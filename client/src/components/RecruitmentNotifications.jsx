import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, XCircle, AlertCircle, Clock, Mail, User, Briefcase, Calendar } from "lucide-react";
import { 
  getRecruitmentRows, 
  markNotificationRead, 
  markAllNotificationsRead,
  getUnreadNotificationCount 
} from "../api/recruitmentApi";
import { toast } from "react-toastify";

/**
 * HR Recruitment Notifications Component
 * Displays and manages recruitment notifications
 */
const RecruitmentNotifications = ({ compact = false, maxItems = null }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, unread
  const [markingRead, setMarkingRead] = useState(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getRecruitmentRows("recruitmentNotifications");
      const data = response.data?.data || [];
      
      // Sort by created date, newest first
      const sorted = data.sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setNotifications(sorted);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
      setMarkingRead(notificationId);
      // Immediate local UI update
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true, is_read: true } : n));
      await markNotificationRead(notificationId);
    } catch (err) {
      toast.error("Failed to mark notification as read");
      await loadNotifications();
    } finally {
      setMarkingRead(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Immediate local UI update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, is_read: true })));
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all notifications as read");
      await loadNotifications();
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.isRead && !notification.is_read) {
      markNotificationRead(notification.id).catch(() => {});
    }

    // Navigate to relevant entity
    if (notification.candidateId) {
      navigate(`/recruitment/candidates/${notification.candidateId}`);
    } else if (notification.jobId) {
      navigate(`/recruitment/jobs/${notification.jobId}`);
    } else if (notification.interviewId) {
      navigate(`/recruitment/all-interviews`);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_application":
        return <User className="w-5 h-5 text-teal-600" />;
      case "new_cv":
        return <Mail className="w-5 h-5 text-blue-600" />;
      case "ai_complete":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "ai_failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "manual_review":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case "interview_scheduled":
        return <Calendar className="w-5 h-5 text-indigo-600" />;
      case "application_status":
        return <Briefcase className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "new_application":
        return "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800";
      case "new_cv":
        return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
      case "ai_complete":
        return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
      case "ai_failed":
        return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
      case "manual_review":
        return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800";
      case "interview_scheduled":
        return "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800";
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700";
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(n => {
    const isUnread = !n.isRead && !n.is_read;
    if (filter === "unread") {
      return isUnread;
    }
    if (filter === "read") {
      return !isUnread;
    }
    return true;
  });

  const displayedNotifications = maxItems 
    ? filteredNotifications.slice(0, maxItems)
    : filteredNotifications;

  const unreadCount = notifications.filter(n => !n.isRead && !n.is_read).length;

  if (loading && notifications.length === 0) {
    return (
      <div className={`${compact ? "p-4" : "p-6"} bg-white dark:bg-gray-800 rounded-lg shadow`}>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal-600 animate-pulse" />
          <span className="text-gray-600 dark:text-gray-400">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${compact ? "p-4" : "p-6"} bg-white dark:bg-gray-800 rounded-lg shadow`}>
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button
            onClick={loadNotifications}
            className="px-3 py-1 text-sm font-medium text-red-700 bg-white rounded-lg border border-red-300 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    // Compact view for widget/sidebar
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {displayedNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {displayedNotifications.map((notification) => {
                const isUnread = !notification.isRead && !notification.is_read;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      isUnread ? "bg-blue-50 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"} text-gray-900 dark:text-white`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > (maxItems || 0) && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigate("/recruitment/notifications")}
              className="w-full text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              View All Notifications
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Hiring Alerts
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300"
              >
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
              filter === "all"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
              filter === "unread"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
              filter === "read"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Read ({Math.max(0, notifications.length - unreadCount)})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              {filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => {
              const isUnread = !notification.isRead && !notification.is_read;

              return (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    isUnread ? "bg-blue-50 dark:bg-blue-900/10" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg border ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className={`text-base ${isUnread ? "font-semibold" : "font-medium"} text-gray-900 dark:text-white`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatTime(notification.createdAt)}</span>
                            <span>•</span>
                            <span className="capitalize">{notification.category || "General"}</span>
                          </div>
                        </div>

                        {isUnread && (
                          <button
                            onClick={(e) => handleMarkAsRead(notification.id, e)}
                            disabled={markingRead === notification.id}
                            className="px-3 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 disabled:opacity-50 dark:bg-teal-900/20 dark:text-teal-300"
                          >
                            {markingRead === notification.id ? "..." : "Mark Read"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitmentNotifications;
