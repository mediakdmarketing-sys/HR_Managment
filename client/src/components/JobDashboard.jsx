import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle,
  Calendar,
  XCircle,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Bell,
  Mail,
  UserCheck,
  CalendarCheck,
  FileText,
} from "lucide-react";
import { getRecruitmentRows } from "../api/recruitmentApi";

/**
 * Recruitment Dashboard
 * Complete recruitment analytics and real-time operations hub
 */
const JobDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [aiResults, setAiResults] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [jobsRes, appsRes, candidatesRes, aiRes, interviewsRes, notifsRes] = await Promise.all([
        getRecruitmentRows("recruitmentJobs"),
        getRecruitmentRows("recruitmentApplications"),
        getRecruitmentRows("recruitmentCandidates"),
        getRecruitmentRows("recruitmentAiResults"),
        getRecruitmentRows("recruitmentInterviews"),
        getRecruitmentRows("recruitmentNotifications"),
      ]);

      setJobs(jobsRes.data?.data || []);
      setApplications(appsRes.data?.data || []);
      setCandidates(candidatesRes.data?.data || []);
      setAiResults(aiRes.data?.data || []);
      setInterviews(interviewsRes.data?.data || []);
      setNotifications(notifsRes.data?.data || []);

    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getJobStats = (jobId) => {
    const jobApplications = applications.filter(app => app.jobId === jobId);
    
    const toBeReviewed = jobApplications.filter(app => 
      app.status === "Pending" || app.status === "New" || app.status === "To Be Reviewed"
    ).length;

    const shortlisted = jobApplications.filter(app => 
      app.status === "Shortlisted"
    ).length;

    const interviewCount = interviews.filter(int => 
      int.jobId === jobId && int.status === "Scheduled"
    ).length;

    // AI-suggested candidates (matched to this job role with score >= 60, but didn't apply to it)
    const job = jobs.find(j => j.id === jobId);
    const aiSuggested = aiResults.filter(ai => {
      if (!job) return false;
      const matches = ai.result?.jobMatches || [];
      const match = matches.find(m => m.jobTitle === job.title && !m.isAppliedJob && m.matchScore >= 60);
      const hasApplied = jobApplications.some(app => app.candidateId === ai.candidateId);
      return Boolean(match && !hasApplied);
    });

    return {
      total: jobApplications.length,
      toBeReviewed,
      shortlisted,
      interviews: interviewCount,
      aiSuggested: aiSuggested.length,
      aiSuggestedCandidates: aiSuggested,
    };
  };

  const getOverallStats = () => {
    const activeJobs = jobs.filter(j => j.status === "Open").length;
    const totalCandidates = candidates.length;
    const totalApplications = applications.length;

    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const recentApps24h = applications.filter(app => {
      const dt = new Date(app.createdAt || app.appliedAt || 0);
      return dt > oneDayAgo;
    }).length;

    const recentApps7d = applications.filter(app => {
      const dt = new Date(app.createdAt || app.appliedAt || 0);
      return dt > sevenDaysAgo;
    }).length;

    const awaitingReview = applications.filter(app => 
      app.status === "Pending" || app.status === "New" || app.status === "To Be Reviewed"
    ).length;

    const shortlisted = applications.filter(app => 
      app.status === "Shortlisted"
    ).length;

    const scheduledInterviews = interviews.filter(int => 
      int.status === "Scheduled"
    ).length;

    const completedInterviews = interviews.filter(int => 
      int.status === "Completed"
    ).length;

    const unreadNotifications = notifications.filter(n => !n.isRead && !n.is_read).length;

    return {
      activeJobs,
      totalCandidates,
      totalApplications,
      recentApps24h,
      recentApps7d,
      awaitingReview,
      shortlisted,
      scheduledInterviews,
      completedInterviews,
      unreadNotifications,
    };
  };

  const getCandidateForApplication = (app) => {
    return candidates.find(c => c.id === app.candidateId);
  };

  const getAIScoreForCandidate = (candidateId, jobId) => {
    const aiResult = aiResults.find(ai => 
      ai.candidateId === candidateId && (ai.jobId === jobId || !ai.jobId)
    );
    return aiResult?.score || aiResult?.result?.jobMatches?.[0]?.matchScore || null;
  };

  const getAIStatusForCandidate = (candidateId) => {
    const aiResult = aiResults.find(ai => ai.candidateId === candidateId);
    return aiResult?.status || "Pending";
  };

  // Recent activity stream combining notifications, latest applications, and interviews
  const getRecentActivities = () => {
    const items = [];

    // Add recent applications
    applications.slice(-6).forEach(app => {
      const candidate = candidates.find(c => c.id === app.candidateId);
      const job = jobs.find(j => j.id === app.jobId);
      items.push({
        id: `app-${app.id}`,
        title: "Application Received",
        desc: `${candidate?.name || candidate?.email || "Candidate"} applied for ${job?.title || "Job"}`,
        time: app.createdAt || app.appliedAt,
        type: "application",
        link: candidate ? `/recruitment/candidates/${candidate.id}` : "/recruitment/candidates",
      });
    });

    // Add recent interviews
    interviews.slice(-4).forEach(interview => {
      const candidate = candidates.find(c => c.id === interview.candidateId);
      items.push({
        id: `int-${interview.id}`,
        title: `Interview ${interview.status || "Scheduled"}`,
        desc: `${interview.title || "Interview"} with ${candidate?.name || "Candidate"}`,
        time: interview.scheduledAt || interview.interview_date || interview.createdAt,
        type: "interview",
        link: "/recruitment/schedule-manage/all-interviews",
      });
    });

    // Add recent notifications
    notifications.slice(0, 4).forEach(n => {
      items.push({
        id: `notif-${n.id}`,
        title: n.title,
        desc: n.message,
        time: n.createdAt,
        type: "notification",
        link: "/recruitment/notifications",
      });
    });

    // Sort newest first
    return items
      .filter(item => item.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);
  };

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal-600 animate-pulse" />
          <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
            Loading recruitment metrics and analytics...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 text-sm font-semibold text-red-700 bg-white rounded-lg border border-red-300 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = getOverallStats();
  const activeJobs = jobs.filter(j => j.status === "Open");
  const recentActivities = getRecentActivities();

  return (
    <div className="space-y-6">
      {/* Header with Navigation Shortcuts */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              SmartHire Recruitment Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Live recruitment pipeline analytics, job statistics, and real-time candidate intake.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300"
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              to="/recruitment/jobs"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Manage Jobs
            </Link>
          </div>
        </div>

        {/* Navigation Quick Shortcuts */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-gray-700">
          <Link
            to="/recruitment/candidates"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Candidates Pipeline
          </Link>
          <Link
            to="/recruitment/schedule-manage/all-interviews"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            Interviews Schedule
          </Link>
          <Link
            to="/recruitment/alerts"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            Hiring Alerts ({stats.unreadNotifications})
          </Link>
          <Link
            to="/recruitment/email-settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300"
          >
            <Mail className="w-3.5 h-3.5 text-teal-600" />
            Recruitment Email Settings
          </Link>
        </div>
      </div>

      {/* 8 Primary SaaS Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Briefcase className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-semibold text-slate-500">Active Jobs</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.activeJobs}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500">Candidates</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalCandidates}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-4 h-4 text-cyan-600" />
            <span className="text-xs font-semibold text-slate-500">Applications</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalApplications}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500">New (7 Days)</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.recentApps7d}</p>
          <span className="text-[10px] text-slate-400 font-medium">{stats.recentApps24h} in 24h</span>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500">To Review</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.awaitingReview}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-slate-500">Shortlisted</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.shortlisted}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-slate-500">Scheduled</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.scheduledInterviews}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarCheck className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-slate-500">Completed</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.completedInterviews}</p>
        </div>
      </div>

      {/* Main Grid: Active Jobs Breakdown & Recent Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Jobs Overview (2 columns on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Active Jobs Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Applications, reviews, and AI match counts for active roles.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                {activeJobs.length} Active Role{activeJobs.length !== 1 ? "s" : ""}
              </span>
            </div>

            {activeJobs.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-gray-700/30 border border-dashed border-slate-200">
                <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">No active job posts</p>
                <p className="text-xs text-slate-500 mt-1">Create an open job post to begin tracking applications.</p>
                <Link
                  to="/recruitment/jobs"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-700 text-white"
                >
                  Create First Job
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map((job) => {
                  const jobStat = getJobStats(job.id);
                  const isSelected = selectedJob === job.id;

                  return (
                    <div
                      key={job.id}
                      className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden transition"
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/30 flex items-center justify-between"
                        onClick={() => setSelectedJob(isSelected ? null : job.id)}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-white truncate text-sm">
                              {job.title}
                            </h4>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                              Open
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                            <span><strong>{jobStat.total}</strong> applications</span>
                            <span className="text-amber-600"><strong>{jobStat.toBeReviewed}</strong> to review</span>
                            <span className="text-purple-600"><strong>{jobStat.shortlisted}</strong> shortlisted</span>
                            <span className="text-indigo-600"><strong>{jobStat.interviews}</strong> interviews</span>
                            {jobStat.aiSuggested > 0 && (
                              <span className="text-teal-600 font-semibold">
                                {jobStat.aiSuggested} AI-suggested
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                        >
                          {isSelected ? "Hide" : "Details"}
                        </button>
                      </div>

                      {isSelected && (
                        <div className="border-t border-slate-100 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/30 p-4 space-y-4">
                          <div>
                            <h5 className="text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-2">
                              Actual Applicants ({jobStat.total})
                            </h5>

                            {jobStat.total === 0 ? (
                              <p className="text-xs text-slate-500 italic">No applications received for this job yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {applications
                                  .filter(app => app.jobId === job.id)
                                  .map(app => {
                                    const candidate = getCandidateForApplication(app);
                                    const aiScore = getAIScoreForCandidate(app.candidateId, job.id);
                                    const aiStatus = getAIStatusForCandidate(app.candidateId);
                                    if (!candidate) return null;

                                    return (
                                      <div
                                        key={app.id}
                                        className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div>
                                          <Link
                                            to={`/recruitment/candidates/${candidate.id}`}
                                            className="font-semibold text-teal-700 hover:underline"
                                          >
                                            {candidate.name || candidate.email}
                                          </Link>
                                          <div className="flex gap-2 text-[11px] text-slate-500 mt-0.5">
                                            <span>Status: {app.status || "Pending"}</span>
                                            <span>•</span>
                                            <span>AI: {aiStatus}</span>
                                            {aiScore !== null && (
                                              <span className="font-semibold text-teal-700">
                                                Match: {aiScore}%
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <Link
                                          to={`/recruitment/candidates/${candidate.id}`}
                                          className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
                                        >
                                          View <ArrowRight size={12} />
                                        </Link>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {jobStat.aiSuggested > 0 && (
                            <div className="pt-3 border-t border-slate-200/70">
                              <div className="flex items-center gap-1.5 mb-2">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                                  AI-Suggested Candidates ({jobStat.aiSuggested})
                                </h5>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-2">
                                Candidates from other applications whose profile skills strongly match this role.
                              </p>

                              <div className="space-y-1.5">
                                {jobStat.aiSuggestedCandidates.map(ai => {
                                  const candidate = candidates.find(c => c.id === ai.candidateId);
                                  const match = ai.result?.jobMatches?.find(m => m.jobTitle === job.title);
                                  if (!candidate) return null;

                                  return (
                                    <div
                                      key={ai.id}
                                      className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <Link
                                          to={`/recruitment/candidates/${candidate.id}`}
                                          className="font-semibold text-slate-800 hover:underline"
                                        >
                                          {candidate.name || candidate.email}
                                        </Link>
                                        <div className="text-[11px] text-amber-700 font-medium">
                                          {match?.matchScore}% match • {match?.recommendation || "Recommended"}
                                        </div>
                                      </div>
                                      <Link
                                        to={`/recruitment/candidates/${candidate.id}`}
                                        className="text-[11px] font-semibold text-teal-700"
                                      >
                                        Review
                                      </Link>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed (1 column on lg) */}
        <div className="space-y-4">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/70">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Recent Recruitment Activity
              </h3>
              <Link
                to="/recruitment/notifications"
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                All Activities
              </Link>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                No recent recruitment activity recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map(act => (
                  <Link
                    key={act.id}
                    to={act.link}
                    className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/50 border border-slate-100 dark:border-gray-700 transition"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/30 flex-shrink-0 mt-0.5">
                        {act.type === "application" ? (
                          <FileText size={14} />
                        ) : act.type === "interview" ? (
                          <Calendar size={14} />
                        ) : (
                          <Bell size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {act.desc}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {act.time ? new Date(act.time).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDashboard;
