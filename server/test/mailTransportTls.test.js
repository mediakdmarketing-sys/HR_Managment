// Transport-level checks: mailbox credentials are only ever sent over verified TLS.
// All servers are loopback fakes; no external host is contacted.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { format } from "node:util";
import { secretVariants } from "../utils/mailSecurity.js";
import { createFakeImapServer, createFakeSmtpServer } from "./support/fakeMailServers.js";
import { generateCertificate, getTestCertificate } from "./support/testCertificate.js";

for (const name of Object.keys(process.env)) {
  if (/^(SMTP_|IMAP_|RECRUITMENT_EMAIL_)/.test(name)) delete process.env[name];
}

const { testImapConnection } = await import("../services/mailboxConnectionTest.js");
const { testSmtpConnection } = await import("../services/mailService.js");

const USER = "recruiting@saved.test";
const PASSWORD = "Transport-Pass-58";
const certificate = getTestCertificate();
const untrusted = certificate ? generateCertificate() : null;
const skipTls = certificate && untrusted ? false : "openssl is not available to create a test certificate";

const plainImap = createFakeImapServer();
const plainSmtp = createFakeSmtpServer();
const tlsImap = certificate ? createFakeImapServer({ tls: certificate }) : null;
const starttlsSmtp = certificate ? createFakeSmtpServer({ tls: certificate }) : null;
const untrustedImap = untrusted ? createFakeImapServer({ tls: untrusted }) : null;
const untrustedSmtp = untrusted ? createFakeSmtpServer({ tls: untrusted }) : null;
const servers = [plainImap, plainSmtp, tlsImap, starttlsSmtp, untrustedImap, untrustedSmtp].filter(Boolean);

const assertNoPassword = (text, label) => {
  for (const variant of secretVariants({ user: USER, password: PASSWORD })) {
    assert.equal(String(text).includes(variant), false, `${label} contains a credential form`);
  }
};

const captureConsole = async (work) => {
  const lines = [];
  const originals = {};
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    originals[method] = console[method];
    console[method] = (...args) => { lines.push(format(...args)); };
  }
  try {
    let error = null;
    try { await work(); } catch (caught) { error = caught; }
    return { error, output: lines.join("\n") };
  } finally {
    Object.assign(console, originals);
  }
};

before(async () => { for (const server of servers) await server.start("::"); });
after(async () => { await Promise.all(servers.map((server) => server.stop())); });

const imapConfig = (server, secure) => ({ host: "localhost", port: server.port, secure, user: USER, password: PASSWORD });

test("IMAP never sends credentials over a plaintext connection", async () => {
  for (const secure of [false, true]) {
    const { error, output } = await captureConsole(() => testImapConnection(imapConfig(plainImap, secure)));
    assert.ok(error, `secure=${secure} must fail`);
    assertNoPassword(error.message, "error");
    assertNoPassword(output, "logs");
  }
  assert.deepEqual(plainImap.record.logins, [], "no LOGIN was sent");
  assertNoPassword(plainImap.record.received, "plaintext server traffic");
});

test("SMTP never sends credentials over a plaintext connection", async () => {
  for (const secure of [false, true]) {
    const { error, output } = await captureConsole(() => testSmtpConnection(imapConfig(plainSmtp, secure)));
    assert.ok(error, `secure=${secure} must fail`);
    assertNoPassword(error.message, "error");
    assertNoPassword(output, "logs");
  }
  assert.deepEqual(plainSmtp.record.logins, [], "no AUTH was sent");
  assertNoPassword(plainSmtp.record.received, "plaintext server traffic");
});

test("credentials are never sent to a server with an untrusted certificate", { skip: skipTls }, async () => {
  const imap = await captureConsole(() => testImapConnection(imapConfig(untrustedImap, true)));
  const smtp = await captureConsole(() => testSmtpConnection(imapConfig(untrustedSmtp, false)));
  assert.ok(imap.error && smtp.error);
  assert.deepEqual(untrustedImap.record.logins, []);
  assert.deepEqual(untrustedSmtp.record.logins, []);
  assertNoPassword(untrustedSmtp.record.received, "untrusted server traffic");
});

test("IMAP over direct TLS sends credentials only inside TLS and scrubs the server's echo", { skip: skipTls }, async () => {
  const { error, output } = await captureConsole(() => testImapConnection(imapConfig(tlsImap, true)));
  assert.ok(error);
  assert.equal(tlsImap.record.logins.length, 1);
  assert.equal(tlsImap.record.logins[0].overTls, true);
  assert.ok(tlsImap.record.logins[0].line.includes(PASSWORD), "the fake server really received the password");
  assert.match(error.message, /\[REDACTED\]/);
  assertNoPassword(error.message, "error");
  assertNoPassword(output, "logs");
});

test("SMTP with STARTTLS authenticates only after the upgrade and scrubs the server's echo", { skip: skipTls }, async () => {
  const { error, output } = await captureConsole(() => testSmtpConnection(imapConfig(starttlsSmtp, false)));
  assert.ok(error);
  assert.ok(starttlsSmtp.record.logins.length >= 1);
  assert.ok(starttlsSmtp.record.logins.every((login) => login.overTls), "AUTH only after STARTTLS");
  assert.match(error.message, /\[REDACTED\]/);
  assertNoPassword(error.message, "error");
  assertNoPassword(output, "logs");
});
