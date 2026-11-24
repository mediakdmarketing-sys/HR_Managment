import { useState, useEffect } from "react";
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  Server,
  Send,
  Sliders,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getEmailSyncStatus,
  getRecruitmentEmailSettings,
  saveRecruitmentEmailSettings,
  testImapConnection,
  testSmtpConnection,
  triggerEmailSync,
} from "../api/recruitmentApi";
import { toast } from "react-toastify";
import { encryptionKeyWarning, isPasswordUsable, passwordWarning } from "../utils/mailCredentialStatus";

const RecruitmentEmailSettings = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [showImapPassword, setShowImapPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  const [imapResult, setImapResult] = useState(null);
  const [smtpResult, setSmtpResult] = useState(null);

  const [settings, setSettings] = useState({
    officialEmail: "recruiting@kdmarketing.org",
    imap: {
      host: "",
      port: 993,
      secure: true,
      user: "recruiting@kdmarketing.org",
      password: "",
      hasPassword: false,
      enabled: true,
    },
    smtp: {
      host: "",
      port: 465,
      secure: true,
      user: "recruiting@kdmarketing.org",
      password: "",
      hasPassword: false,
      enabled: true,
    },
    sync: {
      enabled: true,
      pollInterval: 60000,
    },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, settingsRes] = await Promise.allSettled([
        getEmailSyncStatus(),
        getRecruitmentEmailSettings(),
      ]);

      if (statusRes.status === "fulfilled") {
        setStatus(statusRes.value.data?.data || statusRes.value.data);
      }
      if (settingsRes.status === "fulfilled") {
        const data = settingsRes.value.data?.data || settingsRes.value.data || {};
        setSettings({
          officialEmail: data.officialEmail || "recruiting@kdmarketing.org",
          encryptionKeyStatus: data.encryptionKeyStatus || "",
          imap: {
            host: data.imap?.host || "",
            port: data.imap?.port || 993,
            secure: data.imap?.secure !== undefined ? Boolean(data.imap.secure) : true,
            user: data.imap?.user || data.officialEmail || "recruiting@kdmarketing.org",
            password: "",
            hasPassword: Boolean(data.imap?.hasPassword),
            passwordStorage: data.imap?.passwordStorage || "",
            enabled: data.imap?.enabled !== undefined ? Boolean(data.imap.enabled) : true,
          },
          smtp: {
            host: data.smtp?.host || "",
            port: data.smtp?.port || 465,
            secure: data.smtp?.secure !== undefined ? Boolean(data.smtp.secure) : true,
            user: data.smtp?.user || data.officialEmail || "recruiting@kdmarketing.org",
            password: "",
            hasPassword: Boolean(data.smtp?.hasPassword),
            passwordStorage: data.smtp?.passwordStorage || "",
            enabled: data.smtp?.enabled !== undefined ? Boolean(data.smtp.enabled) : true,
          },
          sync: {
            enabled: data.sync?.enabled !== undefined ? Boolean(data.sync.enabled) : true,
            pollInterval: data.sync?.pollInterval || 60000,
          },
        });
      }
    } catch (error) {
      console.error("Failed to load recruitment email settings:", error);
      toast.error("Failed to load email settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const res = await getEmailSyncStatus();
        setStatus(res.data?.data || res.data);
      } catch {
        // silent background poll error
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTestImap = async () => {
    setTestingImap(true);
    setImapResult(null);
    try {
      const response = await testImapConnection({ imap: settings.imap });
      const result = response.data?.data || response.data;
      setImapResult({
        success: true,
        message: `IMAP Connected successfully! Mailbox "${result.mailbox}" contains ${result.messageCount ?? 0} message(s).`,
      });
      toast.success("IMAP Connection successful!");
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "IMAP connection test failed";
      setImapResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingImap(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const response = await testSmtpConnection({ smtp: settings.smtp });
      const result = response.data?.data || response.data;
      setSmtpResult({
        success: true,
        message: result.message || "SMTP connection verified successfully!",
      });
      toast.success("SMTP Connection successful!");
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "SMTP connection test failed";
      setSmtpResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      // Validate inputs
      if (settings.imap.enabled) {
        if (!settings.imap.host.trim()) throw new Error("IMAP Host is required when incoming email is enabled.");
        if (!settings.imap.user.trim()) throw new Error("IMAP User / Email is required when incoming email is enabled.");
      }
      if (settings.smtp.enabled) {
        if (!settings.smtp.host.trim()) throw new Error("SMTP Host is required when outgoing email is enabled.");
        if (!settings.smtp.user.trim()) throw new Error("SMTP User / Email is required when outgoing email is enabled.");
      }

      const response = await saveRecruitmentEmailSettings(settings);
      const saved = response.data?.data || response.data;
      toast.success("Recruitment email settings saved securely!");

      // Reflect what the server actually stored (it verifies the saved passwords decrypt).
      setSettings((prev) => ({
        ...prev,
        encryptionKeyStatus: saved.encryptionKeyStatus || prev.encryptionKeyStatus,
        imap: { ...prev.imap, password: "", hasPassword: Boolean(saved.imap?.hasPassword), passwordStorage: saved.imap?.passwordStorage || "" },
        smtp: { ...prev.smtp, password: "", hasPassword: Boolean(saved.smtp?.hasPassword), passwordStorage: saved.smtp?.passwordStorage || "" },
      }));

      // Reload status
      const statusRes = await getEmailSyncStatus();
      setStatus(statusRes.data?.data || statusRes.data);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to save email settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await triggerEmailSync();
      const result = response.data?.data || response.data;
      if (result.skipped) {
        toast.info(`Email sync skipped: ${result.reason}`);
      } else {
        toast.success(
          `Sync complete: ${result.processedCount || 0} processed, ${result.skippedCount || 0} skipped, ${result.errorCount || 0} error(s)`
        );
      }
      const statusRes = await getEmailSyncStatus();
      setStatus(statusRes.data?.data || statusRes.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Email synchronization failed");
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = () => {
    if (!status?.configured) return <AlertCircle className="w-5 h-5 text-amber-500" />;
    if (!status?.enabled) return <XCircle className="w-5 h-5 text-gray-400" />;
    if (status?.syncStatus === "Success") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status?.syncStatus === "Failed") return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!status?.configured) return "Not Configured";
    if (!status?.enabled) return "Disabled";
    return status?.syncStatus || "Unknown";
  };

  const getStatusColor = () => {
    if (!status?.configured) return "text-amber-600 font-semibold";
    if (!status?.enabled) return "text-gray-500";
    if (status?.syncStatus === "Success") return "text-green-600 font-semibold";
    if (status?.syncStatus === "Failed") return "text-red-600 font-semibold";
    return "text-gray-600";
  };

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal-600 animate-pulse" />
          <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
            Loading recruitment email settings and mailbox status...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card with status overview */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Recruitment Email & Mailbox Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Configure incoming IMAP application intake and outgoing SMTP recruitment emails.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        {/* Sync Summary Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-gray-700/40 border border-slate-100 dark:border-gray-700 text-sm">
          <div className="flex items-center gap-2.5">
            {getStatusIcon()}
            <div>
              <span className="block text-xs text-slate-400 font-medium">Connection Status</span>
              <span className={getStatusColor()}>{getStatusText()}</span>
            </div>
          </div>

          <div>
            <span className="block text-xs text-slate-400 font-medium">Last Sync</span>
            <span className="font-medium text-slate-700 dark:text-gray-200">
              {formatDate(status?.lastSyncCompletedAt)}
            </span>
          </div>

          <div>
            <span className="block text-xs text-slate-400 font-medium">CVs Processed</span>
            <span className="font-semibold text-teal-700 dark:text-teal-300">
              {status?.processedCount || 0}
            </span>
          </div>

          <div>
            <span className="block text-xs text-slate-400 font-medium">Sync Errors</span>
            <span className={`font-semibold ${status?.errorCount ? "text-red-600" : "text-slate-600 dark:text-gray-300"}`}>
              {status?.errorCount || 0}
            </span>
          </div>
        </div>

        {status?.lastError && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>Last Sync Error:</strong> {status.lastError}</span>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Official Company Recruitment Email Section */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 dark:border-gray-700 pb-3">
            <Mail className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Official Company Recruitment Email
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Confirmed corporate mailbox used for all recruitment communications, inbound candidate CV ingestion, and candidate correspondence.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300 mb-1">
                Company Recruitment Mailbox
              </label>
              <input
                type="email"
                value={settings.officialEmail || "recruiting@kdmarketing.org"}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(prev => ({
                    ...prev,
                    officialEmail: val,
                    imap: { ...prev.imap, user: prev.imap.user === prev.officialEmail ? val : prev.imap.user },
                    smtp: { ...prev.smtp, user: prev.smtp.user === prev.officialEmail ? val : prev.smtp.user },
                  }));
                }}
                className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-teal-600"
                placeholder="recruiting@kdmarketing.org"
              />
            </div>
            <div className="rounded-xl bg-teal-50/70 dark:bg-teal-900/20 p-3 text-xs text-teal-800 dark:text-teal-300 border border-teal-200/60">
              <strong>Security Policy:</strong> This company recruitment email operates independently from HR employee logins. Personal employee passwords and Firebase login credentials are never shared with or used for IMAP/SMTP mailbox synchronization.
            </div>
            {encryptionKeyWarning(settings.encryptionKeyStatus) && (
              <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200">
                {encryptionKeyWarning(settings.encryptionKeyStatus)}
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Incoming Email (IMAP) */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Incoming Email Configuration (IMAP)
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Reads candidate applications and resumes directly from your recruitment inbox.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Enable IMAP</span>
              <input
                type="checkbox"
                checked={settings.imap.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, imap: { ...settings.imap, enabled: e.target.checked } })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                IMAP Host / Server <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. imap.gmail.com"
                value={settings.imap.host}
                onChange={(e) =>
                  setSettings({ ...settings, imap: { ...settings.imap, host: e.target.value } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                IMAP Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="993"
                value={settings.imap.port}
                onChange={(e) =>
                  setSettings({ ...settings, imap: { ...settings.imap, port: Number(e.target.value) } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Email Address / Username <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. careers@yourcompany.com"
                value={settings.imap.user}
                onChange={(e) =>
                  setSettings({ ...settings, imap: { ...settings.imap, user: e.target.value } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Password / App Password {isPasswordUsable(settings.imap) && <span className="text-emerald-600 text-[11px]">(Configured)</span>}
              </label>
              {passwordWarning(settings.imap) && (
                <p role="alert" className="mb-1 text-[11px] text-red-600 dark:text-red-400">{passwordWarning(settings.imap)}</p>
              )}
              <div className="relative">
                <input
                  type={showImapPassword ? "text" : "password"}
                  placeholder={isPasswordUsable(settings.imap) ? "•••••••• (Leave blank to keep existing)" : "Enter IMAP app password"}
                  value={settings.imap.password}
                  onChange={(e) =>
                    setSettings({ ...settings, imap: { ...settings.imap, password: e.target.value } })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showImapPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.imap.secure}
                onChange={(e) =>
                  setSettings({ ...settings, imap: { ...settings.imap, secure: e.target.checked } })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
              <span>Use SSL / TLS connection (recommended for port 993)</span>
            </label>

            <button
              type="button"
              onClick={handleTestImap}
              disabled={testingImap || !settings.imap.host || !settings.imap.user}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-teal-700 text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-400 dark:text-teal-400"
            >
              <ShieldCheck className="w-4 h-4" />
              {testingImap ? "Testing IMAP..." : "Test IMAP Connection"}
            </button>
          </div>

          {imapResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              imapResult.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {imapResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{imapResult.message}</span>
            </div>
          )}
        </div>

        {/* Section 2: Outgoing Email (SMTP) */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Outgoing Email Configuration (SMTP)
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Sends automated acknowledgements, interview invitations, and candidate messages.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Enable SMTP</span>
              <input
                type="checkbox"
                checked={settings.smtp.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, enabled: e.target.checked } })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                SMTP Host / Server <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. smtp.gmail.com"
                value={settings.smtp.host}
                onChange={(e) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                SMTP Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="465 or 587"
                value={settings.smtp.port}
                onChange={(e) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, port: Number(e.target.value) } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Email Address / Username <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. careers@yourcompany.com"
                value={settings.smtp.user}
                onChange={(e) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, user: e.target.value } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Password / App Password {isPasswordUsable(settings.smtp) && <span className="text-emerald-600 text-[11px]">(Configured)</span>}
              </label>
              {passwordWarning(settings.smtp) && (
                <p role="alert" className="mb-1 text-[11px] text-red-600 dark:text-red-400">{passwordWarning(settings.smtp)}</p>
              )}
              <div className="relative">
                <input
                  type={showSmtpPassword ? "text" : "password"}
                  placeholder={isPasswordUsable(settings.smtp) ? "•••••••• (Leave blank to keep existing)" : "Enter SMTP app password"}
                  value={settings.smtp.password}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp: { ...settings.smtp, password: e.target.value } })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={settings.smtp.secure}
                onChange={(e) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, secure: e.target.checked } })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
              <span>Use SSL / TLS connection (check for port 465; uncheck for STARTTLS on port 587)</span>
            </label>

            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={testingSmtp || !settings.smtp.host || !settings.smtp.user}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-teal-700 text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-400 dark:text-teal-400"
            >
              <ShieldCheck className="w-4 h-4" />
              {testingSmtp ? "Testing SMTP..." : "Test SMTP Connection"}
            </button>
          </div>

          {smtpResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              smtpResult.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {smtpResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{smtpResult.message}</span>
            </div>
          )}
        </div>

        {/* Section 3: Synchronization Settings */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 dark:border-gray-700 pb-3">
            <Sliders className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Synchronization & Polling
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Automate periodic mailbox inspection to detect new CVs without manual intervention.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-gray-700">
              <input
                type="checkbox"
                id="auto-sync"
                checked={settings.sync.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, sync: { ...settings.sync, enabled: e.target.checked } })
                }
                className="w-4 h-4 accent-teal-700 rounded"
              />
              <label htmlFor="auto-sync" className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-gray-200">
                Enable Automatic Mailbox Polling
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Polling Interval
              </label>
              <select
                value={settings.sync.pollInterval}
                onChange={(e) =>
                  setSettings({ ...settings, sync: { ...settings.sync, pollInterval: Number(e.target.value) } })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value={30000}>Every 30 seconds</option>
                <option value={60000}>Every 1 minute (Recommended)</option>
                <option value={300000}>Every 5 minutes</option>
                <option value={900000}>Every 15 minutes</option>
                <option value={1800000}>Every 30 minutes</option>
                <option value={3600000}>Every 1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Settings..." : "Save Email Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecruitmentEmailSettings;
