import { createHash } from "node:crypto";
import { isMailConfigured } from "./mailService.js";
import { extractResumeText, validateResumeUpload } from "../utils/recruitmentResume.js";

export const RECRUITMENT_COLLECTIONS = [
  "recruitmentJobs",
  "recruitmentCandidates",
  "recruitmentApplications",
  "recruitmentResumes",
  "recruitmentAiResults",
  "recruitmentConversations",
  "recruitmentMessages",
  "recruitmentBulkSends",
  "recruitmentBulkSendRecipients",
  "recruitmentEmailReplies",
  "recruitmentInterviews",
  "recruitmentNotifications",
  "recruitmentSettings",
  "recruitmentSmsTemplates",
  "recruitmentAttachments",
];

const TABLE_ALIASES = {
  job_posts: "recruitmentJobs",
  jobs: "recruitmentJobs",
  applicants: "recruitmentCandidates",
  candidates: "recruitmentCandidates",
  applications: "recruitmentApplications",
  resumes: "recruitmentResumes",
  resume: "recruitmentResumes",
  screening_results: "recruitmentAiResults",
  chat_messages: "recruitmentMessages",
  conversations: "recruitmentConversations",
  bulk_send_logs: "recruitmentBulkSends",
  bulk_send_logs_recipient: "recruitmentBulkSendRecipients",
  bulk_send_logs_message: "recruitmentBulkSends",
  email_replies: "recruitmentEmailReplies",
  interviews: "recruitmentInterviews",
  notifications: "recruitmentNotifications",
  settings: "recruitmentSettings",
  sms_templates: "recruitmentSmsTemplates",
};

export const normalizeRecruitmentCollection = (table) => {
  const normalized = TABLE_ALIASES[table] || table;
  if (!RECRUITMENT_COLLECTIONS.includes(normalized)) {
    const error = new Error("Recruitment collection is not allowed");
    error.code = "INVALID_COLLECTION";
    throw error;
  }
  return normalized;
};

export const getRecruitmentStatus = () => ({
  firebase: true,  // Firestore is required for this deployment
  database: "Firestore",
  groq: Boolean(process.env.GROQ_API_KEY),
  email: isMailConfigured(),
  ghl: Boolean(process.env.GHL_LOCATION_ID) && Boolean(process.env.GHL_TOKEN),
  collections: RECRUITMENT_COLLECTIONS,
});

const WRITABLE_FIELDS = {
  recruitmentJobs: new Set(["title", "description", "requirements", "status", "location", "department", "employmentType"]),
  recruitmentCandidates: new Set(["name", "email", "phone", "role", "experience", "education", "skills", "location", "source", "status", "summary", "aiScore", "ai_score", "aiRecommendation", "aiSummary", "aiStrengths", "aiMissingSkills", "resumeId", "resumeAttachmentId", "profileUrl"]),
  recruitmentApplications: new Set(["candidateId", "jobId", "status", "source", "notes", "appliedAt"]),
  recruitmentResumes: new Set(["candidateId", "applicationId", "jobId", "attachmentId", "sourceType", "fileStatus", "extractionStatus", "extractedText", "contentType", "size"]),
  recruitmentAiResults: new Set(["candidateId", "jobId", "applicationId", "resumeId", "resumeAttachmentId", "jobRole", "resumeText", "result", "score", "recommendation", "summary", "strengths", "missingSkills", "whySuitable", "skillsMatch", "experienceMatch", "educationMatch", "experience", "location", "recommendedRole", "screeningMode", "status"]),
  recruitmentConversations: new Set(["candidateId", "candidateName", "phone", "lastMessage", "lastMessageAt", "unreadCount"]),
  recruitmentMessages: new Set(["conversationId", "candidateId", "message", "sender", "isRead", "attachmentId", "type"]),
  recruitmentBulkSends: new Set(["channel", "status", "subject", "message", "createdByUid", "recipientCount"]),
  recruitmentBulkSendRecipients: new Set(["sendId", "recipient", "status", "error"]),
  recruitmentEmailReplies: new Set(["candidateId", "subject", "body", "fromEmail", "isRead", "receivedAt"]),
  recruitmentInterviews: new Set(["title", "candidateId", "jobId", "applicationId", "interview_date", "interview_time", "scheduledAt", "meetingType", "status", "notes", "notificationStatus"]),
  recruitmentNotifications: new Set(["type", "category", "title", "message", "entityId", "candidateId", "jobId", "interviewId", "isRead", "is_read", "recipientEmployeeId"]),
  recruitmentSettings: new Set(["key", "value", "officialEmail", "notificationPreferences", "replyToEmail", "senderName", "aiModel", "interviewSettings", "imapConfig", "smtpConfig", "syncSettings"]),
  recruitmentSmsTemplates: new Set(["name", "channel", "subject", "body"]),
  recruitmentAttachments: new Set(["fileName", "storagePath", "contentType", "size", "extension", "candidateId"]),
};

// Fields only the server itself may write (email intake, notifications); the generic HR
// data API rejects them, so clients cannot spoof message IDs or processing results.
const INTERNAL_WRITABLE_FIELDS = {
  recruitmentEmailReplies: new Set(["providerMessageId", "fromName", "applicationId", "processingStatus", "processingNote", "processedAt"]),
  recruitmentNotifications: new Set(["applicationId", "resumeId"]),
};

const TEST_METADATA_FIELDS = new Set(["isTestData", "seedBatchId"]);
const TEST_BATCH_ID = "hrms-recruitment-dev-v1";

export const extractRecruitmentTestMetadata = (payload = {}) => {
  const hasTestMetadata = [...TEST_METADATA_FIELDS].some((field) => payload[field] !== undefined);
  if (!hasTestMetadata) return {};
  if (
    process.env.NODE_ENV === "production" ||
    process.env.RECRUITMENT_TEST_BATCH_ID !== TEST_BATCH_ID ||
    payload.isTestData !== true ||
    payload.seedBatchId !== TEST_BATCH_ID
  ) {
    throw Object.assign(new Error("Recruitment test-data metadata is not allowed"), { code: "INVALID_FIELD" });
  }
  return { isTestData: true, seedBatchId: TEST_BATCH_ID };
};

const validatePayload = (table, payload, { internal = false } = {}) => {
  const collectionName = normalizeRecruitmentCollection(table);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw Object.assign(new Error("Recruitment payload must be an object"), { code: "INVALID_PAYLOAD" });
  }
  const testMetadata = extractRecruitmentTestMetadata(payload);
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 200_000) {
    throw Object.assign(new Error("Recruitment payload is too large"), { code: "INVALID_PAYLOAD" });
  }
  if (collectionName === "recruitmentAttachments" && !internal) {
    throw Object.assign(new Error("Attachment metadata can only be created by secure upload"), { code: "INVALID_PAYLOAD" });
  }
  const allowedFields = WRITABLE_FIELDS[collectionName];
  const internalFields = internal ? INTERNAL_WRITABLE_FIELDS[collectionName] : null;
  for (const field of Object.keys(payload)) {
    if (TEST_METADATA_FIELDS.has(field)) continue;
    if (field === "id" || field === "createdAt" || field === "updatedAt" ||
        (!internal && field === "createdByUid") ||
        !(allowedFields?.has(field) || internalFields?.has(field))) {
      throw Object.assign(new Error(`Recruitment field is not allowed: ${field}`), { code: "INVALID_FIELD" });
    }
  }
  return { ...payload, ...testMetadata };
};

export const validateDocumentId = (id) => {
  if (typeof id !== "string" || !id.trim() || id.length > 128 || id.includes("/")) {
    throw Object.assign(new Error("Invalid recruitment record ID"), { code: "INVALID_ID" });
  }
  return id;
};

const getRelatedDocument = async (database, collectionName, id) => {
  if (!id) return null;
  validateDocumentId(id);
  const snapshot = await database.collection(collectionName).doc(id).get();
  if (!snapshot.exists) {
    throw Object.assign(new Error(`${collectionName} record was not found`), { code: "INVALID_RELATION" });
  }
  return { id: snapshot.id, ...snapshot.data() };
};

const validateRelationships = async (database, collectionName, data) => {
  if (collectionName === "recruitmentCandidates") {
    const resume = data.resumeId
      ? await getRelatedDocument(database, "recruitmentResumes", data.resumeId)
      : null;
    if (resume && resume.candidateId !== data.id) {
      throw Object.assign(new Error("Resume must belong to this candidate"), { code: "INVALID_RELATION" });
    }
    return;
  }

  if (collectionName === "recruitmentApplications") {
    if (!data.candidateId || !data.jobId) {
      throw Object.assign(new Error("Applications require a candidate and a job"), { code: "INVALID_PAYLOAD" });
    }
    await Promise.all([
      getRelatedDocument(database, "recruitmentCandidates", data.candidateId),
      getRelatedDocument(database, "recruitmentJobs", data.jobId),
    ]);
    return;
  }

  if (collectionName === "recruitmentResumes") {
    if (!["file_upload", "synthetic_text_fixture"].includes(data.sourceType)) {
      throw Object.assign(new Error("Resume source type is invalid"), { code: "INVALID_PAYLOAD" });
    }
    if (!["uploaded", "not_uploaded"].includes(data.fileStatus)) {
      throw Object.assign(new Error("Resume file status is invalid"), { code: "INVALID_PAYLOAD" });
    }
    if (data.sourceType === "synthetic_text_fixture" && data.fileStatus !== "not_uploaded") {
      throw Object.assign(new Error("Synthetic resume fixtures cannot be marked as uploaded"), { code: "INVALID_PAYLOAD" });
    }
    const [candidate, application, job, attachment] = await Promise.all([
      getRelatedDocument(database, "recruitmentCandidates", data.candidateId),
      getRelatedDocument(database, "recruitmentApplications", data.applicationId),
      getRelatedDocument(database, "recruitmentJobs", data.jobId),
      getRelatedDocument(database, "recruitmentAttachments", data.attachmentId),
    ]);
    if (application && (
      (data.candidateId && application.candidateId !== data.candidateId) ||
      (data.jobId && application.jobId !== data.jobId)
    )) {
      throw Object.assign(new Error("Resume application must match its candidate and job"), { code: "INVALID_RELATION" });
    }
    if (job && application && application.jobId !== job.id) {
      throw Object.assign(new Error("Resume job must match its application"), { code: "INVALID_RELATION" });
    }
    if (candidate && application && application.candidateId !== candidate.id) {
      throw Object.assign(new Error("Resume candidate must match its application"), { code: "INVALID_RELATION" });
    }
    if (attachment && attachment.candidateId && data.candidateId !== attachment.candidateId) {
      throw Object.assign(new Error("Resume attachment must match its candidate"), { code: "INVALID_RELATION" });
    }
    if (data.fileStatus === "uploaded" && !attachment) {
      throw Object.assign(new Error("Uploaded resumes require a verified attachment"), { code: "INVALID_PAYLOAD" });
    }
    if (data.fileStatus === "not_uploaded" && attachment) {
      throw Object.assign(new Error("Text-only resumes cannot reference an uploaded attachment"), { code: "INVALID_PAYLOAD" });
    }
    if (
      typeof data.extractedText !== "string" ||
      !data.extractedText.trim() ||
      data.extractedText.length > 200_000
    ) {
      throw Object.assign(new Error("Resume extracted text must be non-empty and no longer than 200,000 characters"), { code: "INVALID_PAYLOAD" });
    }
    return;
  }

  if (collectionName === "recruitmentAiResults") {
    const [candidate, job, application, resume] = await Promise.all([
      getRelatedDocument(database, "recruitmentCandidates", data.candidateId),
      getRelatedDocument(database, "recruitmentJobs", data.jobId),
      getRelatedDocument(database, "recruitmentApplications", data.applicationId),
      getRelatedDocument(database, "recruitmentResumes", data.resumeId),
    ]);
    if (application && (
      (candidate && application.candidateId !== candidate.id) ||
      (job && application.jobId !== job.id) ||
      (data.candidateId && application.candidateId !== data.candidateId) ||
      (data.jobId && application.jobId !== data.jobId)
    )) {
      throw Object.assign(new Error("Screening application must match its candidate and job"), { code: "INVALID_RELATION" });
    }
    if (resume && (
      (data.candidateId && resume.candidateId !== data.candidateId) ||
      (data.applicationId && resume.applicationId !== data.applicationId)
    )) {
      throw Object.assign(new Error("Screening resume must match its candidate and application"), { code: "INVALID_RELATION" });
    }
    return;
  }

  if (collectionName === "recruitmentConversations") {
    if (!data.candidateId) {
      throw Object.assign(new Error("Conversations require a candidate"), { code: "INVALID_PAYLOAD" });
    }
    await getRelatedDocument(database, "recruitmentCandidates", data.candidateId);
    if (!data.id) {
      const existing = await database.collection("recruitmentConversations")
        .where("candidateId", "==", data.candidateId)
        .limit(1)
        .get();
      if (existing.docs.length) {
        throw Object.assign(new Error("This candidate already has a conversation"), { code: "DUPLICATE_RECORD" });
      }
    }
    return;
  }

  if (collectionName === "recruitmentMessages") {
    if (!data.conversationId || !data.candidateId) {
      throw Object.assign(new Error("Messages require a conversation and candidate"), { code: "INVALID_PAYLOAD" });
    }
    const [conversation, candidate] = await Promise.all([
      getRelatedDocument(database, "recruitmentConversations", data.conversationId),
      getRelatedDocument(database, "recruitmentCandidates", data.candidateId),
    ]);
    if (conversation.candidateId !== candidate.id) {
      throw Object.assign(new Error("Message conversation must belong to its candidate"), { code: "INVALID_RELATION" });
    }
    return;
  }

  if (collectionName === "recruitmentBulkSendRecipients") {
    if (!data.sendId) {
      throw Object.assign(new Error("Send history recipients require a campaign"), { code: "INVALID_PAYLOAD" });
    }
    await getRelatedDocument(database, "recruitmentBulkSends", data.sendId);
    return;
  }

  if (collectionName === "recruitmentInterviews") {
    const [candidate, job, application] = await Promise.all([
      getRelatedDocument(database, "recruitmentCandidates", data.candidateId),
      getRelatedDocument(database, "recruitmentJobs", data.jobId),
      getRelatedDocument(database, "recruitmentApplications", data.applicationId),
    ]);
    if (application && (
      (candidate && application.candidateId !== candidate.id) ||
      (job && application.jobId !== job.id)
    )) {
      throw Object.assign(new Error("Interview application must match its candidate and job"), { code: "INVALID_RELATION" });
    }
  }
};

export const createRecruitmentFirestoreService = ({
  database,
  bucket,
}) => {
  const now = () => new Date().toISOString();

  const list = async (table, options = {}) => {
    const collectionName = normalizeRecruitmentCollection(table);
    const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 1000);
    let query = database.collection(collectionName).limit(limit);

    if (options.status) query = query.where("status", "==", options.status);
    if (options.jobId) query = query.where("jobId", "==", options.jobId);
    if (options.candidateId) query = query.where("candidateId", "==", options.candidateId);
    if (options.providerMessageId) query = query.where("providerMessageId", "==", options.providerMessageId);

    const snapshot = await query.get();
    let rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const search = String(options.search || "").trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) =>
        Object.values(row).some((value) =>
          typeof value === "string" && value.toLowerCase().includes(search),
        ),
      );
    }
    rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return rows;
  };

  const get = async (table, id) => {
    const collectionName = normalizeRecruitmentCollection(table);
    validateDocumentId(id);
    const snapshot = await database.collection(collectionName).doc(id).get();
    if (!snapshot.exists) {
      throw Object.assign(new Error("Recruitment record was not found"), { code: "NOT_FOUND" });
    }
    return { id: snapshot.id, ...snapshot.data() };
  };

  const create = async (table, payload, options = {}) => {
    const collectionName = normalizeRecruitmentCollection(table);
    const cleanPayload = validatePayload(collectionName, payload, options);
    await validateRelationships(database, collectionName, cleanPayload);
    if (collectionName === "recruitmentInterviews") {
      const scheduledAt = cleanPayload.scheduledAt || cleanPayload.interview_date;
      const parsedDate = Date.parse(scheduledAt);
      if (!cleanPayload.title?.trim() || !Number.isFinite(parsedDate)) {
        throw Object.assign(new Error("Interview title and a valid date and time are required"), { code: "INVALID_PAYLOAD" });
      }
      cleanPayload.title = cleanPayload.title.trim();
      cleanPayload.scheduledAt = new Date(parsedDate).toISOString();
      cleanPayload.interview_date = cleanPayload.scheduledAt;
    }
    if (collectionName === "recruitmentMessages" && cleanPayload.sender &&
        cleanPayload.sender !== "HR" && !options.internal) {
      throw Object.assign(new Error("Message sender must be the authenticated HR user"), { code: "INVALID_FIELD" });
    }
    const timestamp = now();
    const testMetadata = extractRecruitmentTestMetadata(cleanPayload);
    const candidateEmail = String(cleanPayload.email || "").trim().toLowerCase();
    let uniqueKey = null;

    if (candidateEmail && collectionName === "recruitmentCandidates") {
      const existing = await database.collection(collectionName).get();
      if (existing.docs.some((doc) => String(doc.data().email || "").trim().toLowerCase() === candidateEmail)) {
        const error = new Error("A candidate with this email already exists");
        error.code = "DUPLICATE_RECORD";
        throw error;
      }
      cleanPayload.email = candidateEmail;
      uniqueKey = `candidate-email:${candidateEmail}`;
    }

    if (collectionName === "recruitmentJobs" && cleanPayload.title) {
      cleanPayload.title = String(cleanPayload.title).trim();
      const existing = await database.collection(collectionName).get();
      if (existing.docs.some((doc) =>
        String(doc.data().title || "").trim().toLowerCase() === cleanPayload.title.toLowerCase(),
      )) {
        const error = new Error("A job with this title already exists");
        error.code = "DUPLICATE_RECORD";
        throw error;
      }
      cleanPayload.normalizedTitle = cleanPayload.title.toLowerCase();
      uniqueKey = `job-title:${cleanPayload.normalizedTitle}`;
    }

    if (collectionName === "recruitmentApplications") {
      const existing = await database.collection(collectionName)
        .where("candidateId", "==", cleanPayload.candidateId)
        .limit(1)
        .get();
      if (existing.docs.some((doc) => doc.data().jobId === cleanPayload.jobId)) {
        const error = new Error("This candidate application already exists");
        error.code = "DUPLICATE_RECORD";
        throw error;
      }
      uniqueKey = `application:${cleanPayload.candidateId}:${cleanPayload.jobId}`;
    }
    if (collectionName === "recruitmentInterviews") {
      if (cleanPayload.candidateId) {
        uniqueKey = `interview:${cleanPayload.candidateId}:${cleanPayload.scheduledAt}`;
      }
    }
    // One inbox record per provider message, enforced in the same transaction as the write,
    // so concurrent pollers (even in separate backend instances) cannot both store it. The
    // reservation is kept if the record is later deleted, so a removed message is not
    // re-imported by the next poll.
    if (collectionName === "recruitmentEmailReplies" && cleanPayload.providerMessageId) {
      uniqueKey = `email-message:${String(cleanPayload.providerMessageId).trim()}`;
    }

    const ref = database.collection(collectionName).doc();
    const uniqueRef = uniqueKey
      ? database.collection("recruitmentUniqueKeys").doc(createHash("sha256").update(uniqueKey).digest("hex"))
      : null;
    const interviewNotificationRef = collectionName === "recruitmentInterviews"
      ? database.collection("recruitmentNotifications").doc()
      : null;
    // Every new application (email intake or manual) gets exactly one Hiring Alert, written in
    // the same transaction as the application so it can neither be missed nor duplicated.
    // The Hiring Alerts page and the main HRMS Notifications both read this collection.
    const applicationNotificationRef = collectionName === "recruitmentApplications"
      ? database.collection("recruitmentNotifications").doc()
      : null;
    let applicationNotificationText = null;
    const data = {
      ...cleanPayload,
      createdAt: cleanPayload.createdAt || timestamp,
      updatedAt: timestamp,
    };
    if (collectionName === "recruitmentApplications" && cleanPayload.candidateId && cleanPayload.jobId) {
        const [candidate, job] = await Promise.all([
          database.collection("recruitmentCandidates").doc(cleanPayload.candidateId).get(),
          database.collection("recruitmentJobs").doc(cleanPayload.jobId).get(),
        ]);
      if (!candidate.exists || !job.exists) {
        const error = new Error("Application candidate and job must exist");
        error.code = "INVALID_RELATION";
        throw error;
      }
      const candidateData = candidate.data() || {};
      const candidateName = String(candidateData.name || candidateData.email || "A candidate").slice(0, 200);
      const jobTitle = String(job.data()?.title || "a job").slice(0, 200);
      const via = String(cleanPayload.source || "").toLowerCase() === "email" ? " via email" : "";
      applicationNotificationText = `${candidateName} applied for ${jobTitle}${via}`;
    }

    await database.runTransaction(async (transaction) => {
      if (uniqueRef) {
        const reserved = await transaction.get(uniqueRef);
        if (reserved.exists) {
          const error = new Error("This recruitment record already exists");
          error.code = "DUPLICATE_RECORD";
          throw error;
        }
        transaction.set(uniqueRef, { collection: collectionName, recordId: ref.id, createdAt: timestamp, ...testMetadata });
      }
      transaction.set(ref, data);
      if (interviewNotificationRef) {
        transaction.set(interviewNotificationRef, {
          type: "interview_scheduled",
          category: "Recruitment",
          title: "Interview scheduled",
          message: cleanPayload.title,
          entityId: ref.id,
          interviewId: ref.id,
          candidateId: cleanPayload.candidateId || null,
          jobId: cleanPayload.jobId || null,
          isRead: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...testMetadata,
        });
      }
      if (applicationNotificationRef) {
        transaction.set(applicationNotificationRef, {
          type: "new_application",
          category: "application",
          title: "New application received",
          message: applicationNotificationText || "A new application was received",
          entityId: ref.id,
          applicationId: ref.id,
          candidateId: cleanPayload.candidateId || null,
          jobId: cleanPayload.jobId || null,
          isRead: false,
          is_read: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...testMetadata,
        });
      }
    });
    return { id: ref.id, ...data };
  };

  const update = async (table, id, payload, options = {}) => {
    const collectionName = normalizeRecruitmentCollection(table);
    validateDocumentId(id);
    const cleanPayload = validatePayload(collectionName, payload, options);
    if (collectionName === "recruitmentAttachments") {
      throw Object.assign(new Error("Attachment metadata cannot be edited"), { code: "INVALID_PAYLOAD" });
    }
    const ref = database.collection(collectionName).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("Recruitment record was not found"), { code: "NOT_FOUND" });
    await validateRelationships(database, collectionName, {
      ...snapshot.data(),
      ...cleanPayload,
      id,
    });
    if (collectionName === "recruitmentInterviews") {
      const interview = { ...snapshot.data(), ...cleanPayload };
      const scheduledAt = interview.scheduledAt || interview.interview_date;
      const parsedDate = Date.parse(scheduledAt);
      if (!interview.title?.trim() || !Number.isFinite(parsedDate)) {
        throw Object.assign(new Error("Interview title and a valid date and time are required"), { code: "INVALID_PAYLOAD" });
      }
      cleanPayload.scheduledAt = new Date(parsedDate).toISOString();
      cleanPayload.interview_date = cleanPayload.scheduledAt;
      const current = snapshot.data();
      const testMetadata = current.isTestData === true && current.seedBatchId === TEST_BATCH_ID
        ? { isTestData: true, seedBatchId: TEST_BATCH_ID }
        : {};
      const oldUniqueKey = current.candidateId && current.status !== "Cancelled"
        ? `interview:${current.candidateId}:${current.scheduledAt || current.interview_date}`
        : null;
      const newUniqueKey = interview.candidateId && interview.status !== "Cancelled"
        ? `interview:${interview.candidateId}:${cleanPayload.scheduledAt}`
        : null;
      const uniqueRef = (key) => key
        ? database.collection("recruitmentUniqueKeys").doc(createHash("sha256").update(key).digest("hex"))
        : null;
      const oldReservation = uniqueRef(oldUniqueKey);
      const newReservation = uniqueRef(newUniqueKey);
      const timestamp = now();
      cleanPayload.updatedAt = timestamp;
      await database.runTransaction(async (transaction) => {
        const newSnapshot = newReservation ? await transaction.get(newReservation) : null;
        if (newSnapshot?.exists && newSnapshot.data().recordId !== id) {
          throw Object.assign(new Error("This candidate already has an interview at that time"), { code: "DUPLICATE_RECORD" });
        }
        let oldSnapshot = null;
        if (oldReservation && oldUniqueKey !== newUniqueKey) {
          oldSnapshot = await transaction.get(oldReservation);
        }
        transaction.set(ref, cleanPayload, { merge: true });
        if (newReservation) {
          transaction.set(newReservation, {
            collection: collectionName,
            recordId: id,
            createdAt: timestamp,
            ...testMetadata,
          });
        }
        if (oldSnapshot?.exists && oldSnapshot.data().recordId === id) {
          transaction.delete(oldReservation);
        }
      });
      const updated = await ref.get();
      return { id: updated.id, ...updated.data() };
    }
    if (collectionName === "recruitmentCandidates" || collectionName === "recruitmentJobs") {
      const current = snapshot.data();
      const testMetadata = current.isTestData === true && current.seedBatchId === TEST_BATCH_ID
        ? { isTestData: true, seedBatchId: TEST_BATCH_ID }
        : {};
      const candidate = collectionName === "recruitmentCandidates";
      if (candidate && cleanPayload.email !== undefined) {
        cleanPayload.email = String(cleanPayload.email).trim().toLowerCase();
      }
      if (!candidate && cleanPayload.title !== undefined) {
        cleanPayload.title = String(cleanPayload.title).trim();
        if (!cleanPayload.title) {
          throw Object.assign(new Error("Job title is required"), { code: "INVALID_PAYLOAD" });
        }
      }
      const currentValue = candidate
        ? String(current.email || "").trim().toLowerCase()
        : String(current.normalizedTitle || current.title || "").trim().toLowerCase();
      const updatedValue = candidate
        ? String(cleanPayload.email ?? current.email ?? "").trim().toLowerCase()
        : String(cleanPayload.title ?? current.title ?? "").trim().toLowerCase();
      const oldUniqueKey = currentValue
        ? `${candidate ? "candidate-email" : "job-title"}:${currentValue}`
        : null;
      const newUniqueKey = updatedValue
        ? `${candidate ? "candidate-email" : "job-title"}:${updatedValue}`
        : null;
      if (!candidate && cleanPayload.title !== undefined) {
        cleanPayload.normalizedTitle = updatedValue;
      }
      if (updatedValue) {
        const existing = await database.collection(collectionName).get();
        const duplicate = existing.docs.some((doc) => {
          if (doc.id === id) return false;
          const value = candidate ? doc.data().email : doc.data().normalizedTitle || doc.data().title;
          return String(value || "").trim().toLowerCase() === updatedValue;
        });
        if (duplicate) {
          throw Object.assign(
            new Error(candidate ? "A candidate with this email already exists" : "A job with this title already exists"),
            { code: "DUPLICATE_RECORD" },
          );
        }
      }
      const oldReservation = oldUniqueKey
        ? database.collection("recruitmentUniqueKeys").doc(createHash("sha256").update(oldUniqueKey).digest("hex"))
        : null;
      const newReservation = newUniqueKey
        ? database.collection("recruitmentUniqueKeys").doc(createHash("sha256").update(newUniqueKey).digest("hex"))
        : null;
      const timestamp = now();
      cleanPayload.updatedAt = timestamp;
      await database.runTransaction(async (transaction) => {
        const newSnapshot = newReservation ? await transaction.get(newReservation) : null;
        if (newSnapshot?.exists && newSnapshot.data().recordId !== id) {
          throw Object.assign(new Error("This recruitment record already exists"), { code: "DUPLICATE_RECORD" });
        }
        let oldSnapshot = null;
        if (oldReservation && oldUniqueKey !== newUniqueKey) {
          oldSnapshot = await transaction.get(oldReservation);
        }
        transaction.set(ref, cleanPayload, { merge: true });
        if (newReservation) {
          transaction.set(newReservation, { collection: collectionName, recordId: id, createdAt: timestamp, ...testMetadata });
        }
        if (oldSnapshot?.exists && oldSnapshot.data().recordId === id) {
          transaction.delete(oldReservation);
        }
      });
      const updated = await ref.get();
      return { id: updated.id, ...updated.data() };
    }
    cleanPayload.updatedAt = now();
    await ref.set(cleanPayload, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() };
  };

  const remove = async (table, id) => {
    const collectionName = normalizeRecruitmentCollection(table);
    validateDocumentId(id);
    if (collectionName === "recruitmentAttachments") {
      throw Object.assign(new Error("Attachments must be removed using a secure storage operation"), { code: "INVALID_PAYLOAD" });
    }
    const ref = database.collection(collectionName).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("Recruitment record was not found"), { code: "NOT_FOUND" });
    const data = snapshot.data();
    const dependentCollections = {
      recruitmentCandidates: [
        ["recruitmentApplications", "candidateId"],
        ["recruitmentResumes", "candidateId"],
        ["recruitmentAiResults", "candidateId"],
        ["recruitmentConversations", "candidateId"],
        ["recruitmentMessages", "candidateId"],
        ["recruitmentInterviews", "candidateId"],
        ["recruitmentEmailReplies", "candidateId"],
      ],
      recruitmentJobs: [
        ["recruitmentApplications", "jobId"],
        ["recruitmentResumes", "jobId"],
        ["recruitmentAiResults", "jobId"],
        ["recruitmentInterviews", "jobId"],
      ],
      recruitmentResumes: [["recruitmentAiResults", "resumeId"]],
      recruitmentConversations: [["recruitmentMessages", "conversationId"]],
    }[collectionName] || [];
    for (const [dependentCollection, field] of dependentCollections) {
      const dependent = await database.collection(dependentCollection)
        .where(field, "==", id)
        .limit(1)
        .get();
      if (!dependent.empty && dependent.docs.length) {
        throw Object.assign(new Error(`Cannot delete this record while ${dependentCollection} still references it`), { code: "INVALID_RELATION" });
      }
    }
    const uniqueKey = collectionName === "recruitmentCandidates" && data.email
      ? `candidate-email:${String(data.email).trim().toLowerCase()}`
      : collectionName === "recruitmentJobs" && (data.normalizedTitle || data.title)
        ? `job-title:${String(data.normalizedTitle || data.title).trim().toLowerCase()}`
        : collectionName === "recruitmentApplications" && data.candidateId && data.jobId
          ? `application:${data.candidateId}:${data.jobId}`
          : collectionName === "recruitmentInterviews" && data.candidateId && data.status !== "Cancelled"
            ? `interview:${data.candidateId}:${data.scheduledAt || data.interview_date}`
            : null;
    if (uniqueKey) {
      const uniqueRef = database.collection("recruitmentUniqueKeys")
        .doc(createHash("sha256").update(uniqueKey).digest("hex"));
      await database.runTransaction(async (transaction) => {
        const reservation = await transaction.get(uniqueRef);
        if (reservation.exists && reservation.data().recordId === id) transaction.delete(uniqueRef);
        transaction.delete(ref);
      });
    } else {
      await ref.delete();
    }
    return { id };
  };

  const upload = async ({ fileName, base64, contentType, candidateId = null, isTestData, seedBatchId }) => {
    if (!bucket) {
      throw Object.assign(new Error("File, name and Firebase Storage configuration are required"), { code: "CONFIG_REQUIRED" });
    }
    const testMetadata = extractRecruitmentTestMetadata({ isTestData, seedBatchId });
    const { bytes, extension, safeName } = validateResumeUpload({ fileName, base64, contentType });
    if (candidateId) {
      validateDocumentId(candidateId);
      const candidate = await database.collection("recruitmentCandidates").doc(candidateId).get();
      if (!candidate.exists) {
        throw Object.assign(new Error("Resume candidate was not found"), { code: "INVALID_RELATION" });
      }
    }
    const extractedText = await extractResumeText(bytes, extension);
    if (!extractedText.trim()) {
      throw Object.assign(new Error("Resume file contains no extractable text"), { code: "INVALID_FILE_CONTENT" });
    }
    const storageCandidate = candidateId
      ? createHash("sha256").update(candidateId).digest("hex")
      : "unassigned";
    const path = `recruitment/${storageCandidate}/${Date.now()}-${safeName}`;
    const file = bucket.file(path);
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: contentType || "application/octet-stream",
        metadata: { candidateId: candidateId || "", ...testMetadata },
      },
    });
    const metadata = {
      fileName: safeName,
      storagePath: path,
      contentType: contentType || "application/octet-stream",
      size: bytes.length,
      extension,
      candidateId,
      ...testMetadata,
    };
    const record = await create("recruitmentAttachments", metadata, { internal: true });
    const resume = await create("recruitmentResumes", {
      candidateId,
      sourceType: "file_upload",
      fileStatus: "uploaded",
      extractionStatus: "completed",
      extractedText,
      contentType: metadata.contentType,
      size: bytes.length,
      attachmentId: record.id,
      ...testMetadata,
    });
    return { ...record, resumeId: resume.id, extractedText };
  };

  const signedUrl = async (attachmentId) => {
    validateDocumentId(attachmentId);
    const ref = database.collection("recruitmentAttachments").doc(attachmentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("Attachment was not found"), { code: "NOT_FOUND" });
    const data = snapshot.data();
    if (!bucket) throw Object.assign(new Error("Firebase Storage is not configured"), { code: "CONFIG_REQUIRED" });
    const [url] = await bucket.file(data.storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });
    return { url, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), fileName: data.fileName };
  };

  return { list, get, create, update, remove, upload, signedUrl };
};

