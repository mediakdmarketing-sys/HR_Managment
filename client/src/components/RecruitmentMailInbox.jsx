import { useState, useEffect } from "react";
import {
  Mail,
  Inbox,
  Paperclip,
  Calendar,
  User,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-toastify";

const RecruitmentMailInbox = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);
      // Fetch emails from recruitment email replies collection
      const response = await fetch("/api/recruitment/email/list", {
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load emails: ${response.status}`);
      }

      const data = await response.json();
      setEmails(data.emails || []);
      setLastSync(new Date().toLocaleString());
    } catch (error) {
      console.error("Failed to load emails:", error);
      toast.error("Failed to load emails");
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/recruitment/email/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      const data = await response.json();
      toast.success(
        `Sync complete: ${data.data?.processedCount || 0} processed, ${data.data?.errorCount || 0} errors`
      );
      setLastSync(new Date().toLocaleString());
      await loadEmails();
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Email sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const getAuthToken = async () => {
    // This should be implemented based on your auth system
    return localStorage.getItem("authToken") || "";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
          <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
            Loading recruitment emails...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Recruitment Mail Inbox
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {emails.length} email{emails.length !== 1 ? "s" : ""} received
              </p>
            </div>
          </div>

          <button
            onClick={triggerSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {lastSync && (
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
            Last loaded: {lastSync}
          </p>
        )}
      </div>

      {/* Email List */}
      <div className="space-y-3">
        {emails.length === 0 ? (
          <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70 text-center">
            <Mail className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-gray-400">
              No recruitment emails received yet
            </p>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/70 dark:border-gray-700 overflow-hidden hover:shadow-sm transition"
            >
              {/* Email Header - Clickable */}
              <button
                onClick={() =>
                  setExpandedEmail(
                    expandedEmail === email.id ? null : email.id
                  )
                }
                className="w-full p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {email.fromName || email.fromEmail}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-400 truncate">
                        ({email.fromEmail})
                      </span>
                    </div>

                    <p className="font-semibold text-slate-800 dark:text-gray-100 mb-1 truncate">
                      {email.subject || "(No subject)"}
                    </p>

                    <p className="text-sm text-slate-600 dark:text-gray-400 line-clamp-1">
                      {email.body || "(No content)"}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(email.receivedAt)}
                      </span>
                      {email.processingStatus && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          email.processingStatus === "Processed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}>
                          {email.processingStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 flex-shrink-0 transition ${
                      expandedEmail === email.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Email Detail - Expandable */}
              {expandedEmail === email.id && (
                <div className="border-t border-slate-200/70 dark:border-gray-700 p-4 bg-slate-50/50 dark:bg-gray-700/30 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">
                      From:
                    </h4>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {email.fromName && `${email.fromName} <${email.fromEmail}>`}
                      {!email.fromName && email.fromEmail}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">
                      Received:
                    </h4>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {formatDate(email.receivedAt)}
                    </p>
                  </div>

                  {email.candidateId && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">
                        Candidate:
                      </h4>
                      <p className="text-sm text-teal-700 dark:text-teal-300 font-medium">
                        {email.candidateId}
                      </p>
                    </div>
                  )}

                  {email.applicationId && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">
                        Application:
                      </h4>
                      <p className="text-sm text-teal-700 dark:text-teal-300 font-medium">
                        {email.applicationId}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                      Message:
                    </h4>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-slate-200/70 dark:border-gray-700 text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap">
                      {email.body || "(No content)"}
                    </div>
                  </div>

                  {email.processingStatus && (
                    <div className="text-xs text-slate-600 dark:text-gray-400">
                      Processing Status: <strong>{email.processingStatus}</strong>
                      {email.processedAt && (
                        <> at {formatDate(email.processedAt)}</>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecruitmentMailInbox;
