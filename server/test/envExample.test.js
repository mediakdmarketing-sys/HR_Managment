// .env.example is committed to Git, so it must never carry a real secret. These tests read
// the file and fail if a key, password or token has a value. Values are never printed:
// failure messages name the variable only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadCredentialKey } from "../utils/credentialCrypto.js";

const EXAMPLE_PATH = new URL("../.env.example", import.meta.url);

const parseEnv = (text) => {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (!match) continue;
    entries.set(match[1], match[2].trim().replace(/^(["'])(.*)\1$/, "$2"));
  }
  return entries;
};

const example = parseEnv(readFileSync(EXAMPLE_PATH, "utf8"));
const SECRET_NAME = /(KEY|PASS|PASSWORD|SECRET|TOKEN)$/;
const isPlaceholder = (value) => value === "" || /REPLACE_ME/.test(value);

test(".env.example documents RECRUITMENT_CREDENTIALS_KEY with an empty value", () => {
  assert.ok(example.has("RECRUITMENT_CREDENTIALS_KEY"), "RECRUITMENT_CREDENTIALS_KEY must stay documented");
  const value = example.get("RECRUITMENT_CREDENTIALS_KEY");
  assert.equal(value === "", true, "RECRUITMENT_CREDENTIALS_KEY in .env.example must be empty (value not shown)");
  // Belt and braces: whatever is there must not be usable as an encryption key.
  let usable = false;
  try { usable = Boolean(loadCredentialKey(value)); } catch { usable = false; }
  assert.equal(usable, false, "RECRUITMENT_CREDENTIALS_KEY in .env.example is a usable key (value not shown)");
});

test(".env.example contains no values for secret variables", () => {
  const offending = [...example.entries()]
    .filter(([name, value]) => SECRET_NAME.test(name) && !isPlaceholder(value))
    .map(([name]) => name);
  assert.deepEqual(offending, [], `secret variables with values in .env.example: ${offending.join(", ")}`);
});

test("the secret check recognises a real-looking key without echoing it", () => {
  const sample = parseEnv("RECRUITMENT_CREDENTIALS_KEY=" + Buffer.alloc(32, 7).toString("base64"));
  assert.equal(SECRET_NAME.test("RECRUITMENT_CREDENTIALS_KEY"), true);
  assert.equal(isPlaceholder(sample.get("RECRUITMENT_CREDENTIALS_KEY")), false);
  assert.ok(loadCredentialKey(sample.get("RECRUITMENT_CREDENTIALS_KEY")));
});
