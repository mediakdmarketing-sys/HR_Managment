/**
 * Recruitment Notification Service
 * Creates and manages recruitment-related notifications for HR
 */

import { recruitmentFirestore } from "./recruitmentFirebaseService.js";

/**
 * Create a recruitment notification
 */
export const createRecruitmentNotification = async ({
  type,
  category,
  title,
  message,
  candidateId = null,
  jobId = null,
  applicationId = null,
  interviewId = null,
  resumeId = null,
  entityId = null,
}) => {
  try {
    const notification = await recruitmentFirestore.create("recruitmentNotifications", {
      type,
      category: category || "general",
      title,
      message,
      candidateId,
      jobId,
      applicationId,
      interviewId,
      resumeId,
      entityId: entityId || candidateId || applicationId,
      isRead: false,
      is_read: false,
    }, { internal: true }); // server-created: may link applicationId/resumeId

    return notification;

  } catch (error) {
    console.error("Failed to create recruitment notification:", error.message);
    throw error;
  }
};

/**
 * Create "New CV Received" notification
 */
export const notifyNewCVReceived = async ({ candidate, job, application }) => {
  const jobTitle = job?.title || "review";
  const message = `New CV received from ${candidate.name} for ${jobTitle}`;

  return createRecruitmentNotification({
    type: "new_cv",
    category: "application",
    title: "New CV Received",
    message,
    candidateId: candidate.id,
    jobId: job?.id || null,
    applicationId: application.id,
  });
};

/**
 * Create "AI Analysis Complete" notification
 */
export const notifyAIAnalysisComplete = async ({ candidate, aiResult }) => {
  const message = `AI analysis completed for ${candidate.name}`;

  return createRecruitmentNotification({
    type: "ai_complete",
    category: "analysis",
    title: "AI Analysis Complete",
    message,
    candidateId: candidate.id,
    entityId: aiResult.id,
  });
};

/**
 * Create "AI Analysis Failed" notification
 */
export const notifyAIAnalysisFailed = async ({ candidate, error }) => {
  const message = `AI analysis failed for ${candidate.name}: ${error}`;

  return createRecruitmentNotification({
    type: "ai_failed",
    category: "analysis",
    title: "AI Analysis Needs Review",
    message,
    candidateId: candidate.id,
  });
};

/**
 * Create "Manual Review Required" notification
 */
export const notifyManualReviewRequired = async ({ candidate, application, reason }) => {
  const message = `Manual review required for ${candidate.name}: ${reason}`;

  return createRecruitmentNotification({
    type: "manual_review",
    category: "application",
    title: "Manual Review Required",
    message,
    candidateId: candidate.id,
    applicationId: application.id,
  });
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async () => {
  try {
    const notifications = await recruitmentFirestore.list("recruitmentNotifications", {});
    return notifications.filter(n => !n.isRead && !n.is_read).length;
  } catch (error) {
    console.error("Failed to get unread notification count:", error.message);
    return 0;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    await recruitmentFirestore.update("recruitmentNotifications", notificationId, {
      isRead: true,
      is_read: true,
    });
  } catch (error) {
    console.error("Failed to mark notification as read:", error.message);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const notifications = await recruitmentFirestore.list("recruitmentNotifications", {});
    const unread = notifications.filter(n => !n.isRead && !n.is_read);

    await Promise.all(
      unread.map(notification =>
        recruitmentFirestore.update("recruitmentNotifications", notification.id, {
          isRead: true,
          is_read: true,
        })
      )
    );

    return unread.length;

  } catch (error) {
    console.error("Failed to mark all notifications as read:", error.message);
    throw error;
  }
};
