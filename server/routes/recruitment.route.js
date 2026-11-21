import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
  aiScreeningRateLimit,
  emailRateLimit,
  smsRateLimit,
} from "../middleware/rateLimitMiddleware.js";
import { sendRecruitmentMail, testSmtpConnection } from "../services/mailService.js";
import {
  extractRecruitmentTestMetadata,
  getRecruitmentStatus,
} from "../services/recruitmentService.js";
import { recruitmentFirestore } from "../services/recruitmentFirebaseService.js";
import {
  buildRecruitmentScreeningMessages,
  parseRecruitmentScreeningResult,
} from "../utils/recruitmentScreening.js";
import {
  pollRecruitmentEmails,
  getEmailSyncStatus,
  testMailboxConnection,
  isRecruitmentEmailConfigured,
  getSavedEmailConfig,
  saveEmailConfig,
  getRecruitmentMailConfig,
} from "../services/recruitmentEmailService.js";
import {
  analyzeResumeWithJobMatching,
  processPendingAIAnalysis,
  getCandidateAIAnalysis,
  retryAIAnalysis,
} from "../services/recruitmentAIService.js";
import {
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/recruitmentNotificationService.js";

const router = express.Router();
router.use(authenticate);

const configRequired = (res, message) =>
  res.status(503).json({ success: false, code: "CONFIG_REQUIRED", message });

const handleError = (res, error) => {
  if (error.code === "CONFIG_REQUIRED") return configRequired(res, error.message);
  if (error.code === "DUPLICATE_RECORD") {
    return res.status(409).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code === "INVALID_COLLECTION" || error.code === "INVALID_ID" ||
      error.code === "INVALID_FIELD" || error.code === "INVALID_PAYLOAD" ||
      error.code === "INVALID_RELATION") {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code?.startsWith("INVALID_FILE")) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error.code === "NOT_FOUND") {
    return res.status(404).json({ success: false, code: error.code, message: error.message });
  }
  console.error("Recruitment operation failed:", error.message);
  return res.status(500).json({ success: false, message: "Recruitment operation failed" });
};

const startSendRecord = async ({ channel, recipient, subject = "", message, uid }) => {
  const send = await recruitmentFirestore.create("recruitmentBulkSends", {
    channel,
    status: "Sending",
    subject,
    message,
    createdByUid: uid,
    recipientCount: 1,
  }, { internal: true });
  const recipientRecord = await recruitmentFirestore.create("recruitmentBulkSendRecipients", {
    sendId: send.id,
    recipient,
    status: "Sending",
  });
  return { sendId: send.id, recipientId: recipientRecord.id };
};

const finishSendRecord = async ({ sendId, recipientId, status, error }) => {
  await Promise.all([
    recruitmentFirestore.update("recruitmentBulkSends", sendId, { status }),
    recruitmentFirestore.update("recruitmentBulkSendRecipients", recipientId, {
      status,
      ...(error ? { error } : {}),
    }),
  ]);
};

router.get("/status", (req, res) => res.json({ success: true, data: getRecruitmentStatus() }));
router.get("/data/:table", async (req, res) => {
  try {
    res.json({ success: true, data: await recruitmentFirestore.list(req.params.table, req.query) });
  }
  catch (error) { handleError(res, error); }
});
router.post("/data/:table", async (req, res) => {
  try { res.status(201).json({ success: true, data: await recruitmentFirestore.create(req.params.table, req.body) }); }
  catch (error) { handleError(res, error); }
});
router.patch("/data/:table/:id", async (req, res) => {
  try { res.json({ success: true, data: await recruitmentFirestore.update(req.params.table, req.params.id, req.body) }); }
  catch (error) { handleError(res, error); }
});
router.delete("/data/:table/:id", async (req, res) => {
  try { res.json({ success: true, data: await recruitmentFirestore.remove(req.params.table, req.params.id) }); }
  catch (error) { handleError(res, error); }
});
router.post("/upload", async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await recruitmentFirestore.upload({
      fileName: req.body.fileName,
      base64: req.body.base64,
      contentType: req.body.contentType,
      candidateId: req.body.candidateId || null,
      isTestData: req.body.isTestData,
      seedBatchId: req.body.seedBatchId,
    }) });
  } catch (error) { handleError(res, error); }
});
router.get("/attachments/:id/url", async (req, res) => {
  try {
    res.json({ success: true, data: await recruitmentFirestore.signedUrl(req.params.id) });
  } catch (error) { handleError(res, error); }
});
router.post("/ai/screen", aiScreeningRateLimit, async (req, res) => {
  let testMetadata;
  try { testMetadata = extractRecruitmentTestMetadata(req.body); }
  catch (error) { return handleError(res, error); }
  if (testMetadata.isTestData) {
    return configRequired(res, "Live AI screening is disabled for this development test batch");
  }
  if (!process.env.GROQ_API_KEY) return configRequired(res, "Groq AI screening is not configured");
  const resumeText = req.body.resumeText;
  const jobRole = req.body.jobRole ?? "";
  if (typeof resumeText !== "string" || !resumeText.trim() || resumeText.length > 200_000) {
    return res.status(400).json({ success: false, message: "Resume text must be a non-empty string up to 200,000 characters" });
  }
  if (typeof jobRole !== "string" || jobRole.length > 200) {
    return res.status(400).json({ success: false, message: "Job role must be a string up to 200 characters" });
  }
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0.3,
        messages: buildRecruitmentScreeningMessages({ jobRole, resumeText }),
      }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ success: false, message: "AI provider screening failed" });
    const result = parseRecruitmentScreeningResult(payload.choices?.[0]?.message?.content);
    if (!result) return res.status(502).json({ success: false, message: "AI provider returned invalid screening results" });
    const saved = await recruitmentFirestore.create("recruitmentAiResults", {
      jobRole: jobRole.trim(),
      candidateId: req.body.candidateId || null,
      jobId: req.body.jobId || null,
      applicationId: req.body.applicationId || null,
      resumeId: req.body.resumeId || null,
      resumeText,
      result,
      score: result.score,
      recommendation: result.recommendation,
      screeningMode: "Provider",
      status: "Completed",
    });
    res.json({ success: true, data: { id: saved.id, ...result } });
  } catch (error) { handleError(res, error); }
});
router.post("/messages/email", emailRateLimit, async (req, res) => {
  let testMetadata;
  try { testMetadata = extractRecruitmentTestMetadata(req.body); }
  catch (error) { return handleError(res, error); }
  if (!req.body.to || !req.body.subject) return res.status(400).json({ success: false, message: "Recipient and subject are required" });
  if (req.query.dryRun === "true" || req.body.dryRun === true || testMetadata.isTestData) {
    const send = await recruitmentFirestore.create("recruitmentBulkSends", {
      channel: "Email",
      status: "DryRun",
      subject: req.body.subject,
      message: req.body.text || req.body.message || "",
      createdByUid: req.user.uid,
      ...testMetadata,
    }, { internal: true });
    await recruitmentFirestore.create("recruitmentBulkSendRecipients", {
      sendId: send.id,
      recipient: req.body.to,
      status: "NotSent",
      ...testMetadata,
    });
    return res.json({ success: true, data: { delivered: false, dryRun: true, sendId: send.id } });
  }
  if (!getRecruitmentStatus().email) return configRequired(res, "SMTP email delivery is not configured");
  let sendRecord;
  try {
    sendRecord = await startSendRecord({
      channel: "Email",
      recipient: req.body.to,
      subject: req.body.subject,
      message: req.body.text || req.body.message || "",
      uid: req.user.uid,
    });
    await sendRecruitmentMail({ to: req.body.to, subject: req.body.subject, text: req.body.text || req.body.message || "" });
    await finishSendRecord({ ...sendRecord, status: "Delivered" });
    res.json({ success: true, data: { delivered: true } });
  } catch (error) {
    if (sendRecord) {
      await finishSendRecord({ ...sendRecord, status: "Failed", error: "Email provider delivery failed" });
      return res.status(502).json({ success: false, message: "Email provider delivery failed" });
    }
    handleError(res, error);
  }
});
router.post("/messages/sms", smsRateLimit, async (req, res) => {
  let testMetadata;
  try { testMetadata = extractRecruitmentTestMetadata(req.body); }
  catch (error) { return handleError(res, error); }
  if (!req.body.phone || !req.body.message) return res.status(400).json({ success: false, message: "Phone and message are required" });
  if (req.query.dryRun === "true" || req.body.dryRun === true || testMetadata.isTestData) {
    const send = await recruitmentFirestore.create("recruitmentBulkSends", {
      channel: "SMS",
      status: "DryRun",
      message: req.body.message,
      createdByUid: req.user.uid,
      ...testMetadata,
    }, { internal: true });
    await recruitmentFirestore.create("recruitmentBulkSendRecipients", {
      sendId: send.id,
      recipient: req.body.phone,
      status: "NotSent",
      ...testMetadata,
    });
    return res.json({ success: true, data: { delivered: false, dryRun: true, sendId: send.id } });
  }
  const token = process.env.GHL_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) return configRequired(res, "GoHighLevel SMS delivery is not configured");
  let sendRecord;
  try {
    sendRecord = await startSendRecord({
      channel: "SMS",
      recipient: req.body.phone,
      message: req.body.message,
      uid: req.user.uid,
    });
    const response = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify({ type: "SMS", message: req.body.message, phone: req.body.phone, locationId }),
    });
    if (!response.ok) {
      await finishSendRecord({ ...sendRecord, status: "Failed", error: "SMS provider delivery failed" });
      return res.status(502).json({ success: false, message: "SMS provider delivery failed" });
    }
    await finishSendRecord({ ...sendRecord, status: "Delivered" });
    res.json({ success: true, data: { delivered: true } });
  } catch (error) {
    if (sendRecord) {
      await finishSendRecord({ ...sendRecord, status: "Failed", error: "SMS provider delivery failed" });
      return res.status(502).json({ success: false, message: "SMS provider delivery failed" });
    }
    handleError(res, error);
  }
});
router.get("/data/:table/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendSnapshot = async () => {
    try {
      const data = await recruitmentFirestore.list(req.params.table, { ...req.query, limit: 500 });
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error("Recruitment realtime update failed:", error.message);
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Realtime recruitment data is unavailable" })}\n\n`);
    }
  };

  await sendSnapshot();
  const interval = setInterval(sendSnapshot, 5000);
  req.on("close", () => clearInterval(interval));
});

router.get("/data/:table/:id", async (req, res) => {
  try {
    res.json({
      success: true,
      data: await recruitmentFirestore.get(req.params.table, req.params.id),
    });
  } catch (error) { handleError(res, error); }
});

// Email Integration Routes
router.get("/email/status", async (req, res) => {
  try {
    const status = await getEmailSyncStatus();
    res.json({ success: true, data: status });
  } catch (error) { handleError(res, error); }
});

router.get("/email/settings", async (req, res) => {
  try {
    const settings = await getSavedEmailConfig();
    res.json({ success: true, data: settings });
  } catch (error) { handleError(res, error); }
});

router.post("/email/settings", async (req, res) => {
  try {
    const saved = await saveEmailConfig(req.body);
    res.json({ success: true, data: saved, message: "Recruitment email settings saved successfully" });
  } catch (error) { handleError(res, error); }
});

router.post("/email/test", async (req, res) => {
  try {
    const result = await testMailboxConnection(req.body?.imap || req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(502).json({ 
      success: false, 
      message: error.message || "Mailbox connection test failed" 
    });
  }
});

router.post("/email/test-imap", async (req, res) => {
  try {
    // Get saved config to retrieve encrypted password if frontend didn't provide one
    const savedConfig = await getSavedEmailConfig();
    const imapConfig = req.body?.imap || req.body;
    const mailConfig = getRecruitmentMailConfig();
    
    console.log("[Test IMAP] Frontend config:", { host: imapConfig.host, user: imapConfig.user, hasPassword: !!imapConfig.password });
    console.log("[Test IMAP] Saved mail config password exists:", !!mailConfig.password);
    
    // Merge with saved config: use frontend values, but fall back to saved password if empty
    const mergedConfig = {
      host: imapConfig.host || "",
      port: Number(imapConfig.port || 993),
      secure: imapConfig.secure !== undefined ? Boolean(imapConfig.secure) : true,
      user: imapConfig.user || "",
      password: imapConfig.password || mailConfig.password || "",
    };
    
    console.log("[Test IMAP] Merged config:", { host: mergedConfig.host, user: mergedConfig.user, hasPassword: !!mergedConfig.password });
    
    const result = await testMailboxConnection(mergedConfig);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[Test IMAP Error]", error.message);
    res.status(502).json({ 
      success: false, 
      message: error.message || "IMAP connection test failed" 
    });
  }
});

router.post("/email/test-smtp", async (req, res) => {
  try {
    // Get saved config to retrieve encrypted password if frontend didn't provide one
    const smtpConfig = req.body?.smtp || req.body;
    
    // Merge with saved config: use frontend values, but fall back to saved password if empty
    const mergedConfig = {
      host: smtpConfig.host || "",
      port: Number(smtpConfig.port || 465),
      secure: smtpConfig.secure !== undefined ? Boolean(smtpConfig.secure) : true,
      user: smtpConfig.user || "",
      password: smtpConfig.password || getRecruitmentMailConfig().password || "",
    };
    
    const result = await testSmtpConnection(mergedConfig);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message || "SMTP connection test failed"
    });
  }
});

router.post("/email/sync", async (req, res) => {
  try {
    if (!isRecruitmentEmailConfigured()) {
      return configRequired(res, "Recruitment email is not configured");
    }
    const result = await pollRecruitmentEmails();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(502).json({ 
      success: false, 
      message: error.message || "Email synchronization failed" 
    });
  }
});

// Enhanced AI Analysis Routes
router.post("/ai/analyze", aiScreeningRateLimit, async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return configRequired(res, "GROQ AI is not configured");
    }

    const { resumeText, candidateId, applicationId, resumeId, appliedJobId } = req.body;

    if (!resumeText || typeof resumeText !== "string") {
      return res.status(400).json({ 
        success: false, 
        message: "Resume text is required" 
      });
    }

    const result = await analyzeResumeWithJobMatching({
      resumeText,
      candidateId,
      applicationId,
      resumeId,
      appliedJobId,
    });

    res.json({ success: true, data: result });

  } catch (error) { handleError(res, error); }
});

router.post("/ai/process-pending", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return configRequired(res, "GROQ AI is not configured");
    }

    const result = await processPendingAIAnalysis();
    res.json({ success: true, data: result });

  } catch (error) { handleError(res, error); }
});

router.get("/ai/candidate/:candidateId", async (req, res) => {
  try {
    const results = await getCandidateAIAnalysis(req.params.candidateId);
    res.json({ success: true, data: results });
  } catch (error) { handleError(res, error); }
});

router.post("/ai/retry/:aiResultId", aiScreeningRateLimit, async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return configRequired(res, "GROQ AI is not configured");
    }

    const result = await retryAIAnalysis(req.params.aiResultId);
    res.json({ success: true, data: result });

  } catch (error) { handleError(res, error); }
});

// Notification Routes
router.get("/notifications/unread-count", async (req, res) => {
  try {
    const count = await getUnreadNotificationCount();
    res.json({ success: true, data: { count } });
  } catch (error) { handleError(res, error); }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    await markNotificationAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) { handleError(res, error); }
});

router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    const count = await markAllNotificationsAsRead();
    res.json({ success: true, data: { count } });
  } catch (error) { handleError(res, error); }
});

export default router;
