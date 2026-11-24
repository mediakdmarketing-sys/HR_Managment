// Concurrency regression tests for recruitment email intake.
// Bug: several backend instances polled the same mailbox at once; each checked for the
// message ID and then created a record, so one email was stored twice.
//
// Two independent copies of recruitmentEmailService (separate module instances, i.e. two
// "backend processes") share one in-memory Firestore with read latency, mimicking network
// round trips. The IMAP client is a fake; nothing touches the network or sends email.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, mock, test } from "node:test";
import { createRecruitmentFirestoreService } from "../services/recruitmentService.js";
import { createFakeFirestore } from "./support/fakeFirestore.js";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  RECRUITMENT_EMAIL_HOST: "imap.example.test",
  RECRUITMENT_EMAIL_USER: "recruiting@example.test",
  RECRUITMENT_EMAIL_PASSWORD: "Fake-Poll-Pass-64",
});

const SENDER = "sender.qa@example.test";
const BODY_EMAIL = "testcandidate.qa@example.test";
const message = ({ withCv }) => Buffer.from([
  "Message-ID: <qa-concurrency-1@example.test>",
  `From: QA Sender <${SENDER}>`,
  "To: recruiting@example.test",
  "Subject: Application for Junior Software Developer",
  "Date: Mon, 23 Nov 2026 20:58:17 +0000",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b"',
  "",
  "--b",
  "Content-Type: text/plain; charset=utf-8",
  "",
  `I am applying for the Junior Software Developer position.\nName: Test Candidate\nEmail: ${BODY_EMAIL}\n`,
  ...(withCv ? [
    "--b",
    'Content-Type: text/plain; name="cv.txt"',
    'Content-Disposition: attachment; filename="cv.txt"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("Test Candidate\nSkills: JavaScript").toString("base64"),
  ] : []),
  "--b--",
  "",
].join("\r\n"));

const imap = { messages: [], constructed: 0 };
class FakeImapFlow {
  constructor() { imap.constructed += 1; this.usable = false; }
  on() { return this; }
  async connect() { await new Promise((r) => setTimeout(r, 10)); this.usable = true; }
  async getMailboxLock() { return { release() {} }; }
  async search() { return imap.messages.map((_, index) => index + 1); }
  async fetchOne(uid) { await new Promise((r) => setTimeout(r, 10)); return { source: imap.messages[uid - 1] }; }
  async logout() { this.usable = false; }
  close() { this.usable = false; }
}

let database;
let instanceA;
let instanceB;
const seed = () => ({
  recruitmentJobs: {
    job1: { title: "Junior Software Developer", normalizedTitle: "junior software developer", status: "Open", createdAt: "2026-01-01T00:00:00.000Z" },
  },
});
const rows = (collection) => Object.values(database.dump(collection));
const quiet = async (work) => {
  const originals = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try { return await work(); } finally { Object.assign(console, originals); }
};

before(async () => {
  database = createFakeFirestore(seed(), { latencyMs: 15 });
  const proxy = new Proxy({}, { get: (_, key) => database[key] });
  const bucket = { file: () => ({ save: async () => {} }) };
  const recruitmentFirestore = createRecruitmentFirestoreService({ database: proxy, bucket });
  mock.module(new URL("../services/recruitmentFirebaseService.js", import.meta.url).href, {
    namedExports: { recruitmentFirestore },
  });
  mock.module("imapflow", { namedExports: { ImapFlow: FakeImapFlow } });
  instanceA = await import("../services/recruitmentEmailService.js?instance=a");
  instanceB = await import("../services/recruitmentEmailService.js?instance=b");
  assert.notEqual(instanceA, instanceB, "the two instances must be separate module copies");
});

beforeEach(() => {
  database = createFakeFirestore(seed(), { latencyMs: 15 });
  imap.constructed = 0;
});

after(() => {
  instanceA.stopEmailPolling();
  instanceB.stopEmailPolling();
});

test("two backend instances polling the same email at once store it once", async () => {
  imap.messages = [message({ withCv: false })];
  const [a, b] = await quiet(() => Promise.all([instanceA.pollRecruitmentEmails(), instanceB.pollRecruitmentEmails()]));
  assert.equal(rows("recruitmentEmailReplies").length, 1, "duplicate inbox records were created");
  assert.equal(a.errorCount + b.errorCount, 0);
  assert.equal(a.processedCount + b.processedCount, 1);
  assert.equal(a.skippedCount + b.skippedCount, 1, "the losing instance must report a duplicate skip");
  const reservation = database.dump("recruitmentUniqueKeys")[
    createHash("sha256").update("email-message:<qa-concurrency-1@example.test>").digest("hex")
  ];
  assert.equal(reservation?.collection, "recruitmentEmailReplies");
});

test("concurrent instances with a CV create one email, candidate, application and resume", async () => {
  imap.messages = [message({ withCv: true })];
  await quiet(() => Promise.all([instanceA.pollRecruitmentEmails(), instanceB.pollRecruitmentEmails()]));
  assert.equal(rows("recruitmentEmailReplies").length, 1);
  assert.equal(rows("recruitmentCandidates").length, 1);
  assert.equal(rows("recruitmentApplications").length, 1);
  assert.equal(rows("recruitmentResumes").length, 1);
  assert.equal(rows("recruitmentEmailReplies")[0].processingStatus, "Processed");
});

test("overlapping polls in one process share a single IMAP session and result", async () => {
  imap.messages = [message({ withCv: false })];
  const results = await quiet(() => Promise.all([
    instanceA.pollRecruitmentEmails(), // interval tick
    instanceA.pollRecruitmentEmails(), // manual sync
    instanceA.pollRecruitmentEmails(), // restart after a settings save
  ]));
  assert.equal(imap.constructed, 1, "a second IMAP session was opened while a poll was running");
  assert.equal(results[0], results[1]);
  assert.equal(results[1], results[2]);
  assert.equal(rows("recruitmentEmailReplies").length, 1);
  // Once finished, the next poll runs normally (and finds the message already stored).
  const next = await quiet(() => instanceA.pollRecruitmentEmails());
  assert.equal(imap.constructed, 2);
  assert.equal(next.skippedCount, 1);
});

test("a record stored before reservations existed is still not duplicated", async () => {
  database.put("recruitmentEmailReplies", "legacy1", {
    providerMessageId: "<qa-concurrency-1@example.test>",
    subject: "Application for Junior Software Developer",
    fromEmail: SENDER,
    createdAt: "2026-11-23T20:59:19.022Z",
  });
  imap.messages = [message({ withCv: false })];
  const result = await quiet(() => instanceA.pollRecruitmentEmails());
  assert.equal(result.skippedCount, 1);
  assert.equal(rows("recruitmentEmailReplies").length, 1);
});

test("business rules: no CV keeps the email in Needs Review with no candidate or application", async () => {
  imap.messages = [message({ withCv: false })];
  await quiet(() => instanceA.pollRecruitmentEmails());
  const [reply] = rows("recruitmentEmailReplies");
  assert.equal(reply.processingStatus, "Needs Review");
  assert.equal(reply.processingNote, "No CV attachment found");
  assert.equal(rows("recruitmentCandidates").length, 0);
  assert.equal(rows("recruitmentApplications").length, 0);
});

test("business rules: with a CV the candidate email is the sender, never an address from the body", async () => {
  imap.messages = [message({ withCv: true })];
  await quiet(() => instanceA.pollRecruitmentEmails());
  const [candidate] = rows("recruitmentCandidates");
  assert.equal(candidate.email, SENDER);
  assert.equal(JSON.stringify(rows("recruitmentCandidates")).includes(BODY_EMAIL), false);
  assert.equal(rows("recruitmentApplications")[0].jobId, "job1");
});

test("stopping polling cancels a start-up poll that has not fired yet (settings save restart)", async () => {
  await instanceB.initializeEmailPolling(); // marks polling initialised (no poll in test mode)
  process.env.NODE_ENV = "development"; // let startEmailPolling schedule its timers
  try {
    imap.messages = [];
    await quiet(async () => {
      instanceB.startEmailPolling();
      instanceB.stopEmailPolling(); // what saveEmailConfig does before restarting
    });
    await new Promise((resolve) => setTimeout(resolve, 2400));
    assert.equal(imap.constructed, 0, "the cancelled start-up poll still ran");

    // Control: without a stop, the start-up poll does run after ~2 seconds.
    await quiet(async () => { instanceB.startEmailPolling(); });
    await new Promise((resolve) => setTimeout(resolve, 2400));
    assert.equal(imap.constructed, 1);
  } finally {
    instanceB.stopEmailPolling();
    process.env.NODE_ENV = "test";
  }
});
