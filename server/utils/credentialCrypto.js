// Encryption at rest for stored mailbox credentials (AES-256-GCM).
//
// The key comes only from the RECRUITMENT_CREDENTIALS_KEY environment variable: 32 random
// bytes written as 64 hex characters or base64. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Each value is bound to its field (the "context"), so ciphertexts cannot be swapped
// between fields. Stored format: enc:v1:<iv>:<auth tag>:<ciphertext>, all base64.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";

const parseEnv = (text) => dotenv.parse(text);

const PREFIX = "enc:v1:";
const KEY_ENV = "RECRUITMENT_CREDENTIALS_KEY";

const keyError = (code, message) => Object.assign(new Error(message), { code });

// --- Detecting a key edited in .env while the server is running -------------------------
// process.env is read once at startup, so editing RECRUITMENT_CREDENTIALS_KEY in .env has no
// effect until a restart. Saving passwords in that window encrypts them with the old
// in-memory key, and they become unreadable after the next restart. We remember a one-way
// hash of the key line in the .env file (never the key) and refuse to save credentials once
// the file no longer matches what the running process loaded. Hosts without a .env file
// (environment variables only) are unaffected.
const envFilePath = () => process.env.DOTENV_CONFIG_PATH || new URL("../.env", import.meta.url);
const envFileKeyHash = () => {
  let value;
  try { value = parseEnv(readFileSync(envFilePath()))[KEY_ENV]; } catch { return "no-file"; }
  const text = String(value ?? "").trim();
  return text ? createHash("sha256").update(text).digest("hex") : "unset";
};
let envFileBaseline = envFileKeyHash();

// Re-reads the baseline; for process start and tests.
export const resetCredentialKeyBaseline = () => { envFileBaseline = envFileKeyHash(); };

// "ok" | "missing" | "invalid" | "restart-required"
export const credentialKeyStatus = () => {
  if (envFileKeyHash() !== envFileBaseline) return "restart-required";
  try { return loadCredentialKey() ? "ok" : "missing"; } catch { return "invalid"; }
};

export const assertCredentialKeyCurrent = () => {
  if (envFileKeyHash() !== envFileBaseline) {
    throw keyError(
      "CREDENTIALS_KEY_STALE",
      `${KEY_ENV} in the server .env file changed after the server started. Restart the server, then save the mailbox passwords again.`,
    );
  }
};

// Returns the 32-byte key, null when unset, or throws when the value is malformed.
// The key value itself is never included in any message.
export const loadCredentialKey = (raw = process.env[KEY_ENV]) => {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const key = /^[0-9a-f]{64}$/i.test(text)
    ? Buffer.from(text, "hex")
    : /^[A-Za-z0-9+/]+={0,2}$/.test(text) ? Buffer.from(text, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw keyError(
      "CREDENTIALS_KEY_INVALID",
      `${KEY_ENV} must be 32 random bytes written as 64 hex characters or base64`,
    );
  }
  return key;
};

export const isEncryptedSecret = (value) => typeof value === "string" && value.startsWith(PREFIX);

export const encryptSecret = (plaintext, key, context) => {
  if (!key) {
    throw keyError("CREDENTIALS_KEY_REQUIRED", `Set ${KEY_ENV} on the server before saving mailbox passwords`);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};

// Decrypts an enc:v1 value. Values without the prefix are legacy plaintext and returned
// as-is; callers report them so they can be re-saved encrypted.
export const decryptSecret = (value, key, context) => {
  if (!isEncryptedSecret(value)) return value;
  if (!key) {
    throw keyError("CREDENTIALS_KEY_REQUIRED", `${KEY_ENV} is required to read the stored mailbox password`);
  }
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw keyError("CREDENTIALS_UNREADABLE", "Stored mailbox password is malformed");
  try {
    const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw keyError(
      "CREDENTIALS_UNREADABLE",
      `Stored mailbox password could not be decrypted; check ${KEY_ENV} or enter the password again`,
    );
  }
};

const MAIL_SECTIONS = ["imap", "smtp"];
const contextFor = (section) => `recruitment-mail:${section}:password`;

// Copy of a mail config with every non-empty password encrypted (already-encrypted values
// are kept). Throws CREDENTIALS_KEY_REQUIRED when a password must be stored without a key.
export const encryptMailConfigSecrets = (config = {}, key = loadCredentialKey()) => {
  const output = structuredClone(config);
  for (const section of MAIL_SECTIONS) {
    const password = output[section]?.password;
    if (!password || isEncryptedSecret(password)) continue;
    output[section].password = encryptSecret(password, key, contextFor(section));
  }
  return output;
};

// Decrypts a stored mail config. Never throws: a password that cannot be read is
// replaced with "" and reported, so the server keeps running without it.
// Returns { config, storage } where storage[section] is
// "encrypted" | "unencrypted" | "unreadable" | "none".
export const decryptMailConfigSecrets = (config = {}, key) => {
  const output = structuredClone(config || {});
  const storage = {};
  let resolvedKey = key;
  let keyProblem = null;
  if (resolvedKey === undefined) {
    try { resolvedKey = loadCredentialKey(); }
    catch (error) { resolvedKey = null; keyProblem = error; }
  }
  for (const section of MAIL_SECTIONS) {
    const password = output[section]?.password;
    if (!password) { storage[section] = "none"; continue; }
    if (!isEncryptedSecret(password)) { storage[section] = "unencrypted"; continue; }
    try {
      if (keyProblem) throw keyProblem;
      output[section].password = decryptSecret(password, resolvedKey, contextFor(section));
      storage[section] = "encrypted";
    } catch {
      output[section].password = "";
      storage[section] = "unreadable";
    }
  }
  return { config: output, storage };
};
