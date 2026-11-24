import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecruitmentFirestoreService } from "../services/recruitmentService.js";

const createMemoryFirestore = () => {
  const collections = new Map();
  const getCollection = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const snapshot = (id, value) => ({
    id,
    exists: value !== undefined,
    data: () => value === undefined ? undefined : { ...value },
  });
  return {
    async runTransaction(work) {
      const writes = [];
      const transaction = {
        get: (reference) => reference.get(),
        set: (reference, value, options) => writes.push({ reference, value, options }),
        delete: (reference) => writes.push({ reference, delete: true }),
      };
      const result = await work(transaction);
      for (const write of writes) {
        if (write.delete) await write.reference.delete();
        else await write.reference.set(write.value, write.options);
      }
      return result;
    },
    collection(name) {
      const documents = getCollection(name);
      return {
        async get() {
          return {
            docs: [...documents.entries()].map(([id, value]) => snapshot(id, value)),
          };
        },
        doc(id) {
          const documentId = id || `doc-${Math.random().toString(36).slice(2)}`;
          return {
            id: documentId,
            async get() {
              return snapshot(documentId, documents.get(documentId));
            },
            async set(value, options) {
              const existing = documents.get(documentId) || {};
              documents.set(documentId, options?.merge ? { ...existing, ...value } : { ...value });
            },
            async delete() {
              documents.delete(documentId);
            },
            async runTransaction(work) {
              const writes = [];
              const transaction = {
                get: (reference) => reference.get(),
                set: (reference, value, options) => writes.push({ reference, value, options }),
              };
              const result = await work(transaction);
              for (const write of writes) {
                await write.reference.set(write.value, write.options);
              }
              return result;
            },
          };
        },
        limit(limit) {
          const self = this;
          return {
            where(field, operator, value) {
              return createFilteredQuery(documents, field, value, limit);
            },
            async get() {
              return {
                docs: [...documents.entries()].slice(0, limit).map(([id, value]) => snapshot(id, value)),
              };
            },
          };
        },
        where(field, operator, value) {
          return createFilteredQuery(documents, field, value);
        },
      };
    },
  };

  function createFilteredQuery(documents, field, value, limit) {
    return {
      limit(nextLimit) {
        return this.withLimit(nextLimit);
      },
      withLimit(nextLimit) {
        return this;
      },
      where(nextField, nextOperator, nextValue) {
        return createFilteredQuery(documents, nextField, nextValue, limit);
      },
      async get() {
        const matches = [...documents.entries()]
          .filter(([, data]) => data[field] === value)
          .slice(0, limit || undefined);
        return {
          empty: matches.length === 0,
          docs: matches.map(([id, data]) => snapshot(id, data)),
        };
      },
    };
  }
};

test("Firebase recruitment service persists jobs, candidates and applications", async () => {
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket: null });

  const job = await service.create("recruitmentJobs", { title: "Engineer", status: "Open" });
  const candidate = await service.create("recruitmentCandidates", { name: "Ravi", email: "RAVI@example.test", status: "New" });
  const application = await service.create("recruitmentApplications", {
    jobId: job.id,
    candidateId: candidate.id,
    status: "Applied",
  });

  assert.equal(job.title, "Engineer");
  assert.equal(candidate.email, "ravi@example.test");
  assert.equal(application.jobId, job.id);
  await assert.rejects(
    () => service.create("recruitmentCandidates", { email: "ravi@example.test", name: "Duplicate" }),
    (error) => error.code === "DUPLICATE_RECORD",
  );
});

test("Firebase recruitment service prevents duplicate applications and updates status", async () => {
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket: null });
  const job = await service.create("recruitmentJobs", { title: "Designer", status: "Open" });
  const candidate = await service.create("recruitmentCandidates", { name: "Sam", email: "sam@example.test" });
  await service.create("recruitmentApplications", { jobId: job.id, candidateId: candidate.id, status: "Applied" });
  await assert.rejects(
    () => service.create("recruitmentApplications", { jobId: job.id, candidateId: candidate.id, status: "Applied" }),
    (error) => error.code === "DUPLICATE_RECORD",
  );

  const updated = await service.update("recruitmentCandidates", candidate.id, { status: "Shortlisted" });
  assert.equal(updated.status, "Shortlisted");
});

test("Firebase recruitment service keeps candidate emails and job titles unique on update", async () => {
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket: null });
  await service.create("recruitmentCandidates", { name: "One", email: "one@example.test" });
  const candidateTwo = await service.create("recruitmentCandidates", { name: "Two", email: "two@example.test" });
  const jobOne = await service.create("recruitmentJobs", { title: "Engineer" });
  const jobTwo = await service.create("recruitmentJobs", { title: "Designer" });

  await assert.rejects(
    () => service.update("recruitmentCandidates", candidateTwo.id, { email: "ONE@example.test" }),
    (error) => error.code === "DUPLICATE_RECORD",
  );
  await assert.rejects(
    () => service.update("recruitmentJobs", jobTwo.id, { title: "Engineer" }),
    (error) => error.code === "DUPLICATE_RECORD",
  );
  await service.update("recruitmentCandidates", candidateTwo.id, { email: "three@example.test" });
  await service.remove("recruitmentJobs", jobOne.id);

  const replacementCandidate = await service.create("recruitmentCandidates", { name: "Replacement", email: "two@example.test" });
  const replacementJob = await service.create("recruitmentJobs", { title: "Engineer" });
  assert.equal(replacementCandidate.email, "two@example.test");
  assert.equal(replacementJob.title, "Engineer");
});

test("Firebase recruitment service stores AI results and interview records", async () => {
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket: null });
  const ai = await service.create("recruitmentAiResults", { score: 88, status: "Completed" });
  const interview = await service.create("recruitmentInterviews", {
    title: "Technical interview",
    interview_date: "2026-12-01T10:00:00.000Z",
    status: "Scheduled",
  });

  assert.equal(ai.score, 88);
  assert.equal(interview.status, "Scheduled");
  await service.update("recruitmentInterviews", interview.id, { status: "Cancelled" });
  const updated = await service.list("recruitmentInterviews");
  assert.equal(updated[0].status, "Cancelled");
});

test("Firebase recruitment service prevents overlapping candidate interviews and releases cancelled slots", async () => {
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket: null });
  const candidate = await service.create("recruitmentCandidates", {
    name: "Interview candidate",
    email: "interview@example.test",
  });
  const interviewDetails = {
    title: "Technical interview",
    candidateId: candidate.id,
    interview_date: "2026-12-01T10:00:00.000Z",
    status: "Scheduled",
  };
  const first = await service.create("recruitmentInterviews", interviewDetails);

  await assert.rejects(
    () => service.create("recruitmentInterviews", interviewDetails),
    (error) => error.code === "DUPLICATE_RECORD",
  );
  const secondInterview = await service.create("recruitmentInterviews", {
    ...interviewDetails,
    interview_date: "2026-12-01T11:00:00.000Z",
  });
  await assert.rejects(
    () => service.update("recruitmentInterviews", secondInterview.id, {
      interview_date: interviewDetails.interview_date,
      scheduledAt: interviewDetails.interview_date,
    }),
    (error) => error.code === "DUPLICATE_RECORD",
  );
  await service.update("recruitmentInterviews", first.id, { status: "Cancelled" });
  const replacement = await service.create("recruitmentInterviews", interviewDetails);

  assert.notEqual(replacement.id, first.id);
  assert.equal((await service.list("recruitmentNotifications")).length, 3);
});

test("Firebase recruitment service records private resume metadata", async () => {
  const files = [];
  const bucket = {
    file(path) {
      return {
        async save() {
          files.push(path);
        },
        async makePrivate() {},
      };
    },
  };
  const database = createMemoryFirestore();
  const service = createRecruitmentFirestoreService({ database, bucket });
  const candidate = await service.create("recruitmentCandidates", {
    name: "Candidate",
    email: "candidate@example.test",
  });
  const attachment = await service.upload({
    fileName: "resume.txt",
    base64: Buffer.from("resume").toString("base64"),
    contentType: "text/plain",
    candidateId: candidate.id,
  });

  assert.equal(files.length, 1);
  assert.match(files[0], /^recruitment\/[a-f0-9]{64}\//);
  assert.equal(attachment.fileName, "resume.txt");
  assert.equal(attachment.candidateId, candidate.id);
  assert.equal(attachment.storagePath, files[0]);
});

test("development batch markers persist on records, interview notifications, and unique keys", async () => {
  const previousBatch = process.env.RECRUITMENT_TEST_BATCH_ID;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.RECRUITMENT_TEST_BATCH_ID = "hrms-recruitment-dev-v1";
  process.env.NODE_ENV = "test";

  try {
    const database = createMemoryFirestore();
    const service = createRecruitmentFirestoreService({ database, bucket: null });
    const metadata = { isTestData: true, seedBatchId: "hrms-recruitment-dev-v1" };
    const job = await service.create("recruitmentJobs", { title: "Test role", ...metadata });
    const candidate = await service.create("recruitmentCandidates", {
      name: "Test candidate",
      email: "test@example.test",
      ...metadata,
    });
    await service.create("recruitmentInterviews", {
      title: "Test interview",
      candidateId: candidate.id,
      jobId: job.id,
      interview_date: "2027-01-01T10:00:00.000Z",
      ...metadata,
    });

    assert.equal((await service.list("recruitmentJobs"))[0].seedBatchId, metadata.seedBatchId);
    assert.equal((await service.list("recruitmentCandidates"))[0].isTestData, true);
    assert.equal((await service.list("recruitmentNotifications"))[0].seedBatchId, metadata.seedBatchId);
    const uniqueKeys = await database.collection("recruitmentUniqueKeys").get();
    assert.equal(uniqueKeys.docs.length, 3);
    assert.ok(uniqueKeys.docs.every((doc) => doc.data().seedBatchId === metadata.seedBatchId));
  } finally {
    if (previousBatch === undefined) delete process.env.RECRUITMENT_TEST_BATCH_ID;
    else process.env.RECRUITMENT_TEST_BATCH_ID = previousBatch;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
