// Security helpers for recruitment mailbox credentials. This module has no Firebase or
// network dependencies so it can be unit tested in isolation.

// Keys whose values must never leave the server in an API response.
const SECRET_KEY_PATTERN =
  /^(password|pass|passwd|pwd|secret|clientsecret|client_secret|apikey|api_key|accesstoken|access_token|refreshtoken|refresh_token|token|privatekey|private_key|credentials?)$/i;

export const isSecretKey = (key) => SECRET_KEY_PATTERN.test(String(key));

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

// Returns a deep copy of `value` with every secret-named key removed at any depth.
// Non-plain objects (Dates, Firestore Timestamps, Buffers) are passed through unchanged.
export const redactSecrets = (value) => {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!isPlainObject(value)) return value;
  const copy = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSecretKey(key)) continue;
    copy[key] = redactSecrets(nested);
  }
  return copy;
};

export const containsSecretKeys = (value) => {
  if (Array.isArray(value)) return value.some(containsSecretKeys);
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => isSecretKey(key) || containsSecretKeys(nested),
  );
};

// Express middleware: every res.json() body passing through it is redacted.
export const redactJsonResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(redactSecrets(body));
  next();
};

// recruitmentSettings records that hold mailbox configuration or sync state. They are
// managed only through the validated /email/* endpoints, never the generic data API.
export const PROTECTED_SETTINGS_KEYS = new Set(["recruitment_email_config", "email_sync_status"]);

// Returns an error for a generic-API write that must be refused, or null when allowed.
export const checkGenericSettingsWrite = ({ collectionName, existing = null, payload = null }) => {
  if (collectionName !== "recruitmentSettings") return null;
  const refuse = (message) =>
    Object.assign(new Error(message), { code: "PROTECTED_SETTING" });
  if (existing && PROTECTED_SETTINGS_KEYS.has(existing.key)) {
    return refuse("Recruitment email settings can only be changed from the email settings page");
  }
  if (payload && PROTECTED_SETTINGS_KEYS.has(payload.key)) {
    return refuse("Recruitment email settings can only be changed from the email settings page");
  }
  if (payload && containsSecretKeys(payload)) {
    return refuse("Credentials cannot be stored through the generic recruitment API");
  }
  return null;
};

const normalizeHost = (host) => String(host || "").trim().toLowerCase().replace(/\.$/, "");
const normalizeUser = (user) => String(user || "").trim().toLowerCase();
const isProvidedPassword = (password) =>
  typeof password === "string" && password.trim() !== "" && !password.startsWith("••");
const toBoolean = (value) => value === true || value === "true";

// The full connection target a saved password is bound to.
const sameTarget = (a, b) =>
  normalizeHost(a.host) === normalizeHost(b.host) &&
  Number(a.port) === Number(b.port) &&
  a.secure === b.secure &&
  normalizeUser(a.user) === normalizeUser(b.user);

const targetOf = ({ host, port, secure, user }, defaultPort) => ({
  host: String(host || "").trim(),
  port: Number(port || defaultPort),
  secure: secure === undefined ? true : toBoolean(secure),
  user: String(user || "").trim(),
});

// Every mailbox connection requires TLS: direct TLS when `secure`, otherwise STARTTLS is
// mandatory (the connection fails before login if the server does not offer it).
// Certificate verification is always left on.
const TLS_POLICY = { minVersion: "TLSv1.2", rejectUnauthorized: true };
export const imapTlsOptions = ({ secure }) =>
  secure ? { secure: true, tls: TLS_POLICY } : { secure: false, doSTARTTLS: true, tls: TLS_POLICY };
export const smtpTlsOptions = ({ secure }) =>
  secure ? { secure: true, tls: TLS_POLICY } : { secure: false, requireTLS: true, tls: TLS_POLICY };

// Decides which credentials a connection test may use.
// - A password supplied in the request is used as-is (it is the caller's own secret).
// - The saved password is used only when host, port, TLS mode and user all match the
//   saved configuration, so a test can never deliver it to another server, port or
//   account. Connections always require TLS (see imapTlsOptions/smtpTlsOptions).
export const resolveMailTestConfig = ({ requested = {}, saved = {}, defaultPort, label = "Mail" }) => {
  const request = requested && typeof requested === "object" ? requested : {};
  const savedTarget = targetOf(saved, defaultPort);
  const { host, port, secure, user } = targetOf({
    host: request.host || savedTarget.host,
    port: request.port || savedTarget.port,
    secure: request.secure !== undefined ? request.secure : savedTarget.secure,
    user: request.user || savedTarget.user,
  }, defaultPort);
  const requestedPassword = request.password ?? request.pass;

  if (!host || !user) {
    throw Object.assign(new Error(`${label} host and user email are required for a connection test`), {
      code: "MAIL_CREDENTIALS_REQUIRED",
    });
  }

  if (isProvidedPassword(requestedPassword)) {
    return { host, port, secure, user, password: requestedPassword, usesSavedPassword: false };
  }

  const matchesSaved =
    Boolean(saved.password) && sameTarget({ host, port, secure, user }, savedTarget);

  if (!matchesSaved) {
    throw Object.assign(
      new Error(
        saved.password
          ? `Enter the ${label} password to test a server, port, security mode or account that differs from the saved settings`
          : `Enter the ${label} password to run a connection test`,
      ),
      { code: "MAIL_CREDENTIALS_REQUIRED" },
    );
  }

  return { host, port, secure, user, password: saved.password, usesSavedPassword: true };
};

// Password to store when mailbox settings are saved. A blank or masked password keeps
// the saved one only while host, port, TLS mode and user are all unchanged; any change
// requires the password again, so a saved password can never be redirected by editing
// settings.
export const passwordForSavedSettings = ({ requested = {}, saved = {}, defaultPort, label = "Mail" }) => {
  const requestedPassword = requested.password ?? requested.pass;
  if (isProvidedPassword(requestedPassword)) return requestedPassword;
  if (!saved.password) return "";
  const savedTarget = targetOf(saved, defaultPort);
  const requestedTarget = targetOf({
    host: requested.host || savedTarget.host,
    port: requested.port || savedTarget.port,
    secure: requested.secure !== undefined ? requested.secure : savedTarget.secure,
    user: requested.user || savedTarget.user,
  }, defaultPort);
  if (!sameTarget(requestedTarget, savedTarget)) {
    throw Object.assign(
      new Error(`Enter the ${label} password when changing the ${label} server, port, security mode or user email`),
      { code: "MAIL_CREDENTIALS_REQUIRED" },
    );
  }
  return saved.password;
};

const MIN_SCRUB_LENGTH = 4;

// Encodings in which a password can appear in SMTP/IMAP traffic or server replies.
export const secretVariants = ({ user = "", password = "" } = {}) => {
  if (typeof password !== "string" || password.length < MIN_SCRUB_LENGTH) return [];
  const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
  return [
    b64(`\u0000${user}\u0000${password}`), // SMTP/IMAP AUTH PLAIN
    b64(`${user}\u0000${user}\u0000${password}`),
    b64(password), // AUTH LOGIN
    password.replace(/["\\]/g, "\\$&"), // IMAP quoted string
    encodeURIComponent(password),
    password,
  ].filter((variant, index, all) => variant && all.indexOf(variant) === index);
};

// Removes every known encoding of the given credentials from a message.
export const scrubSecrets = (text, credentials = []) => {
  let output = String(text ?? "");
  const variants = credentials
    .flatMap((credential) => secretVariants(credential))
    .sort((a, b) => b.length - a.length);
  for (const variant of variants) {
    output = output.split(variant).join("[REDACTED]");
  }
  return output;
};
