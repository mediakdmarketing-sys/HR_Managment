// Regression tests for Mail Inbox → Reply (POST /api/recruitment/messages/email).
// Bug: SMTP detection and delivery used only the SMTP_* environment variables, so the
// saved, encrypted recruitment SMTP settings were ignored and Reply reported "SMTP email
// delivery is not configured" even after a successful SMTP connection test.
//
// nodemailer is replaced by an in-memory transport: no connection is opened and no email
// is sent. Firestore is in-memory, auth is a pass-through stub, keys are generated per run.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { format } from "node:util";
import { after, before, beforeEach, mock, test } from "node:test";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
process.env.RECRUITMENT_CREDENTIALS_KEY = randomBytes(32).toString("base64");

const USER = "recruiting@example.test";
const SMTP_PASSWORD = "Saved-Smtp-Pass-71";
const ENV_PASSWORD = "Env-Smtp-Pass-82";

// ---- in-memory nodemailer ----
const transport = { created: [], sent: [], failWith: null };
const fakeNodemailer = {
  createTransport(options) {
    transport.created.push(options);
    return {
      async sendMail(message) {
        if (transport.failWith) throw transport.failWith;
        transport.sent.push(message);
        return { messageId: "<fake-1@example.test>" };
      },
      async verify() { return true; },
      close() {},
    };
  },
};

let crypto;
let emailService;
let database;
let baseUrl;
let httpServer;

const savedConfig = (smtpOverrides = {}) => ({
  officialEmail: USER,
  imap: { host: "imap.example.test", port: 993, secure: true, user: USER, password: "Imap-Pass-93", enabled: true },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: USER, password: SMTP_PASSWORD, enabled: true, ...smtpOverrides },
  sync: { enabled: false, pollInterval: 60000 },
});
const useSavedConfig = async (config) => {
  database.put("recruitmentSettings", "cfg1", {
    key: "recruitment_email_config",
    value: crypto.encryptMailConfigSecrets(config),
    createdAt: "2026-11-21T00:00:00.000Z",
  });
  return emailService.loadSavedMailConfig();
};
const call = async (method, path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text, json: text ? JSON.parse(text) : null };
};
const reply = (extra = {}) => call("POST", "/api/recruitment/messages/email", {
  to: "candidate@example.test",
  subject: "Re: Recruitment Test - QA",
  text: "Thank you, we will be in touch.",
  dryRun: false,
  ...extra,
});
const captureConsole = async (work) => {
  const chunks = [];
  const originals = {};
  for (const method of ["log", "info", "warn", "error"]) {
    originals[method] = console[method];
    console[method] = (...args) => { chunks.push(format(...args)); };
  }
  try { return { result: await work(), output: chunks.join("\n") }; }
  finally { Object.assign(console, originals); }
};
const assertNoSecrets = (text, label) => {
  for (const secret of [SMTP_PASSWORD, ENV_PASSWORD, process.env.RECRUITMENT_CREDENTIALS_KEY, "enc:v1:"]) {
    assert.equal(String(text).includes(secret), false, `${label} exposed a secret`);
  }
};

before(async () => {
  // Must be registered before anything imports mailService.js (recruitmentService.js does),
  // so the real nodemailer is never loaded in this test.
  mock.module("nodemailer", { defaultExport: fakeNodemailer });
  crypto = await import("../utils/credentialCrypto.js");
  const { createRecruitmentFirestoreService } = await import("../services/recruitmentService.js");
  const { createFakeFirestore } = await import("./support/fakeFirestore.js");
  database = createFakeFirestore();
  const proxy = new Proxy({}, { get: (_, key) => database[key] });
  const recruitmentFirestore = createRecruitmentFirestoreService({ database: proxy, bucket: {} });

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

  emailService = await import("../services/recruitmentEmailService.js");
  const { default: recruitmentRouter } = await import("../routes/recruitment.route.js");
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/recruitment", recruitmentRouter);
  await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(() => new Promise((resolve) => httpServer.close(resolve)));

beforeEach(async () => {
  const { createFakeFirestore } = await import("./support/fakeFirestore.js");
  database = createFakeFirestore();
  emailService.setDynamicMailConfig(null);
  for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) delete process.env[name];
  Object.assign(transport, { created: [], sent: [], failWith: null });
});

test("without saved or environment SMTP settings, status and reply report not configured", async () => {
  const status = await call("GET", "/api/recruitment/status");
  assert.equal(status.json.data.email, false);
  const response = await reply();
  assert.equal(response.status, 503);
  assert.equal(response.json.code, "CONFIG_REQUIRED");
  assert.equal(transport.created.length, 0);
});

test("saved encrypted SMTP settings are detected (the reported bug)", async () => {
  const loaded = await useSavedConfig(savedConfig());
  assert.equal(loaded.storage.smtp, "encrypted");
  assert.ok(crypto.isEncryptedSecret(database.dump("recruitmentSettings").cfg1.value.smtp.password));
  const status = await call("GET", "/api/recruitment/status");
  assert.equal(status.json.data.email, true, "status.email ignored the saved SMTP settings");
  assertNoSecrets(status.text, "status response");
});

test("a reply is delivered through the saved SMTP account with the decrypted password and TLS", async () => {
  await useSavedConfig(savedConfig());
  const response = await reply();
  assert.equal(response.status, 200, response.json?.message);
  assert.deepEqual(response.json.data, { delivered: true });
  assertNoSecrets(response.text, "reply response");

  assert.equal(transport.created.length, 1);
  const [options] = transport.created;
  assert.equal(options.host, "smtp.example.test");
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.tls.rejectUnauthorized, true);
  assert.equal(options.tls.minVersion, "TLSv1.2");
  assert.equal(options.logger, false);
  assert.equal(options.debug, false);
  assert.equal(options.auth.user, USER);
  assert.equal(options.auth.pass === SMTP_PASSWORD, true, "transport did not get the decrypted saved password");

  const [message] = transport.sent;
  assert.equal(message.to, "candidate@example.test");
  assert.equal(message.subject, "Re: Recruitment Test - QA");
  assert.equal(message.text, "Thank you, we will be in touch.");
  assert.match(message.from, /<recruiting@example\.test>$/);

  const [send] = Object.values(database.dump("recruitmentBulkSends"));
  assert.equal(send.status, "Delivered");
  const [recipient] = Object.values(database.dump("recruitmentBulkSendRecipients"));
  assert.equal(recipient.status, "Delivered");
});

test("STARTTLS port uses mandatory STARTTLS, never plaintext", async () => {
  await useSavedConfig(savedConfig({ port: 587, secure: false }));
  assert.equal((await reply()).status, 200);
  const [options] = transport.created;
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.equal(options.tls.rejectUnauthorized, true);
});

test("disabled SMTP or an unreadable saved password is reported as not configured", async () => {
  await useSavedConfig(savedConfig({ enabled: false }));
  assert.equal((await call("GET", "/api/recruitment/status")).json.data.email, false);
  assert.equal((await reply()).status, 503);

  database.put("recruitmentSettings", "cfg1", {
    key: "recruitment_email_config",
    value: crypto.encryptMailConfigSecrets(savedConfig(), randomBytes(32)), // another key
    createdAt: "2026-11-21T00:00:00.000Z",
  });
  const { captured } = { captured: await captureConsole(() => emailService.loadSavedMailConfig()) };
  assert.equal(captured.result.storage.smtp, "unreadable");
  assert.equal((await call("GET", "/api/recruitment/status")).json.data.email, false);
  assert.equal((await reply()).status, 503);
  assert.equal(transport.created.length, 0);
});

test("the environment SMTP password is never combined with a different saved server", async () => {
  Object.assign(process.env, { SMTP_HOST: "env-smtp.example.test", SMTP_PORT: "465", SMTP_USER: "env@example.test", SMTP_PASS: ENV_PASSWORD });
  await useSavedConfig(savedConfig({ password: "" }));
  assert.equal(emailService.isRecruitmentSmtpConfigured(), false);
  assert.equal((await reply()).status, 503);
  assert.equal(transport.created.length, 0);
});

test("environment SMTP settings still work when no SMTP server has been saved", async () => {
  Object.assign(process.env, { SMTP_HOST: "env-smtp.example.test", SMTP_PORT: "465", SMTP_USER: "env@example.test", SMTP_PASS: ENV_PASSWORD });
  assert.equal((await call("GET", "/api/recruitment/status")).json.data.email, true);
  assert.equal((await reply()).status, 200);
  assert.equal(transport.created[0].host, "env-smtp.example.test");
  assert.equal(transport.created[0].auth.pass === ENV_PASSWORD, true);
});

test("a provider failure returns a generic error and never leaks the password", async () => {
  await useSavedConfig(savedConfig());
  const b64 = Buffer.from(`\u0000${USER}\u0000${SMTP_PASSWORD}`).toString("base64");
  transport.failWith = Object.assign(new Error(`535 Authentication failed for ${SMTP_PASSWORD} (${b64})`), { code: "EAUTH" });
  const { result: response, output } = await captureConsole(() => reply());
  assert.equal(response.status, 502);
  assert.equal(response.json.message, "Email provider delivery failed");
  assertNoSecrets(response.text, "failure response");
  assertNoSecrets(output, "server log");
  assert.equal(output.includes(b64), false, "encoded credential logged");
  assert.match(output, /Recruitment email delivery failed/);
  const [send] = Object.values(database.dump("recruitmentBulkSends"));
  assert.equal(send.status, "Failed");
});

test("dry-run replies never create an SMTP transport", async () => {
  await useSavedConfig(savedConfig());
  const response = await reply({ dryRun: true });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.dryRun, true);
  assert.equal(transport.created.length, 0);
});
