/**
 * Recruitment Email Integration Service
 * Handles automatic CV collection from configured recruitment mailbox
 * Extracts attachments, creates candidates/applications, triggers AI analysis
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { recruitmentFirestore } from "./recruitmentFirebaseService.js";
import { validateResumeUpload, extractResumeText } from "../utils/recruitmentResume.js";
import { createRecruitmentNotification } from "./recruitmentNotificationService.js";
import { testImapConnection } from "./mailboxConnectionTest.js";
import {
  imapTlsOptions,
  passwordForSavedSettings,
  resolveMailTestConfig,
  scrubSecrets,
} from "../utils/mailSecurity.js";
import {
  assertCredentialKeyCurrent,
  credentialKeyStatus,
  decryptMailConfigSecrets,
  encryptMailConfigSecrets,
} from "../utils/credentialCrypto.js";

// Configuration
export const OFFICIAL_RECRUITMENT_EMAIL = "recruiting@kdmarketing.org";
let dynamicMailConfig = null;

export const setDynamicMailConfig = (config) => {
  dynamicMailConfig = config;
};

export const getRecruitmentMailConfig = () => {
  if (dynamicMailConfig?.imap) {
    return {
      enabled: dynamicMailConfig.imap.enabled !== false && dynamicMailConfig.sync?.enabled !== false,
      host: dynamicMailConfig.imap.host || process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST,
      port: Number(dynamicMailConfig.imap.port || process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
      secure: dynamicMailConfig.imap.secure !== false,
      user: dynamicMailConfig.imap.user || process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
      password: dynamicMailConfig.imap.password || process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD,
      pollInterval: Number(dynamicMailConfig.sync?.pollInterval || process.env.RECRUITMENT_EMAIL_POLL_INTERVAL || 60000), // 60 seconds
      sinceDays: Number(process.env.RECRUITMENT_EMAIL_SINCE_DAYS || 2),
    };
  }
  return {
    enabled: process.env.RECRUITMENT_EMAIL_ENABLED !== "false",
    host: process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST,
    port: Number(process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
    secure: true,
    user: process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
    password: process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD,
    pollInterval: Number(process.env.RECRUITMENT_EMAIL_POLL_INTERVAL || 60000), // 60 seconds
    sinceDays: Number(process.env.RECRUITMENT_EMAIL_SINCE_DAYS || 2),
  };
};

export const isRecruitmentEmailConfigured = () => {
  const config = getRecruitmentMailConfig();
  return Boolean(config.host && config.user && config.password);
};

const readStoredEmailConfig = async () => {
  const settings = await recruitmentFirestore.list("recruitmentSettings", {});
  return settings.find((s) => s.key === "recruitment_email_config") || null;
};

// Logs (without any secret) stored passwords that are unencrypted or cannot be read.
const reportPasswordStorage = (storage) => {
  for (const [section, state] of Object.entries(storage)) {
    if (state === "unencrypted") {
      console.warn(`[Email Config] Stored ${section.toUpperCase()} password is not encrypted; save the email settings again to encrypt it.`);
    } else if (state === "unreadable") {
      console.error(`[Email Config] Stored ${section.toUpperCase()} password could not be decrypted; check RECRUITMENT_CREDENTIALS_KEY or enter the password again.`);
    }
  }
};

// Loads the saved mail configuration from Firestore, decrypts its passwords into memory
// and makes it the active configuration. Returns { config, storage } or null.
export const loadSavedMailConfig = async () => {
  const setting = await readStoredEmailConfig();
  if (!setting?.value) return null;
  const { config, storage } = decryptMailConfigSecrets(setting.value);
  reportPasswordStorage(storage);
  setDynamicMailConfig(config);
  return { config, storage };
};

export const getSavedEmailConfig = async () => {
  try {
    const emailConfigSetting = await readStoredEmailConfig();
    const { config: val, storage } = emailConfigSetting?.value
      ? decryptMailConfigSecrets(emailConfigSetting.value)
      : { config: dynamicMailConfig || {}, storage: {} };

    const imapPass = val.imap?.password || process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD;
    const smtpPass = val.smtp?.password || process.env.SMTP_PASS;
    const storageOf = (section, hasPassword) =>
      storage[section] && storage[section] !== "none"
        ? storage[section]
        : hasPassword ? "environment" : "none";

    return {
      officialEmail: val.officialEmail || process.env.RECRUITMENT_OFFICIAL_EMAIL || OFFICIAL_RECRUITMENT_EMAIL,
      // "ok" | "missing" | "invalid" | "restart-required" (never the key itself)
      encryptionKeyStatus: credentialKeyStatus(),
      imap: {
        host: val.imap?.host || process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || "",
        port: Number(val.imap?.port || process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
        secure: val.imap?.secure !== undefined ? Boolean(val.imap.secure) : true,
        user: val.imap?.user || process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(imapPass),
        passwordStorage: storageOf("imap", Boolean(imapPass)),
        enabled: val.imap?.enabled !== undefined ? Boolean(val.imap.enabled) : (process.env.RECRUITMENT_EMAIL_ENABLED !== "false"),
      },
      smtp: {
        host: val.smtp?.host || process.env.SMTP_HOST || "",
        port: Number(val.smtp?.port || process.env.SMTP_PORT || 465),
        secure: val.smtp?.secure !== undefined ? Boolean(val.smtp.secure) : true,
        user: val.smtp?.user || process.env.SMTP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(smtpPass),
        passwordStorage: storageOf("smtp", Boolean(smtpPass)),
        enabled: val.smtp?.enabled !== undefined ? Boolean(val.smtp.enabled) : true,
      },
      sync: {
        enabled: val.sync?.enabled !== undefined ? Boolean(val.sync.enabled) : true,
        pollInterval: Number(val.sync?.pollInterval || process.env.RECRUITMENT_EMAIL_POLL_INTERVAL || 60000),
      },
    };
  } catch (error) {
    console.error("Failed to load saved email config:", error.message);
    return {
      officialEmail: OFFICIAL_RECRUITMENT_EMAIL,
      imap: {
        host: process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || "",
        port: Number(process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
        secure: true,
        user: process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD),
        enabled: process.env.RECRUITMENT_EMAIL_ENABLED !== "false",
      },
      smtp: {
        host: process.env.SMTP_HOST || "",
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        user: process.env.SMTP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(process.env.SMTP_PASS),
        enabled: true,
      },
      sync: {
        enabled: true,
        pollInterval: Number(process.env.RECRUITMENT_EMAIL_POLL_INTERVAL || 60000),
      },
    };
  }
};

export const saveEmailConfig = async (newConfig = {}) => {
  // Never encrypt with a key that the next restart will not load (see credentialCrypto).
  assertCredentialKeyCurrent();
  const existingSetting = await readStoredEmailConfig();
  // Passwords are compared and retained in plaintext in memory only; storage is encrypted.
  const { config: existingVal, storage } = decryptMailConfigSecrets(existingSetting?.value || {});

  const asBoolean = (value) => value === true || value === "true";
  const envSmtpPort = Number(process.env.SMTP_PORT || 465);
  const savedImap = {
    host: existingVal.imap?.host || process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || "",
    port: Number(existingVal.imap?.port || process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
    secure: existingVal.imap?.secure !== undefined ? asBoolean(existingVal.imap.secure) : true,
    user: existingVal.imap?.user || process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
    password: existingVal.imap?.password || process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD || "",
  };
  const savedSmtp = {
    host: existingVal.smtp?.host || process.env.SMTP_HOST || "",
    port: Number(existingVal.smtp?.port || envSmtpPort),
    secure: existingVal.smtp?.secure !== undefined ? asBoolean(existingVal.smtp.secure) : envSmtpPort === 465,
    user: existingVal.smtp?.user || process.env.SMTP_USER || OFFICIAL_RECRUITMENT_EMAIL,
    password: existingVal.smtp?.password || process.env.SMTP_PASS || "",
  };

  // A stored password that cannot be decrypted must not be silently dropped (the key may
  // only be misconfigured); require it to be re-entered instead.
  for (const [section, label] of [["imap", "IMAP"], ["smtp", "SMTP"]]) {
    const requested = newConfig[section]?.password;
    const provided = typeof requested === "string" && requested.trim() && !requested.startsWith("••");
    if (storage[section] === "unreadable" && !provided) {
      throw Object.assign(
        new Error(`The stored ${label} password could not be decrypted; check RECRUITMENT_CREDENTIALS_KEY or enter the password again`),
        { code: "CREDENTIALS_UNREADABLE" },
      );
    }
  }

  // A blank/masked password keeps the saved one only if host, port, TLS mode and user are
  // all unchanged.
  const imapPassword = passwordForSavedSettings({
    requested: newConfig.imap || {}, saved: savedImap, defaultPort: 993, label: "IMAP",
  });
  const smtpPassword = passwordForSavedSettings({
    requested: newConfig.smtp || {}, saved: savedSmtp, defaultPort: 465, label: "SMTP",
  });

  const mergedConfig = {
    officialEmail: String(newConfig.officialEmail || existingVal.officialEmail || OFFICIAL_RECRUITMENT_EMAIL).trim(),
    imap: {
      host: String(newConfig.imap?.host || savedImap.host || "").trim(),
      port: Number(newConfig.imap?.port || savedImap.port || 993),
      secure: newConfig.imap?.secure !== undefined ? asBoolean(newConfig.imap.secure) : savedImap.secure,
      user: String(newConfig.imap?.user || savedImap.user || OFFICIAL_RECRUITMENT_EMAIL).trim(),
      password: imapPassword,
      enabled: newConfig.imap?.enabled !== undefined ? Boolean(newConfig.imap.enabled) : true,
    },
    smtp: {
      host: String(newConfig.smtp?.host || savedSmtp.host || "").trim(),
      port: Number(newConfig.smtp?.port || savedSmtp.port || 465),
      secure: newConfig.smtp?.secure !== undefined ? asBoolean(newConfig.smtp.secure) : savedSmtp.secure,
      user: String(newConfig.smtp?.user || savedSmtp.user || OFFICIAL_RECRUITMENT_EMAIL).trim(),
      password: smtpPassword,
      enabled: newConfig.smtp?.enabled !== undefined ? Boolean(newConfig.smtp.enabled) : true,
    },
    sync: {
      enabled: newConfig.sync?.enabled !== undefined ? Boolean(newConfig.sync.enabled) : true,
      pollInterval: Math.max(Number(newConfig.sync?.pollInterval || 60000), 10000),
    },
  };

  // Encrypt before anything is written; throws CREDENTIALS_KEY_REQUIRED (nothing stored)
  // when a password would otherwise be saved without RECRUITMENT_CREDENTIALS_KEY.
  const storedConfig = encryptMailConfigSecrets(mergedConfig);

  let settingId = existingSetting?.id;
  if (existingSetting) {
    await recruitmentFirestore.update("recruitmentSettings", existingSetting.id, {
      value: storedConfig,
    });
  } else {
    settingId = (await recruitmentFirestore.create("recruitmentSettings", {
      key: "recruitment_email_config",
      value: storedConfig,
    })).id;
  }

  // Read the record back and prove it decrypts, with the key a restart will load, to the
  // passwords just saved. On any mismatch the previous stored value is put back so a
  // recoverable ciphertext is never replaced by an unreadable one.
  const verified = decryptMailConfigSecrets((await readStoredEmailConfig())?.value || {});
  const mismatch = ["imap", "smtp"].filter((section) =>
    (verified.config[section]?.password || "") !== (mergedConfig[section].password || ""));
  if (mismatch.length) {
    if (existingSetting) {
      await recruitmentFirestore.update("recruitmentSettings", settingId, { value: existingSetting.value });
    }
    throw Object.assign(
      new Error(`Saved ${mismatch.map((s) => s.toUpperCase()).join(" and ")} password could not be verified; nothing was changed. Check RECRUITMENT_CREDENTIALS_KEY and restart the server.`),
      { code: "CREDENTIALS_VERIFY_FAILED" },
    );
  }

  setDynamicMailConfig(mergedConfig);

  // Restart email polling if enabled and configured
  stopEmailPolling();
  if (mergedConfig.sync.enabled && mergedConfig.imap.enabled) {
    startEmailPolling();
  }

  return getSavedEmailConfig();
};

/**
 * Strip quoted reply content from email body
 * Keeps only the new message text
 */
const stripQuotedReply = (text) => {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  let cutIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Gmail style: "On <date>, <person> wrote:"
    if (/^On\b.*wrote:\s*$/i.test(line)) {
      cutIndex = i;
      break;
    }
    
    // Outlook style: "----- Original Message -----"
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line)) {
      cutIndex = i;
      break;
    }
    
    // Classic quoted lines: "> text"
    if (/^>/.test(line)) {
      cutIndex = i;
      break;
    }
  }

  if (cutIndex === -1) return text.trim();
  return lines.slice(0, cutIndex).join("\n").trim();
};

const MAX_STORED_BODY = 20_000;
const RESUME_EXTENSIONS = [".pdf", ".docx", ".txt"];
// .doc cannot be parsed, but it still marks a message as a likely application.
const CV_SIGNAL_EXTENSIONS = [...RESUME_EXTENSIONS, ".doc"];

const extensionOf = (fileName = "") => {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
};

// Readable text from an HTML-only email (scripts, styles and tags removed).
const htmlToText = (html) => String(html || "")
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;/gi, "'")
  .replace(/&amp;/gi, "&")
  .replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const bodyTextOf = (parsed) =>
  (typeof parsed.text === "string" && parsed.text.trim()) ? parsed.text : htmlToText(parsed.html);

// Document attachments sent as files (inline images such as signature logos do not count).
const documentAttachments = (parsed) => (parsed.attachments || []).filter((attachment) =>
  attachment.contentDisposition !== "inline" &&
  CV_SIGNAL_EXTENSIONS.includes(extensionOf(attachment.filename || "")));

// Whole-word recruitment terms, matched against the subject and the text (or HTML) body.
const RECRUITMENT_PATTERNS = [
  /\bapplica(?:tion|nt)s?\b/, /\bappl(?:y|ying|ied)\b/, /\bcvs?\b/, /\br[eé]sum[eé]s?\b/,
  /\bcurriculum vitae\b/, /\bjobs?\b/, /\bpositions?\b/, /\bvacanc(?:y|ies)\b/, /\bcareers?\b/,
  /\bemployment\b/, /\binterested in\b/, /\binterview(?:s|ed|ing)?\b/, /\bhiring\b/,
  /\brecruit(?:ment|ing|er)?\b/,
];

/**
 * Check if email appears to be recruitment-related.
 * A message is kept when it comes from a known candidate (a reply needs no keywords),
 * mentions a recruitment term in its subject or body (plain-text or HTML), or carries a
 * CV-type document attachment.
 */
const isRecruitmentEmail = (parsed, { knownCandidate = false } = {}) => {
  if (knownCandidate) return true;
  const haystack = `${parsed.subject || ""}\n${bodyTextOf(parsed)}`.toLowerCase();
  if (RECRUITMENT_PATTERNS.some((pattern) => pattern.test(haystack))) return true;
  return documentAttachments(parsed).length > 0;
};

// Bounces and copies of the mailbox's own messages are never candidate mail.
const isAutomatedOrOwnMessage = (address, mailboxUser) =>
  address === String(mailboxUser || "").trim().toLowerCase() ||
  /^(mailer-daemon|postmaster)@/i.test(address);

/**
 * Extract job title from email subject/body
 */
const extractJobTitle = (parsed) => {
  const subject = parsed.subject || "";
  const text = parsed.text || "";

  // Try to find "Application for <Job Title>" pattern
  const patterns = [
    /application\s+for\s+(.+?)(?:\s*[-–—]\s*|\s*$)/i,
    /applying\s+for\s+(.+?)(?:\s*[-–—]\s*|\s*$)/i,
    /position:\s*(.+?)(?:\s*[-–—]\s*|\s*$)/i,
    /job:\s*(.+?)(?:\s*[-–—]\s*|\s*$)/i,
    /role:\s*(.+?)(?:\s*[-–—]\s*|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern) || text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 200);
    }
  }

  return null;
};

/**
 * Validate CV attachments before anything is stored. Returns upload-ready files whose
 * type, signature and size are valid and whose text can be extracted.
 */
const prepareResumeAttachments = async (parsed, messageId) => {
  const prepared = [];
  for (const attachment of documentAttachments(parsed)) {
    const fileName = attachment.filename || "attachment";
    if (!RESUME_EXTENSIONS.includes(extensionOf(fileName))) continue;
    try {
      const base64 = Buffer.from(attachment.content || []).toString("base64");
      const contentType = attachment.contentType || "application/octet-stream";
      const { bytes, extension } = validateResumeUpload({ fileName, base64, contentType });
      const text = await extractResumeText(bytes, extension);
      if (!text.trim()) throw Object.assign(new Error("no extractable text"), { code: "INVALID_FILE_CONTENT" });
      prepared.push({ fileName, base64, contentType });
    } catch (error) {
      // File names and contents are personal data; log only the reason code.
      console.warn(`[Email Intake] CV attachment skipped in ${messageId}: ${error.code || "invalid file"}`);
    }
  }
  return prepared;
};

const findCandidateByEmail = async (normalizedEmail) => {
  const candidates = await recruitmentFirestore.list("recruitmentCandidates", { limit: 1000 });
  return candidates.find((candidate) =>
    String(candidate.email || "").toLowerCase().trim() === normalizedEmail) || null;
};

const createCandidateFromEmail = (normalizedEmail, senderName) =>
  recruitmentFirestore.create("recruitmentCandidates", {
    name: String(senderName || "").trim() || normalizedEmail,
    email: normalizedEmail,
    source: "Email",
    status: "New",
    phone: null,
    location: null,
    skills: [],
    experience: null,
    education: null,
  });

/**
 * Match candidate to job based on email content
 */
const matchCandidateToJob = async (parsed) => {
  const jobTitle = extractJobTitle(parsed);

  if (!jobTitle) {
    return null;
  }

  // Find matching active job
  const jobs = await recruitmentFirestore.list("recruitmentJobs", {});

  const matchedJob = jobs.find(job => {
    if (job.status !== "Open") return false;

    const titleMatch = job.title.toLowerCase().includes(jobTitle.toLowerCase()) ||
                      jobTitle.toLowerCase().includes(job.title.toLowerCase());

    return titleMatch;
  });

  return matchedJob || null;
};

/**
 * Find or create the application for a candidate and job (applications require a job).
 */
const findOrCreateApplication = async (candidate, job, emailRecord) => {
  const applications = await recruitmentFirestore.list("recruitmentApplications", { candidateId: candidate.id });
  const existingApplication = applications.find((app) => app.jobId === job.id);
  if (existingApplication) return existingApplication;

  return recruitmentFirestore.create("recruitmentApplications", {
    candidateId: candidate.id,
    jobId: job.id,
    status: "To Be Reviewed",
    source: "Email",
    appliedAt: emailRecord.receivedAt,
    notes: `Application received via email: ${emailRecord.subject}`.slice(0, 1000),
  });
};

/**
 * Queue AI analysis for a stored resume. The pending-analysis processor reads the text
 * from the resume record, so it is not copied here (that could exceed the payload limit).
 */
const queueAIAnalysis = async ({ candidate, application, job, resume }) => {
  try {
    return await recruitmentFirestore.create("recruitmentAiResults", {
      candidateId: candidate.id,
      applicationId: application?.id || null,
      resumeId: resume.resumeId,
      jobId: job?.id || null,
      resumeAttachmentId: resume.attachmentId,
      jobRole: job?.title || "General Application",
      status: "Pending",
      screeningMode: "auto-email",
    });
  } catch (error) {
    console.error(`[Email Intake] Could not queue AI analysis for resume ${resume.resumeId}: ${error.code || error.message}`);
    return null;
  }
};

const validDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date : new Date();
};

/**
 * Store incoming email record (server-only fields are written with { internal: true }).
 */
const storeIncomingEmail = (parsed, messageId, { senderEmail, candidateId }) =>
  recruitmentFirestore.create("recruitmentEmailReplies", {
    providerMessageId: messageId,
    fromEmail: senderEmail,
    fromName: String(parsed.from?.value?.[0]?.name || "").slice(0, 200),
    subject: String(parsed.subject || "").slice(0, 500),
    body: stripQuotedReply(bodyTextOf(parsed)).slice(0, MAX_STORED_BODY),
    receivedAt: validDate(parsed.date).toISOString(),
    candidateId: candidateId || null,
    applicationId: null,
    isRead: false,
    processingStatus: "Processing",
    processedAt: null,
  }, { internal: true });

const markEmail = (emailRecord, changes) =>
  recruitmentFirestore.update("recruitmentEmailReplies", emailRecord.id, {
    ...changes,
    processedAt: new Date().toISOString(),
  }, { internal: true });

/**
 * Process a single email message.
 * Every recruitment-related message is stored for the Mail Inbox first; CV intake
 * (candidate, application, resume, AI queue, notification) follows. Logs carry message
 * IDs and outcome codes only, never addresses or message content.
 */
const processEmail = async (parsed, messageId, { mailboxUser = "" } = {}) => {
  let emailRecord = null;
  try {
    const sender = parsed.from?.value?.[0] || {};
    const senderEmail = String(sender.address || "").trim().toLowerCase();
    if (!senderEmail) return { skipped: true, reason: "no-sender" };
    if (isAutomatedOrOwnMessage(senderEmail, mailboxUser)) return { skipped: true, reason: "automated-or-own" };

    const existing = await recruitmentFirestore.list("recruitmentEmailReplies", { providerMessageId: messageId, limit: 1 });
    if (existing.length) return { skipped: true, reason: "duplicate" };

    const knownCandidate = await findCandidateByEmail(senderEmail);
    if (!isRecruitmentEmail(parsed, { knownCandidate: Boolean(knownCandidate) })) {
      return { skipped: true, reason: "not-recruitment" };
    }

    try {
      emailRecord = await storeIncomingEmail(parsed, messageId, {
        senderEmail,
        candidateId: knownCandidate?.id || null,
      });
    } catch (error) {
      // Another poller (this or another backend instance) stored this message first.
      if (error.code === "DUPLICATE_RECORD") return { skipped: true, reason: "duplicate" };
      throw error;
    }

    const attachments = await prepareResumeAttachments(parsed, messageId);
    if (!attachments.length) {
      await markEmail(emailRecord, {
        processingStatus: "Needs Review",
        processingNote: knownCandidate ? "Message from an existing candidate" : "No CV attachment found",
      });
      return { success: true, emailId: emailRecord.id, candidate: knownCandidate };
    }

    const candidate = knownCandidate || await createCandidateFromEmail(senderEmail, sender.name);

    // Store the CVs first: an application is only created once at least one CV is stored.
    const resumes = [];
    for (const attachment of attachments) {
      try {
        const uploaded = await recruitmentFirestore.upload({ ...attachment, candidateId: candidate.id });
        resumes.push({ resumeId: uploaded.resumeId, attachmentId: uploaded.id });
      } catch (error) {
        console.error(`[Email Intake] CV could not be stored for ${messageId}: ${error.code || "error"}`);
      }
    }

    if (!resumes.length) {
      // Nothing usable was stored. A candidate created just for this email is rolled back so
      // no candidate exists without a CV; an existing candidate is left untouched.
      if (!knownCandidate) {
        try { await recruitmentFirestore.remove("recruitmentCandidates", candidate.id); }
        catch (error) { console.error(`[Email Intake] Could not roll back candidate for ${messageId}: ${error.code || "error"}`); }
      }
      await markEmail(emailRecord, {
        candidateId: knownCandidate?.id || null,
        processingStatus: "Needs Review",
        processingNote: "CV could not be stored",
      });
      return { success: true, emailId: emailRecord.id, candidate: knownCandidate, resumes };
    }

    const job = await matchCandidateToJob(parsed);
    // Creating the application also creates its Hiring Alert (see recruitmentService.create).
    const application = job ? await findOrCreateApplication(candidate, job, emailRecord) : null;
    if (application) {
      for (const resume of resumes) {
        await recruitmentFirestore.update("recruitmentResumes", resume.resumeId, {
          applicationId: application.id,
          jobId: job.id,
        });
      }
    }

    const aiResults = [];
    for (const resume of resumes) {
      const aiResult = await queueAIAnalysis({ candidate, application, job, resume });
      if (aiResult) aiResults.push(aiResult);
    }

    await markEmail(emailRecord, {
      candidateId: candidate.id,
      applicationId: application?.id || null,
      processingStatus: application ? "Processed" : "Needs Review",
      processingNote: application ? null : "No open job matched; assign a job manually",
    });

    // A CV without an application has no application alert, so raise one for it here.
    if (!application) {
      try {
        await createRecruitmentNotification({
          type: "new_cv",
          category: "application",
          title: "New CV Received",
          message: `New CV received from ${candidate.name}; no open job matched, assign one to create an application`,
          candidateId: candidate.id,
          resumeId: resumes[0].resumeId,
        });
      } catch {
        // Already logged by the notification service; the email and CV are stored.
      }
    }

    console.log(`[Email Intake] Stored ${messageId}: candidate=${candidate.id}, application=${application?.id || "none"}, resumes=${resumes.length}`);
    return { success: true, emailId: emailRecord.id, candidate, application, job, resumes, aiResults };

  } catch (error) {
    console.error(`[Email Intake] Failed to process ${messageId}: ${error.code || ""} ${error.message}`);
    if (emailRecord) {
      try {
        await markEmail(emailRecord, {
          processingStatus: "Failed",
          processingNote: "Automatic processing failed; review this message manually",
        });
      } catch { /* the original error is reported below */ }
    }
    return { error: error.message };
  }
};

/**
 * Poll mailbox for new recruitment emails
 */
// Only one poll runs at a time in this process. A caller that arrives while a poll is in
// progress (interval tick, manual sync, restart after a settings save) shares its result
// instead of opening a second IMAP session over the same messages.
let activePoll = null;
export const pollRecruitmentEmails = () => {
  activePoll ||= runPoll().finally(() => { activePoll = null; });
  return activePoll;
};

const runPoll = async () => {
  const config = getRecruitmentMailConfig();

  if (!config.enabled) {
    console.log("[Email Poll] Recruitment email polling is disabled");
    return { skipped: true, reason: "disabled", processedCount: 0, skippedCount: 0, errorCount: 0 };
  }

  if (!isRecruitmentEmailConfigured()) {
    const msg = "Recruitment email is not configured (missing credentials)";
    console.log("[Email Poll] ✗ " + msg);
    return { skipped: true, reason: "not-configured", processedCount: 0, skippedCount: 0, errorCount: 0, error: msg };
  }

  console.log(`[Email Poll] Starting IMAP authentication...`);
  console.log(`[Email Poll]   Server: ${config.host}:${config.port} (SSL/TLS=${config.secure})`);
  console.log(`[Email Poll]   User: ${config.user}`);

  const credentials = [{ user: config.user, password: config.password }];
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    // TLS is mandatory: direct TLS, or STARTTLS required before login.
    ...imapTlsOptions(config),
    auth: { user: config.user, pass: config.password },
    logger: false,
  });
  // Late socket errors are emitted as events; without a listener they crash the process.
  client.on("error", (error) => {
    console.error("[Email Poll] IMAP client error:", scrubSecrets(error?.message || "unknown", credentials));
  });

  try {
    await client.connect();
    console.log("[Email Poll] ✓ IMAP connection established");
    
    const lock = await client.getMailboxLock("INBOX");
    console.log("[Email Poll] ✓ INBOX lock acquired");
    
    try {
      const since = new Date();
      since.setDate(since.getDate() - config.sinceDays);
      
      const uids = await client.search({ since });

      if (!uids || uids.length === 0) {
        console.log(`[Email Poll] ✓ Sync complete: No new messages since ${since.toISOString()}`);
        await updateSyncStatus({ success: true, processedCount: 0, skippedCount: 0, errorCount: 0, isPollingEnabled: true });
        return { success: true, processedCount: 0, skippedCount: 0, errorCount: 0 };
      }

      console.log(`[Email Poll] ✓ Found ${uids.length} message(s) since ${since.toISOString()}`);

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errorDetails = [];

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true });
          if (!message?.source) {
            console.log(`[Email Poll] ⊘ Skipping UID ${uid}: no source`);
            skippedCount++;
            continue;
          }

          const parsed = await simpleParser(message.source);
          const messageId = parsed.messageId || `${config.user}-uid${uid}`;

          const result = await processEmail(parsed, messageId, { mailboxUser: config.user });

          if (result.skipped) {
            skippedCount++;
            console.log(`[Email Poll] ⊘ Skipped UID ${uid}: ${result.reason}`);
          } else if (result.error) {
            errorCount++;
            errorDetails.push(`UID${uid}: ${result.error}`);
            console.error(`[Email Poll] ✗ Error processing UID ${uid}: ${result.error}`);
          } else if (result.success) {
            processedCount++;
            console.log(`[Email Poll] ✓ Stored UID ${uid} in Mail Inbox: email=${result.emailId}, candidate=${result.candidate?.id || "none"}`);
          }

        } catch (error) {
          errorCount++;
          errorDetails.push(`UID${uid}: ${error.message}`);
          console.error(`[Email Poll] ✗ Failed to fetch/parse message ${uid}: ${error.message}`);
        }
      }

      const pollSuccess = errorCount === 0;
      const pollError = errorDetails.length > 0 ? errorDetails.slice(0, 5).join("; ") : null;

      await updateSyncStatus({
        success: pollSuccess,
        processedCount,
        skippedCount,
        errorCount,
        error: pollError,
        isPollingEnabled: true,
      });

      const status = pollSuccess ? "✓ SUCCESS" : "⚠ PARTIAL";
      console.log(`[Email Poll] ${status} Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

      return {
        success: pollSuccess,
        processedCount,
        skippedCount,
        errorCount,
        error: pollError,
      };

    } finally {
      lock.release();
      console.log("[Email Poll] INBOX lock released");
    }

  } catch (error) {
    // Server replies can quote what the client sent; scrub before logging or storing.
    const detail = scrubSecrets(
      [error.message, error.responseText].filter(Boolean).join(": ") || "Connection failed",
      credentials,
    );
    console.error("[Email Poll] ✗ IMAP connection failed:", detail);
    console.error("[Email Poll]   Error Code:", error.code);
    console.error("[Email Poll]   Server:", `${config.host}:${config.port}`);

    const errorMsg = `IMAP connection failed to ${config.host}:${config.port} for ${config.user}: ${detail}`;
    
    await updateSyncStatus({
      success: false,
      error: errorMsg,
      errorCount: 1,
      processedCount: 0,
      skippedCount: 0,
      isPollingEnabled: true,
    });
    
    // Don't throw - this allows the polling loop to continue
    return {
      success: false,
      error: errorMsg,
      errorCount: 1,
      processedCount: 0,
      skippedCount: 0,
    };
  } finally {
    try {
      if (client.usable) {
        await client.logout();
        console.log("[Email Poll] ✓ IMAP connection closed");
      } else {
        client.close();
      }
    } catch (e) {
      // Ignore logout errors
    }
  }
};

/**
 * Update sync status record
 * 
 * IMPORTANT: This tracks CUMULATIVE metrics across all syncs,
 * but processedCount/skippedCount/errorCount should reflect OVERALL totals,
 * while individual poll results show THIS poll's results.
 */
const updateSyncStatus = async (status) => {
  try {
    const settings = await recruitmentFirestore.list("recruitmentSettings", {});
    let syncStatusSetting = settings.find(s => s.key === "email_sync_status");
    const existingStatus = syncStatusSetting?.value || {};

    const now = new Date().toISOString();
    
    // For cumulative counts: add THIS poll's results to PREVIOUS totals
    // This way we track the total across all syncs, not just last poll
    const statusData = {
      lastSyncStartedAt: now,
      lastSyncCompletedAt: now, // Always update to reflect attempt
      lastSuccessfulSyncAt: status.success && (status.processedCount > 0 || status.skippedCount > 0) ? now : existingStatus.lastSuccessfulSyncAt || null,
      lastError: status.error || null,
      lastErrorTime: status.error ? now : null,
      
      // Cumulative totals across all polls
      totalProcessedCount: (existingStatus.totalProcessedCount || 0) + (status.processedCount || 0),
      totalSkippedCount: (existingStatus.totalSkippedCount || 0) + (status.skippedCount || 0),
      totalErrorCount: (existingStatus.totalErrorCount || 0) + (status.errorCount || 0),
      
      // Last poll's results (for monitoring current poll)
      lastPollProcessedCount: status.processedCount || 0,
      lastPollSkippedCount: status.skippedCount || 0,
      lastPollErrorCount: status.errorCount || 0,
      
      syncStatus: status.success && !status.error ? "Success" : "Failed",
      isPollingEnabled: status.isPollingEnabled !== undefined ? status.isPollingEnabled : existingStatus.isPollingEnabled !== false,
    };

    if (syncStatusSetting) {
      await recruitmentFirestore.update("recruitmentSettings", syncStatusSetting.id, {
        value: statusData,
      });
    } else {
      await recruitmentFirestore.create("recruitmentSettings", {
        key: "email_sync_status",
        value: statusData,
      });
    }

  } catch (error) {
    console.error("Failed to update sync status:", error.message);
  }
};

/**
 * Get current sync status
 */
export const getEmailSyncStatus = async () => {
  try {
    const settings = await recruitmentFirestore.list("recruitmentSettings", {});
    const syncStatusSetting = settings.find(s => s.key === "email_sync_status");

    if (!syncStatusSetting) {
      return {
        configured: isRecruitmentEmailConfigured(),
        enabled: getRecruitmentMailConfig().enabled,
        lastSyncStartedAt: null,
        lastSyncCompletedAt: null,
        lastSuccessfulSyncAt: null,
        lastError: null,
        lastErrorTime: null,
        totalProcessedCount: 0,
        totalSkippedCount: 0,
        totalErrorCount: 0,
        lastPollProcessedCount: 0,
        lastPollSkippedCount: 0,
        lastPollErrorCount: 0,
        syncStatus: "Never Run",
        isPollingEnabled: true,
      };
    }

    // For backward compatibility, also return simplified "counts"
    const status = syncStatusSetting.value;
    return {
      configured: isRecruitmentEmailConfigured(),
      enabled: getRecruitmentMailConfig().enabled,
      ...status,
      // Backward compat aliases
      processedCount: status.totalProcessedCount || status.processedCount || 0,
      skippedCount: status.totalSkippedCount || status.skippedCount || 0,
      errorCount: status.totalErrorCount || status.errorCount || 0,
    };

  } catch (error) {
    console.error("Failed to get sync status:", error.message);
    return {
      configured: isRecruitmentEmailConfigured(),
      enabled: getRecruitmentMailConfig().enabled,
      error: error.message,
    };
  }
};

/**
 * Test mailbox connection
 */
// The saved password is only ever sent to the saved host and user (resolveMailTestConfig);
// testing any other server requires the caller to supply that server's password.
export const testMailboxConnection = async (customConfig = null) => {
  const config = resolveMailTestConfig({
    requested: customConfig || {},
    saved: getRecruitmentMailConfig(),
    defaultPort: 993,
    label: "IMAP",
  });
  return testImapConnection(config);
};

const sameAccount = (a, b) =>
  String(a.host || "").trim().toLowerCase() === String(b.host || "").trim().toLowerCase() &&
  String(a.user || "").trim().toLowerCase() === String(b.user || "").trim().toLowerCase();

// Outgoing (SMTP) mailbox settings. The saved settings (decrypted in memory by
// loadSavedMailConfig) are used as a unit; the SMTP_* environment variables apply only when
// no SMTP server has been saved. The environment password is never combined with a
// different saved server or account.
export const getRecruitmentSmtpConfig = () => {
  const env = {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASS || "",
  };
  const smtp = dynamicMailConfig?.smtp;
  if (!smtp?.host) {
    return { ...env, secure: env.port === 465, enabled: true, source: env.host ? "environment" : "none" };
  }
  const port = Number(smtp.port || 465);
  const saved = { host: smtp.host, user: smtp.user || "" };
  return {
    host: smtp.host,
    port,
    secure: smtp.secure !== undefined ? smtp.secure !== false : port === 465,
    user: saved.user,
    password: smtp.password || (sameAccount(saved, env) ? env.password : ""),
    enabled: smtp.enabled !== false,
    source: "saved",
  };
};

// True when recruitment email can actually be delivered: an enabled SMTP server with a
// host, user and a usable (decrypted) password.
export const isRecruitmentSmtpConfigured = () => {
  const smtp = getRecruitmentSmtpConfig();
  return Boolean(smtp.enabled && smtp.host && smtp.user && smtp.password);
};

// Auto-start polling if not in test environment
let pollingInterval = null;
let initialPollTimer = null;
let isPollingInitialized = false;

/**
 * Initialize and start email polling with Firebase credentials
 * This is async to load credentials from Firebase before polling
 */
export const initializeEmailPolling = async () => {
  console.log("[Email Polling] Initializing email polling system...");
  
  if (process.env.NODE_ENV === "test") {
    console.log("[Email Polling] Polling disabled in test environment");
    isPollingInitialized = true;
    return;
  }

  try {
    // Load saved configuration from Firebase
    console.log("[Email Polling] Loading saved email configuration from Firebase...");
    // Decrypts stored passwords into memory only (see loadSavedMailConfig).
    const loaded = await loadSavedMailConfig();

    if (loaded) {
      console.log("[Email Polling] ✓ Found saved email configuration in Firebase");
      const { config } = loaded;
      console.log(`[Email Polling] Configuration loaded:`);
      console.log(`  - IMAP Host: ${config.imap?.host}`);
      console.log(`  - IMAP Enabled: ${config.imap?.enabled}`);
      console.log(`  - SMTP Host: ${config.smtp?.host}`);
      console.log(`  - SMTP Enabled: ${config.smtp?.enabled}`);
      console.log(`  - Sync Enabled: ${config.sync?.enabled}`);
      console.log(`  - Poll Interval: ${config.sync?.pollInterval}ms`);
    } else {
      console.log("[Email Polling] ✗ No saved email configuration found in Firebase");
    }
  } catch (error) {
    console.error("[Email Polling] ✗ Error loading configuration from Firebase:", error.message);
  }

  isPollingInitialized = true;

  // Now start polling if configured
  startEmailPolling();
};

export const startEmailPolling = () => {
  console.log("[Email Polling] Attempting to start polling...");
  
  if (!isPollingInitialized) {
    console.log("[Email Polling] ⚠ Polling not initialized yet. Call initializeEmailPolling() first.");
    return;
  }

  if (process.env.NODE_ENV === "test") {
    console.log("[Email Polling] Polling disabled in test environment");
    return;
  }

  if (!isRecruitmentEmailConfigured()) {
    console.log("[Email Polling] ✗ Polling not started: mailbox not configured (missing host, user, or password)");
    return;
  }

  const config = getRecruitmentMailConfig();

  if (!config.enabled) {
    console.log("[Email Polling] ✗ Polling not started: disabled in configuration");
    return;
  }

  if (pollingInterval) {
    console.log("[Email Polling] ⚠ Polling already running (skipping duplicate start)");
    return;
  }

  console.log(`[Email Polling] ✓ Starting recruitment email polling`);
  console.log(`[Email Polling]   Server: ${config.host}:${config.port}`);
  console.log(`[Email Polling]   User: ${config.user}`);
  console.log(`[Email Polling]   Poll Interval: ${config.pollInterval}ms`);

  const poll = async () => {
    try {
      await pollRecruitmentEmails();
    } catch (error) {
      console.error("[Email Polling] Error during poll cycle:", error.message);
    }
  };

  // Initial poll after short delay
  initialPollTimer = setTimeout(() => { initialPollTimer = null; poll(); }, 2000);

  // Schedule recurring polls
  pollingInterval = setInterval(poll, config.pollInterval);
};

export const stopEmailPolling = () => {
  // Also cancel a start-up poll that has not fired yet.
  if (initialPollTimer) {
    clearTimeout(initialPollTimer);
    initialPollTimer = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Email Polling] ✓ Email polling stopped");
  }
};
