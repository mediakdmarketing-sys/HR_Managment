import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  countApplicationsForJob,
  RECRUITMENT_PAGE_TABLES,
  tablesForRecruitmentPage,
} from "../src/navigation/recruitmentPageData.js";

const applications = [
  { id: "a1", jobId: "job1", candidateId: "c1" },
  { id: "a2", jobId: "job2", candidateId: "c2" },
  { id: "a3", jobId: "job1", candidateId: "c3" },
];

test("the Jobs page loads applications, so Open Jobs can count them (bug: always 0)", () => {
  assert.ok(tablesForRecruitmentPage("jobs").includes("recruitmentApplications"));
  assert.ok(tablesForRecruitmentPage("jobs").includes("recruitmentJobs"));
});

test("every page that shows per-job application counts loads applications", () => {
  for (const page of ["jobs", "job-details", "applications", "candidates", "dashboard", "overview"]) {
    assert.ok(RECRUITMENT_PAGE_TABLES[page].includes("recruitmentApplications"), `${page} does not load applications`);
  }
});

test("job application counts match Applications Management (grouped by jobId)", () => {
  assert.equal(countApplicationsForJob(applications, "job1"), 2);
  assert.equal(countApplicationsForJob(applications, "job2"), 1);
  assert.equal(countApplicationsForJob(applications, "job3"), 0);
  assert.equal(countApplicationsForJob(undefined, "job1"), 0);
  const total = ["job1", "job2"].reduce((sum, job) => sum + countApplicationsForJob(applications, job), 0);
  assert.equal(total, applications.length);
});

test("Recruitment.jsx uses the shared page-data map and count helper", () => {
  const source = readFileSync(new URL("../src/Pages/Recruitment.jsx", import.meta.url), "utf8");
  assert.match(source, /tablesForRecruitmentPage\(active\)/);
  assert.match(source, /countApplicationsForJob\(rows\.recruitmentApplications, job\.id\)/);
  assert.doesNotMatch(source, /const tables = \{\s*dashboard:/, "a second, divergent page-data map was reintroduced");
});

test("unknown pages load nothing", () => {
  assert.deepEqual(tablesForRecruitmentPage("does-not-exist"), []);
});
