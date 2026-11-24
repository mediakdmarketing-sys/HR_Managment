import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptionKeyWarning, isPasswordUsable, passwordWarning } from "../src/utils/mailCredentialStatus.js";

test("an unreadable stored password is not shown as configured and asks for re-entry", () => {
  assert.equal(isPasswordUsable({ hasPassword: true, passwordStorage: "unreadable" }), false);
  assert.match(passwordWarning({ passwordStorage: "unreadable" }), /Enter the password again/);
});

test("encrypted or environment passwords are usable with no warning", () => {
  for (const passwordStorage of ["encrypted", "environment"]) {
    assert.equal(isPasswordUsable({ hasPassword: true, passwordStorage }), true);
    assert.equal(passwordWarning({ passwordStorage }), "");
  }
  assert.equal(isPasswordUsable({ hasPassword: false, passwordStorage: "none" }), false);
});

test("encryption key problems produce a visible warning; ok produces none", () => {
  assert.match(encryptionKeyWarning("restart-required"), /Restart the server/);
  assert.match(encryptionKeyWarning("missing"), /RECRUITMENT_CREDENTIALS_KEY/);
  assert.match(encryptionKeyWarning("invalid"), /not a valid/);
  assert.equal(encryptionKeyWarning("ok"), "");
  assert.equal(encryptionKeyWarning(undefined), "");
});
