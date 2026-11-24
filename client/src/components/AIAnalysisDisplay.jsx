import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, TrendingUp, Briefcase, Award, AlertTriangle } from "lucide-react";
import { getCandidateAIAnalysis, retryAIAnalysis } from "../api/recruitmentApi";
import { toast } from "react-toastify";

/**
 * AI Analysis Display Component
 * Shows complete AI analysis results for a candidate
 */
const AIAnalysisDisplay = ({ candidateId, applicationId = null }) => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCandidateAIAnalysis(candidateId);
      const data = response.data?.data || response.data || [];
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load AI analysis:", err);
      setError(err.response?.data?.message || "Failed to load AI analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId) {
      loadAnalysis();
    }
  }, [candidateId]);

  const handleRetry = async (analysisId) => {
    try {
      setRetrying(analysisId);
      await retryAIAnalysis(analysisId);
      toast.success("AI analysis retry initiated");
      setTimeout(loadAnalysis, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to retry analysis");
    } finally {
      setRetrying(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "Failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "Pending":
        return <Clock className="w-5 h-5 text-amber-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getMatchColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-blue-600 bg-blue-50";
    if (score >= 40) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getRecommendationBadge = (recommendation) => {
    const colors = {
      "Highly Recommended": "bg-green-100 text-green-800 border-green-200",
      "Recommended": "bg-blue-100 text-blue-800 border-blue-200",
      "Consider": "bg-amber-100 text-amber-800 border-amber-200",
      "Not Suitable": "bg-red-100 text-red-800 border-red-200",
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${colors[recommendation] || "bg-gray-100 text-gray-800"}`}>
        {recommendation}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal-600 animate-pulse" />
          <span className="text-gray-600 dark:text-gray-400">Loading AI analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button
            onClick={loadAnalysis}
            className="px-3 py-1 text-sm font-medium text-red-700 bg-white rounded-lg border border-red-300 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            No AI analysis available for this candidate yet.
          </span>
        </div>
      </div>
    );
  }

  // Get the most recent analysis
  const latestAnalysis = analyses.sort((a, b) => 
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )[0];

  const result = latestAnalysis.result || {};
  const profile = result.candidateProfile || {};
  const education = result.education || {};
  const experience = result.experience || {};
  const skills = result.skills || {};
  const jobMatches = result.jobMatches || [];

  // Separate applied job from suggested jobs
  const appliedJobMatch = jobMatches.find(m => m.isAppliedJob);
  const suggestedJobMatches = jobMatches.filter(m => !m.isAppliedJob);

  return (
    <div className="space-y-6">
      {/* Analysis Status Header */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(latestAnalysis.status)}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Analysis Results
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Status: {latestAnalysis.status} • {new Date(latestAnalysis.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          {latestAnalysis.status === "Failed" && (
            <button
              onClick={() => handleRetry(latestAnalysis.id)}
              disabled={retrying === latestAnalysis.id}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${retrying === latestAnalysis.id ? "animate-spin" : ""}`} />
              {retrying === latestAnalysis.id ? "Retrying..." : "Retry Analysis"}
            </button>
          )}
        </div>

        {/* Overall Summary */}
        {result.overallSummary && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{result.overallSummary}</p>
          </div>
        )}
      </div>

      {/* Candidate Profile */}
      {(profile.name || profile.email || profile.phone || profile.location || profile.currentRole) && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Candidate Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.name && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Name</span>
                <p className="text-sm text-gray-900 dark:text-white">{profile.name}</p>
              </div>
            )}
            {profile.email && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Email</span>
                <p className="text-sm text-gray-900 dark:text-white">{profile.email}</p>
              </div>
            )}
            {profile.phone && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-sm text-gray-900 dark:text-white">{profile.phone}</p>
              </div>
            )}
            {profile.location && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Location</span>
                <p className="text-sm text-gray-900 dark:text-white">{profile.location}</p>
              </div>
            )}
            {profile.currentRole && (
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Current Role</span>
                <p className="text-sm text-gray-900 dark:text-white">{profile.currentRole}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Education */}
      {(education.degrees?.length > 0 || education.fields?.length > 0) && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Education & Qualifications
            </h3>
          </div>
          {education.degrees?.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Degrees</h4>
              <ul className="list-disc list-inside space-y-1">
                {education.degrees.map((degree, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">{degree}</li>
                ))}
              </ul>
            </div>
          )}
          {education.institutions?.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Institutions</h4>
              <ul className="list-disc list-inside space-y-1">
                {education.institutions.map((inst, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">{inst}</li>
                ))}
              </ul>
            </div>
          )}
          {education.fields?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Fields of Study</h4>
              <div className="flex flex-wrap gap-2">
                {education.fields.map((field, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Experience */}
      {(experience.totalYears || experience.roles?.length > 0 || experience.summary) && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Work Experience
            </h3>
          </div>
          {experience.totalYears && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Experience</span>
              <p className="text-sm text-gray-900 dark:text-white">{experience.totalYears} years</p>
            </div>
          )}
          {experience.summary && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Summary</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{experience.summary}</p>
            </div>
          )}
          {experience.roles?.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Previous Roles</h4>
              <ul className="list-disc list-inside space-y-1">
                {experience.roles.map((role, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">{role}</li>
                ))}
              </ul>
            </div>
          )}
          {experience.companies?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Companies</h4>
              <div className="flex flex-wrap gap-2">
                {experience.companies.map((company, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg">
                    {company}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skills */}
      {(skills.technical?.length > 0 || skills.tools?.length > 0 || 
        skills.languages?.length > 0 || skills.soft?.length > 0 || 
        skills.certifications?.length > 0) && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Skills & Certifications
          </h3>
          <div className="space-y-4">
            {skills.technical?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Technical Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.technical.map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {skills.tools?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Tools & Software</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.tools.map((tool, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {skills.languages?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Programming Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.languages.map((lang, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {skills.soft?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Soft Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.soft.map((soft, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs font-medium bg-pink-50 text-pink-700 rounded-lg">
                      {soft}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {skills.certifications?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Certifications</h4>
                <ul className="list-disc list-inside space-y-1">
                  {skills.certifications.map((cert, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">{cert}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Applied Job Match */}
      {appliedJobMatch && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-teal-200 dark:border-teal-800">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Applied Job: {appliedJobMatch.jobTitle}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className={`p-4 rounded-lg ${getMatchColor(appliedJobMatch.matchScore)}`}>
              <span className="text-xs font-semibold">Match Score</span>
              <p className="text-2xl font-bold">{appliedJobMatch.matchScore}%</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Experience Match</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{appliedJobMatch.experienceMatch}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Education Match</span>
              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{appliedJobMatch.educationMatch}</p>
            </div>
          </div>

          <div className="mb-4">
            {getRecommendationBadge(appliedJobMatch.recommendation)}
          </div>

          {appliedJobMatch.summary && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Analysis</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{appliedJobMatch.summary}</p>
            </div>
          )}

          {appliedJobMatch.matchingSkills?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Matching Skills</h4>
              <div className="flex flex-wrap gap-2">
                {appliedJobMatch.matchingSkills.map((skill, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-lg border border-green-200">
                    ✓ {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {appliedJobMatch.missingSkills?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Missing Requirements</h4>
              <div className="flex flex-wrap gap-2">
                {appliedJobMatch.missingSkills.map((skill, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg border border-red-200">
                    ✗ {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Alternative Jobs */}
      {suggestedJobMatches.length > 0 && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI-Suggested Alternative Roles
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Based on the candidate's profile, AI suggests these alternative positions:
          </p>

          <div className="space-y-4">
            {suggestedJobMatches
              .sort((a, b) => b.matchScore - a.matchScore)
              .map((match, idx) => (
                <div key={idx} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{match.jobTitle}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${getMatchColor(match.matchScore)}`}>
                          {match.matchScore}% Match
                        </span>
                        {getRecommendationBadge(match.recommendation)}
                      </div>
                    </div>
                  </div>

                  {match.summary && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{match.summary}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-gray-500 dark:text-gray-400">Experience:</span>
                      <span className="ml-1 capitalize text-gray-700 dark:text-gray-300">{match.experienceMatch}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 dark:text-gray-400">Education:</span>
                      <span className="ml-1 capitalize text-gray-700 dark:text-gray-300">{match.educationMatch}</span>
                    </div>
                  </div>

                  {match.matchingSkills?.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Matching Skills:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {match.matchingSkills.slice(0, 5).map((skill, skillIdx) => (
                          <span key={skillIdx} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                            {skill}
                          </span>
                        ))}
                        {match.matchingSkills.length > 5 && (
                          <span className="px-2 py-0.5 text-xs text-gray-500">
                            +{match.matchingSkills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Strengths and Development Areas */}
      {(result.strengths?.length > 0 || result.developmentAreas?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {result.strengths?.length > 0 && (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Key Strengths
              </h3>
              <ul className="space-y-2">
                {result.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.developmentAreas?.length > 0 && (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Development Areas
              </h3>
              <ul className="space-y-2">
                {result.developmentAreas.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAnalysisDisplay;
