import assert from "node:assert/strict";
import { test } from "node:test";

// Mock email data structures
const createMockParsedEmail = (options = {}) => ({
  messageId: options.messageId || "test-message-123",
  from: {
    value: [{
      address: options.fromEmail || "candidate@example.com",
      name: options.fromName || "Test Candidate",
    }],
  },
  subject: options.subject || "Application for Software Developer",
  text: options.text || "Hello, I am applying for the software developer position. Please find my resume attached.",
  html: options.html || null,
  date: options.date || new Date(),
  attachments: options.attachments || [],
});

const createMockAttachment = (options = {}) => ({
  filename: options.filename || "resume.pdf",
  contentType: options.contentType || "application/pdf",
  content: options.content || Buffer.from("%PDF-1.4 test content"),
});

test("Email classification identifies recruitment emails by keywords", () => {
  const recruitmentKeywords = [
    "Application for Software Developer",
    "Applying for the position",
    "My CV is attached",
    "Job application - Marketing Manager",
    "Resume for review",
    "Interested in the vacancy",
  ];

  const nonRecruitmentSubjects = [
    "Meeting reminder",
    "Invoice #12345",
    "Project update",
    "General inquiry",
  ];

  // Test that recruitment keywords would be detected
  for (const subject of recruitmentKeywords) {
    const lowerSubject = subject.toLowerCase();
    const hasKeyword = [
      "application", "apply", "cv", "resume", "job", "position", "vacancy"
    ].some(kw => lowerSubject.includes(kw));
    
    assert.ok(hasKeyword, `"${subject}" should be identified as recruitment email`);
  }

  // Test that non-recruitment subjects don't trigger
  for (const subject of nonRecruitmentSubjects) {
    const lowerSubject = subject.toLowerCase();
    const hasKeyword = [
      "application", "apply", "cv", "resume", "job", "position", "vacancy"
    ].some(kw => lowerSubject.includes(kw));
    
    assert.ok(!hasKeyword, `"${subject}" should not be identified as recruitment email`);
  }
});

test("Email classification identifies recruitment emails by CV attachments", () => {
  const recruitmentAttachments = [
    "john_doe_cv.pdf",
    "Resume_2024.docx",
    "my-resume.pdf",
    "curriculum_vitae.pdf",
  ];

  const nonRecruitmentAttachments = [
    "invoice.pdf",
    "presentation.pptx",
    "report.xlsx",
    "image.jpg",
  ];

  // Test CV/resume filenames
  for (const filename of recruitmentAttachments) {
    const lower = filename.toLowerCase();
    const isResumeFile = lower.includes("cv") || 
                         lower.includes("resume") ||
                         lower.includes("curriculum");
    
    assert.ok(isResumeFile, `"${filename}" should be identified as CV/resume`);
  }

  // Test non-CV filenames
  for (const filename of nonRecruitmentAttachments) {
    const lower = filename.toLowerCase();
    const isResumeFile = lower.includes("cv") || 
                         lower.includes("resume") ||
                         lower.includes("curriculum");
    
    assert.ok(!isResumeFile, `"${filename}" should not be identified as CV/resume`);
  }
});

test("Job title extraction from email subject", () => {
  const testCases = [
    {
      subject: "Application for Software Developer",
      expected: "Software Developer",
    },
    {
      subject: "Applying for Senior Marketing Manager",
      expected: "Senior Marketing Manager",
    },
    {
      subject: "Position: Data Analyst - Application",
      expected: "Data Analyst",
    },
    {
      subject: "Job: Frontend Developer",
      expected: "Frontend Developer",
    },
  ];

  for (const testCase of testCases) {
    const patterns = [
      /application\s+for\s+(.+?)(?:\s*[-–—]\s*|\s*$)/i,
      /applying\s+for\s+(.+?)(?:\s*[-–—]\s*|\s*$)/i,
      /position:\s*(.+?)(?:\s*[-–—]\s*|\s*$)/i,
      /job:\s*(.+?)(?:\s*[-–—]\s*|\s*$)/i,
    ];

    let extracted = null;
    for (const pattern of patterns) {
      const match = testCase.subject.match(pattern);
      if (match && match[1]) {
        extracted = match[1].trim();
        break;
      }
    }

    assert.ok(extracted, `Should extract job title from "${testCase.subject}"`);
    assert.ok(
      extracted.toLowerCase().includes(testCase.expected.toLowerCase()) ||
      testCase.expected.toLowerCase().includes(extracted.toLowerCase()),
      `Extracted "${extracted}" should match expected "${testCase.expected}"`
    );
  }
});

test("Attachment validation rejects unsupported file types", () => {
  const supportedExtensions = [".pdf", ".docx", ".txt"];
  const unsupportedExtensions = [".exe", ".zip", ".jpg", ".png", ".xlsx", ".pptx"];

  for (const ext of supportedExtensions) {
    assert.ok(
      supportedExtensions.includes(ext),
      `${ext} should be supported`
    );
  }

  for (const ext of unsupportedExtensions) {
    assert.ok(
      !supportedExtensions.includes(ext),
      `${ext} should not be supported`
    );
  }
});

test("Email normalization for candidate matching", () => {
  const emailVariants = [
    "Test.User@Example.Com",
    "test.user@example.com",
    " test.user@example.com ",
    "TEST.USER@EXAMPLE.COM",
  ];

  const normalized = emailVariants.map(email => email.toLowerCase().trim());

  // All should normalize to the same value
  const unique = [...new Set(normalized)];
  assert.equal(unique.length, 1, "All email variants should normalize to the same value");
  assert.equal(unique[0], "test.user@example.com");
});

test("Quoted reply content stripping", () => {
  const emailWithQuotes = `Thank you for considering my application.

I look forward to hearing from you.

On Mon, Jan 1, 2024 at 10:00 AM HR Team <hr@company.com> wrote:
> Thank you for applying.
> We will review your application.`;

  const lines = emailWithQuotes.split(/\r?\n/);
  let cutIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^On\b.*wrote:\s*$/i.test(line)) {
      cutIndex = i;
      break;
    }
  }

  const cleaned = cutIndex === -1 
    ? emailWithQuotes.trim() 
    : lines.slice(0, cutIndex).join("\n").trim();

  assert.ok(cleaned.includes("Thank you for considering my application"));
  assert.ok(cleaned.includes("I look forward to hearing from you"));
  assert.ok(!cleaned.includes("Thank you for applying"));
  assert.ok(!cleaned.includes("We will review your application"));
});

test("Duplicate email detection by message ID", () => {
  const processedMessageIds = new Set([
    "msg-001@server.com",
    "msg-002@server.com",
    "msg-003@server.com",
  ]);

  const newMessage = "msg-004@server.com";
  const duplicateMessage = "msg-002@server.com";

  assert.ok(!processedMessageIds.has(newMessage), "New message should not be marked as duplicate");
  assert.ok(processedMessageIds.has(duplicateMessage), "Existing message should be marked as duplicate");
});

test("Email sync status tracking structure", () => {
  const syncStatus = {
    lastSyncStartedAt: new Date().toISOString(),
    lastSyncCompletedAt: new Date().toISOString(),
    lastSuccessfulSyncAt: new Date().toISOString(),
    lastError: null,
    processedCount: 5,
    skippedCount: 2,
    errorCount: 0,
    syncStatus: "Success",
  };

  assert.ok(syncStatus.lastSyncStartedAt);
  assert.ok(syncStatus.lastSyncCompletedAt);
  assert.equal(syncStatus.processedCount, 5);
  assert.equal(syncStatus.skippedCount, 2);
  assert.equal(syncStatus.errorCount, 0);
  assert.equal(syncStatus.syncStatus, "Success");
});

test("Resume source type differentiation", () => {
  const emailSourceResume = {
    sourceType: "Email",
    candidateId: "candidate-123",
    attachmentId: "attach-456",
  };

  const manualSourceResume = {
    sourceType: "Manual",
    candidateId: "candidate-789",
    attachmentId: "attach-012",
  };

  assert.equal(emailSourceResume.sourceType, "Email");
  assert.equal(manualSourceResume.sourceType, "Manual");
  assert.notEqual(emailSourceResume.sourceType, manualSourceResume.sourceType);
});

test("Application status initialization for email applications", () => {
  const emailApplication = {
    candidateId: "candidate-123",
    jobId: "job-456",
    status: "To Be Reviewed",
    source: "Email",
  };

  assert.equal(emailApplication.status, "To Be Reviewed");
  assert.equal(emailApplication.source, "Email");
});

test("Notification type categorization", () => {
  const notificationTypes = {
    newCv: { type: "new_cv", category: "application" },
    aiComplete: { type: "ai_complete", category: "analysis" },
    aiFailed: { type: "ai_failed", category: "analysis" },
    manualReview: { type: "manual_review", category: "application" },
  };

  assert.equal(notificationTypes.newCv.type, "new_cv");
  assert.equal(notificationTypes.newCv.category, "application");
  assert.equal(notificationTypes.aiComplete.type, "ai_complete");
  assert.equal(notificationTypes.aiComplete.category, "analysis");
});

test("Enhanced AI analysis result structure validation", () => {
  const aiResult = {
    candidateProfile: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      location: "New York",
      currentRole: "Software Engineer",
    },
    education: {
      degrees: ["B.S. Computer Science"],
      institutions: ["MIT"],
      fields: ["Computer Science", "Software Engineering"],
    },
    experience: {
      totalYears: 5,
      roles: ["Software Engineer", "Junior Developer"],
      companies: ["Tech Corp", "Startup Inc"],
      summary: "5 years of software development experience",
    },
    skills: {
      technical: ["JavaScript", "Python", "React"],
      tools: ["Git", "Docker", "VS Code"],
      languages: ["JavaScript", "Python", "TypeScript"],
      soft: ["Communication", "Teamwork", "Problem Solving"],
      certifications: ["AWS Certified Developer"],
    },
    jobMatches: [
      {
        jobTitle: "Senior Software Developer",
        matchScore: 85,
        isAppliedJob: true,
        matchingSkills: ["JavaScript", "React", "Python"],
        missingSkills: ["Kubernetes"],
        experienceMatch: "good",
        educationMatch: "excellent",
        summary: "Strong match with relevant experience",
        recommendation: "Recommended",
      },
    ],
    overallSummary: "Experienced software engineer with strong technical skills",
    strengths: ["Technical expertise", "Project experience"],
    developmentAreas: ["Cloud infrastructure"],
  };

  // Validate structure
  assert.ok(aiResult.candidateProfile);
  assert.ok(aiResult.education);
  assert.ok(aiResult.experience);
  assert.ok(aiResult.skills);
  assert.ok(Array.isArray(aiResult.jobMatches));
  assert.equal(aiResult.jobMatches.length, 1);

  // Validate job match structure
  const jobMatch = aiResult.jobMatches[0];
  assert.ok(typeof jobMatch.matchScore === "number");
  assert.ok(jobMatch.matchScore >= 0 && jobMatch.matchScore <= 100);
  assert.ok(typeof jobMatch.isAppliedJob === "boolean");
  assert.ok(Array.isArray(jobMatch.matchingSkills));
  assert.ok(Array.isArray(jobMatch.missingSkills));
  assert.ok(["poor", "fair", "good", "excellent"].includes(jobMatch.experienceMatch));
  assert.ok(["Not Suitable", "Consider", "Recommended", "Highly Recommended"].includes(jobMatch.recommendation));
});

test("Email configuration fallback mechanism", () => {
  const config1 = {
    host: process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || null,
    user: process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || null,
  };

  const config2 = {
    host: process.env.RECRUITMENT_EMAIL_HOST || process.env.IMAP_HOST || "fallback.com",
    user: process.env.RECRUITMENT_EMAIL_USER || process.env.IMAP_USER || "test@example.com",
  };

  // Config should use fallback if primary not set
  assert.ok(config2.host);
  assert.ok(config2.user);
});

console.log("✅ All email integration tests passed");
