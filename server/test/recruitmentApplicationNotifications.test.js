// Regression tests: every new application raises exactly one Hiring Alert, visible both in
// Recruitment → Hiring Alerts (GET /api/recruitment/data/recruitmentNotifications) and in the
// main HRMS Notifications (GET /api/notifications).
// Bugs: (1) the only alert was raised by email intake and only after a CV was stored, so an
// application whose CV upload failed (or any manual application) produced no alert at all;
// (2) the intake created the application before storing the CV, leaving an application
// without a CV.
//
// In-memory Firestore and Storage, fake IMAP client, stubbed auth/leave/birthday services.
// No network, no email, no real records.
import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";
import { createRecruitmentFirestoreService } from "../services/recruitmentService.js";
import { createFakeFirestore } from "./support/fakeFirestore.js";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  RECRUITMENT_EMAIL_HOST: "imap.example.test",
  RECRUITMENT_EMAIL_USER: "recruiting@example.test",
  RECRUITMENT_EMAIL_PASSWORD: "Fake-Poll-Pass-27",
});

const mime = ({ id, from, subject, cv = true }) => Buffer.from([
  `Message-ID: <${id}@example.test>`, `From: ${from}`, "To: recruiting@example.test",
  `Subject: ${subject}`, "Date: Tue, 24 Nov 2026 12:37:00 +0000", "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b"', "", "--b", "Content-Type: text/plain; charset=utf-8", "",
  "Please find my CV attached.",
  ...(cv ? ["--b", 'Content-Type: text/plain; name="cv.txt"', 'Content-Disposition: attachment; filename="cv.txt"',
    "Content-Transfer-Encoding: base64", "", Buffer.from("Applicant\nSkills: JavaScript").toString("base64")] : []),
  "--b--", "",
].join("\r\n"));

const imap = { messages: [] };
class FakeImapFlow {
  constructor() { this.usable = false; }
  on() { return this; }
  async connect() { this.usable = true; }
  async getMailboxLock() { return { release() {} }; }
  async search() { return imap.messages.map((_, i) => i + 1); }
  async fetchOne(uid) { return { source: imap.messages[uid - 1] }; }
  async logout() {}
  close() {}
}

const storage = { fail: false };
let database;
let emailService;
let baseUrl;
let httpServer;
let role = "HR";

const seed = () => ({
  recruitmentJobs: {
    job1: { title: "Junior Software Developer", normalizedTitle: "junior software developer", status: "Open", createdAt: "2026-01-01T00:00:00.000Z" },
  },
  recruitmentCandidates: {
    cand1: { name: "Manual Candidate", email: "manual.candidate@example.test", status: "New", createdAt: "2026-01-02T00:00:00.000Z" },
  },
});
const rows = (collection) => Object.values(database.dump(collection));
const notificationsFor = (applicationId) => rows("recruitmentNotifications").filter((n) => n.applicationId === applicationId);
const call = async (method, path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
};
const quiet = async (work) => {
  const originals = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try { return await work(); } finally { Object.assign(console, originals); }
};
const poll = (...messages) => { imap.messages = messages; return quiet(() => emailService.pollRecruitmentEmails()); };

before(async () => {
  database = createFakeFirestore(seed());
  const proxy = new Proxy({}, { get: (_, key) => database[key] });
  const bucket = {
    file: () => ({
      save: async () => {
        if (storage.fail) throw Object.assign(new Error("The specified bucket does not exist."), { code: 404 });
      },
    }),
  };
  const recruitmentFirestore = createRecruitmentFirestoreService({ database: proxy, bucket });

  const stubAuth = (req, res, next) => {
    req.user = { uid: "user-test", id: "user-test", role, status: "Active" };
    next();
  };
  mock.module(new URL("../middleware/authMiddleware.js", import.meta.url).href, {
    defaultExport: stubAuth,
    namedExports: { verifyToken: stubAuth },
  });
  mock.module(new URL("../services/recruitmentFirebaseService.js", import.meta.url).href, {
    namedExports: { recruitmentFirestore },
  });
  // The main notifications controller also reads HRMS (leave) notifications; stub them.
  mock.module(new URL("../services/leaveService.js", import.meta.url).href, {
    namedExports: {
      getNotifications: async () => [{ id: "hrms1", title: "Leave approved", isRead: false, createdAt: "2026-11-01T00:00:00.000Z" }],
      markNotificationRead: async () => {},
      markAllNotificationsRead: async () => {},
    },
  });
  mock.module(new URL("../services/birthdayService.js", import.meta.url).href, {
    namedExports: { ensureBirthdayReminders: async () => {} },
  });
  mock.module("imapflow", { namedExports: { ImapFlow: FakeImapFlow } });

  emailService = await import("../services/recruitmentEmailService.js");
  const { default: recruitmentRouter } = await import("../routes/recruitment.route.js");
  const { default: notificationRouter } = await import("../routes/notification.route.js");
  const app = express();
  app.use(express.json());
  app.use("/api/recruitment", recruitmentRouter);
  app.use("/api/notifications", notificationRouter);
  await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(() => new Promise((resolve) => httpServer.close(resolve)));

beforeEach(() => {
  database = createFakeFirestore(seed());
  storage.fail = false;
  role = "HR";
});

test("a manual application creates exactly one Hiring Alert", async () => {
  const created = await call("POST", "/api/recruitment/data/recruitmentApplications", {
    candidateId: "cand1", jobId: "job1", status: "To Be Reviewed", source: "Manual",
  });
  assert.equal(created.status, 201, created.json?.message);
  const alerts = notificationsFor(created.json.data.id);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, "new_application");
  assert.equal(alerts[0].category, "application");
  assert.equal(alerts[0].candidateId, "cand1");
  assert.equal(alerts[0].jobId, "job1");
  assert.equal(alerts[0].entityId, created.json.data.id);
  assert.equal(alerts[0].isRead, false);
  assert.equal(alerts[0].message, "Manual Candidate applied for Junior Software Developer");
});

test("Hiring Alerts and main HRMS Notifications both return the alert", async () => {
  const created = await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "job1" });
  const applicationId = created.json.data.id;

  const hiringAlerts = await call("GET", "/api/recruitment/data/recruitmentNotifications");
  assert.equal(hiringAlerts.status, 200);
  assert.equal(hiringAlerts.json.data.filter((n) => n.applicationId === applicationId).length, 1);

  const main = await call("GET", "/api/notifications");
  assert.equal(main.status, 200);
  const recruitment = main.json.data.filter((n) => n.source === "recruitment");
  assert.equal(recruitment.length, 1);
  assert.equal(recruitment[0].applicationId, applicationId);
  assert.match(recruitment[0].id, /^recruitment:/);
  assert.equal(recruitment[0].isRead, false);
  assert.equal(main.json.data.filter((n) => n.source === "hrms").length, 1, "HRMS notifications still included");
});

test("marking the alert read in main Notifications is reflected in Hiring Alerts", async () => {
  const created = await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "job1" });
  const [alert] = notificationsFor(created.json.data.id);
  const notificationId = Object.entries(database.dump("recruitmentNotifications")).find(([, n]) => n === alert || n.applicationId === alert.applicationId)[0];
  const read = await call("PATCH", `/api/notifications/recruitment:${notificationId}/read`);
  assert.equal(read.status, 200);
  const stored = database.dump("recruitmentNotifications")[notificationId];
  assert.equal(stored.isRead, true);
  assert.equal(stored.is_read, true, "Hiring Alerts unread count also checks is_read");
});

test("a duplicate or invalid application creates no extra alert", async () => {
  const first = await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "job1" });
  assert.equal(first.status, 201);
  const duplicate = await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "job1" });
  assert.equal(duplicate.status, 409);
  const missingJob = await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "nope" });
  assert.equal(missingJob.status, 400);
  assert.equal(rows("recruitmentNotifications").length, 1);
});

test("an email-created application raises one alert, with no duplicate CV alert", async () => {
  const result = await poll(mime({ id: "e1", from: "Email Applicant <email.applicant@example.test>", subject: "Application for Junior Software Developer" }));
  assert.equal(result.errorCount, 0);
  const [application] = rows("recruitmentApplications");
  assert.ok(application, "application was not created");
  assert.equal(application.jobId, "job1");
  assert.equal(rows("recruitmentResumes").length, 1);
  assert.equal(rows("recruitmentResumes")[0].applicationId !== undefined, true);

  const alerts = rows("recruitmentNotifications");
  assert.equal(alerts.length, 1, `expected one alert, got ${alerts.map((n) => n.type).join(", ")}`);
  assert.equal(alerts[0].type, "new_application");
  assert.match(alerts[0].message, /Email Applicant applied for Junior Software Developer via email/);
  assert.equal(rows("recruitmentEmailReplies")[0].processingStatus, "Processed");

  const main = await call("GET", "/api/notifications");
  assert.equal(main.json.data.filter((n) => n.source === "recruitment").length, 1);

  // Polling again never adds a second application or alert.
  await poll(mime({ id: "e1", from: "Email Applicant <email.applicant@example.test>", subject: "Application for Junior Software Developer" }));
  assert.equal(rows("recruitmentApplications").length, 1);
  assert.equal(rows("recruitmentNotifications").length, 1);
});

test("if the CV cannot be stored, no application or new candidate is created", async () => {
  storage.fail = true; // e.g. the configured Storage bucket does not exist
  const result = await poll(mime({ id: "e2", from: "Storage Fail <storage.fail@example.test>", subject: "Application for Junior Software Developer" }));
  assert.equal(result.errorCount, 0);
  const [reply] = rows("recruitmentEmailReplies");
  assert.equal(reply.processingStatus, "Needs Review");
  assert.equal(reply.processingNote, "CV could not be stored");
  assert.equal(reply.applicationId, null);
  assert.equal(rows("recruitmentApplications").length, 0, "application created without a stored CV");
  assert.equal(rows("recruitmentCandidates").length, 1, "candidate created without a stored CV was not rolled back");
});

test("a CV failure from an existing candidate keeps that candidate", async () => {
  storage.fail = true;
  await poll(mime({ id: "e3", from: "Manual Candidate <manual.candidate@example.test>", subject: "Application for Junior Software Developer" }));
  assert.ok(database.dump("recruitmentCandidates").cand1, "existing candidate was removed");
  assert.equal(rows("recruitmentEmailReplies")[0].candidateId, "cand1");
  assert.equal(rows("recruitmentApplications").length, 0);
});

test("a stored CV with no matching job raises one CV alert and no application", async () => {
  await poll(mime({ id: "e4", from: "No Match <no.match@example.test>", subject: "Application for Astronaut" }));
  assert.equal(rows("recruitmentApplications").length, 0);
  const alerts = rows("recruitmentNotifications");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, "new_cv");
  assert.equal(rows("recruitmentEmailReplies")[0].processingStatus, "Needs Review");
});

test("recruitment alerts in main Notifications are limited to HR users", async () => {
  await call("POST", "/api/recruitment/data/recruitmentApplications", { candidateId: "cand1", jobId: "job1" });
  const notificationId = Object.keys(database.dump("recruitmentNotifications"))[0];
  role = "Employee";
  const main = await call("GET", "/api/notifications");
  assert.equal(main.status, 200);
  assert.equal(main.json.data.filter((n) => n.source === "recruitment").length, 0);
  const read = await call("PATCH", `/api/notifications/recruitment:${notificationId}/read`);
  assert.equal(read.status, 403);
  assert.equal(database.dump("recruitmentNotifications")[notificationId].isRead, false);
});
