// End-to-end regression tests for the Recruitment → Mail Inbox data flow:
//   IMAP fetch → mailparser → classification → intake validation → Firestore →
//   GET /api/recruitment/data/recruitmentEmailReplies (the endpoint the Mail Inbox calls).
// Only three things are substituted: the IMAP client (an in-process fake serving fixed
// synthetic messages; nothing touches the network), Firestore/Storage (in-memory), and
// authentication (pass-through). Parsing, classification, validation, the poll loop and
// the HTTP route are the real code. No real mailbox, credentials, emails or records.
import assert from "node:assert/strict";
import { format } from "node:util";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";
import { createRecruitmentFirestoreService } from "../services/recruitmentService.js";
import { secretVariants } from "../utils/mailSecurity.js";
import { createFakeFirestore } from "./support/fakeFirestore.js";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
const MAILBOX_USER = "recruiting@example.test";
const MAILBOX_PASSWORD = "Fake-Poll-Pass-55";
process.env.RECRUITMENT_EMAIL_HOST = "imap.example.test";
process.env.RECRUITMENT_EMAIL_USER = MAILBOX_USER;
process.env.RECRUITMENT_EMAIL_PASSWORD = MAILBOX_PASSWORD;

// ---------- synthetic messages ----------
const mime = ({ id, from, subject, text, html, attachments = [], date = "Mon, 23 Nov 2026 09:00:00 +0000" }) => {
  const headers = [
    `Message-ID: <${id}@example.test>`,
    `From: ${from}`,
    `To: ${MAILBOX_USER}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
  ];
  const parts = [];
  if (text !== undefined) parts.push(`Content-Type: text/plain; charset=utf-8\r\n\r\n${text}`);
  if (html !== undefined) parts.push(`Content-Type: text/html; charset=utf-8\r\n\r\n${html}`);
  for (const file of attachments) {
    parts.push([
      `Content-Type: ${file.contentType}; name="${file.filename}"`,
      `Content-Disposition: ${file.inline ? "inline" : "attachment"}; filename="${file.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(file.content).toString("base64"),
    ].join("\r\n"));
  }
  const boundary = "fixture-boundary";
  return Buffer.from([
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    ...parts.map((part) => `--${boundary}\r\n${part}`),
    `--${boundary}--`,
    "",
  ].join("\r\n"));
};

const CV_TEXT = "Jane Applicant\nSkills: JavaScript, React, Node.js\nExperience: 5 years building web apps.";
const MESSAGES = {
  application: mime({
    id: "app-1", from: "Jane Applicant <jane.applicant@example.test>",
    subject: "Application for Software Developer",
    text: "Hello, please find my CV attached.",
    attachments: [{ filename: "jane_cv.txt", contentType: "text/plain", content: CV_TEXT }],
  }),
  candidateReply: mime({
    id: "reply-1", from: "Known Candidate <known.candidate@example.test>",
    subject: "Re: Next steps",
    text: "Tuesday at 10am works for me. Thank you!\n\nOn Mon, 23 Nov 2026 HR wrote:\n> Are you free on Tuesday?",
  }),
  htmlOnly: mime({
    id: "html-1", from: "Html Sender <html.sender@example.test>",
    subject: "Hello",
    html: "<html><body><p>I would like to <b>apply</b> for the Designer vacancy.</p></body></html>",
  }),
  newsletter: mime({
    id: "news-1", from: "Shop <news@shop.example.test>",
    subject: "Weekly digest",
    text: "Big sale this week on everything.",
    attachments: [{ filename: "logo.png", contentType: "image/png", content: "\x89PNG fake", inline: true }],
  }),
  noJobMatch: mime({
    id: "nojob-1", from: "Sam Seeker <sam.seeker@example.test>",
    subject: "My resume",
    text: "Attached is my resume for any suitable role.",
    attachments: [{ filename: "sam_resume.txt", contentType: "text/plain", content: "Sam Seeker\nAccountant, 3 years." }],
  }),
  largeBody: mime({
    id: "large-1", from: "Long Writer <long.writer@example.test>",
    subject: "Job application",
    text: `I am applying for a position. ${"Lorem ipsum dolor sit amet. ".repeat(12000)}`,
  }),
};

// ---------- fake IMAP client ----------
const imapState = { messages: [], constructed: [] };
class FakeImapFlow {
  constructor(options) {
    imapState.constructed.push(options);
    this.usable = false;
  }
  on() { return this; }
  async connect() { this.usable = true; }
  async getMailboxLock() { return { release() {} }; }
  async search() { return imapState.messages.map((_, index) => index + 1); }
  async fetchOne(uid) { return { uid, source: imapState.messages[uid - 1] }; }
  async logout() { this.usable = false; }
  close() { this.usable = false; }
}

// ---------- harness ----------
let database;
let storedFiles;
let emailService;
let baseUrl;
let httpServer;

const seed = () => ({
  recruitmentJobs: {
    job1: { title: "Software Developer", normalizedTitle: "software developer", status: "Open", createdAt: "2026-01-01T00:00:00.000Z" },
  },
  recruitmentCandidates: {
    cand1: { name: "Known Candidate", email: "known.candidate@example.test", status: "New", createdAt: "2026-01-02T00:00:00.000Z" },
  },
});

const captureOutput = async (work) => {
  const chunks = [];
  const originals = {};
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    originals[method] = console[method];
    console[method] = (...args) => { chunks.push(format(...args)); };
  }
  try {
    return { result: await work(), output: chunks.join("\n") };
  } finally {
    Object.assign(console, originals);
  }
};

const poll = async (...names) => {
  imapState.messages = names.map((name) => MESSAGES[name]);
  return captureOutput(() => emailService.pollRecruitmentEmails());
};

const inbox = async () => {
  const response = await fetch(`${baseUrl}/api/recruitment/data/recruitmentEmailReplies`);
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
};

const values = (collection) => Object.values(database.dump(collection));
const replyFrom = (address) => values("recruitmentEmailReplies").find((row) => row.fromEmail === address);

before(async () => {
  database = createFakeFirestore(seed());
  storedFiles = new Map();
  const bucket = { file: (path) => ({ save: async (bytes) => { storedFiles.set(path, bytes); } }) };
  // The service reads `database` through this proxy so each test can start from a fresh seed.
  const proxy = new Proxy({}, { get: (_, key) => database[key] });
  const recruitmentFirestore = createRecruitmentFirestoreService({ database: proxy, bucket });

  const passThroughAuth = (req, res, next) => {
    req.user = { uid: "hr-test", id: "hr-test", role: "HR", status: "Active" };
    next();
  };
  mock.module(new URL("../middleware/authMiddleware.js", import.meta.url).href, {
    defaultExport: passThroughAuth,
    namedExports: { verifyToken: passThroughAuth },
  });
  mock.module(new URL("../services/recruitmentFirebaseService.js", import.meta.url).href, {
    namedExports: { recruitmentFirestore },
  });
  mock.module("imapflow", { namedExports: { ImapFlow: FakeImapFlow } });

  emailService = await import("../services/recruitmentEmailService.js");
  const { default: recruitmentRouter } = await import("../routes/recruitment.route.js");
  const app = express();
  app.use(express.json());
  app.use("/api/recruitment", recruitmentRouter);
  await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(() => new Promise((resolve) => httpServer.close(resolve)));

beforeEach(() => {
  database = createFakeFirestore(seed());
  storedFiles.clear();
  imapState.constructed = [];
});

// ---------- tests ----------
test("a CV application email flows from IMAP to Firestore to the Mail Inbox API", async () => {
  const { result, output } = await poll("application");
  assert.equal(result.errorCount, 0, `poll reported errors: ${result.error}\n${output}`);
  assert.equal(result.processedCount, 1);

  const reply = replyFrom("jane.applicant@example.test");
  assert.ok(reply, "email was not stored in recruitmentEmailReplies");
  assert.equal(reply.subject, "Application for Software Developer");
  assert.equal(reply.processingStatus, "Processed");
  assert.equal(reply.providerMessageId, "<app-1@example.test>");

  const [candidate] = values("recruitmentCandidates").filter((row) => row.email === "jane.applicant@example.test");
  assert.ok(candidate, "candidate was not created");
  const [application] = values("recruitmentApplications");
  assert.equal(application.jobId, "job1");
  assert.equal(application.source, "Email");
  const resumes = values("recruitmentResumes");
  assert.equal(resumes.length, 1, "exactly one resume record per CV");
  assert.equal(resumes[0].applicationId, Object.keys(database.dump("recruitmentApplications"))[0]);
  assert.equal(resumes[0].jobId, "job1");
  assert.ok(resumes[0].extractedText.includes("JavaScript"));
  assert.equal(storedFiles.size, 1, "CV file was not stored");
  const [aiRequest] = values("recruitmentAiResults");
  assert.equal(aiRequest?.status, "Pending", "AI analysis request was not queued");
  // One Hiring Alert per application, raised when the application is created.
  const notifications = values("recruitmentNotifications");
  assert.equal(notifications.length, 1, "expected exactly one alert for the new application");
  assert.equal(notifications[0].type, "new_application");
  assert.equal(reply.candidateId, Object.keys(database.dump("recruitmentCandidates")).find((id) => id !== "cand1"));

  const response = await inbox();
  assert.equal(response.status, 200);
  assert.equal(response.json.success, true);
  assert.equal(response.json.data.length, 1);
  assert.equal(response.json.data[0].subject, "Application for Software Developer");
  assert.equal(response.json.data[0].fromEmail, "jane.applicant@example.test");
  assert.match(response.json.data[0].body, /CV attached/);
});

test("a plain reply from a known candidate is shown in the inbox (no recruitment keywords)", async () => {
  const { result, output } = await poll("candidateReply");
  assert.equal(result.errorCount, 0, output);
  const reply = replyFrom("known.candidate@example.test");
  assert.ok(reply, "candidate reply was skipped as not-recruitment");
  assert.equal(reply.candidateId, "cand1");
  assert.equal(reply.body, "Tuesday at 10am works for me. Thank you!", "quoted text must be stripped");
  assert.equal(values("recruitmentCandidates").length, 1, "no new candidate for a reply");
  assert.equal((await inbox()).json.data.length, 1);
});

test("an HTML-only recruitment email is classified using its HTML body", async () => {
  const { result, output } = await poll("htmlOnly");
  assert.equal(result.errorCount, 0, output);
  const reply = replyFrom("html.sender@example.test");
  assert.ok(reply, "HTML-only email was skipped");
  assert.match(reply.body, /apply for the Designer vacancy/);
  assert.doesNotMatch(reply.body, /<p>|<b>/, "stored body must be text, not markup");
  assert.equal(reply.processingStatus, "Needs Review");
});

test("a newsletter with only an inline image is not treated as a recruitment email", async () => {
  const { result } = await poll("newsletter");
  assert.equal(result.skippedCount, 1);
  assert.equal(values("recruitmentEmailReplies").length, 0);
  assert.equal(values("recruitmentCandidates").length, 1);
});

test("a CV with no matching open job is kept for review instead of failing", async () => {
  const { result, output } = await poll("noJobMatch");
  assert.equal(result.errorCount, 0, `intake failed: ${result.error}\n${output}`);
  const reply = replyFrom("sam.seeker@example.test");
  assert.ok(reply, "email was not stored");
  assert.equal(reply.processingStatus, "Needs Review");
  const candidate = values("recruitmentCandidates").find((row) => row.email === "sam.seeker@example.test");
  assert.ok(candidate, "candidate was not created");
  assert.equal(values("recruitmentApplications").length, 0, "no application without a job");
  const [resume] = values("recruitmentResumes");
  assert.ok(resume, "CV was not stored");
  assert.equal(reply.candidateId, Object.entries(database.dump("recruitmentCandidates")).find(([, row]) => row.email === "sam.seeker@example.test")[0]);
});

test("an email with a very large body is stored with a truncated body", async () => {
  const { result, output } = await poll("largeBody");
  assert.equal(result.errorCount, 0, output);
  const reply = replyFrom("long.writer@example.test");
  assert.ok(reply, "large email was not stored");
  assert.ok(reply.body.length <= 20_000);
});

test("polling the same messages twice does not duplicate inbox records", async () => {
  await poll("application", "candidateReply");
  const { result } = await poll("application", "candidateReply");
  assert.equal(result.processedCount, 0);
  assert.equal(result.skippedCount, 2);
  assert.equal(values("recruitmentEmailReplies").length, 2);
  assert.equal(values("recruitmentResumes").length, 1);
  assert.equal(values("recruitmentApplications").length, 1);
});

test("the inbox API returns newest mail first, and Mark read works", async () => {
  database.put("recruitmentEmailReplies", "old", { subject: "Older", fromEmail: "a@example.test", body: "x", receivedAt: "2026-11-01T00:00:00.000Z", createdAt: "2026-11-01T00:00:00.000Z" });
  database.put("recruitmentEmailReplies", "new", { subject: "Newer", fromEmail: "b@example.test", body: "y", receivedAt: "2026-11-20T00:00:00.000Z", createdAt: "2026-11-20T00:00:00.000Z" });
  const response = await inbox();
  assert.deepEqual(response.json.data.map((row) => row.id), ["new", "old"]);

  const patch = await fetch(`${baseUrl}/api/recruitment/data/recruitmentEmailReplies/old`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }),
  });
  assert.equal(patch.status, 200);
  assert.equal(database.dump("recruitmentEmailReplies").old.isRead, true);
});

test("intake-only fields cannot be written through the generic HR data API", async () => {
  database.put("recruitmentEmailReplies", "r1", { subject: "S", fromEmail: "a@example.test", body: "x", createdAt: "2026-11-01T00:00:00.000Z" });
  for (const payload of [{ providerMessageId: "spoof" }, { processingStatus: "Processed" }]) {
    const response = await fetch(`${baseUrl}/api/recruitment/data/recruitmentEmailReplies/r1`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400, `generic API accepted ${Object.keys(payload)[0]}`);
  }
  const created = await fetch(`${baseUrl}/api/recruitment/data/recruitmentNotifications`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "x", title: "x", message: "x", resumeId: "r" }),
  });
  assert.equal(created.status, 400);
});

test("the poll uses TLS options and never writes the mailbox password anywhere", async () => {
  const { output } = await poll("application", "candidateReply", "htmlOnly", "noJobMatch");
  assert.equal(imapState.constructed.length, 1);
  assert.equal(imapState.constructed[0].secure, true);
  assert.equal(imapState.constructed[0].tls.rejectUnauthorized, true);
  assert.equal(imapState.constructed[0].logger, false);
  const everything = [
    output,
    JSON.stringify(Object.fromEntries(["recruitmentEmailReplies", "recruitmentCandidates", "recruitmentResumes",
      "recruitmentApplications", "recruitmentNotifications", "recruitmentAiResults", "recruitmentSettings"]
      .map((name) => [name, database.dump(name)]))),
    (await inbox()).text,
  ].join("\n");
  for (const variant of secretVariants({ user: MAILBOX_USER, password: MAILBOX_PASSWORD })) {
    assert.equal(everything.includes(variant), false, `mailbox password leaked: ${variant}`);
  }
  // Logs carry identifiers and counts only, never message bodies.
  assert.equal(output.includes("Tuesday at 10am"), false, "email body content was logged");
  assert.equal(output.includes("Lorem ipsum"), false);
});
