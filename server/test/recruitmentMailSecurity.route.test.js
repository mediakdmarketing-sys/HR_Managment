// Route-level regression tests for recruitment mailbox credential handling.
// The real recruitment router is loaded with two substitutions only: authentication is a
// pass-through stub and Firestore is in-memory. Mail "servers" are loopback fakes; no
// real credentials, external hosts, emails or Firestore records are involved. The
// encryption key is generated per run.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { format } from "node:util";
import { after, before, mock, test } from "node:test";
import express from "express";
import { createRecruitmentFirestoreService } from "../services/recruitmentService.js";
import { encryptMailConfigSecrets, isEncryptedSecret, decryptMailConfigSecrets } from "../utils/credentialCrypto.js";
import { secretVariants } from "../utils/mailSecurity.js";
import { createFakeFirestore } from "./support/fakeFirestore.js";
import { createFakeImapServer, createFakeSmtpServer } from "./support/fakeMailServers.js";
import { getTestCertificate } from "./support/testCertificate.js";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
const TEST_KEY = randomBytes(32).toString("base64");
process.env.RECRUITMENT_CREDENTIALS_KEY = TEST_KEY;

const SAVED_USER = "recruiting@saved.test";
const IMAP_PASSWORD = "Saved-Imap-Pass-91";
const SMTP_PASSWORD = "Saved-Smtp-Pass-37";
const SAVED_CREDENTIALS = [
  { user: SAVED_USER, password: IMAP_PASSWORD },
  { user: SAVED_USER, password: SMTP_PASSWORD },
];

const certificate = getTestCertificate();
const skipTls = certificate ? false : "openssl is not available to create a test certificate";

// Saved mailbox: direct-TLS IMAP and STARTTLS SMTP. Falls back to plaintext fakes when no
// certificate can be created (TLS-dependent tests are then skipped).
const savedImapServer = createFakeImapServer(certificate ? { tls: certificate } : {});
const savedSmtpServer = createFakeSmtpServer(certificate ? { tls: certificate } : {});
const attackerImapServer = createFakeImapServer();
const attackerSmtpServer = createFakeSmtpServer();

let savedConfig;
let database;
let baseUrl;
let httpServer;
let emailService;

const assertNoSecrets = (text, label, credentials = SAVED_CREDENTIALS) => {
  for (const credential of credentials) {
    for (const variant of secretVariants(credential)) {
      assert.equal(String(text).includes(variant), false, `${label} leaked a credential form: ${variant}`);
    }
  }
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

// Records everything written to the console/stdout/stderr while `work` runs.
const captureOutput = async (work) => {
  const chunks = [];
  const originals = {};
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    originals[method] = console[method];
    console[method] = (...args) => { chunks.push(format(...args)); };
  }
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = function (chunk, ...rest) { chunks.push(String(chunk)); return stdoutWrite.call(this, chunk, ...rest); };
  process.stderr.write = function (chunk, ...rest) { chunks.push(String(chunk)); return stderrWrite.call(this, chunk, ...rest); };
  try {
    const result = await work();
    return { result, output: chunks.join("\n") };
  } finally {
    Object.assign(console, originals);
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
};

const storedConfig = () => database.dump("recruitmentSettings").cfg1.value;
const restoreSavedConfig = async () => {
  process.env.RECRUITMENT_CREDENTIALS_KEY = TEST_KEY;
  database.put("recruitmentSettings", "cfg1", {
    key: "recruitment_email_config",
    value: encryptMailConfigSecrets(savedConfig),
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  await emailService.loadSavedMailConfig();
};

before(async () => {
  await savedImapServer.start("::");
  await savedSmtpServer.start("::");
  await attackerImapServer.start("127.0.0.1");
  await attackerSmtpServer.start("127.0.0.1");

  savedConfig = {
    officialEmail: SAVED_USER,
    imap: { host: "localhost", port: savedImapServer.port, secure: true, user: SAVED_USER, password: IMAP_PASSWORD, enabled: true },
    smtp: { host: "localhost", port: savedSmtpServer.port, secure: false, user: SAVED_USER, password: SMTP_PASSWORD, enabled: true },
    sync: { enabled: false, pollInterval: 60000 },
  };
  database = createFakeFirestore({
    recruitmentSettings: {
      cfg1: { key: "recruitment_email_config", value: encryptMailConfigSecrets(savedConfig), createdAt: "2026-01-01T00:00:00.000Z" },
      sync1: { key: "email_sync_status", value: { syncStatus: "Never Run" }, createdAt: "2026-01-01T00:00:00.000Z" },
    },
  });
  const recruitmentFirestore = createRecruitmentFirestoreService({ database, bucket: {} });

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
  const loaded = await emailService.loadSavedMailConfig();
  assert.deepEqual(loaded.storage, { imap: "encrypted", smtp: "encrypted" });

  const app = express();
  app.use(express.json());
  app.use("/api/recruitment", recruitmentRouter);
  await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/recruitment`;
});

after(async () => {
  httpServer?.closeAllConnections();
  await new Promise((resolve) => (httpServer ? httpServer.close(resolve) : resolve()));
  await Promise.all([savedImapServer, savedSmtpServer, attackerImapServer, attackerSmtpServer].map((server) => server.stop()));
});

test("stored mailbox passwords are encrypted at rest", () => {
  const stored = storedConfig();
  assert.ok(isEncryptedSecret(stored.imap.password));
  assert.ok(isEncryptedSecret(stored.smtp.password));
  assertNoSecrets(JSON.stringify(stored), "stored settings");
});

test("GET /data/settings and /data/recruitmentSettings/:id never return mailbox passwords or ciphertext", async () => {
  for (const path of ["/data/settings", "/data/recruitmentSettings", "/data/settings?search=Saved", "/data/recruitmentSettings/cfg1", "/data/settings/cfg1"]) {
    const response = await call("GET", path);
    assert.equal(response.status, 200, path);
    assertNoSecrets(response.text, path);
    assert.equal(response.text.includes("enc:v1:"), false, `${path} returned ciphertext`);
  }
  const list = await call("GET", "/data/settings");
  const config = list.json.data.find((row) => row.key === "recruitment_email_config");
  assert.equal(config.value.imap.host, "localhost", "non-secret settings remain visible");
  assert.equal(config.value.smtp.user, SAVED_USER);
});

test("GET /data/settings/stream never streams mailbox passwords or ciphertext", async () => {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/data/settings/stream`, { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = "";
  while (!received.includes("\n\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    received += decoder.decode(value, { stream: true });
  }
  controller.abort();
  assert.match(received, /recruitment_email_config/);
  assertNoSecrets(received, "stream");
  assert.equal(received.includes("enc:v1:"), false);
});

test("generic writes cannot modify, replace or delete mailbox settings records", async () => {
  const before = database.dump("recruitmentSettings");

  const redirect = await call("PATCH", "/data/settings/cfg1", { value: { imap: { host: "127.0.0.1", port: attackerImapServer.port } } });
  assert.equal(redirect.status, 403);
  assert.equal(redirect.json.code, "PROTECTED_SETTING");

  const rekey = await call("PATCH", "/data/recruitmentSettings/sync1", { key: "anything" });
  assert.equal(rekey.status, 403);

  const shadow = await call("POST", "/data/settings", { key: "recruitment_email_config", value: { imap: { host: "127.0.0.1" } } });
  assert.equal(shadow.status, 403);

  const storeSecret = await call("POST", "/data/settings", { key: "ui_prefs", smtpConfig: { password: "x-y-z-1" } });
  assert.equal(storeSecret.status, 403);

  for (const id of ["cfg1", "sync1"]) {
    const removal = await call("DELETE", `/data/settings/${id}`);
    assert.equal(removal.status, 403, id);
  }

  assert.deepEqual(database.dump("recruitmentSettings"), before, "stored settings must be unchanged");
  assert.equal(attackerImapServer.record.connections, 0);
});

test("ordinary recruitment settings records can still be written through the generic API", async () => {
  const created = await call("POST", "/data/settings", { key: "ui_prefs", value: { theme: "dark" } });
  assert.equal(created.status, 201);
  const updated = await call("PATCH", `/data/settings/${created.json.data.id}`, { value: { theme: "light" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.value.theme, "light");
  const removed = await call("DELETE", `/data/settings/${created.json.data.id}`);
  assert.equal(removed.status, 200);
});

test("GET /email/settings reports whether passwords exist and how they are stored, without returning them", async () => {
  const response = await call("GET", "/email/settings");
  assert.equal(response.status, 200);
  assert.equal(response.json.data.imap.hasPassword, true);
  assert.equal(response.json.data.smtp.hasPassword, true);
  assert.equal(response.json.data.imap.passwordStorage, "encrypted");
  assert.equal(response.json.data.smtp.passwordStorage, "encrypted");
  assert.equal(response.json.data.imap.host, "localhost");
  assertNoSecrets(response.text, "/email/settings");
  assert.equal(response.text.includes("enc:v1:"), false);
});

test("IMAP tests against another host never receive the saved password", async () => {
  const attacker = { host: "127.0.0.1", port: attackerImapServer.port, secure: false, user: SAVED_USER };
  for (const [path, body] of [
    ["/email/test-imap", { imap: { ...attacker, password: "" } }],
    ["/email/test-imap", { imap: { ...attacker, password: "••••••••" } }],
    ["/email/test-imap", { ...attacker }],
    ["/email/test", { imap: { ...attacker } }],
    ["/email/test", { ...attacker }],
  ]) {
    const response = await call("POST", path, body);
    assert.equal(response.status, 400, `${path} ${JSON.stringify(body)}`);
    assert.equal(response.json.code, "MAIL_CREDENTIALS_REQUIRED");
    assertNoSecrets(response.text, path);
  }
  assert.equal(attackerImapServer.record.connections, 0, "no connection may reach the other host");
});

test("the saved password is refused unless host, port, TLS mode and user all match", async () => {
  const connectionsBefore = savedImapServer.record.connections + savedSmtpServer.record.connections;
  const saved = savedConfig.imap;
  for (const change of [
    { port: saved.port + 1 },
    { secure: false },
    { user: "other@saved.test" },
    { host: "127.0.0.1" },
  ]) {
    const response = await call("POST", "/email/test-imap", { imap: { host: saved.host, port: saved.port, secure: saved.secure, user: saved.user, password: "", ...change } });
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(response.json.code, "MAIL_CREDENTIALS_REQUIRED");
  }
  const smtp = savedConfig.smtp;
  for (const change of [{ port: smtp.port + 1 }, { secure: true }]) {
    const response = await call("POST", "/email/test-smtp", { smtp: { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, password: "", ...change } });
    assert.equal(response.status, 400, JSON.stringify(change));
  }
  assert.equal(savedImapServer.record.connections + savedSmtpServer.record.connections, connectionsBefore, "nothing was contacted");
});

test("SMTP tests against another host never receive the saved SMTP or IMAP password", async () => {
  const attacker = { host: "127.0.0.1", port: attackerSmtpServer.port, secure: false, user: SAVED_USER };
  for (const body of [{ smtp: { ...attacker, password: "" } }, { smtp: { ...attacker } }, { ...attacker }]) {
    const response = await call("POST", "/email/test-smtp", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.json.code, "MAIL_CREDENTIALS_REQUIRED");
    assertNoSecrets(response.text, "/email/test-smtp");
  }
  assert.equal(attackerSmtpServer.record.connections, 0, "no connection may reach the other host");
});

test("IMAP test of the saved mailbox uses the decrypted saved password over TLS; errors and logs stay clean", { skip: skipTls }, async () => {
  const { result: response, output } = await captureOutput(() =>
    call("POST", "/email/test-imap", { imap: { host: "localhost", port: savedImapServer.port, secure: true, user: SAVED_USER, password: "" } }));
  const login = savedImapServer.record.logins.at(-1);
  assert.ok(login.line.includes(IMAP_PASSWORD), "saved IMAP server received the decrypted saved password");
  assert.equal(login.overTls, true);
  assert.equal(response.status, 502);
  assert.match(response.json.message, /IMAP Mailbox connection failed/);
  assert.match(response.json.message, /\[REDACTED\]/, "the server's credential echo was scrubbed");
  assertNoSecrets(response.text, "IMAP error response");
  assertNoSecrets(output, "IMAP logs");
});

test("SMTP test of the saved server uses the saved SMTP password only after STARTTLS; errors and logs stay clean", { skip: skipTls }, async () => {
  const { result: response, output } = await captureOutput(() =>
    call("POST", "/email/test-smtp", { smtp: { host: "localhost", port: savedSmtpServer.port, secure: false, user: SAVED_USER, password: "" } }));
  const logins = savedSmtpServer.record.logins;
  assert.ok(logins.length >= 1);
  assert.ok(logins.every((entry) => entry.overTls), "AUTH only after STARTTLS");
  const authPlain = Buffer.from(`\u0000${SAVED_USER}\u0000${SMTP_PASSWORD}`).toString("base64");
  const authLogin = Buffer.from(SMTP_PASSWORD).toString("base64");
  assert.ok(logins.some((entry) => entry.line.includes(authPlain) || entry.line.includes(authLogin)), "saved SMTP password was used");
  assert.equal(savedSmtpServer.record.received.includes(Buffer.from(`\u0000${SAVED_USER}\u0000${IMAP_PASSWORD}`).toString("base64")), false, "the IMAP password is not used for SMTP");
  assert.equal(response.status, 502);
  assert.match(response.json.message, /\[REDACTED\]/, "the server's credential echo was scrubbed");
  assertNoSecrets(response.text, "SMTP error response");
  assertNoSecrets(output, "SMTP logs");
  assert.doesNotMatch(output, /AUTH PLAIN|AUTH LOGIN/i, "SMTP protocol debug logging is off");
});

test("a caller-supplied password still requires TLS, and the saved password is never sent elsewhere", async () => {
  const callerPassword = "Caller-Own-Imap-1";
  const callerCredential = [{ user: "me@other.test", password: callerPassword }];
  const { result: response, output } = await captureOutput(() =>
    call("POST", "/email/test-imap", { imap: { host: "127.0.0.1", port: attackerImapServer.port, secure: false, user: "me@other.test", password: callerPassword } }));
  assert.equal(attackerImapServer.record.connections, 1);
  assert.deepEqual(attackerImapServer.record.logins, [], "no LOGIN over a connection without TLS");
  assertNoSecrets(attackerImapServer.record.received, "attacker traffic", [...SAVED_CREDENTIALS, ...callerCredential]);
  assert.equal(response.status, 502);
  assertNoSecrets(response.text, "caller-password error response", callerCredential);
  assertNoSecrets(output, "caller-password logs", callerCredential);
});

test("saving settings cannot redirect the saved password to a new host, port, TLS mode or user", async () => {
  const before = database.dump("recruitmentSettings");
  for (const [section, change] of [
    ["imap", { host: "127.0.0.1", port: attackerImapServer.port }],
    ["imap", { port: savedConfig.imap.port + 1 }],
    ["imap", { secure: false }],
    ["smtp", { user: "other@saved.test" }],
    ["smtp", { secure: true }],
  ]) {
    const body = {
      ...savedConfig,
      imap: { ...savedConfig.imap, password: "" },
      smtp: { ...savedConfig.smtp, password: "" },
    };
    body[section] = { ...body[section], ...change };
    const response = await call("POST", "/email/settings", body);
    assert.equal(response.status, 400, `${section} ${JSON.stringify(change)}`);
    assert.equal(response.json.code, "MAIL_CREDENTIALS_REQUIRED");
  }
  assert.deepEqual(database.dump("recruitmentSettings"), before, "stored settings must be unchanged");
});

test("saving unchanged settings keeps the passwords, stored encrypted, and returns no secrets", async () => {
  const response = await call("POST", "/email/settings", {
    ...savedConfig,
    imap: { ...savedConfig.imap, password: "" },
    smtp: { ...savedConfig.smtp, password: "••••••••" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.imap.hasPassword, true);
  assertNoSecrets(response.text, "save response");
  const stored = storedConfig();
  assert.ok(isEncryptedSecret(stored.imap.password) && isEncryptedSecret(stored.smtp.password));
  assertNoSecrets(JSON.stringify(stored), "stored settings");
  const { config } = decryptMailConfigSecrets(stored);
  assert.equal(config.imap.password, IMAP_PASSWORD);
  assert.equal(config.smtp.password, SMTP_PASSWORD);
});

test("without RECRUITMENT_CREDENTIALS_KEY a password is never saved", async () => {
  const before = database.dump("recruitmentSettings");
  delete process.env.RECRUITMENT_CREDENTIALS_KEY;
  try {
    const response = await call("POST", "/email/settings", {
      ...savedConfig,
      imap: { ...savedConfig.imap, password: "Brand-New-Pass-4" },
      smtp: { ...savedConfig.smtp, password: "Brand-New-Pass-5" },
    });
    assert.equal(response.status, 503);
    assert.equal(response.json.code, "CREDENTIALS_KEY_REQUIRED");
    assertNoSecrets(response.text, "missing-key response", [{ user: SAVED_USER, password: "Brand-New-Pass-4" }]);
    assert.deepEqual(database.dump("recruitmentSettings"), before, "nothing was stored");
  } finally {
    await restoreSavedConfig();
  }
});

test("legacy unencrypted passwords still work, are reported, and are encrypted on the next save", async () => {
  database.put("recruitmentSettings", "cfg1", { key: "recruitment_email_config", value: structuredClone(savedConfig), createdAt: "2026-01-01T00:00:00.000Z" });
  try {
    const { result: loaded, output } = await captureOutput(() => emailService.loadSavedMailConfig());
    assert.deepEqual(loaded.storage, { imap: "unencrypted", smtp: "unencrypted" });
    assert.match(output, /not encrypted; save the email settings again/);
    assertNoSecrets(output, "load warning logs");
    assert.equal(emailService.getRecruitmentMailConfig().password, IMAP_PASSWORD, "the legacy password still works");

    const settings = await call("GET", "/email/settings");
    assert.equal(settings.json.data.imap.passwordStorage, "unencrypted");
    assertNoSecrets(settings.text, "legacy /email/settings");

    const saved = await call("POST", "/email/settings", { ...savedConfig, imap: { ...savedConfig.imap, password: "" }, smtp: { ...savedConfig.smtp, password: "" } });
    assert.equal(saved.status, 200);
    const stored = storedConfig();
    assert.ok(isEncryptedSecret(stored.imap.password) && isEncryptedSecret(stored.smtp.password), "migrated to encrypted storage");
    assertNoSecrets(JSON.stringify(stored), "migrated settings");
  } finally {
    await restoreSavedConfig();
  }
});

test("a wrong key leaves passwords unreadable without crashing, leaking or deleting them", async () => {
  const before = database.dump("recruitmentSettings");
  process.env.RECRUITMENT_CREDENTIALS_KEY = randomBytes(32).toString("base64");
  try {
    const { result: loaded, output } = await captureOutput(() => emailService.loadSavedMailConfig());
    assert.deepEqual(loaded.storage, { imap: "unreadable", smtp: "unreadable" });
    assert.match(output, /could not be decrypted/);
    assert.equal(Boolean(emailService.getRecruitmentMailConfig().password), false, "no usable password in memory");

    const settings = await call("GET", "/email/settings");
    assert.equal(settings.json.data.imap.hasPassword, false);
    assert.equal(settings.json.data.imap.passwordStorage, "unreadable");

    const connectionsBefore = savedImapServer.record.connections;
    const probe = await call("POST", "/email/test-imap", { imap: { ...savedConfig.imap, password: "" } });
    assert.equal(probe.status, 400, "no usable saved password");
    assert.equal(savedImapServer.record.connections, connectionsBefore);

    const save = await call("POST", "/email/settings", { ...savedConfig, imap: { ...savedConfig.imap, password: "" }, smtp: { ...savedConfig.smtp, password: "" } });
    assert.equal(save.status, 409);
    assert.equal(save.json.code, "CREDENTIALS_UNREADABLE");
    assert.deepEqual(database.dump("recruitmentSettings"), before, "the unreadable ciphertext was not overwritten");
    assertNoSecrets(output + settings.text + probe.text + save.text, "wrong-key outputs");
  } finally {
    await restoreSavedConfig();
  }
});

test("a failed poll never logs or stores credentials, and /email/status stays clean", { skip: skipTls }, async () => {
  emailService.setDynamicMailConfig({ ...structuredClone(savedConfig), sync: { enabled: true, pollInterval: 60000 } });
  try {
    const { result, output } = await captureOutput(() => emailService.pollRecruitmentEmails());
    assert.equal(result.success, false);
    const login = savedImapServer.record.logins.at(-1);
    assert.equal(login.overTls, true);
    assert.ok(login.line.includes(IMAP_PASSWORD), "the poll really authenticated with the saved password");
    assert.match(result.error, /\[REDACTED\]/);
    assertNoSecrets(result.error, "poll result");
    assertNoSecrets(output, "poll logs");
    const lastError = database.dump("recruitmentSettings").sync1.value.lastError;
    assert.match(lastError, /\[REDACTED\]/);
    assertNoSecrets(lastError, "stored lastError");
    const status = await call("GET", "/email/status");
    assertNoSecrets(status.text, "/email/status");
  } finally {
    await restoreSavedConfig();
  }
});
