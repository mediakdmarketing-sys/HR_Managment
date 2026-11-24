
import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs";

try {
  const PROJECT_ID = "hrms-65efa";
  const BATCH_ID = "hrms-recruitment-dev-v1";
  const MARKERS = {
    isTestData: true,
    seedBatchId: BATCH_ID,
  };

  // Verify Firebase project before making any changes.
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

  const credentialProjectId =
    credentialPath && fs.existsSync(credentialPath)
      ? JSON.parse(fs.readFileSync(credentialPath, "utf8")).project_id
      : "";

  const configuredProjectId =
    process.env.FIREBASE_PROJECT_ID || credentialProjectId;

  if (
    configuredProjectId !== PROJECT_ID ||
    (credentialProjectId && credentialProjectId !== PROJECT_ID)
  ) {
    throw new Error(
      "Firebase project verification failed; no data was written."
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Development seed script refuses to run in production."
    );
  }

  if (process.env.RECRUITMENT_TEST_BATCH_ID !== BATCH_ID) {
    throw new Error(
      "RECRUITMENT_TEST_BATCH_ID must match the development seed batch."
    );
  }

  const { firestore } = await import("../config/firebase.js");
  const { RECRUITMENT_COLLECTIONS } = await import(
    "../services/recruitmentService.js"
  );

  // Jobs
  const jobs = [
    ["Senior Backend Engineer", "Engineering", "Remote - US"],
    ["Frontend Product Engineer", "Engineering", "Remote - US"],
    ["Data Analyst", "Analytics", "Austin, TX"],
    ["HR Coordinator", "People Operations", "Remote - US"],
    ["Customer Success Associate", "Customer Experience", "Remote - US"],
    ["QA Automation Engineer", "Engineering", "Remote - US"],
    ["Product Designer", "Design", "Portland, OR"],
    ["Technical Support Specialist", "Customer Experience", "Remote - US"],
  ].map(([title, department, location], index) => ({
    id: `${BATCH_ID}-job-${String(index + 1).padStart(2, "0")}`,
    title,
    normalizedTitle: title.toLowerCase(),
    department,
    location,
    employmentType: "Full-time",
    description: `Fictional development vacancy for the ${department} team. This record is synthetic test data only.`,
    requirements:
      "Relevant experience, clear communication, and a collaborative approach.",
    status: "Open",
    ...MARKERS,
  }));

  // Candidates
  const candidateNames = [
    "Avery Stone",
    "Casey Rivera",
    "Jordan Lee",
    "Morgan Blake",
    "Taylor Quinn",
    "Riley Hart",
    "Cameron Wells",
    "Drew Parker",
    "Skyler Reed",
    "Rowan Ellis",
    "Emerson Lane",
    "Finley Brooks",
    "Sage Bennett",
    "Alex Morgan",
    "Reese Taylor",
    "Dakota Hayes",
    "Jamie Chen",
    "Kendall Ross",
    "Peyton James",
    "Robin Cole",
  ];

  const candidateStatuses = [
    "New",
    "Screening",
    "Shortlisted",
    "Interview",
    "Pending",
    "New",
    "Screening",
    "Shortlisted",
    "Interview",
    "Rejected",
    "New",
    "Screening",
    "Shortlisted",
    "Pending",
    "Hired",
    "New",
    "Screening",
    "Interview",
    "Pending",
    "Shortlisted",
  ];

  const candidates = candidateNames.map((name, index) => {
    const number = String(index + 1).padStart(2, "0");

    return {
      id: `${BATCH_ID}-candidate-${number}`,
      name,
      email: `candidate.${number}@example.com`,
      phone: `+1-202-555-${String(101 + index).padStart(4, "0")}`,
      role: jobs[index % jobs.length].title,
      experience: `${2 + (index % 8)} years`,
      education: [
        "B.S. Computer Science",
        "B.A. Information Systems",
        "M.S. Human-Computer Interaction",
        "B.Eng. Software Engineering",
      ][index % 4],
      skills: [
        ["JavaScript", "React", "Accessibility"],
        ["Node.js", "API design", "PostgreSQL"],
        ["Data analysis", "SQL", "Reporting"],
        ["Communication", "Recruiting", "Coordination"],
      ][index % 4],
      location: [
        "Remote - US",
        "Austin, TX",
        "Portland, OR",
        "Denver, CO",
      ][index % 4],
      source: "Development test batch",
      status: candidateStatuses[index],
      summary:
        "Fictional candidate profile created solely for development workflow testing.",
      resumeId: `${BATCH_ID}-resume-${number}`,
      ...MARKERS,
    };
  });

  // Applications
  const applications = candidates.map((candidate, index) => ({
    id: `${BATCH_ID}-application-${String(index + 1).padStart(2, "0")}`,
    candidateId: candidate.id,
    jobId: jobs[index % jobs.length].id,
    status: ["Pending", "Shortlisted", "Interview", "Rejected", "Hired"][
      index % 5
    ],
    source: "Development test batch",
    notes: "Synthetic application; do not contact.",
    appliedAt: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    ...MARKERS,
  }));

  // Synthetic text resumes.
  // No PDF or Firebase Storage dependency is required.
  const resumeTextFor = (candidate, job) =>
    [
      `Synthetic resume fixture for ${candidate.name}.`,
      `Fictional education: ${candidate.education}.`,
      `Fictional experience: ${candidate.experience} in ${job.department.toLowerCase()}.`,
      `Skills: ${candidate.skills.join(", ")}.`,
      "This is simulated extracted text only; no resume file has been uploaded.",
    ].join(" ");

  const resumes = candidates.map((candidate, index) => {
    const application = applications[index];
    const job = jobs[index % jobs.length];

    return {
      id: `${BATCH_ID}-resume-${String(index + 1).padStart(2, "0")}`,
      candidateId: candidate.id,
      applicationId: application.id,
      jobId: job.id,
      sourceType: "synthetic_text_fixture",
      fileStatus: "not_uploaded",
      extractionStatus: "simulated",
      extractedText: resumeTextFor(candidate, job),
      contentType: "text/plain",
      ...MARKERS,
    };
  });

  // Simulated AI screening results.
  const aiResults = candidates.map((candidate, index) => {
    const job = jobs[index % jobs.length];
    const application = applications[index];
    const resume = resumes[index];

    const score = 68 + ((index * 7) % 31);

    const recommendation =
      score >= 85
        ? "Strong match"
        : score >= 75
          ? "Potential match"
          : "Review";

    const result = {
      name: candidate.name,
      experience: candidate.experience,
      location: candidate.location,
      recommendedRole: job.title,
      score,
      recommendation,
      summary: `Mock screening result for a fictional ${job.title} candidate.`,
      skillsMatch: Math.min(98, score + (index % 4)),
      experienceMatch: Math.max(55, score - (index % 6)),
      educationMatch: Math.max(60, score - (index % 8)),
      strengths: [
        "Relevant fictional experience",
        "Clear communication",
      ],
      missingSkills:
        score < 80 ? ["Additional role-specific depth"] : [],
      whySuitable:
        "Deterministic simulated result linked to a synthetic resume fixture; no external AI provider was called.",
    };

    return {
      id: `${BATCH_ID}-ai-result-${String(index + 1).padStart(2, "0")}`,
      candidateId: candidate.id,
      jobId: job.id,
      applicationId: application.id,
      resumeId: resume.id,
      jobRole: job.title,
      resumeText: resume.extractedText,
      result,
      score,
      recommendation,
      summary: result.summary,
      strengths: result.strengths,
      missingSkills: result.missingSkills,
      whySuitable: result.whySuitable,
      screeningMode: "Simulated",
      status: "Completed",
      ...MARKERS,
    };
  });

  // Conversations
  const conversations = candidates.map((candidate, index) => ({
    id: `${BATCH_ID}-conversation-${String(index + 1).padStart(2, "0")}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    phone: candidate.phone,
    lastMessage:
      "Thanks for the update. I am available to discuss next steps.",
    lastMessageAt: "2026-11-18T15:00:00.000Z",
    unreadCount: index % 3,
    ...MARKERS,
  }));

  // Conversation messages
  const messages = candidates.flatMap((candidate, index) => {
    const baseId =
      `${BATCH_ID}-message-${String(index + 1).padStart(2, "0")}`;

    const conversationId =
      `${BATCH_ID}-conversation-${String(index + 1).padStart(2, "0")}`;

    return [
      {
        id: `${baseId}-hr`,
        conversationId,
        candidateId: candidate.id,
        sender: "HR",
        message: `Hello ${candidate.name.split(" ")[0]}, this is a synthetic development message about your application.`,
        isRead: true,
        type: "text",
        ...MARKERS,
      },
      {
        id: `${baseId}-candidate`,
        conversationId,
        candidateId: candidate.id,
        sender: "Candidate",
        message:
          "Thanks for the update. I am available to discuss next steps.",
        isRead: true,
        type: "text",
        ...MARKERS,
      },
    ];
  });

  // Interviews
  const interviewStatuses = [
    "Scheduled",
    "Scheduled",
    "Scheduled",
    "Scheduled",
    "Scheduled",
    "Scheduled",
    "Completed",
    "Cancelled",
  ];

  const interviews = jobs.map((job, index) => {
    const scheduledAt = new Date(
      Date.UTC(2027, 0, 5 + index, 10, 0)
    ).toISOString();

    const application = applications[index];

    return {
      id: `${BATCH_ID}-interview-${String(index + 1).padStart(2, "0")}`,
      title: `${job.title} - development interview`,
      candidateId: candidates[index].id,
      jobId: job.id,
      applicationId: application.id,
      interview_date: scheduledAt,
      scheduledAt,
      interview_time: "10:00",
      meetingType: "Video",
      status: interviewStatuses[index],
      notes: "Fictional schedule; no invitation was sent.",
      notificationStatus: "NotSent",
      ...MARKERS,
    };
  });

  // Interview notifications
  const interviewNotifications = interviews.map((interview, index) => ({
    id: `${BATCH_ID}-notification-${String(index + 1).padStart(2, "0")}`,
    type: "interview_scheduled",
    category: "Recruitment",
    title: "Test interview scheduled",
    message: interview.title,
    entityId: interview.id,
    interviewId: interview.id,
    candidateId: interview.candidateId,
    jobId: interview.jobId,
    isRead: true,
    createdAt: "2026-11-19T12:00:00.000Z",
    ...MARKERS,
  }));

  // Email replies
  const emailReplies = [
    [
      "candidate.02@example.com",
      "Interview availability",
      "I am available Tuesday afternoon.",
    ],
    [
      "candidate.06@example.com",
      "Portfolio link",
      "Please find my fictional portfolio details attached.",
    ],
    [
      "candidate.11@example.com",
      "Thank you",
      "Thank you for the update on my application.",
    ],
  ].map(([fromEmail, subject, body], index) => ({
    id: `${BATCH_ID}-email-reply-${String(index + 1).padStart(2, "0")}`,
    candidateId: candidates[[1, 5, 10][index]].id,
    fromEmail,
    subject: `[TEST DATA] ${subject}`,
    body,
    isRead: index !== 0,
    receivedAt: `2026-11-${String(16 + index).padStart(2, "0")}T12:00:00.000Z`,
    ...MARKERS,
  }));

  // Bulk send dry-run data
  const bulkSendId = `${BATCH_ID}-bulk-send-01`;

  const bulkSend = {
    id: bulkSendId,
    channel: "Email",
    status: "DryRun",
    subject: "[TEST DATA] Interview follow-up preview",
    message: "Preview only; no message was sent.",
    createdByUid: "development-seed-script",
    recipientCount: 2,
    createdAt: "2026-11-19T12:00:00.000Z",
    ...MARKERS,
  };

  const bulkRecipients = [1, 2].map((number) => ({
    id: `${BATCH_ID}-bulk-recipient-${String(number).padStart(2, "0")}`,
    sendId: bulkSendId,
    recipient: candidates[number].email,
    status: "NotSent",
    ...MARKERS,
  }));

  // SMS templates
  const smsTemplates = [
    [
      "Interview reminder",
      "Hello {{name}}, this is a test-only reminder for your scheduled interview.",
    ],
    [
      "Application update",
      "Hello {{name}}, this is a test-only update on your application.",
    ],
  ].map(([name, body], index) => ({
    id: `${BATCH_ID}-sms-template-${String(index + 1).padStart(2, "0")}`,
    name: `[TEST DATA] ${name}`,
    channel: "SMS",
    body,
    ...MARKERS,
  }));

  // Recruitment settings
  const settings = [
    {
      id: `${BATCH_ID}-settings-default`,
      key: "default",
      senderName: "HR Recruitment Team",
      replyToEmail: "recruitment@example.com",
      aiModel: "provider-configured-by-server",
      interviewSettings: {
        durationMinutes: 45,
        timeZone: "UTC",
      },
      notificationPreferences: {
        newApplication: true,
        interviewScheduled: true,
      },
      ...MARKERS,
    },
  ];

  // Unique key records
  const uniqueKey = (key) =>
    createHash("sha256").update(key).digest("hex");

  const uniqueKeys = [
    ...jobs.map((job) => ({
      id: uniqueKey(`job-title:${job.normalizedTitle}`),
      collection: "recruitmentJobs",
      recordId: job.id,
    })),

    ...candidates.map((candidate) => ({
      id: uniqueKey(`candidate-email:${candidate.email}`),
      collection: "recruitmentCandidates",
      recordId: candidate.id,
    })),

    ...applications.map((application) => ({
      id: uniqueKey(
        `application:${application.candidateId}:${application.jobId}`
      ),
      collection: "recruitmentApplications",
      recordId: application.id,
    })),

    ...interviews
      .filter((interview) => interview.candidateId)
      .map((interview) => ({
        id: uniqueKey(
          `interview:${interview.candidateId}:${interview.scheduledAt}`
        ),
        collection: "recruitmentInterviews",
        recordId: interview.id,
      })),
  ].map((record) => ({
    ...record,
    ...MARKERS,
  }));

  // All Firestore development records.
  // Synthetic resumes are stored in recruitmentResumes.
  // No recruitmentAttachments or Storage objects are created.
  const recordGroups = [
    ["recruitmentJobs", jobs],
    ["recruitmentCandidates", candidates],
    ["recruitmentApplications", applications],
    ["recruitmentResumes", resumes],
    ["recruitmentAiResults", aiResults],
    ["recruitmentConversations", conversations],
    ["recruitmentMessages", messages],
    ["recruitmentInterviews", interviews],
    ["recruitmentNotifications", interviewNotifications],
    ["recruitmentEmailReplies", emailReplies],
    ["recruitmentBulkSends", [bulkSend]],
    ["recruitmentBulkSendRecipients", bulkRecipients],
    ["recruitmentSmsTemplates", smsTemplates],
    ["recruitmentSettings", settings],
    ["recruitmentUniqueKeys", uniqueKeys],
  ];

  // Validate collection names against the service configuration.
  const allowedCollections = new Set([
    ...RECRUITMENT_COLLECTIONS,
    "recruitmentUniqueKeys",
  ]);

  for (const [collection] of recordGroups) {
    if (!allowedCollections.has(collection)) {
      throw new Error(
        `Collection ${collection} is not registered in recruitmentService.`
      );
    }
  }

  const allRecords = recordGroups.flatMap(
    ([collection, records]) =>
      records.map((record) => ({
        collection,
        record,
      }))
  );

  // Check every document ID before starting writes.
  const references = allRecords.map(({ collection, record }) =>
    firestore.collection(collection).doc(record.id)
  );

  const existingSnapshots = await Promise.all(
    references.map((reference) => reference.get())
  );

  for (let index = 0; index < existingSnapshots.length; index += 1) {
    const snapshot = existingSnapshots[index];

    if (
      snapshot.exists &&
      (
        snapshot.data().isTestData !== true ||
        snapshot.data().seedBatchId !== BATCH_ID
      )
    ) {
      throw new Error(
        `Seed ID collision in ${allRecords[index].collection}; no Firestore writes were started.`
      );
    }
  }

  // Write only this development batch.
  // Existing records from the same batch are updated idempotently.
  for (let start = 0; start < allRecords.length; start += 20) {
    const batch = allRecords.slice(start, start + 20);

    await Promise.all(
      batch.map(async ({ collection, record }) => {
        const reference = firestore
          .collection(collection)
          .doc(record.id);

        await firestore.runTransaction(async (transaction) => {
          const current = await transaction.get(reference);

          if (
            current.exists &&
            (
              current.data().isTestData !== true ||
              current.data().seedBatchId !== BATCH_ID
            )
          ) {
            throw new Error(
              `Seed ID collision in ${collection}; refusing to overwrite the document.`
            );
          }

          const now = new Date().toISOString();

          transaction.set(reference, {
            ...record,
            createdAt: current.exists
              ? current.data().createdAt || now
              : now,
            updatedAt: now,
          });
        });
      })
    );
  }

  const counts = Object.fromEntries(
    recordGroups.map(([collection, records]) => [
      collection,
      records.length,
    ])
  );

  console.log(
    `Seeded idempotent test batch ${BATCH_ID} in Firebase project ${PROJECT_ID}.`
  );

  console.log(
    "Synthetic text resumes stored in Firestore; no Storage upload was performed."
  );

  console.log(
    `records_by_collection=${JSON.stringify(counts)}`
  );

  console.log(
    `total_test_records=${allRecords.length}`
  );

} catch (error) {
  const message = String(
    error?.message || "Unknown error"
  )
    .replace(/Bearer\s+[^\s"'`,]+/gi, "Bearer [REDACTED]")
    .replace(/ya29\.[A-Za-z0-9._~-]+/gi, "[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(
      /Authorization\s*[:=]\s*[^,;\n]+/gi,
      "Authorization: [REDACTED]"
    );

  const code = Number.isFinite(Number(error?.code))
    ? Number(error.code)
    : "unknown";

  console.error(
    `Recruitment seed failed (${code}): ${message}`
  );

  process.exitCode = 1;
}
