/**
 * Recruitment AI Analysis Service
 * Enhanced CV analysis with job matching and categorization
 */

import { recruitmentFirestore } from "./recruitmentFirebaseService.js";
import { createRecruitmentNotification } from "./recruitmentNotificationService.js";

/**
 * Build enhanced AI prompt for CV analysis with job matching
 */
export const buildEnhancedScreeningPrompt = ({ resumeText, jobs, appliedJobTitle }) => {
  const jobDescriptions = jobs.map(job => ({
    title: job.title,
    description: job.description || "",
    requirements: job.requirements || "",
    location: job.location || "",
    department: job.department || "",
  }));

  return [
    {
      role: "system",
      content: [
        "You are an expert HR recruitment analyst. Analyze the candidate's resume and match them against the provided job roles.",
        "Extract structured information from the resume including name, contact details, education, experience, skills, and qualifications.",
        "For each job role provided, calculate a match score (0-100) based on:",
        "- Required skills match",
        "- Experience relevance and level",
        "- Education requirements",
        "- Location compatibility (if specified)",
        "- Overall role suitability",
        "",
        "Return ONLY a valid JSON object with this exact structure:",
        "{",
        '  "candidateProfile": {',
        '    "name": "string or null",',
        '    "email": "string or null",',
        '    "phone": "string or null",',
        '    "location": "string or null",',
        '    "currentRole": "string or null"',
        "  },",
        '  "education": {',
        '    "degrees": ["list of degrees/qualifications"],',
        '    "institutions": ["list of institutions if available"],',
        '    "fields": ["list of study fields"]',
        "  },",
        '  "experience": {',
        '    "totalYears": number or null,',
        '    "roles": ["list of previous job titles"],',
        '    "companies": ["list of companies if available"],',
        '    "summary": "brief experience summary"',
        "  },",
        '  "skills": {',
        '    "technical": ["list of technical skills"],',
        '    "tools": ["list of software/tools"],',
        '    "languages": ["list of programming languages if applicable"],',
        '    "soft": ["list of soft skills"],',
        '    "certifications": ["list of certifications"]',
        "  },",
        '  "jobMatches": [',
        "    {",
        '      "jobTitle": "exact job title from provided list",',
        '      "matchScore": number 0-100,',
        '      "isAppliedJob": boolean,',
        '      "matchingSk skills": ["skills that match job requirements"],',
        '      "missingSkills": ["required skills not found in CV"],',
        '      "experienceMatch": "poor|fair|good|excellent",',
        '      "educationMatch": "poor|fair|good|excellent",',
        '      "summary": "brief explanation of why this score",',
        '      "recommendation": "Not Suitable|Consider|Recommended|Highly Recommended"',
        "    }",
        "  ],",
        '  "overallSummary": "2-3 sentence summary of candidate",',
        '  "strengths": ["list of key strengths"],',
        '  "developmentAreas": ["list of areas for development"]',
        "}",
        "",
        "Important:",
        "- Do not invent information not present in the CV",
        "- Mark unknown fields as null or empty arrays",
        "- Base match scores on actual evidence from the CV",
        "- Explain scores with specific examples",
        "- Do not use protected characteristics for matching",
        "- Focus on job-related skills, experience, and qualifications only",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        resumeText,
        appliedJobTitle: appliedJobTitle || "General Application",
        availableJobs: jobDescriptions,
      }),
    },
  ];
};

/**
 * Parse and validate AI analysis result
 */
export const parseAIAnalysisResult = (content) => {
  if (typeof content !== "string") return null;

  // Remove markdown code blocks if present
  const json = content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const result = JSON.parse(json);

    // Validate structure
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return null;
    }

    // Validate required fields
    if (!result.candidateProfile || typeof result.candidateProfile !== "object") {
      return null;
    }

    if (!result.jobMatches || !Array.isArray(result.jobMatches)) {
      return null;
    }

    // Validate job matches
    for (const match of result.jobMatches) {
      if (typeof match.matchScore !== "number" || 
          match.matchScore < 0 || 
          match.matchScore > 100 ||
          !Number.isFinite(match.matchScore)) {
        return null;
      }
    }

    return result;

  } catch (error) {
    console.error("Failed to parse AI analysis result:", error.message);
    return null;
  }
};

/**
 * Perform AI analysis on resume with job matching
 */
export const analyzeResumeWithJobMatching = async ({
  resumeText,
  candidateId,
  applicationId,
  resumeId,
  appliedJobId = null,
}) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ AI is not configured");
  }

  // Get all active jobs
  const allJobs = await recruitmentFirestore.list("recruitmentJobs", {});
  const activeJobs = allJobs.filter(job => job.status === "Open");

  if (activeJobs.length === 0) {
    throw new Error("No active jobs available for matching");
  }

  // Get applied job title
  let appliedJobTitle = null;
  if (appliedJobId) {
    const appliedJob = activeJobs.find(j => j.id === appliedJobId);
    appliedJobTitle = appliedJob?.title || null;
  }

  // Build AI prompt
  const messages = buildEnhancedScreeningPrompt({
    resumeText,
    jobs: activeJobs,
    appliedJobTitle,
  });

  // Call Groq API
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 4000,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI provider request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI provider returned empty response");
  }

  // Parse result
  const analysisResult = parseAIAnalysisResult(content);

  if (!analysisResult) {
    throw new Error("AI provider returned invalid analysis format");
  }

  // Store analysis result
  const aiResult = await recruitmentFirestore.create("recruitmentAiResults", {
    candidateId,
    applicationId,
    resumeId,
    jobId: appliedJobId,
    resumeAttachmentId: null,
    jobRole: appliedJobTitle || "General Application",
    resumeText: resumeText.slice(0, 50000), // Store truncated
    result: analysisResult,
    
    // Legacy flat fields for compatibility
    score: analysisResult.jobMatches[0]?.matchScore || 0,
    recommendation: analysisResult.jobMatches[0]?.recommendation || "Consider",
    summary: analysisResult.overallSummary || "",
    strengths: analysisResult.strengths || [],
    missingSkills: analysisResult.jobMatches[0]?.missingSkills || [],
    
    status: "Completed",
    screeningMode: "enhanced-auto",
  });

  // Update candidate with AI-extracted information
  if (analysisResult.candidateProfile) {
    const updates = {};
    
    if (analysisResult.candidateProfile.location) {
      updates.location = analysisResult.candidateProfile.location;
    }
    
    if (analysisResult.skills?.technical) {
      updates.skills = analysisResult.skills.technical;
    }
    
    if (analysisResult.experience?.summary) {
      updates.experience = analysisResult.experience.summary;
    }
    
    if (analysisResult.education?.degrees) {
      updates.education = analysisResult.education.degrees.join(", ");
    }
    
    if (analysisResult.overallSummary) {
      updates.summary = analysisResult.overallSummary;
    }

    // Update AI score fields
    if (analysisResult.jobMatches[0]) {
      updates.aiScore = analysisResult.jobMatches[0].matchScore;
      updates.ai_score = analysisResult.jobMatches[0].matchScore;
      updates.aiRecommendation = analysisResult.jobMatches[0].recommendation;
      updates.aiSummary = analysisResult.overallSummary;
      updates.aiStrengths = analysisResult.strengths?.join(", ");
      updates.aiMissingSkills = analysisResult.jobMatches[0].missingSkills?.join(", ");
    }

    if (Object.keys(updates).length > 0) {
      await recruitmentFirestore.update("recruitmentCandidates", candidateId, updates);
    }
  }

  return aiResult;
};

/**
 * Process pending AI analysis requests
 */
export const processPendingAIAnalysis = async () => {
  if (!process.env.GROQ_API_KEY) {
    console.log("AI analysis skipped: GROQ not configured");
    return { skipped: true };
  }

  try {
    // Get pending AI analysis requests
    const aiResults = await recruitmentFirestore.list("recruitmentAiResults", {});
    const pending = aiResults.filter(r => r.status === "Pending");

    if (pending.length === 0) {
      return { processed: 0 };
    }

    console.log(`Processing ${pending.length} pending AI analysis requests`);

    let successCount = 0;
    let errorCount = 0;

    for (const pendingAnalysis of pending) {
      try {
        // Get resume text
        const resume = await recruitmentFirestore.list("recruitmentResumes", {});
        const resumeRecord = resume.find(r => r.id === pendingAnalysis.resumeId);

        if (!resumeRecord || !resumeRecord.extractedText) {
          console.error(`No extracted text for resume ${pendingAnalysis.resumeId}`);
          await recruitmentFirestore.update("recruitmentAiResults", pendingAnalysis.id, {
            status: "Failed",
          });
          errorCount++;
          continue;
        }

        // Perform analysis
        await analyzeResumeWithJobMatching({
          resumeText: resumeRecord.extractedText,
          candidateId: pendingAnalysis.candidateId,
          applicationId: pendingAnalysis.applicationId,
          resumeId: pendingAnalysis.resumeId,
          appliedJobId: pendingAnalysis.jobId,
        });

        // Delete the pending record (new complete record was created)
        await recruitmentFirestore.remove("recruitmentAiResults", pendingAnalysis.id);

        // Get candidate
        const candidate = await recruitmentFirestore.list("recruitmentCandidates", {});
        const candidateRecord = candidate.find(c => c.id === pendingAnalysis.candidateId);

        // Notify
        if (candidateRecord) {
          await createRecruitmentNotification({
            type: "ai_complete",
            category: "analysis",
            title: "AI Analysis Complete",
            message: `AI analysis completed for ${candidateRecord.name}`,
            candidateId: candidateRecord.id,
          });
        }

        successCount++;

      } catch (error) {
        console.error(`AI analysis failed for ${pendingAnalysis.id}:`, error.message);
        
        await recruitmentFirestore.update("recruitmentAiResults", pendingAnalysis.id, {
          status: "Failed",
        });

        // Notify of failure
        const candidate = await recruitmentFirestore.list("recruitmentCandidates", {});
        const candidateRecord = candidate.find(c => c.id === pendingAnalysis.candidateId);

        if (candidateRecord) {
          await createRecruitmentNotification({
            type: "ai_failed",
            category: "analysis",
            title: "AI Analysis Failed",
            message: `AI analysis failed for ${candidateRecord.name}: ${error.message}`,
            candidateId: candidateRecord.id,
          });
        }

        errorCount++;
      }
    }

    console.log(`AI analysis complete: success=${successCount}, errors=${errorCount}`);

    return { processed: successCount + errorCount, successCount, errorCount };

  } catch (error) {
    console.error("Failed to process pending AI analysis:", error.message);
    throw error;
  }
};

/**
 * Get AI analysis for a candidate
 */
export const getCandidateAIAnalysis = async (candidateId) => {
  const aiResults = await recruitmentFirestore.list("recruitmentAiResults", {});
  return aiResults.filter(r => r.candidateId === candidateId);
};

/**
 * Retry failed AI analysis
 */
export const retryAIAnalysis = async (aiResultId) => {
  const aiResults = await recruitmentFirestore.list("recruitmentAiResults", {});
  const aiResult = aiResults.find(r => r.id === aiResultId);

  if (!aiResult) {
    throw new Error("AI analysis record not found");
  }

  if (aiResult.status === "Completed") {
    throw new Error("AI analysis already completed");
  }

  // Update to pending
  await recruitmentFirestore.update("recruitmentAiResults", aiResultId, {
    status: "Pending",
  });

  // Process immediately
  await processPendingAIAnalysis();

  return { success: true };
};
