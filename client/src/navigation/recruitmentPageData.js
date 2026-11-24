// Firestore collections each Recruitment page loads. A page that shows a count or list of
// related records must load that collection too (e.g. Jobs shows applications per job).
export const RECRUITMENT_PAGE_TABLES = {
  dashboard: ["recruitmentJobs", "recruitmentCandidates", "recruitmentApplications", "recruitmentInterviews", "recruitmentNotifications", "recruitmentAiResults"],
  overview: ["recruitmentJobs", "recruitmentCandidates", "recruitmentApplications", "recruitmentInterviews", "recruitmentNotifications", "recruitmentAiResults"],
  jobs: ["recruitmentJobs", "recruitmentApplications"],
  "job-details": ["recruitmentJobs", "recruitmentApplications", "recruitmentCandidates", "recruitmentAiResults"],
  candidates: ["recruitmentCandidates", "recruitmentApplications", "recruitmentJobs", "recruitmentAiResults"],
  "candidate-details": ["recruitmentCandidates", "recruitmentApplications", "recruitmentJobs", "recruitmentAiResults"],
  "candidate-profile": ["recruitmentCandidates", "recruitmentApplications"],
  "candidate-ai-analysis": ["recruitmentCandidates"],
  applications: ["recruitmentApplications", "recruitmentCandidates", "recruitmentJobs"],
  "candidate-chat": ["recruitmentCandidates", "recruitmentMessages"],
  "resume-viewer": [],
  "resume-upload": ["recruitmentCandidates", "recruitmentJobs"],
  "ai-results": ["recruitmentAiResults"],
  chats: ["recruitmentMessages", "recruitmentCandidates"],
  "bulk-send": ["recruitmentCandidates", "recruitmentSmsTemplates"],
  "send-history": ["recruitmentBulkSends", "recruitmentBulkSendRecipients"],
  "mail-inbox": ["recruitmentEmailReplies", "recruitmentCandidates"],
  "schedule-interview": ["recruitmentInterviews", "recruitmentCandidates"],
  "all-interviews": ["recruitmentInterviews", "recruitmentCandidates"],
  notifications: ["recruitmentNotifications"],
  alerts: ["recruitmentNotifications"],
  "email-settings": [],
};

export const tablesForRecruitmentPage = (page) => RECRUITMENT_PAGE_TABLES[page] || [];

// Number of applications for one job: the same rule Applications Management uses
// (an application belongs to the job whose id is its jobId).
export const countApplicationsForJob = (applications, jobId) =>
  (Array.isArray(applications) ? applications : []).filter((application) => application?.jobId === jobId).length;
