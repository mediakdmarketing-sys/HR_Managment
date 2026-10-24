import nodemailer from "nodemailer";

// SMTP settings, e.g. Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=you@gmail.com,
// SMTP_PASS=<16-character app password>.
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
const FROM_NAME = process.env.MAIL_FROM_NAME || "KD Marketing Group HR";

export const isMailConfigured = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter;
const getTransporter = () => {
  const port = Number(SMTP_PORT) || 465;
  transporter ||= nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
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
