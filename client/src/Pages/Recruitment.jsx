import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Upload } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import {
  getRecruitmentPage,
  getRecruitmentRecordId,
} from "../navigation/recruitmentRoutes";
import { countApplicationsForJob, tablesForRecruitmentPage } from "../navigation/recruitmentPageData";
import {
  getRecruitmentStatus,
  getRecruitmentRows,
  createRecruitmentRow,
  updateRecruitmentRow,
  deleteRecruitmentRow,
  uploadRecruitmentFile,
  getRecruitmentAttachmentUrl,
  screenRecruitmentResume,
  sendRecruitmentEmail,
  sendRecruitmentSms,
  streamRecruitmentRows,
  getCandidateAIAnalysis,
  analyzeResumeWithJobs,
  retryAIAnalysis,
} from "../api/recruitmentApi";
import RecruitmentNotifications from "../components/RecruitmentNotifications";
import RecruitmentEmailSettings from "../components/RecruitmentEmailSettings";
import JobDashboard from "../components/JobDashboard";
import AIAnalysisDisplay from "../components/AIAnalysisDisplay";
import { formatMailReceived, sortMailInbox } from "../utils/mailInbox";

const field = (label, value, onChange, type = "text", placeholder = "") => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
    <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
  </label>
);

const Card = ({ title, children, action }) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>{action}
    </div>
    {children}
  </section>
);

const Recruitment = () => {
  const location = useLocation();
  const active = getRecruitmentPage(location.pathname) || "jobs";
  const recordId = getRecruitmentRecordId(location.pathname, active);
  const pageTitle = {
    dashboard: "Recruitment Overview",
    overview: "Recruitment Overview",
    jobs: "Jobs",
    "job-details": "Job Details",
    candidates: "Candidates",
    "candidate-details": "Candidate Details",
    "candidate-profile": "Candidate Profile",
    "candidate-ai-analysis": "Candidate AI Analysis",
    "candidate-chat": "Candidate Chat",
    "resume-viewer": "Resume Viewer",
    "resume-upload": "Resume Upload",
    "ai-results": "AI Results",
    applications: "Applications",
    chats: "Chats",
    "bulk-send": "Bulk Send",
    "send-history": "Send History",
    "mail-inbox": "Mail Inbox",
    "schedule-interview": "Schedule Interview",
    "all-interviews": "All Interviews",
    notifications: "Hiring Alerts",
    alerts: "Hiring Alerts",
    "email-settings": "Recruitment Email Settings",
  }[active] || "Recruitment";
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState({});
  const loadRequestId = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobRequirements, setJobRequirements] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [messageText, setMessageText] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [interviewTitle, setInterviewTitle] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewApplicant, setInterviewApplicant] = useState("");
  const [interviewEditing, setInterviewEditing] = useState(null);
  const [jobSearch, setJobSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("Pending");
  const [attachment, setAttachment] = useState(null);
  const [jobEditing, setJobEditing] = useState(null);
  const [candidateDraft, setCandidateDraft] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const requestId = ++loadRequestId.current;
    setError("");
    setLoadError("");
    setLoading(true);
    setRows({});
    try {
      const statusResponse = await getRecruitmentStatus();
      const statusData = statusResponse.data?.data;
      if (
        statusResponse.data?.success !== true ||
        !statusData ||
        typeof statusData.firebase !== "boolean"
      ) {
        throw new Error("Recruitment status response was invalid.");
      }
      if (requestId !== loadRequestId.current) return;
      setStatus(statusData);
      if (!statusData.firebase) return;
      const tables = tablesForRecruitmentPage(active);
      const entries = await Promise.all(tables.map(async (table) => {
        const response = await getRecruitmentRows(table);
        const data = response.data?.data;
        if (response.data?.success !== true || !Array.isArray(data)) {
          throw new Error(`Recruitment data response for ${table} was invalid.`);
        }
        return [table, data];
      }));
      if (requestId !== loadRequestId.current) return;
      setRows(Object.fromEntries(entries));
    } catch (requestError) {
      if (requestId === loadRequestId.current) {
        setLoadError(requestError.response?.data?.message || requestError.message || "Unable to load recruitment data.");
      }
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    load();
    return () => { loadRequestId.current += 1; };
  }, [active, recordId]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (active !== "chats" && active !== "candidate-chat") return undefined;
    let stop = () => {};
    let disposed = false;
    streamRecruitmentRows(
      "recruitmentMessages",
      (messages) => setRows((current) => ({ ...current, recruitmentMessages: messages })),
      (message) => setError(message),
      recordId ? { candidateId: recordId } : {},
    )
      .then((stopStream) => {
        if (disposed) stopStream();
        else stop = stopStream;
      })
      .catch((streamError) => {
        if (!disposed) setError(streamError.message || "Realtime recruitment updates are unavailable.");
      });
    return () => {
      disposed = true;
      stop();
    };
  }, [active, recordId]);

  useEffect(() => {
    if (active !== "resume-viewer" || !recordId) return undefined;
    let activeRequest = true;
    getRecruitmentAttachmentUrl(recordId)
      .then((response) => {
        const attachmentData = response.data?.data;
        if (response.data?.success !== true || !attachmentData?.url) {
          throw new Error("Resume preview response was invalid.");
        }
        if (activeRequest) {
          setAttachment({
            id: recordId,
            url: attachmentData.url,
            fileName: attachmentData.fileName || "Candidate resume",
          });
        }
      })
      .catch((requestError) => {
        if (activeRequest) {
          setAttachment({
            id: recordId,
            error: requestError.response?.data?.message || "Resume preview is unavailable.",
          });
        }
      });
    return () => { activeRequest = false; };
  }, [active, recordId]);

  const run = async (operation) => {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || requestError.message || "Recruitment operation failed."); }
    finally { setBusy(false); }
  };

  const createJob = () => run(async () => {
    await createRecruitmentRow("recruitmentJobs", {
      title: jobTitle,
      description: jobDescription,
      requirements: jobRequirements,
      status: "Open",
    });
    setJobTitle(""); setJobDescription(""); setJobRequirements("");
  });

  const createCandidate = () => run(async () => {
    await createRecruitmentRow("recruitmentCandidates", { name: candidateName, email: candidateEmail, status: "Pending" });
    setCandidateName(""); setCandidateEmail("");
  });
  const saveCandidateProfile = () => run(async () => {
    if (!candidateDraft?.name.trim()) throw new Error("Candidate name is required.");
    await updateRecruitmentRow("recruitmentCandidates", recordId, candidateDraft);
    setCandidateDraft(null);
  });

  const createApplication = () => run(async () => {
    await createRecruitmentRow("recruitmentApplications", {
      candidateId: selectedCandidateId,
      jobId: selectedJobId,
      status: applicationStatus,
    });
  });

  const sendCandidateMessage = () => run(async () => {
    await createRecruitmentRow("recruitmentMessages", {
      candidateId: recordId,
      message: chatDraft,
      sender: "HR",
      isRead: false,
    });
    setChatDraft("");
  });
  const sendCandidateSms = () => run(async () => {
    if (!currentCandidate?.phone || !chatDraft.trim()) {
      throw new Error("A candidate phone number and message are required.");
    }
    if (!window.confirm(`Send an SMS to ${currentCandidate.name || currentCandidate.phone}?`)) return;
    const response = await sendRecruitmentSms({ phone: currentCandidate.phone, message: chatDraft }, false);
    if (!response.data.data.delivered) throw new Error("SMS was not delivered.");
    setNotice("SMS delivery was reported by the provider and recorded in Send History.");
    setChatDraft("");
  });

  const screenResume = async () => {
    setBusy(true); setError("");
    try {
      const response = await screenRecruitmentResume({
        resumeText,
        jobRole: rows.recruitmentJobs?.find((job) => job.id === selectedJobId)?.title || jobRole,
        candidateId: selectedCandidateId || null,
        jobId: selectedJobId || null,
      });
      setAiResult(response.data.data);
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "AI screening unavailable."); }
    finally { setBusy(false); }
  };

  const uploadResume = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await uploadRecruitmentFile({
          fileName: file.name,
          contentType: file.type,
          candidateId: selectedCandidateId || null,
          base64: String(reader.result).split(",")[1],
        });
        if (selectedCandidateId) {
          await updateRecruitmentRow("recruitmentCandidates", selectedCandidateId, {
            resumeAttachmentId: response.data.data.id,
          });
        }
        if (response.data.data.extractedText) setResumeText(response.data.data.extractedText);
        await load();
      } catch (requestError) { setError(requestError.response?.data?.message || "Resume upload failed."); }
      finally { setBusy(false); }
    };
    reader.onerror = () => {
      setError("Resume file could not be read.");
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const sendBulkMessages = (channel, dryRun) => run(async () => {
    const recipientField = channel === "Email" ? "email" : "phone";
    const recipients = (rows.recruitmentCandidates || []).filter(
      (candidate) => selectedRecipients.includes(candidate.id) && candidate[recipientField],
    );
    if (!recipients.length) {
      throw new Error(`Select at least one candidate with a ${recipientField === "email" ? "email address" : "phone number"}.`);
    }
    if (!dryRun && !window.confirm(`Send ${channel} to ${recipients.length} selected candidate(s)? This will contact real recipients.`)) return;
    const results = await Promise.allSettled(recipients.map((candidate) =>
      channel === "Email"
        ? sendRecruitmentEmail({ to: candidate.email, subject, text: messageText }, dryRun)
        : sendRecruitmentSms({ phone: candidate.phone, message: messageText }, dryRun),
    ));
    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures) throw new Error(`${failures} ${channel} operation(s) failed. Review Send History for per-recipient results.`);
  });
  const sendInboxReply = () => run(async () => {
    if (!replyTarget || !replySubject.trim() || !replyBody.trim()) {
      throw new Error("Choose a reply recipient and enter a subject and message.");
    }
    if (!window.confirm(`Send this email reply to ${replyTarget}?`)) return;
    await sendRecruitmentEmail({
      to: replyTarget,
      subject: replySubject,
      text: replyBody,
    }, false);
    setReplyTarget(null);
    setReplySubject("");
    setReplyBody("");
  });
  const saveSmsTemplate = () => run(async () => {
    await createRecruitmentRow("recruitmentSmsTemplates", {
      name: templateName,
      channel: "SMS",
      body: templateBody,
    });
    setTemplateName("");
    setTemplateBody("");
  });

  const createInterview = () => run(async () => {
    await createRecruitmentRow("recruitmentInterviews", {
      title: interviewTitle,
      interview_date: new Date(interviewDate).toISOString(),
      candidateId: interviewApplicant || null,
      status: "Scheduled",
    });
    setInterviewTitle("");
    setInterviewDate("");
    setInterviewApplicant("");
  });
  const saveInterview = () => run(async () => {
    if (!interviewEditing?.date || !interviewEditing.title.trim()) {
      throw new Error("Interview title and date are required.");
    }
    await updateRecruitmentRow("recruitmentInterviews", interviewEditing.id, {
      title: interviewEditing.title.trim(),
      scheduledAt: new Date(interviewEditing.date).toISOString(),
      interview_date: new Date(interviewEditing.date).toISOString(),
      candidateId: interviewEditing.candidateId || null,
    });
    setInterviewEditing(null);
  });

  const applicantOptions = (rows.recruitmentCandidates || []).map((applicant) => (
    <option key={applicant.id} value={applicant.id}>{applicant.name || applicant.email || applicant.id}</option>
  ));
  const jobOptions = (rows.recruitmentJobs || []).map((job) => (
    <option key={job.id} value={job.id}>{job.title || job.id}</option>
  ));
  const filteredJobs = (rows.recruitmentJobs || []).filter((job) =>
    `${job.title || ""} ${job.description || ""} ${job.requirements || ""}`
      .toLowerCase()
      .includes(jobSearch.toLowerCase()),
  );
  const filteredCandidates = (rows.recruitmentCandidates || []).filter((candidate) =>
    `${candidate.name || ""} ${candidate.email || ""} ${candidate.phone || ""} ${candidate.status || ""}`
      .toLowerCase()
      .includes(candidateSearch.toLowerCase()) &&
      (candidateStatusFilter === "all" || candidate.status === candidateStatusFilter),
  );
  const currentJob = rows.recruitmentJobs?.find((job) => job.id === recordId);
  const currentCandidate = rows.recruitmentCandidates?.find((candidate) => candidate.id === recordId);
  const currentAttachment = attachment?.id === recordId ? attachment : null;

  const unavailable = (name) => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <strong>{name}</strong> is not configured. This module will not simulate success.
    </div>
  );

  return (
    <UserLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-teal-700">Recruitment Management</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-800">{pageTitle}</h1>
        </div>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <span>{loadError}</span>
            <button type="button" disabled={loading} onClick={load} className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold disabled:opacity-50">
              Retry loading
            </button>
          </div>
        )}
        {notice && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
        {loading && <div role="status" className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm">Loading {pageTitle.toLowerCase()} data…</div>}
        {!loading && !loadError && status && !status.firebase && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Firestore recruitment data is not configured.</strong> Jobs, candidates,
            conversations, interviews and send history are unavailable until Firebase Admin configuration is provided.
          </div>
        )}
        {!loading && !loadError && status?.firebase && (
          <>
        {(active === "dashboard" || active === "overview") && <JobDashboard />}

        {(active === "notifications" || active === "alerts") && <RecruitmentNotifications />}

        {active === "email-settings" && <RecruitmentEmailSettings />}

        {active === "candidate-ai-analysis" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Link
                to={`/recruitment/candidates/${encodeURIComponent(recordId)}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                ← Back to Candidate Details
              </Link>
            </div>
            <AIAnalysisDisplay candidateId={recordId} />
          </div>
        )}

        {active === "applications" && (
          <div className="space-y-4">
            <Card title="Applications Management" action={<span className="text-xs text-slate-400">{rows.recruitmentApplications?.length || 0} total</span>}>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Review and track all formal job applications received across active requisitions.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Candidate</th>
                        <th className="py-2.5 px-3">Job Applied</th>
                        <th className="py-2.5 px-3">Applied Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(rows.recruitmentApplications || []).map((app) => {
                        const candidate = rows.recruitmentCandidates?.find((c) => c.id === app.candidateId);
                        const job = rows.recruitmentJobs?.find((j) => j.id === app.jobId);
                        return (
                          <tr key={app.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3">
                              {candidate ? (
                                <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}`} className="font-semibold text-teal-700 hover:underline">
                                  {candidate.name || candidate.email || "Unnamed Candidate"}
                                </Link>
                              ) : <span className="text-slate-400">Unknown Candidate</span>}
                              <p className="text-xs text-slate-400">{candidate?.email}</p>
                            </td>
                            <td className="py-3 px-3">
                              {job ? (
                                <Link to={`/recruitment/jobs/${encodeURIComponent(job.id)}`} className="font-medium text-slate-700 hover:text-teal-700">
                                  {job.title}
                                </Link>
                              ) : <span className="text-slate-400">General Application</span>}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-500">
                              {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={app.status || "Pending"}
                                onChange={(e) => run(() => updateRecruitmentRow("recruitmentApplications", app.id, { status: e.target.value }))}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-teal-500"
                              >
                                {["Pending", "Shortlisted", "Interview", "Hired", "Rejected"].map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-right space-x-2">
                              {candidate && (
                                <Link
                                  to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/ai-analysis`}
                                  className="inline-flex text-xs font-semibold text-purple-700 hover:underline"
                                >
                                  AI Match
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!rows.recruitmentApplications || rows.recruitmentApplications.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                            No applications received yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        {active === "jobs" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Create job">
              <div className="space-y-3">
                {field("Job title", jobTitle, setJobTitle, "text", "Senior Software Engineer")}
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Description</span>
                  <textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Requirements</span>
                  <textarea value={jobRequirements} onChange={(event) => setJobRequirements(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <button disabled={busy || !jobTitle} onClick={createJob} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create job</button>
              </div>
            </Card>
            <Card title="Open jobs" action={<span className="text-xs text-slate-400">{rows.recruitmentJobs?.length || 0} total</span>}>
              <div className="space-y-2">
                <input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Search jobs" className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                {filteredJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0 flex-1">
                      {jobEditing?.id === job.id ? (
                        <div className="space-y-2">
                          <input value={jobEditing.title} onChange={(event) => setJobEditing({ ...jobEditing, title: event.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          <textarea value={jobEditing.description} onChange={(event) => setJobEditing({ ...jobEditing, description: event.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          <input value={jobEditing.requirements} onChange={(event) => setJobEditing({ ...jobEditing, requirements: event.target.value })} placeholder="Requirements" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                        </div>
                      ) : (
                        <>
                          <Link to={`/recruitment/jobs/${encodeURIComponent(job.id)}`} className="font-semibold text-teal-700 hover:underline">{job.title}</Link>
                          <p className="text-xs text-slate-500">{job.status || "Open"}</p>
                          <p className="text-xs text-slate-500">{countApplicationsForJob(rows.recruitmentApplications, job.id)} applications</p>
                        </>
                      )}
                    </div>
                    <div className="ml-3 flex flex-col gap-2">
                      {jobEditing?.id === job.id ? (
                        <>
                          <button onClick={() => run(async () => {
                            const jobChanges = {
                              title: jobEditing.title,
                              description: jobEditing.description,
                              requirements: jobEditing.requirements,
                            };
                            await updateRecruitmentRow("recruitmentJobs", job.id, jobChanges);
                            setJobEditing(null);
                          })} className="text-xs font-semibold text-teal-700">Save</button>
                          <button onClick={() => setJobEditing(null)} className="text-xs text-slate-500">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setJobEditing({ id: job.id, title: job.title || "", description: job.description || "", requirements: job.requirements || "" })} className="text-xs font-semibold text-teal-700">Edit</button>
                      )}
                      <button onClick={() => {
                        if (window.confirm(`Delete job "${job.title}"? This action cannot be undone.`)) {
                          run(() => deleteRecruitmentRow("recruitmentJobs", job.id));
                        }
                      }} className="text-xs font-semibold text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
                {!filteredJobs.length && <p className="text-sm text-slate-500">No jobs match the search.</p>}
              </div>
            </Card>
          </div>
        )}

        {active === "job-details" && (
          currentJob ? (
            <div className="space-y-6">
              {/* Job Summary Banner */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 border border-slate-200/70">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{currentJob.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {currentJob.department || "General"} · {currentJob.location || "Remote"} · {currentJob.employmentType || "Full-time"}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    currentJob.status === "Open" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                  }`}>
                    {currentJob.status || "Open"}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 pt-4 border-t border-slate-100">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</h4>
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{currentJob.description || "No description provided."}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Requirements</h4>
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{currentJob.requirements || "No requirements provided."}</p>
                  </div>
                </div>
              </div>

              {/* Two Column Section: Actual Applicants vs AI-Suggested Candidates */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 1. Actual Applicants */}
                <Card
                  title="Actual Applicants"
                  action={
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                      {(rows.recruitmentApplications || []).filter((a) => a.jobId === currentJob.id).length} Applied
                    </span>
                  }
                >
                  <p className="text-xs text-slate-500 mb-4">
                    Candidates who formally submitted an application for this specific role.
                  </p>
                  <div className="space-y-3">
                    {(() => {
                      const applicants = (rows.recruitmentApplications || []).filter((a) => a.jobId === currentJob.id);
                      if (applicants.length === 0) {
                        return (
                          <div className="p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl">
                            No candidates have applied for this job yet.
                          </div>
                        );
                      }
                      return applicants.map((app) => {
                        const candidate = rows.recruitmentCandidates?.find((c) => c.id === app.candidateId);
                        return (
                          <div key={app.id} className="rounded-xl border border-slate-200 p-4 bg-white hover:border-teal-300 transition">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                {candidate ? (
                                  <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}`} className="font-semibold text-teal-700 hover:underline">
                                    {candidate.name || candidate.email || "Unnamed Candidate"}
                                  </Link>
                                ) : <span className="font-semibold text-slate-700">Candidate record unavailable</span>}
                                <p className="text-xs text-slate-400 mt-0.5">{candidate?.email}</p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Applied on: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "Recent"}
                                </p>
                              </div>
                              <div className="text-right">
                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                                <select
                                  value={app.status || "Pending"}
                                  onChange={(e) => run(() => updateRecruitmentRow("recruitmentApplications", app.id, { status: e.target.value }))}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-teal-500"
                                >
                                  {["Pending", "Shortlisted", "Interview", "Hired", "Rejected"].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-emerald-700 font-medium">✓ Formal Application</span>
                              {candidate && (
                                <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/ai-analysis`} className="text-teal-700 font-semibold hover:underline">
                                  View CV Analysis →
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>

                {/* 2. AI-Suggested Candidates */}
                <Card
                  title="AI-Suggested Candidates"
                  action={
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      Suggested (Not Applied)
                    </span>
                  }
                >
                  <p className="text-xs text-slate-500 mb-4">
                    Candidates identified by AI CV screening matching requirements for this role.
                  </p>
                  <div className="rounded-xl bg-purple-50/60 border border-purple-100 p-3 mb-4 text-xs text-purple-800">
                    <strong>HR Policy:</strong> AI suggestions assist candidate discovery and do NOT automatically create applications. HR must explicitly contact or invite suitable candidates.
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const appliedCandidateIds = new Set((rows.recruitmentApplications || []).filter((a) => a.jobId === currentJob.id).map((a) => a.candidateId));
                      const normJobTitle = (currentJob.title || "").toLowerCase();

                      const suggested = (rows.recruitmentCandidates || []).filter((c) => {
                        if (appliedCandidateIds.has(c.id)) return false;
                        const ai = (rows.recruitmentAiResults || []).find((r) => r.candidateId === c.id);
                        if (ai) {
                          if (ai.jobRole && ai.jobRole.toLowerCase() === normJobTitle) return true;
                          if (Array.isArray(ai.jobMatches) && ai.jobMatches.some((m) => m.jobTitle?.toLowerCase() === normJobTitle && m.matchScore >= 40)) return true;
                          if (ai.score && ai.score >= 50) return true;
                        }
                        if (c.role && c.role.toLowerCase().includes(normJobTitle)) return true;
                        return false;
                      });

                      if (suggested.length === 0) {
                        return (
                          <div className="p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl">
                            No AI-suggested candidates found for this job yet. Resumes uploaded will automatically generate role matches.
                          </div>
                        );
                      }

                      return suggested.map((cand) => {
                        const ai = (rows.recruitmentAiResults || []).find((r) => r.candidateId === cand.id);
                        const matchInfo = ai?.jobMatches?.find((m) => m.jobTitle?.toLowerCase() === normJobTitle);
                        const score = matchInfo?.matchScore || ai?.score || cand.aiScore || 70;
                        const recommendation = matchInfo?.recommendation || ai?.recommendation || "Recommended based on profile";
                        const reason = matchInfo?.summary || ai?.summary || "Skills and qualifications match job requirements.";

                        return (
                          <div key={cand.id} className="rounded-xl border border-purple-200/70 bg-purple-50/20 p-4 hover:border-purple-300 transition">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Link to={`/recruitment/candidates/${encodeURIComponent(cand.id)}`} className="font-semibold text-slate-800 hover:text-purple-700">
                                    {cand.name || cand.email || "Unnamed Candidate"}
                                  </Link>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                                    Suggested
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{cand.email}</p>
                                <p className="text-xs text-slate-600 mt-2">
                                  <span className="font-semibold text-purple-800">{score}% Match</span> · {recommendation}
                                </p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {reason}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-purple-100/80 flex items-center justify-between text-xs">
                              <Link
                                to={`/recruitment/candidates/${encodeURIComponent(cand.id)}/ai-analysis`}
                                className="text-purple-700 font-semibold hover:underline"
                              >
                                View AI Analysis →
                              </Link>
                              <Link
                                to={`/recruitment/candidates/${encodeURIComponent(cand.id)}/chat`}
                                className="px-3 py-1 rounded-lg bg-purple-700 text-white font-medium hover:bg-purple-800"
                              >
                                Contact Candidate
                              </Link>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </Card>
              </div>
            </div>
          ) : <Card title="Job not found"><p className="text-sm text-slate-500">This job record is unavailable.</p></Card>
        )}

        {active === "candidates" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Add candidate">
              <div className="space-y-3">
                {field("Name", candidateName, setCandidateName)}
                {field("Email", candidateEmail, setCandidateEmail, "email")}
                <button disabled={busy || !candidateName} onClick={createCandidate} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add candidate</button>
              </div>
            </Card>
            <Card title="Candidate pipeline" action={<span className="text-xs text-slate-400">{rows.recruitmentCandidates?.length || 0} total</span>}>
              <div className="space-y-2">
                <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search candidates" className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <select value={candidateStatusFilter} onChange={(event) => setCandidateStatusFilter(event.target.value)} className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="all">All candidate statuses</option>
                  {["Pending", "New", "Screening", "Shortlisted", "Interview", "Hired", "Rejected"].map((status) => <option key={status}>{status}</option>)}
                </select>
                {filteredCandidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-slate-200 p-3">
                    <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}`} className="font-semibold text-teal-700 hover:underline">{candidate.name || "Unnamed candidate"}</Link>
                    <p className="text-xs text-slate-500">{candidate.email || candidate.phone || "No contact"}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/profile`} className="font-semibold text-teal-700">Profile</Link>
                      <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/ai-analysis`} className="font-semibold text-purple-700">AI Analysis</Link>
                      <Link to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/chat`} className="font-semibold text-teal-700">Chat history</Link>
                      {candidate.resumeAttachmentId && <Link to={`/recruitment/resumes/${encodeURIComponent(candidate.resumeAttachmentId)}`} className="font-semibold text-teal-700">Resume</Link>}
                    </div>
                    <select value={candidate.status || "New"} onChange={(event) => run(() => updateRecruitmentRow("recruitmentCandidates", candidate.id, { status: event.target.value }))}
                      className="mt-2 rounded-lg border border-slate-200 px-2 py-1 text-xs">
                      {["Pending", "New", "Screening", "Shortlisted", "Interview", "Hired", "Rejected"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                ))}
                {!filteredCandidates.length && <p className="text-sm text-slate-500">No candidates match the current search and status filter.</p>}
              </div>
            </Card>
            <Card title="Create application">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-500">Candidate
                  <select value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select candidate</option>{applicantOptions}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-500">Job
                  <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select job</option>{jobOptions}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-500">Status
                  <select value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {["Pending", "Shortlisted", "Rejected", "Interview", "Hired"].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <button disabled={busy || !selectedCandidateId || !selectedJobId} onClick={createApplication} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create application</button>
              </div>
              <div className="mt-5 space-y-2">
                {(rows.recruitmentApplications || []).map((application) => (
                  <div key={application.id} className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600">
                    {rows.recruitmentCandidates?.find((candidate) => candidate.id === application.candidateId)?.name || "Candidate"} · {rows.recruitmentJobs?.find((job) => job.id === application.jobId)?.title || "Job"} · {application.status}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {active === "candidate-details" && (
          currentCandidate ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title={currentCandidate.name || "Candidate Details"}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {["email", "phone", "role", "experience", "location", "source", "status"].map((key) => (
                    <div key={key}>
                      <dt className="font-semibold capitalize text-slate-500">{key}</dt>
                      <dd className="mt-1 break-words text-slate-800">{currentCandidate[key] || "Not provided"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-teal-700">
                  <Link to={`/recruitment/candidates/${encodeURIComponent(recordId)}/profile`}>View profile</Link>
                  <Link to={`/recruitment/candidates/${encodeURIComponent(recordId)}/ai-analysis`} className="text-purple-700">AI CV Analysis</Link>
                  <Link to={`/recruitment/candidates/${encodeURIComponent(recordId)}/chat`}>Open chat</Link>
                  {currentCandidate.resumeAttachmentId && <Link to={`/recruitment/resumes/${encodeURIComponent(currentCandidate.resumeAttachmentId)}`}>View resume</Link>}
                </div>
              </Card>
              <Card title="Applications">
                {(rows.recruitmentApplications || [])
                  .filter((application) => application.candidateId === recordId)
                  .map((application) => (
                    <div key={application.id} className="mb-2 rounded-xl border border-slate-200 p-3">
                      <Link to={`/recruitment/jobs/${encodeURIComponent(application.jobId)}`} className="font-semibold text-teal-700 hover:underline">
                        {rows.recruitmentJobs?.find((job) => job.id === application.jobId)?.title || "Job details"}
                      </Link>
                      <label className="mt-2 block text-xs text-slate-500">Application status
                        <select value={application.status || "Pending"} onChange={(event) => run(() => updateRecruitmentRow("recruitmentApplications", application.id, { status: event.target.value }))} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-slate-700">
                          {["Pending", "Shortlisted", "Rejected", "Interview", "Hired"].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>
                  ))}
              </Card>
              <div className="lg:col-span-2">
                <AIAnalysisDisplay candidateId={recordId} />
              </div>
            </div>
          ) : <Card title="Candidate not found"><p className="text-sm text-slate-500">This candidate record is unavailable.</p></Card>
        )}

        {active === "candidate-profile" && (
          currentCandidate ? (
            <Card title={currentCandidate.name || "Candidate Profile"}>
              {candidateDraft ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["name", "email", "phone", "role", "experience", "location", "source", "status"].map((key) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-xs font-semibold capitalize text-slate-500">{key}</span>
                        <input type={key === "email" ? "email" : "text"} value={candidateDraft[key] || ""} onChange={(event) => setCandidateDraft({ ...candidateDraft, [key]: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button disabled={busy} onClick={saveCandidateProfile} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save profile</button>
                    <button onClick={() => setCandidateDraft(null)} className="rounded-xl px-4 py-2 text-sm text-slate-500">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{currentCandidate.summary || currentCandidate.ai_summary || "No profile summary is available."}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {["email", "phone", "role", "experience", "location", "source", "status"].map((key) => (
                      <p key={key} className="text-sm capitalize text-slate-600">{key}: {currentCandidate[key] || "Not provided"}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => setCandidateDraft(Object.fromEntries(
                      ["name", "email", "phone", "role", "experience", "location", "source", "status"]
                        .map((key) => [key, currentCandidate[key] || ""]),
                    ))}
                    className="mt-4 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700"
                  >
                    Edit profile
                  </button>
                  {currentCandidate.resumeAttachmentId && (
                    <Link to={`/recruitment/resumes/${encodeURIComponent(currentCandidate.resumeAttachmentId)}`} className="ml-3 mt-4 inline-block text-sm font-semibold text-teal-700">
                      Open private resume
                    </Link>
                  )}
                </>
              )}
            </Card>
          ) : <Card title="Candidate not found"><p className="text-sm text-slate-500">This candidate profile is unavailable.</p></Card>
        )}

        {active === "candidate-chat" && (
          <Card title={`Chat · ${currentCandidate?.name || "Candidate"}`}>
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              This view contains HR notes. Provider-synced candidate replies are unavailable until a verified inbound messaging integration is configured.
            </p>
            <div className="mb-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {(rows.recruitmentMessages || []).map((message) => (
                <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.sender === "HR" ? "ml-auto bg-teal-50 text-slate-700" : "bg-slate-100 text-slate-700"}`}>
                  <p>{message.message || message.content || ""}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{message.sender || "Candidate"}</p>
                </div>
              ))}
              {!rows.recruitmentMessages?.length && <p className="text-sm text-slate-500">No chat history is available.</p>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (chatDraft.trim()) sendCandidateMessage(); }} className="flex flex-wrap gap-2">
              <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Write an internal message..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button disabled={busy || !chatDraft.trim()} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save note</button>
              {status?.ghl && currentCandidate?.phone && <button type="button" disabled={busy || !chatDraft.trim()} onClick={sendCandidateSms} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send SMS to candidate</button>}
              {status && !status.ghl && <p className="w-full text-xs text-amber-700">Candidate SMS is unavailable until GoHighLevel is configured.</p>}
            </form>
          </Card>
        )}

        {active === "resume-viewer" && (
          <Card title="Private Resume Preview">
            {currentAttachment?.url ? (
              currentAttachment.fileName.toLowerCase().endsWith(".pdf") ? (
                <iframe title="Private candidate resume" src={currentAttachment.url} className="h-[75vh] w-full rounded-xl border border-slate-200" />
              ) : (
                <a href={currentAttachment.url} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">
                  Open or download {currentAttachment.fileName}
                </a>
              )
            ) : !currentAttachment ? (
              <p role="status" className="text-sm text-slate-500">Loading private resume preview...</p>
            ) : currentAttachment.error ? (
              <p role="alert" className="text-sm text-red-700">{currentAttachment.error}</p>
            ) : (
              <p className="text-sm text-slate-500">No private resume preview is available.</p>
            )}
          </Card>
        )}

        {active === "resume-upload" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Resume Upload">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-500">Attach to candidate
                  <select value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Unassigned resume</option>{applicantOptions}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-500">Target job
                  <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select job</option>{jobOptions}
                  </select>
                </label>
              </div>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                <Upload className="text-teal-700" /><span className="mt-2 text-sm font-semibold text-slate-700">Choose resume file</span>
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={uploadResume} />
              </label>
              {status && !status.firebase && unavailable("Firebase recruitment storage")}
            </Card>
            <Card title="AI Analysis">
              <div className="space-y-3">
                {field("Job role", jobRole, setJobRole)}
                <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste resume text..." className="min-h-48 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <button disabled={busy || !resumeText} onClick={screenResume} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Screen resume</button>
              </div>
              {status && !status.groq && <div className="mt-3">{unavailable("Groq AI screening")}</div>}
            </Card>
          </div>
        )}

        {active === "ai-results" && (
          <Card title="Persisted AI Results">
            {aiResult && <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-teal-50 p-3 text-sm text-slate-700">{JSON.stringify(aiResult, null, 2)}</pre>}
            {(rows.recruitmentAiResults || []).map((result) => (
              <div key={result.id} className="mb-2 rounded-xl border border-slate-200 p-3">
                <p className="font-semibold text-slate-700">{result.jobRole || "Resume analysis"} · Score {result.score ?? "—"}</p>
                <p className="mt-1 text-sm text-slate-500">{result.recommendation || result.result?.summary || "Analysis saved"}</p>
              </div>
            ))}
            {!aiResult && !rows.recruitmentAiResults?.length && <p className="text-sm text-slate-500">No AI results found.</p>}
          </Card>
        )}

        {active === "chats" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Candidate conversations">
              <div className="space-y-2">
                {(rows.recruitmentCandidates || []).map((candidate) => (
                  <Link key={candidate.id} to={`/recruitment/candidates/${encodeURIComponent(candidate.id)}/chat`} className="block rounded-xl border border-slate-200 p-3 hover:border-teal-300">
                    <p className="font-semibold text-teal-700">{candidate.name || candidate.email || "Candidate"}</p>
                    <p className="text-xs text-slate-500">{candidate.phone || "No phone"} · {candidate.email || "No email"}</p>
                  </Link>
                ))}
                {!rows.recruitmentCandidates?.length && <p className="text-sm text-slate-500">No candidates available.</p>}
              </div>
            </Card>
            <Card title="Recent HR messages">
              <div className="space-y-2">
                {(rows.recruitmentMessages || []).map((message) => {
                  const candidate = rows.recruitmentCandidates?.find((item) => item.id === message.candidateId);
                  const content = (
                    <>
                      <p className="text-sm font-semibold text-slate-700">{candidate?.name || candidate?.email || "Candidate"}</p>
                      <p className="mt-1 text-sm text-slate-600">{message.message || message.content || "Message"}</p>
                    </>
                  );
                  return message.candidateId
                    ? <Link key={message.id} to={`/recruitment/candidates/${encodeURIComponent(message.candidateId)}/chat`} className="block rounded-xl bg-slate-50 p-3">{content}</Link>
                    : <div key={message.id} className="rounded-xl bg-slate-50 p-3">{content}</div>;
                })}
                {!rows.recruitmentMessages?.length && <p className="text-sm text-slate-500">No HR messages found.</p>}
              </div>
            </Card>
          </div>
        )}

        {active === "bulk-send" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Bulk message composition">
              <div className="space-y-3">
                {field("Subject", subject, setSubject)}
                <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Message" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const template = rows.recruitmentSmsTemplates?.find((item) => item.id === event.target.value);
                    if (template) setMessageText(template.body || "");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Use saved message template</option>
                  {(rows.recruitmentSmsTemplates || []).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy || !selectedRecipients.length || !subject.trim() || !messageText.trim()} onClick={() => sendBulkMessages("Email", true)} className="rounded-xl border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-50">Dry-run email</button>
                  <button disabled={busy || !selectedRecipients.length || !messageText.trim()} onClick={() => sendBulkMessages("SMS", true)} className="rounded-xl border border-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Dry-run SMS</button>
                  {status?.email && <button disabled={busy || !selectedRecipients.length || !subject.trim() || !messageText.trim()} onClick={() => sendBulkMessages("Email", false)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send email</button>}
                  {status?.ghl && <button disabled={busy || !selectedRecipients.length || !messageText.trim()} onClick={() => sendBulkMessages("SMS", false)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send SMS</button>}
                </div>
                {status && !status.email && <p className="text-xs text-amber-700">SMTP is not configured; email delivery is unavailable.</p>}
                {status && !status.ghl && <p className="text-xs text-amber-700">GoHighLevel is not configured; SMS delivery is unavailable.</p>}
              </div>
            </Card>
            <Card title="Recipients and SMS templates">
              <div className="mb-4 max-h-56 space-y-2 overflow-y-auto">
                {(rows.recruitmentCandidates || []).map((candidate) => (
                  <label key={candidate.id} className="flex items-start gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selectedRecipients.includes(candidate.id)} onChange={(event) => setSelectedRecipients((current) =>
                      event.target.checked
                        ? [...current, candidate.id]
                        : current.filter((id) => id !== candidate.id),
                    )} className="mt-1 accent-teal-700" />
                    <span><strong className="text-slate-700">{candidate.name || "Unnamed candidate"}</strong><span className="block text-xs text-slate-500">{candidate.email || "No email"} · {candidate.phone || "No phone"}</span></span>
                  </label>
                ))}
                {!rows.recruitmentCandidates?.length && <p className="text-sm text-slate-500">No candidates available.</p>}
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                {field("Template name", templateName, setTemplateName)}
                <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="SMS template body" className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <button disabled={busy || !templateName.trim() || !templateBody.trim()} onClick={saveSmsTemplate} className="rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50">Save SMS template</button>
              </div>
            </Card>
          </div>
        )}

        {active === "send-history" && (
          <Card title="Send history">
            {(rows.recruitmentBulkSends || []).length ? (rows.recruitmentBulkSends || []).map((log) => (
              <div key={log.id} className="border-b border-slate-100 py-3 text-sm">
                <p><strong>{log.channel || "Message"}</strong> · {log.status || "Recorded"} · {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Time unavailable"}</p>
                {log.subject && <p className="mt-1 text-slate-600">Subject: {log.subject}</p>}
                {log.message && <p className="mt-1 whitespace-pre-wrap text-slate-600">{log.message}</p>}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {(rows.recruitmentBulkSendRecipients || []).filter((recipient) => recipient.sendId === log.id).map((recipient) => (
                    <p key={recipient.id}>{recipient.recipient} · {recipient.status}{recipient.error ? ` · ${recipient.error}` : ""}</p>
                  ))}
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No send history found.</p>}
          </Card>
        )}

        {active === "mail-inbox" && (
          <Card title="Mail inbox">
            <p className="mb-3 rounded-lg bg-green-50 p-3 text-xs text-green-800">
              ✓ Inbound emails are automatically synchronized from your configured IMAP mailbox every minute.
            </p>
            {sortMailInbox(rows.recruitmentEmailReplies).map((mail) => (
              <div key={mail.id} className="mb-3 rounded-xl border border-slate-200 p-3">
                <p className="font-semibold text-slate-700">{mail.subject || "Email"}</p>
                <p className="text-xs text-slate-500">
                  {mail.fromEmail || "Sender unavailable"}
                  {formatMailReceived(mail) && ` · ${formatMailReceived(mail)}`}
                  {mail.processingStatus && ` · ${mail.processingStatus}`}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{mail.body || mail.message || ""}</p>
                <div className="mt-3 flex gap-3 text-xs font-semibold">
                  {mail.fromEmail && (
                    <button type="button" onClick={() => {
                      setReplyTarget(mail.fromEmail);
                      setReplySubject(`Re: ${mail.subject || ""}`);
                    }} className="text-teal-700">Reply</button>
                  )}
                  {!(mail.isRead ?? mail.is_read) && (
                    <button type="button" onClick={() => run(() => updateRecruitmentRow("recruitmentEmailReplies", mail.id, { isRead: true }))} className="text-slate-500">Mark read</button>
                  )}
                </div>
              </div>
            ))}
            {!rows.recruitmentEmailReplies?.length && <p className="text-sm text-slate-500">No mail replies found.</p>}
            {replyTarget && (
              <form onSubmit={(event) => { event.preventDefault(); sendInboxReply(); }} className="mt-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                <p className="text-sm font-semibold text-slate-700">Reply to {replyTarget}</p>
                <input value={replySubject} onChange={(event) => setReplySubject(event.target.value)} aria-label="Reply subject" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} aria-label="Reply message" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                <div className="flex gap-2">
                  <button disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send email reply</button>
                  <button type="button" onClick={() => setReplyTarget(null)} className="rounded-xl px-4 py-2 text-sm text-slate-500">Cancel</button>
                </div>
                {status && !status.email && unavailable("SMTP email delivery")}
              </form>
            )}
          </Card>
        )}

        {active === "schedule-interview" && (
          <div className="grid gap-6">
            <Card title="Schedule interview">
              <div className="space-y-3">
                {field("Title", interviewTitle, setInterviewTitle)}
                {field("Date and time", interviewDate, setInterviewDate, "datetime-local")}
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Candidate</span>
                  <select value={interviewApplicant} onChange={(event) => setInterviewApplicant(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Unassigned</option>{applicantOptions}</select>
                </label>
                <button disabled={busy || !interviewTitle.trim() || !interviewDate} onClick={createInterview} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Schedule</button>
              </div>
            </Card>
          </div>
        )}

        {active === "all-interviews" && (
          <Card title="All Interviews">
            {(rows.recruitmentInterviews || []).map((interview) => (
              <div key={interview.id} className="mb-2 rounded-xl border border-slate-200 p-3">
                {interviewEditing?.id === interview.id ? (
                  <div className="space-y-2">
                    <input value={interviewEditing.title} onChange={(event) => setInterviewEditing({ ...interviewEditing, title: event.target.value })} aria-label="Interview title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input type="datetime-local" value={interviewEditing.date} onChange={(event) => setInterviewEditing({ ...interviewEditing, date: event.target.value })} aria-label="Interview date and time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select value={interviewEditing.candidateId} onChange={(event) => setInterviewEditing({ ...interviewEditing, candidateId: event.target.value })} aria-label="Interview candidate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Unassigned</option>{applicantOptions}
                    </select>
                    <div className="flex gap-3 text-xs font-semibold">
                      <button onClick={saveInterview} className="text-teal-700">Save changes</button>
                      <button onClick={() => setInterviewEditing(null)} className="text-slate-500">Cancel editing</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-slate-700">{interview.title || "Interview"}</p>
                    <p className="text-xs text-slate-500">{interview.scheduledAt || interview.interview_date || interview.scheduled_at || "Date unavailable"} · {interview.status || "Scheduled"}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => {
                          const dateValue = interview.scheduledAt || interview.interview_date || interview.scheduled_at;
                          const date = dateValue ? new Date(dateValue) : new Date();
                          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          setInterviewEditing({
                            id: interview.id,
                            title: interview.title || "",
                            date: localDate,
                            candidateId: interview.candidateId || "",
                          });
                        }}
                        className="text-xs font-semibold text-teal-700"
                      >
                        Edit / Reschedule
                      </button>
                      <button
                        onClick={() => run(() => updateRecruitmentRow("recruitmentInterviews", interview.id, { status: "Cancelled" }))}
                        className="text-xs font-semibold text-red-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!rows.recruitmentInterviews?.length && <p className="text-sm text-slate-500">No interviews scheduled.</p>}
          </Card>
        )}
          </>
        )}
      </div>
    </UserLayout>
  );
};

export default Recruitment;


