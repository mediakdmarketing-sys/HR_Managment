import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkGenericSettingsWrite,
  containsSecretKeys,
  imapTlsOptions,
  smtpTlsOptions,
  passwordForSavedSettings,
  redactSecrets,
  resolveMailTestConfig,
  scrubSecrets,
  secretVariants,
} from "../utils/mailSecurity.js";

const SAVED = { host: "imap.saved.test", port: 993, secure: true, user: "recruiting@saved.test", password: "Saved-Imap-Pass-91" };

test("redactSecrets removes secret keys at any depth, including inside arrays", () => {
  const input = {
    data: [{
      id: "cfg",
      key: "recruitment_email_config",
      value: {
        imap: { host: "imap.saved.test", password: "p1", hasPassword: true },
        smtp: { host: "smtp.saved.test", pass: "p2" },
        nested: [{ apiKey: "k", token: "t", deeper: { privateKey: "pk", clientSecret: "cs" } }],
      },
    }],
  };
  const output = redactSecrets(input);
  const json = JSON.stringify(output);
  for (const secret of ["p1", "p2", "\"k\"", "\"t\"", "pk", "cs"]) assert.equal(json.includes(secret), false, secret);
  assert.equal(output.data[0].value.imap.host, "imap.saved.test");
  assert.equal(output.data[0].value.imap.hasPassword, true);
  assert.equal(input.data[0].value.imap.password, "p1", "input must not be mutated");
});

test("redactSecrets keeps non-plain objects such as Dates and Timestamps intact", () => {
  class Timestamp { constructor() { this._seconds = 1; } }
  const when = new Date("2026-01-01T00:00:00Z");
  const stamp = new Timestamp();
  const output = redactSecrets({ when, stamp, list: [1, "a", null] });
  assert.equal(output.when, when);
  assert.equal(output.stamp, stamp);
  assert.deepEqual(output.list, [1, "a", null]);
});

test("containsSecretKeys detects nested credential fields", () => {
  assert.equal(containsSecretKeys({ value: { imap: { password: "x" } } }), true);
  assert.equal(containsSecretKeys({ value: { theme: "dark" } }), false);
});

test("generic settings writes cannot touch mailbox settings or store credentials", () => {
  const collectionName = "recruitmentSettings";
  assert.equal(checkGenericSettingsWrite({ collectionName, existing: { key: "recruitment_email_config" } }).code, "PROTECTED_SETTING");
  assert.equal(checkGenericSettingsWrite({ collectionName, existing: { key: "email_sync_status" } }).code, "PROTECTED_SETTING");
  assert.equal(checkGenericSettingsWrite({ collectionName, payload: { key: "recruitment_email_config" } }).code, "PROTECTED_SETTING");
  assert.equal(checkGenericSettingsWrite({ collectionName, payload: { key: "x", smtpConfig: { password: "y" } } }).code, "PROTECTED_SETTING");
  assert.equal(checkGenericSettingsWrite({ collectionName, payload: { key: "ui_prefs", value: { theme: "dark" } } }), null);
  assert.equal(checkGenericSettingsWrite({ collectionName: "recruitmentJobs", payload: { key: "recruitment_email_config" } }), null);
});

test("connection tests use the saved password only for the saved host and user", () => {
  const sameTarget = resolveMailTestConfig({ requested: { host: "IMAP.Saved.Test.", user: " Recruiting@Saved.test ", password: "" }, saved: SAVED, defaultPort: 993 });
  assert.equal(sameTarget.password, SAVED.password);
  assert.equal(sameTarget.usesSavedPassword, true);

  const defaults = resolveMailTestConfig({ requested: {}, saved: SAVED, defaultPort: 993 });
  assert.equal(defaults.host, SAVED.host);
  assert.equal(defaults.usesSavedPassword, true);

  for (const requested of [
    { host: "attacker.example", user: SAVED.user, password: "" },
    { host: "attacker.example", user: SAVED.user },
    { host: "attacker.example", user: SAVED.user, password: "••••••••" },
    { host: SAVED.host, user: "someone@else.test", password: "" },
    { host: "imap.saved.test.attacker.example", user: SAVED.user },
  ]) {
    assert.throws(
      () => resolveMailTestConfig({ requested, saved: SAVED, defaultPort: 993 }),
      (error) => error.code === "MAIL_CREDENTIALS_REQUIRED" && !error.message.includes(SAVED.password),
      JSON.stringify(requested),
    );
  }
});

test("the saved password requires host, port, TLS mode and user to all match", () => {
  for (const requested of [
    { port: 143 },
    { port: "994" },
    { secure: false },
    { secure: "false" },
    { port: 143, secure: false },
  ]) {
    assert.throws(
      () => resolveMailTestConfig({ requested: { host: SAVED.host, user: SAVED.user, password: "", ...requested }, saved: SAVED, defaultPort: 993 }),
      (error) => error.code === "MAIL_CREDENTIALS_REQUIRED",
      JSON.stringify(requested),
    );
  }
  // Same values in a different representation still match.
  const same = resolveMailTestConfig({ requested: { host: SAVED.host, user: SAVED.user, port: "993", secure: "true" }, saved: SAVED, defaultPort: 993 });
  assert.equal(same.usesSavedPassword, true);
});

test("saving settings requires the password again when port or TLS mode change", () => {
  for (const change of [{ port: 143 }, { secure: false }]) {
    assert.throws(
      () => passwordForSavedSettings({ requested: { host: SAVED.host, user: SAVED.user, password: "", ...change }, saved: SAVED, defaultPort: 993, label: "IMAP" }),
      (error) => error.code === "MAIL_CREDENTIALS_REQUIRED",
      JSON.stringify(change),
    );
  }
  assert.equal(
    passwordForSavedSettings({ requested: { host: SAVED.host, user: SAVED.user, port: 993, secure: true }, saved: SAVED, defaultPort: 993 }),
    SAVED.password,
  );
});

test("every mailbox connection requires TLS with certificate verification", () => {
  assert.deepEqual(imapTlsOptions({ secure: true }), { secure: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true } });
  assert.deepEqual(imapTlsOptions({ secure: false }), { secure: false, doSTARTTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true } });
  assert.deepEqual(smtpTlsOptions({ secure: true }), { secure: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true } });
  assert.deepEqual(smtpTlsOptions({ secure: false }), { secure: false, requireTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true } });
});

test("a caller-supplied password is used as-is for any host and never mixed with the saved one", () => {
  const result = resolveMailTestConfig({
    requested: { host: "other.example", user: "me@other.example", password: "Caller-Own-Pass" },
    saved: SAVED,
    defaultPort: 993,
  });
  assert.equal(result.password, "Caller-Own-Pass");
  assert.equal(result.usesSavedPassword, false);
});

test("connection tests without any password fail with a clear message", () => {
  assert.throws(
    () => resolveMailTestConfig({ requested: { host: "h", user: "u" }, saved: {}, defaultPort: 465, label: "SMTP" }),
    /Enter the SMTP password/,
  );
});

test("saving settings keeps the saved password only while host and user are unchanged", () => {
  assert.equal(passwordForSavedSettings({ requested: { host: SAVED.host, user: SAVED.user, password: "" }, saved: SAVED }), SAVED.password);
  assert.equal(passwordForSavedSettings({ requested: { host: SAVED.host, user: SAVED.user, password: "••••" }, saved: SAVED }), SAVED.password);
  assert.equal(passwordForSavedSettings({ requested: { host: "new.example", user: SAVED.user, password: "New-Pass-1" }, saved: SAVED }), "New-Pass-1");
  assert.equal(passwordForSavedSettings({ requested: { host: "new.example", user: "x@y.z" }, saved: { host: "", user: "", password: "" } }), "");
  assert.throws(
    () => passwordForSavedSettings({ requested: { host: "attacker.example", user: SAVED.user, password: "" }, saved: SAVED, label: "IMAP" }),
    (error) => error.code === "MAIL_CREDENTIALS_REQUIRED" && /IMAP password/.test(error.message),
  );
});

test("scrubSecrets removes raw, base64, AUTH PLAIN, quoted and URL-encoded password forms", () => {
  const credential = { user: "recruiting@saved.test", password: "Pa\"ss\\word 99" };
  const variants = secretVariants(credential);
  const message = `failed: ${variants.join(" | ")} end`;
  const scrubbed = scrubSecrets(message, [credential]);
  for (const variant of variants) assert.equal(scrubbed.includes(variant), false, variant);
  assert.equal(scrubbed.includes("ss\\word"), false);
  assert.match(scrubbed, /^failed: \[REDACTED\]/);
  assert.match(scrubbed, / end$/);
});

test("scrubSecrets ignores empty or very short values instead of mangling messages", () => {
  assert.equal(scrubSecrets("a normal error", [{ user: "u", password: "" }, { user: "u", password: "a" }]), "a normal error");
});
