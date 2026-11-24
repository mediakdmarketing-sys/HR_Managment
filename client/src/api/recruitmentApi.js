import axios from "axios";
import { configureApiAuth } from "../config/axiosAuth";
import { firebaseAuth } from "../config/firebase";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const TEST_BATCH_ID = import.meta.env.DEV &&
  import.meta.env.VITE_RECRUITMENT_TEST_BATCH_ID === "hrms-recruitment-dev-v1"
  ? "hrms-recruitment-dev-v1"
  : null;
const recruitment = axios.create({ baseURL: `${API_BASE}/recruitment` });
configureApiAuth(recruitment);

const withTestMetadata = (payload) => TEST_BATCH_ID
  ? { ...payload, isTestData: true, seedBatchId: TEST_BATCH_ID }
  : payload;

export const getRecruitmentStatus = () => recruitment.get("/status");
export const getRecruitmentRows = (table, limit) =>
  recruitment.get(`/data/${encodeURIComponent(table)}`, { params: { limit } });
export const getRecruitmentRow = (table, id) =>
  recruitment.get(`/data/${encodeURIComponent(table)}/${encodeURIComponent(id)}`);
export const createRecruitmentRow = (table, payload) =>
  recruitment.post(`/data/${table}`, withTestMetadata(payload));
export const updateRecruitmentRow = (table, id, payload) =>
  recruitment.patch(`/data/${table}/${encodeURIComponent(id)}`, payload);
export const deleteRecruitmentRow = (table, id) =>
  recruitment.delete(`/data/${table}/${encodeURIComponent(id)}`);
export const uploadRecruitmentFile = (payload) => recruitment.post("/upload", withTestMetadata(payload));
export const getRecruitmentAttachmentUrl = (id) =>
  recruitment.get(`/attachments/${encodeURIComponent(id)}/url`);
export const screenRecruitmentResume = (payload) =>
  recruitment.post("/ai/screen", withTestMetadata(payload));
export const sendRecruitmentEmail = (payload, dryRun = true) =>
  recruitment.post("/messages/email", withTestMetadata({
    ...payload,
    dryRun: TEST_BATCH_ID ? true : dryRun,
  }));
export const sendRecruitmentSms = (payload, dryRun = true) =>
  recruitment.post("/messages/sms", withTestMetadata({
    ...payload,
    dryRun: TEST_BATCH_ID ? true : dryRun,
  }));

export const streamRecruitmentRows = async (table, onRows, onError, params = {}) => {
  await firebaseAuth.authStateReady();
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (!token) {
    onError?.("A Firebase HR session is required for realtime recruitment updates.");
    return () => {};
  }
  const search = new URLSearchParams(params).toString();
  const query = search ? `?${search}` : "";
  const response = await fetch(`${API_BASE}/recruitment/data/${encodeURIComponent(table)}/stream${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok || !response.body) {
    onError?.("Realtime recruitment updates are unavailable.");
    return () => {};
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopped = false;
  const read = async () => {
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        try {
          onRows(JSON.parse(line.slice(6)));
        } catch {
          onError?.("Realtime recruitment data was invalid.");
        }
      }
    }
  };
  read().catch(() => {
    if (!stopped) onError?.("Realtime recruitment updates are unavailable.");
  });
  return () => {
    stopped = true;
    reader.cancel();
  };
};

// Email Integration APIs
export const getEmailSyncStatus = () => recruitment.get("/email/status");
export const getRecruitmentEmailSettings = () => recruitment.get("/email/settings");
export const saveRecruitmentEmailSettings = (payload) => recruitment.post("/email/settings", payload);
export const testEmailConnection = () => recruitment.post("/email/test");
export const testImapConnection = (payload) => recruitment.post("/email/test-imap", payload);
export const testSmtpConnection = (payload) => recruitment.post("/email/test-smtp", payload);
export const triggerEmailSync = () => recruitment.post("/email/sync");

// Enhanced AI Analysis APIs
export const analyzeResumeWithJobs = (payload) => recruitment.post("/ai/analyze", payload);
export const processPendingAI = () => recruitment.post("/ai/process-pending");
export const getCandidateAIAnalysis = (candidateId) =>
  recruitment.get(`/ai/candidate/${encodeURIComponent(candidateId)}`);
export const retryAIAnalysis = (aiResultId) =>
  recruitment.post(`/ai/retry/${encodeURIComponent(aiResultId)}`);

// Notification APIs
export const getUnreadNotificationCount = () => recruitment.get("/notifications/unread-count");
export const markNotificationRead = (notificationId) =>
  recruitment.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
export const markAllNotificationsRead = () => recruitment.post("/notifications/mark-all-read");
