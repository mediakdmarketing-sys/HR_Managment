// Regression tests for "both mailbox passwords unreadable after saving".
// Root cause: RECRUITMENT_CREDENTIALS_KEY was changed in .env while the server kept running;
// the running process still held the old key, so Save encrypted the passwords with it and
// every later process (restart, check script) could not decrypt them.
//
// Everything is local: a temporary .env file (never the real one), runtime-generated keys,
// in-memory Firestore, pass-through auth and a fake IMAP client. Nothing is printed.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, mock, test } from "node:test";

process.env.NODE_ENV = "test";
for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_|RECRUITMENT_CREDENTIALS_KEY|MAIL_FROM|GROQ_|GHL_)/.test(name)) delete process.env[name];
}
const OLD_KEY = randomBytes(32).toString("base64");
const NEW_KEY = randomBytes(32).toString("hex"); // both accepted formats are exercised
const tempDir = mkdtempSync(path.join(tmpdir(), "hrms-key-test-"));
const ENV_FILE = path.join(tempDir, ".env");
const writeEnvFile = (key) => writeFileSync(ENV_FILE, `PORT=5000\nRECRUITMENT_CREDENTIALS_KEY=${key}\n`);
writeEnvFile(OLD_KEY);
process.env.DOTENV_CONFIG_PATH = ENV_FILE;
process.env.RECRUITMENT_CREDENTIALS_KEY = OLD_KEY; // the key the "running server" started with

const USER = "recruiting@example.test";
const OLD_IMAP = "Old-Imap-Pass-11";
const OLD_SMTP = "Old-Smtp-Pass-22";
const NEW_IMAP = "New-Imap-Pass-33";
const NEW_SMTP = "New-Smtp-Pass-44";
const ALL_PASSWORDS = [OLD_IMAP, OLD_SMTP, NEW_IMAP, NEW_SMTP];

const baseConfig = (imapPassword, smtpPassword) => ({
  officialEmail: USER,
  imap: { host: "imap.example.test", port: 993, secure: true, user: USER, password: imapPassword, enabled: true },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: USER, password: smtpPassword, enabled: true },
  sync: { enabled: false, pollInterval: 60000 },
});
// sync enabled so the poll runs; in NODE_ENV=test no polling timer is ever started.
const settingsBody = (imapPassword, smtpPassword) => ({
  officialEmail: USER,
  imap: { host: "imap.example.test", port: 993, secure: true, user: USER, password: imapPassword, enabled: true },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: USER, password: smtpPassword, enabled: true },
  sync: { enabled: true, pollInterval: 60000 },
});

const imapState = { constructed: [] };
class FakeImapFlow {
  constructor(options) { imapState.constructed.push(options); this.usable = false; }
  on() { return this; }
  async connect() { this.usable = true; }
  async getMailboxLock() { return { release() {} }; }
  async search() { return []; }
  async logout() { this.usable = false; }
  close() { this.usable = false; }
}

let crypto;
let emailService;
let database;
let corruptNextSettingsWrite = false;
let baseUrl;
let httpServer;

const stored = () => database.dump("recruitmentSettings").cfg1.value;
const call = async (method, urlPath, body) => {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text, json: text ? JSON.parse(text) : null };
};
const assertNoSecretsIn = (text, label) => {
  assert.equal(text.includes("enc:v1:"), false, `${label} contains ciphertext`);
  for (const password of ALL_PASSWORDS) assert.equal(text.includes(password), false, `${label} contains a password`);
  for (const key of [OLD_KEY, NEW_KEY]) assert.equal(text.includes(key), false, `${label} contains a key`);
};
// Simulates a server restart: new process environment, fresh in-memory config.
const restartWithKey = async (key) => {
  process.env.RECRUITMENT_CREDENTIALS_KEY = key;
  crypto.resetCredentialKeyBaseline();
  emailService.setDynamicMailConfig(null);
  return emailService.loadSavedMailConfig();
};

before(async () => {
  crypto = await import("../utils/credentialCrypto.js");
  crypto.resetCredentialKeyBaseline();
  const { createRecruitmentFirestoreService } = await import("../services/recruitmentService.js");
  const { createFakeFirestore } = await import("./support/fakeFirestore.js");

  // The stored config as it was before the key change: encrypted with the OLD key.
  database = createFakeFirestore({
    recruitmentSettings: {
      cfg1: {
        key: "recruitment_email_config",
        value: crypto.encryptMailConfigSecrets(baseConfig(OLD_IMAP, OLD_SMTP), crypto.loadCredentialKey(OLD_KEY)),
        createdAt: "2026-11-21T16:53:12.606Z",
      },
    },
  });
  // Optional fault injection: corrupt the next settings write (for the verification test).
  const wrapped = {
    ...database,
    collection: (name) => {
      const query = database.collection(name);
      return {
        ...query,
        doc: (id) => {
          const ref = query.doc(id);
          return {
            ...ref,
            set: async (data, options) => {
              if (name === "recruitmentSettings" && corruptNextSettingsWrite) {
                corruptNextSettingsWrite = false;
                const bad = structuredClone(data);
                bad.value.imap.password = crypto.encryptSecret("x", randomBytes(32), "recruitment-mail:imap:password");
                return ref.set(bad, options);
              }
              return ref.set(data, options);
            },
          };
        },
      };
    },
  };
  const recruitmentFirestore = createRecruitmentFirestoreService({ database: wrapped, bucket: {} });

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
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/recruitment", recruitmentRouter);
  await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  const loaded = await emailService.loadSavedMailConfig();
  assert.deepEqual(loaded.storage, { imap: "encrypted", smtp: "encrypted" });
});

after(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  rmSync(tempDir, { recursive: true, force: true });
});

test("exact failure: key edited in .env while running -> save is refused, nothing is overwritten", async () => {
  const before = structuredClone(stored());
  writeEnvFile(NEW_KEY); // .env now has the new key; the process still holds the old one

  const settings = await call("GET", "/api/recruitment/email/settings");
  assert.equal(settings.json.data.encryptionKeyStatus, "restart-required");
  assertNoSecretsIn(settings.text, "settings response");

  const save = await call("POST", "/api/recruitment/email/settings", settingsBody(NEW_IMAP, NEW_SMTP));
  assert.equal(save.status, 503);
  assert.equal(save.json.code, "CREDENTIALS_KEY_STALE");
  assert.match(save.json.message, /Restart the server/);
  assertNoSecretsIn(save.text, "stale-key save response");
  assert.deepEqual(stored(), before, "stored credentials must not be re-encrypted with the stale key");
});

test("after restart with the new key, old passwords are reported unreadable (never exposed)", async () => {
  const loaded = await restartWithKey(NEW_KEY);
  assert.deepEqual(loaded.storage, { imap: "unreadable", smtp: "unreadable" });
  assert.equal(emailService.isRecruitmentEmailConfigured(), false);

  const settings = await call("GET", "/api/recruitment/email/settings");
  assert.equal(settings.json.data.encryptionKeyStatus, "ok");
  assert.equal(settings.json.data.imap.passwordStorage, "unreadable");
  assert.equal(settings.json.data.smtp.passwordStorage, "unreadable");
  assert.equal(settings.json.data.imap.hasPassword, false);
  assertNoSecretsIn(settings.text, "settings response");
});

test("a blank-password save cannot overwrite unreadable credentials", async () => {
  const before = structuredClone(stored());
  const save = await call("POST", "/api/recruitment/email/settings", settingsBody("", ""));
  assert.equal(save.status, 409);
  assert.equal(save.json.code, "CREDENTIALS_UNREADABLE");
  assert.deepEqual(stored(), before);
});

test("re-entering both passwords stores them encrypted with the current key", async () => {
  const save = await call("POST", "/api/recruitment/email/settings", settingsBody(NEW_IMAP, NEW_SMTP));
  assert.equal(save.status, 200, save.json?.message);
  assert.equal(save.json.data.imap.passwordStorage, "encrypted");
  assert.equal(save.json.data.smtp.passwordStorage, "encrypted");
  assert.equal(save.json.data.imap.hasPassword, true);
  assertNoSecretsIn(save.text, "save response");

  const value = stored();
  assert.ok(crypto.isEncryptedSecret(value.imap.password));
  assert.ok(crypto.isEncryptedSecret(value.smtp.password));
  assert.equal(JSON.stringify(value).includes(NEW_IMAP), false, "plaintext stored");
  const key = crypto.loadCredentialKey(NEW_KEY);
  assert.equal(crypto.decryptSecret(value.imap.password, key, "recruitment-mail:imap:password") === NEW_IMAP, true);
  assert.equal(crypto.decryptSecret(value.smtp.password, key, "recruitment-mail:smtp:password") === NEW_SMTP, true);
});

test("after another restart, polling decrypts and uses the saved IMAP password over TLS", async () => {
  const loaded = await restartWithKey(NEW_KEY);
  assert.deepEqual(loaded.storage, { imap: "encrypted", smtp: "encrypted" });
  assert.equal(emailService.isRecruitmentEmailConfigured(), true);
  assert.equal(emailService.getRecruitmentSmtpConfig().password === NEW_SMTP, true);

  imapState.constructed = [];
  const result = await emailService.pollRecruitmentEmails();
  assert.equal(result.success, true);
  const [options] = imapState.constructed;
  assert.equal(options.auth.pass === NEW_IMAP, true, "poll did not receive the decrypted IMAP password");
  assert.equal(options.secure, true);
  assert.equal(options.tls.rejectUnauthorized, true);

  const status = await call("GET", "/api/recruitment/email/status");
  assertNoSecretsIn(status.text, "status response");
});

test("blank password fields keep valid saved credentials", async () => {
  const save = await call("POST", "/api/recruitment/email/settings", settingsBody("", ""));
  assert.equal(save.status, 200, save.json?.message);
  const key = crypto.loadCredentialKey(NEW_KEY);
  assert.equal(crypto.decryptSecret(stored().imap.password, key, "recruitment-mail:imap:password") === NEW_IMAP, true);
  assert.equal(crypto.decryptSecret(stored().smtp.password, key, "recruitment-mail:smtp:password") === NEW_SMTP, true);
  const loaded = await restartWithKey(NEW_KEY);
  assert.deepEqual(loaded.storage, { imap: "encrypted", smtp: "encrypted" });
});

test("a save whose stored result does not decrypt is rolled back and reported", async () => {
  const before = structuredClone(stored());
  corruptNextSettingsWrite = true;
  const save = await call("POST", "/api/recruitment/email/settings", settingsBody("Another-Imap-Pass-55", ""));
  assert.equal(save.status, 503);
  assert.equal(save.json.code, "CREDENTIALS_VERIFY_FAILED");
  assert.equal(save.text.includes("Another-Imap-Pass-55"), false);
  assertNoSecretsIn(save.text, "verify-failure response");
  assert.deepEqual(stored().imap, before.imap, "previous valid credentials must be restored");
  assert.deepEqual(stored().smtp, before.smtp);
});
