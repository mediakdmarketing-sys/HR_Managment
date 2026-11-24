import nodemailer from "nodemailer";
import { resolveMailTestConfig, scrubSecrets, smtpTlsOptions } from "../utils/mailSecurity.js";

// Removes the environment SMTP credentials from error text before it is logged.
export const scrubSmtpError = (message) =>
  scrubSecrets(message, [{ user: process.env.SMTP_USER, password: process.env.SMTP_PASS }]);

// SMTP settings, e.g. Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=you@gmail.com,
// SMTP_PASS=<16-character app password>.
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
const FROM_NAME = process.env.MAIL_FROM_NAME || "KD Marketing Group HR";

export const isMailConfigured = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter;
// TLS is mandatory for sending too: direct TLS on 465, otherwise STARTTLS is required
// rather than opportunistic, so credentials are never sent over a plaintext connection.
const getTransporter = () => {
  const port = Number(SMTP_PORT) || 465;
  transporter ||= nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    ...smtpTlsOptions({ secure: port === 465 }),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
};

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export const sendPasswordResetMail = ({ to, name, link }) =>
  getTransporter().sendMail({
    from: `"${FROM_NAME}" <${process.env.MAIL_FROM || SMTP_USER}>`,
    to,
    subject: "Reset your HR Portal password",
    text: `Hello ${name || ""},\n\nWe received a request to reset the password for your HR Portal account (${to}).\n\nSet a new password here (the link expires in 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n\n${FROM_NAME}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;color:#1e293b">
    <h1 style="margin:0 0 16px;font-size:22px">Reset your password</h1>
    <p style="margin:0 0 12px;line-height:1.6">Hello ${escapeHtml(name || "")},</p>
    <p style="margin:0 0 24px;line-height:1.6">We received a request to reset the password for your HR Portal account (<strong>${escapeHtml(to)}</strong>).</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px">Set a new password</a></p>
    <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.6">The link expires in 1 hour and can be used once. If the button doesn't work, copy this address into your browser:<br><a href="${escapeHtml(link)}" style="color:#0f766e;word-break:break-all">${escapeHtml(link)}</a></p>
    <p style="margin:24px 0 0;font-size:13px;color:#64748b">If you didn't ask for this, you can ignore this email; your password stays the same.</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px">${escapeHtml(FROM_NAME)}</p>
</div>`,
  });

// Sends recruitment mail through the given SMTP account (normally the saved recruitment
// mailbox from getRecruitmentSmtpConfig). TLS is mandatory and certificates are verified;
// protocol logging stays off and any error is scrubbed of the credentials before it is
// rethrown. The From address is the authenticated mailbox, as most providers require.
export const sendRecruitmentMail = async ({ to, subject, text, smtp }) => {
  if (!smtp?.host || !smtp?.user || !smtp?.password) {
    throw Object.assign(new Error("SMTP email delivery is not configured"), { code: "CONFIG_REQUIRED" });
  }
  const credentials = [{ user: smtp.user, password: smtp.password }];
  const mailTransport = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 465,
    ...smtpTlsOptions({ secure: smtp.secure }),
    auth: { user: smtp.user, pass: smtp.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    logger: false,
    debug: false,
  });
  try {
    const info = await mailTransport.sendMail({
      from: `"${FROM_NAME}" <${smtp.user}>`,
      to,
      subject,
      text,
    });
    return { messageId: info?.messageId || null };
  } catch (error) {
    const detail = scrubSecrets(error?.message || "delivery failed", credentials);
    throw Object.assign(new Error(`SMTP delivery failed: ${detail}`), { code: error?.code || "SMTP_DELIVERY_FAILED" });
  } finally {
    mailTransport.close?.();
  }
};

// Verifies SMTP login. Callers pass a configuration already resolved with
// resolveMailTestConfig; the environment password is likewise only used for the
// environment's own SMTP host and user. Protocol logging stays off (nodemailer's
// logger/debug output includes the AUTH exchange) and errors are scrubbed of credentials.
export const testSmtpConnection = async (customConfig = {}) => {
  const { host, port, secure, user, password } = resolveMailTestConfig({
    requested: customConfig,
    saved: {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: Number(SMTP_PORT || 465) === 465,
      user: SMTP_USER,
      password: SMTP_PASS,
    },
    defaultPort: 465,
    label: "SMTP",
  });
  const credentials = [{ user, password }];

  console.log(`[SMTP Test] Testing connection to ${host}:${port} (secure=${secure})`);

  const testTransporter = nodemailer.createTransport({
    host,
    port,
    ...smtpTlsOptions({ secure }),
    auth: { user, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
  });

  try {
    await testTransporter.verify();
    console.log(`[SMTP Test] Verified SMTP connection to ${host}:${port}`);

    return {
      success: true,
      host,
      port,
      user,
      secure,
      message: `SMTP connection to ${host}:${port} verified successfully`,
    };
  } catch (error) {
    const detail = scrubSecrets(error.message || error.code || "Connection timeout", credentials);
    console.error(`[SMTP Test Error] ${host}:${port} code=${error.code || "unknown"} ${detail}`);
    throw new Error(`SMTP connection test failed (${host}:${port}): ${detail}`);
  } finally {
    testTransporter.close();
  }
};
