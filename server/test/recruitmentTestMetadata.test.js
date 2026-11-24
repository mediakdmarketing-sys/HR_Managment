import assert from "node:assert/strict";
import { test } from "node:test";
import { extractRecruitmentTestMetadata } from "../services/recruitmentService.js";

test("recruitment test metadata is restricted to the configured development batch", () => {
  const previousBatch = process.env.RECRUITMENT_TEST_BATCH_ID;
  const previousEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "test";
    delete process.env.RECRUITMENT_TEST_BATCH_ID;
    assert.throws(
      () => extractRecruitmentTestMetadata({ isTestData: true, seedBatchId: "hrms-recruitment-dev-v1" }),
      (error) => error.code === "INVALID_FIELD",
    );

    process.env.RECRUITMENT_TEST_BATCH_ID = "hrms-recruitment-dev-v1";
    assert.deepEqual(
      extractRecruitmentTestMetadata({ isTestData: true, seedBatchId: "hrms-recruitment-dev-v1" }),
      { isTestData: true, seedBatchId: "hrms-recruitment-dev-v1" },
    );
    assert.throws(
      () => extractRecruitmentTestMetadata({ isTestData: true, seedBatchId: "another-batch" }),
      (error) => error.code === "INVALID_FIELD",
    );

    process.env.NODE_ENV = "production";
    assert.throws(
      () => extractRecruitmentTestMetadata({ isTestData: true, seedBatchId: "hrms-recruitment-dev-v1" }),
      (error) => error.code === "INVALID_FIELD",
    );
  } finally {
    if (previousBatch === undefined) delete process.env.RECRUITMENT_TEST_BATCH_ID;
    else process.env.RECRUITMENT_TEST_BATCH_ID = previousBatch;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
