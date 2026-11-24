import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  decryptMailConfigSecrets,
  decryptSecret,
  encryptMailConfigSecrets,
  encryptSecret,
  isEncryptedSecret,
  loadCredentialKey,
} from "../utils/credentialCrypto.js";

// Keys are generated per run; no key material is hardcoded.
const key = randomBytes(32);
const otherKey = randomBytes(32);
const CONTEXT = "recruitment-mail:imap:password";

test("loadCredentialKey accepts 32-byte hex or base64 keys and rejects anything else", () => {
  assert.deepEqual(loadCredentialKey(key.toString("hex")), key);
  assert.deepEqual(loadCredentialKey(key.toString("base64")), key);
  assert.equal(loadCredentialKey(""), null);
  assert.equal(loadCredentialKey(undefined), null);
  for (const bad of ["short", randomBytes(16).toString("base64"), randomBytes(31).toString("hex"), "not base64 !!"]) {
    assert.throws(
      () => loadCredentialKey(bad),
      (error) => error.code === "CREDENTIALS_KEY_INVALID" && !error.message.includes(bad),
    );
  }
});

test("encryptSecret round-trips, uses a fresh IV each time and never contains the plaintext", () => {
  const first = encryptSecret("App-Pass-1234", key, CONTEXT);
  const second = encryptSecret("App-Pass-1234", key, CONTEXT);
  assert.ok(isEncryptedSecret(first));
  assert.notEqual(first, second);
  assert.equal(first.includes("App-Pass-1234"), false);
  assert.equal(first.includes(Buffer.from("App-Pass-1234").toString("base64")), false);
  assert.equal(decryptSecret(first, key, CONTEXT), "App-Pass-1234");
});

test("decryption fails closed for a wrong key, another field's context or tampering", () => {
  const value = encryptSecret("App-Pass-1234", key, CONTEXT);
  const failsUnreadable = (fn) => assert.throws(fn, (error) => error.code === "CREDENTIALS_UNREADABLE" && !error.message.includes("App-Pass"));
  failsUnreadable(() => decryptSecret(value, otherKey, CONTEXT));
  failsUnreadable(() => decryptSecret(value, key, "recruitment-mail:smtp:password"));
  const [prefix, version, iv, tag, ciphertext] = value.split(":");
  const flipped = Buffer.from(ciphertext, "base64");
  flipped[0] ^= 1;
  failsUnreadable(() => decryptSecret([prefix, version, iv, tag, flipped.toString("base64")].join(":"), key, CONTEXT));
  failsUnreadable(() => decryptSecret("enc:v1:onlyonepart", key, CONTEXT));
  assert.throws(() => decryptSecret(value, null, CONTEXT), (error) => error.code === "CREDENTIALS_KEY_REQUIRED");
});

test("encryption requires a key; it is never silently stored in plaintext", () => {
  assert.throws(() => encryptSecret("x-y-z-1", null, CONTEXT), (error) => error.code === "CREDENTIALS_KEY_REQUIRED");
  assert.throws(
    () => encryptMailConfigSecrets({ imap: { host: "h", password: "x-y-z-1" } }, null),
    (error) => error.code === "CREDENTIALS_KEY_REQUIRED",
  );
  // No password to protect: saving without a key is fine.
  assert.deepEqual(encryptMailConfigSecrets({ imap: { host: "h", password: "" } }, null), { imap: { host: "h", password: "" } });
});

test("mail config passwords are encrypted per field and decrypted back", () => {
  const config = {
    imap: { host: "imap.test", password: "Imap-Secret-1" },
    smtp: { host: "smtp.test", password: "Smtp-Secret-2" },
    sync: { enabled: true },
  };
  const stored = encryptMailConfigSecrets(config, key);
  const json = JSON.stringify(stored);
  assert.equal(json.includes("Imap-Secret-1"), false);
  assert.equal(json.includes("Smtp-Secret-2"), false);
  assert.equal(stored.imap.host, "imap.test");
  assert.equal(config.imap.password, "Imap-Secret-1", "input must not be mutated");
  assert.equal(encryptMailConfigSecrets(stored, key).imap.password, stored.imap.password, "already-encrypted values are kept");

  const swapped = { ...stored, imap: { ...stored.imap, password: stored.smtp.password } };
  assert.equal(decryptMailConfigSecrets(swapped, key).storage.imap, "unreadable", "ciphertexts cannot be swapped between fields");

  const { config: plain, storage } = decryptMailConfigSecrets(stored, key);
  assert.deepEqual(storage, { imap: "encrypted", smtp: "encrypted" });
  assert.equal(plain.imap.password, "Imap-Secret-1");
  assert.equal(plain.smtp.password, "Smtp-Secret-2");
});

test("decryptMailConfigSecrets never throws and reports legacy, unreadable and missing passwords", () => {
  const stored = encryptMailConfigSecrets({ imap: { password: "Imap-Secret-1" } }, key);
  const legacy = { imap: { password: "Legacy-Plain-3" }, smtp: { password: "" } };

  const wrongKey = decryptMailConfigSecrets(stored, otherKey);
  assert.equal(wrongKey.storage.imap, "unreadable");
  assert.equal(wrongKey.config.imap.password, "");

  const noKey = decryptMailConfigSecrets(stored, null);
  assert.equal(noKey.storage.imap, "unreadable");

  const legacyResult = decryptMailConfigSecrets(legacy, key);
  assert.deepEqual(legacyResult.storage, { imap: "unencrypted", smtp: "none" });
  assert.equal(legacyResult.config.imap.password, "Legacy-Plain-3");

  const previous = process.env.RECRUITMENT_CREDENTIALS_KEY;
  process.env.RECRUITMENT_CREDENTIALS_KEY = "malformed";
  try {
    assert.equal(decryptMailConfigSecrets(stored).storage.imap, "unreadable");
  } finally {
    if (previous === undefined) delete process.env.RECRUITMENT_CREDENTIALS_KEY;
    else process.env.RECRUITMENT_CREDENTIALS_KEY = previous;
  }
});
