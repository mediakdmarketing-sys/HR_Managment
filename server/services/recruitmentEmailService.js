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

export const getSavedEmailConfig = async () => {
  try {
    const settings = await recruitmentFirestore.list("recruitmentSettings", {});
    const emailConfigSetting = settings.find(s => s.key === "recruitment_email_config");
    const val = emailConfigSetting?.value || dynamicMailConfig || {};

    const imapPass = val.imap?.password || process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD;
    const smtpPass = val.smtp?.password || process.env.SMTP_PASS;

    return {
      officialEmail: val.officialEmail || process.env.RECRUITMENT_OFFICIAL_EMAIL || OFFICIAL_RECRUITMENT_EMAIL,
      imap: {
        host: val.imap?.host || process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || "",
        port: Number(val.imap?.port || process.env.RECRUITMENT_EMAIL_PORT || process.env.IMAP_PORT || 993),
        secure: val.imap?.secure !== undefined ? Boolean(val.imap.secure) : true,
        user: val.imap?.user || process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(imapPass),
        enabled: val.imap?.enabled !== undefined ? Boolean(val.imap.enabled) : (process.env.RECRUITMENT_EMAIL_ENABLED !== "false"),
      },
      smtp: {
        host: val.smtp?.host || process.env.SMTP_HOST || "",
        port: Number(val.smtp?.port || process.env.SMTP_PORT || 465),
        secure: val.smtp?.secure !== undefined ? Boolean(val.smtp.secure) : true,
        user: val.smtp?.user || process.env.SMTP_USER || OFFICIAL_RECRUITMENT_EMAIL,
        hasPassword: Boolean(smtpPass),
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
  const settings = await recruitmentFirestore.list("recruitmentSettings", {});
  const existingSetting = settings.find(s => s.key === "recruitment_email_config");
  const existingVal = existingSetting?.value || {};

  // Preserve existing passwords if new password is not provided or is placeholder
  const isMaskedOrEmpty = (str) => !str || str.startsWith("••") || str.trim() === "";

  const imapPassword = isMaskedOrEmpty(newConfig.imap?.password)
    ? (existingVal.imap?.password || process.env.RECRUITMENT_EMAIL_PASSWORD || process.env.IMAP_PASSWORD || "")
    : newConfig.imap.password;

  const smtpPassword = isMaskedOrEmpty(newConfig.smtp?.password)
    ? (existingVal.smtp?.password || process.env.SMTP_PASS || "")
    : newConfig.smtp.password;

  const mergedConfig = {
    officialEmail: String(newConfig.officialEmail || existingVal.officialEmail || OFFICIAL_RECRUITMENT_EMAIL).trim(),
    imap: {
      host: String(newConfig.imap?.host || existingVal.imap?.host || "").trim(),
      port: Number(newConfig.imap?.port || existingVal.imap?.port || 993),
      secure: newConfig.imap?.secure !== undefined ? Boolean(newConfig.imap.secure) : true,
      user: String(newConfig.imap?.user || existingVal.imap?.user || OFFICIAL_RECRUITMENT_EMAIL).trim(),
      password: imapPassword,
      enabled: newConfig.imap?.enabled !== undefined ? Boolean(newConfig.imap.enabled) : true,
    },
    smtp: {
      host: String(newConfig.smtp?.host || existingVal.smtp?.host || "").trim(),
      port: Number(newConfig.smtp?.port || existingVal.smtp?.port || 465),
      secure: newConfig.smtp?.secure !== undefined ? Boolean(newConfig.smtp.secure) : true,
      user: String(newConfig.smtp?.user || existingVal.smtp?.user || OFFICIAL_RECRUITMENT_EMAIL).trim(),
      password: smtpPassword,
      enabled: newConfig.smtp?.enabled !== undefined ? Boolean(newConfig.smtp.enabled) : true,
    },
    sync: {
      enabled: newConfig.sync?.enabled !== undefined ? Boolean(newConfig.sync.enabled) : true,
      pollInterval: Math.max(Number(newConfig.sync?.pollInterval || 60000), 10000),
    },
  };

  if (existingSetting) {
    await recruitmentFirestore.update("recruitmentSettings", existingSetting.id, {
      value: mergedConfig,
    });
  } else {
    await recruitmentFirestore.create("recruitmentSettings", {
      key: "recruitment_email_config",
      value: mergedConfig,
    });
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

/**
 * Check if email appears to be a recruitment application
 * Based on keywords, attachments, and context
 */
const isRecruitmentEmail = (parsed) => {
  const subject = (parsed.subject || "").toLowerCase();
  const text = (parsed.text || "").toLowerCase();
  const hasAttachments = parsed.attachments && parsed.attachments.length > 0;

  // Common recruitment keywords
  const keywords = [
    "application", "apply", "cv", "resume", "curriculum vitae",
    "job", "position", "vacancy", "career", "employment",
    "applying for", "interested in", "attached resume",
    "my cv", "my resume"
  ];

  const hasKeyword = keywords.some(keyword => 
    subject.includes(keyword) || text.includes(keyword)
  );

  // Has CV/resume attachment
  const hasResumeAttachment = parsed.attachments?.some(att => {
    const filename = (att.filename || "").toLowerCase();
    return filename.includes("cv") || 
           filename.includes("resume") || 
           filename.endsWith(".pdf") || 
           filename.endsWith(".docx");
  });

  return hasKeyword || hasResumeAttachment || hasAttachments;
};

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
 * Process email attachments and store valid resumes
 */
const processEmailAttachments = async (parsed, emailRecord) => {
  if (!parsed.attachments || parsed.attachments.length === 0) {
    return [];
  }

  const processed = [];

  for (const attachment of parsed.attachments) {
    try {
      const fileName = attachment.filename || "attachment";
      const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

      // Only process supported resume formats
      if (![".pdf", ".docx", ".txt"].includes(extension)) {
        console.log(`Skipping unsupported attachment: ${fileName}`);
        continue;
      }

      // Validate file size
      if (!attachment.content || attachment.content.length === 0) {
        console.log(`Skipping empty attachment: ${fileName}`);
        continue;
      }

      if (attachment.content.length > 5 * 1024 * 1024) {
        console.log(`Skipping oversized attachment: ${fileName}`);
        continue;
      }

      // Convert to base64
      const base64 = attachment.content.toString("base64");
      const contentType = attachment.contentType || "application/octet-stream";

      // Validate
      const validation = validateResumeUpload({ fileName, base64, contentType });

      // Store in Firebase Storage
      const uploadResult = await recruitmentFirestore.upload({
        fileName: validation.safeName,
        base64,
        contentType,
        candidateId: null, // Will be linked after candidate creation
      });

      processed.push({
        attachmentId: uploadResult.id,
        fileName: validation.safeName,
        contentType,
        size: validation.bytes.length,
        extension: validation.extension,
        bytes: validation.bytes,
      });

    } catch (error) {
      console.error(`Failed to process attachment ${attachment.filename}:`, error.message);
    }
  }

  return processed;
};

/**
 * Find or create candidate from email and CV
 */
const findOrCreateCandidate = async (parsed, emailRecord, attachments) => {
  const senderEmail = parsed.from?.value?.[0]?.address;
  const senderName = parsed.from?.value?.[0]?.name || "";

  if (!senderEmail) {
    throw new Error("Sender email is required");
  }

  // Normalize email for matching
  const normalizedEmail = senderEmail.toLowerCase().trim();

  // Check for existing candidate
  const candidates = await recruitmentFirestore.list("recruitmentCandidates", {
    limit: 1000 // Should be enough for email matching
  });

  const existingCandidate = candidates.find(c => 
    c.email && c.email.toLowerCase().trim() === normalizedEmail
  );

  if (existingCandidate) {
    return existingCandidate;
  }

  // Create new candidate
  const candidate = await recruitmentFirestore.create("recruitmentCandidates", {
    name: senderName || senderEmail,
    email: normalizedEmail,
    source: "Email",
    status: "New",
    phone: null,
    location: null,
    skills: [],
    experience: null,
    education: null,
  });

  return candidate;
};

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
 * Create application record
 */
const createApplication = async (candidate, job, emailRecord) => {
  // Check for existing application
  const applications = await recruitmentFirestore.list("recruitmentApplications", {});
  
  const existingApplication = applications.find(app =>
    app.candidateId === candidate.id && 
    (!job || app.jobId === job.id)
  );

  if (existingApplication) {
    return existingApplication;
  }

  // Create new application
  const application = await recruitmentFirestore.create("recruitmentApplications", {
    candidateId: candidate.id,
    jobId: job?.id || null,
    status: "To Be Reviewed",
    source: "Email",
    appliedAt: emailRecord.receivedAt,
    notes: `Application received via email: ${emailRecord.subject}`,
  });

  return application;
};

/**
 * Link resumes to candidate and application
 */
const linkResumesToApplication = async (candidate, application, attachments) => {
  const resumeRecords = [];

  for (const attachment of attachments) {
    try {
      // Create resume metadata record
      const resume = await recruitmentFirestore.create("recruitmentResumes", {
        candidateId: candidate.id,
        applicationId: application.id,
        jobId: application.jobId,
        attachmentId: attachment.attachmentId,
        sourceType: "Email",
        fileStatus: "Stored",
        extractionStatus: "Pending",
        contentType: attachment.contentType,
        size: attachment.size,
      });

      resumeRecords.push({
        ...resume,
        bytes: attachment.bytes,
        extension: attachment.extension,
      });

    } catch (error) {
      console.error(`Failed to create resume record for ${attachment.fileName}:`, error.message);
    }
  }

  return resumeRecords;
};

/**
 * Trigger AI analysis for resume
 */
const triggerAIAnalysis = async (candidate, application, job, resume) => {
  try {
    // Extract text from resume
    const extractedText = await extractResumeText(resume.bytes, resume.extension);

    if (!extractedText || extractedText.trim().length === 0) {
      console.error(`No text extracted from resume ${resume.id}`);
      await recruitmentFirestore.update("recruitmentResumes", resume.id, {
        extractionStatus: "Failed",
      });
      return null;
    }

    // Update extraction status
    await recruitmentFirestore.update("recruitmentResumes", resume.id, {
      extractionStatus: "Completed",
      extractedText: extractedText.slice(0, 50000), // Store truncated version
    });

    // Create AI analysis request record
    const aiResult = await recruitmentFirestore.create("recruitmentAiResults", {
      candidateId: candidate.id,
      applicationId: application.id,
      resumeId: resume.id,
      jobId: job?.id || null,
      resumeAttachmentId: resume.attachmentId,
      jobRole: job?.title || "General Application",
      resumeText: extractedText.slice(0, 200000),
      status: "Pending",
      screeningMode: "auto-email",
    });

    return aiResult;

  } catch (error) {
    console.error(`Failed to trigger AI analysis for resume ${resume.id}:`, error.message);
    await recruitmentFirestore.update("recruitmentResumes", resume.id, {
      extractionStatus: "Failed",
    });
    return null;
  }
};

/**
 * Store incoming email record
 */
const storeIncomingEmail = async (parsed, messageId) => {
  const sender = parsed.from?.value?.[0] || {};
  
  const emailRecord = await recruitmentFirestore.create("recruitmentEmailReplies", {
    providerMessageId: messageId,
    fromEmail: sender.address || "",
    fromName: sender.name || "",
    subject: parsed.subject || "",
    body: stripQuotedReply(parsed.text || ""),
    bodyHtml: parsed.html || null,
    receivedAt: (parsed.date || new Date()).toISOString(),
    candidateId: null, // Will be updated after candidate creation
    applicationId: null,
    processingStatus: "Processing",
    processedAt: null,
  }, { internal: true });

  return emailRecord;
};

/**
 * Process a single email message
 */
const processEmail = async (parsed, messageId) => {
  console.log(`Processing email: ${messageId} from ${parsed.from?.value?.[0]?.address}`);

  try {
    // Check if already processed
    const existingEmails = await recruitmentFirestore.list("recruitmentEmailReplies", {});
    const alreadyProcessed = existingEmails.find(e => e.providerMessageId === messageId);
    
    if (alreadyProcessed) {
      console.log(`Email already processed: ${messageId}`);
      return { skipped: true, reason: "duplicate" };
    }

    // Check if this is a recruitment email
    if (!isRecruitmentEmail(parsed)) {
      console.log(`Email does not appear to be a recruitment application: ${messageId}`);
      return { skipped: true, reason: "not-recruitment" };
    }

    // Store email record
    const emailRecord = await storeIncomingEmail(parsed, messageId);

    // Process attachments
    const attachments = await processEmailAttachments(parsed, emailRecord);

    if (attachments.length === 0) {
      console.log(`No valid resume attachments found in email: ${messageId}`);
      await recruitmentFirestore.update("recruitmentEmailReplies", emailRecord.id, {
        processingStatus: "Needs Review",
        processedAt: new Date().toISOString(),
      });
      return { skipped: true, reason: "no-attachments" };
    }

    // Find or create candidate
    const candidate = await findOrCreateCandidate(parsed, emailRecord, attachments);

    // Match to job
    const job = await matchCandidateToJob(parsed);

    // Create application
    const application = await createApplication(candidate, job, emailRecord);

    // Link resumes
    const resumes = await linkResumesToApplication(candidate, application, attachments);

    // Update email record with candidate/application
    await recruitmentFirestore.update("recruitmentEmailReplies", emailRecord.id, {
      candidateId: candidate.id,
      applicationId: application.id,
      processingStatus: "Processed",
      processedAt: new Date().toISOString(),
    });

    // Trigger AI analysis for each resume
    const aiResults = [];
    for (const resume of resumes) {
      const aiResult = await triggerAIAnalysis(candidate, application, job, resume);
      if (aiResult) {
        aiResults.push(aiResult);
      }
    }

    // Create "New CV Received" notification
    await createRecruitmentNotification({
      type: "new_cv",
      category: "application",
      title: "New CV Received",
      message: `New CV received from ${candidate.name} for ${job?.title || "review"}`,
      candidateId: candidate.id,
      jobId: job?.id || null,
      applicationId: application.id,
    });

    console.log(`Successfully processed email ${messageId}: candidate=${candidate.id}, application=${application.id}, resumes=${resumes.length}`);

    return {
      success: true,
      candidate,
      application,
      job,
      resumes,
      aiResults,
    };

  } catch (error) {
    console.error(`Failed to process email ${messageId}:`, error.message);
    return { error: error.message };
  }
};

/**
 * Poll mailbox for new recruitment emails
 */
export const pollRecruitmentEmails = async () => {
  const config = getRecruitmentMailConfig();

  if (!config.enabled) {
    console.log("[Email Poll] Recruitment email polling is disabled");
    return { skipped: true, reason: "disabled", processedCount: 0, skippedCount: 0, errorCount: 0 };
  }

  if (!isRecruitmentEmailConfigured()) {
    console.log("[Email Poll] Recruitment email is not configured");
    return { skipped: true, reason: "not-configured", processedCount: 0, skippedCount: 0, errorCount: 0, error: "Email configuration incomplete (missing host, user, or password)" };
  }

  console.log(`[Email Poll] Starting poll of ${config.user}@${config.host} (port ${config.port})`);

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  try {
    await client.connect();
    console.log("[Email Poll] Connected to mailbox");
    
    const lock = await client.getMailboxLock("INBOX");
    
    try {
      const since = new Date();
      since.setDate(since.getDate() - config.sinceDays);
      
      const uids = await client.search({ since });

      if (!uids || uids.length === 0) {
        console.log(`[Email Poll] No recent messages found (since ${since.toISOString()})`);
        await updateSyncStatus({ success: true, processedCount: 0, skippedCount: 0, errorCount: 0, isPollingEnabled: true });
        return { success: true, processedCount: 0, skippedCount: 0, errorCount: 0 };
      }

      console.log(`[Email Poll] Found ${uids.length} message(s) since ${since.toISOString()}`);

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errorDetails = [];

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true });
          if (!message?.source) {
            console.log(`[Email Poll] Skipping UID ${uid}: no source`);
            skippedCount++;
            continue;
          }

          const parsed = await simpleParser(message.source);
          const messageId = parsed.messageId || `${config.user}-uid${uid}`;

          const result = await processEmail(parsed, messageId);

          if (result.skipped) {
            skippedCount++;
            console.log(`[Email Poll] Skipped UID ${uid}: ${result.reason}`);
          } else if (result.error) {
            errorCount++;
            errorDetails.push(`UID${uid}: ${result.error}`);
            console.error(`[Email Poll] Error processing UID ${uid}: ${result.error}`);
          } else if (result.success) {
            processedCount++;
            console.log(`[Email Poll] Processed UID ${uid}: ${result.candidate?.id}`);
          }

        } catch (error) {
          errorCount++;
          errorDetails.push(`UID${uid}: ${error.message}`);
          console.error(`[Email Poll] Failed to fetch/parse message ${uid}:`, error.message);
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

      console.log(`[Email Poll] Complete: processed=${processedCount}, skipped=${skippedCount}, errors=${errorCount}`);

      return {
        success: pollSuccess,
        processedCount,
        skippedCount,
        errorCount,
        error: pollError,
      };

    } finally {
      lock.release();
    }

  } catch (error) {
    console.error("[Email Poll] IMAP connection/polling failed:", error.message);
    const errorMsg = `IMAP connection failed to ${config.host}:${config.port} for ${config.user}: ${error.message}`;
    
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
      await client.logout();
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
export const testMailboxConnection = async (customConfig = null) => {
  const currentConfig = getRecruitmentMailConfig();
  const config = {
    host: customConfig?.host || currentConfig.host,
    port: Number(customConfig?.port || currentConfig.port || 993),
    secure: customConfig?.secure !== undefined ? Boolean(customConfig.secure) : currentConfig.secure,
    user: customConfig?.user || currentConfig.user,
    password: customConfig?.password || currentConfig.password,
  };

  if (!config.host || !config.user || !config.password) {
    throw new Error("Recruitment IMAP email host, user email, and password are required");
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    clientInfo: { name: "HRMS-SmartHire", version: "1.0.0" },
  });

  try {
    await client.connect();
    console.log(`[IMAP Test] Successfully connected to ${config.host}:${config.port}`);
    
    const mailboxLock = await client.getMailboxLock("INBOX");
    
    // Safely access mailbox properties with null checks
    const mailbox = mailboxLock?.value;
    const messageCount = mailbox?.exists || 0;
    
    if (mailboxLock) {
      mailboxLock.release();
    }
    
    await client.logout();
    console.log(`[IMAP Test] Successfully authenticated and accessed mailbox. Messages: ${messageCount}`);

    return {
      success: true,
      mailbox: config.user,
      messageCount: messageCount,
      host: config.host,
      port: config.port,
      folderStatus: mailbox ? {
        exists: mailbox.exists || 0,
        recent: mailbox.recent || 0,
        unseen: mailbox.unseen || 0,
      } : null,
    };

  } catch (error) {
    console.error(`[IMAP Test Error] ${error.message}`);
    throw new Error(`IMAP Mailbox connection failed: ${error.message}`);
  }
};

// Auto-start polling if not in test environment
let pollingInterval = null;

export const startEmailPolling = () => {
  if (process.env.NODE_ENV === "test") {
    console.log("Email polling disabled in test environment");
    return;
  }

  if (!isRecruitmentEmailConfigured()) {
    console.log("Email polling not started: mailbox not configured");
    return;
  }

  const config = getRecruitmentMailConfig();

  if (!config.enabled) {
    console.log("Email polling not started: disabled in configuration");
    return;
  }

  if (pollingInterval) {
    console.log("Email polling already running");
    return;
  }

  console.log(`Starting recruitment email polling (interval: ${config.pollInterval}ms)`);

  const poll = async () => {
    try {
      await pollRecruitmentEmails();
    } catch (error) {
      console.error("Email polling error:", error.message);
    }
  };

  // Initial poll
  poll();

  // Schedule recurring polls
  pollingInterval = setInterval(poll, config.pollInterval);
};

export const stopEmailPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("Email polling stopped");
  }
};
