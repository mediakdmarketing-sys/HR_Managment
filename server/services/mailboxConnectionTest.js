import { ImapFlow } from "imapflow";
import { imapTlsOptions, scrubSecrets } from "../utils/mailSecurity.js";

// Connects to an IMAP mailbox with an already-resolved configuration (see
// resolveMailTestConfig), opens INBOX and reports its counts. TLS is mandatory (direct or
// STARTTLS), protocol logging stays off and error messages are scrubbed so credentials
// never reach logs or API responses.
export const testImapConnection = async (config) => {
  const credentials = [{ user: config.user, password: config.password }];
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    ...imapTlsOptions(config),
    auth: { user: config.user, pass: config.password },
    logger: false,
    clientInfo: { name: "HRMS-SmartHire", version: "1.0.0" },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
  // Socket errors after a failed connect are emitted as events; without a listener they
  // would crash the process.
  client.on("error", () => {});

  try {
    await client.connect();
    const mailboxLock = await client.getMailboxLock("INBOX");
    const mailbox = client.mailbox || null;
    const messageCount = mailbox?.exists || 0;
    mailboxLock?.release();
    await client.logout();
    console.log(`[IMAP Test] Connected to ${config.host}:${config.port}. Messages: ${messageCount}`);

    return {
      success: true,
      mailbox: config.user,
      messageCount,
      host: config.host,
      port: config.port,
      folderStatus: mailbox
        ? { exists: mailbox.exists || 0, recent: mailbox.recent || 0, unseen: mailbox.unseen || 0 }
        : null,
    };
  } catch (error) {
    const detail = scrubSecrets(
      [error.message, error.responseText].filter(Boolean).join(": ") || "Connection failed",
      credentials,
    );
    console.error(`[IMAP Test Error] ${config.host}:${config.port} ${detail}`);
    throw new Error(`IMAP Mailbox connection failed: ${detail}`);
  } finally {
    if (client.usable) {
      try { await client.logout(); } catch { /* already closed */ }
    } else {
      client.close();
    }
  }
};
