import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRecruitmentGroupForPath,
  getRecruitmentPage,
  RECRUITMENT_NAVIGATION,
} from "../src/navigation/recruitmentRoutes.js";

test("recruitment navigation follows the requested module order and names", () => {
  assert.deepEqual(
    RECRUITMENT_NAVIGATION.map((item) => item.label),
    [
      "Recruitment Overview",
      "Jobs",
      "Candidates",
      "Applications",
      "Interviews",
      "Conversations / Messages",
      "Hiring Alerts",
      "Email Settings",
    ],
  );
  assert.equal(
    RECRUITMENT_NAVIGATION.some((item) => item.label === "Recruitment Overview"),
    true,
  );
  assert.deepEqual(
    RECRUITMENT_NAVIGATION.find((item) => item.label === "Interviews").children.map((item) => item.label),
    ["Schedule Interview", "All Interviews"],
  );
  assert.deepEqual(
    RECRUITMENT_NAVIGATION.find((item) => item.label === "Conversations / Messages").children.map((item) => item.label),
    ["Chats", "Bulk Send", "Send History", "Mail Inbox"],
  );
});

test("every recruitment submenu has a persistent URL and maps to its page", () => {
  const items = RECRUITMENT_NAVIGATION.flatMap((item) => item.children || [item]);
  for (const item of items) {
    assert.ok(item.path.startsWith("/recruitment/"));
    assert.equal(getRecruitmentPage(item.path), item.page);
  }
});

test("nested active routes identify the parent group for automatic expansion", () => {
  assert.equal(
    getRecruitmentGroupForPath("/recruitment/conversations/mail-inbox"),
    "Conversations / Messages",
  );
  assert.equal(
    getRecruitmentGroupForPath("/recruitment/schedule-manage/all-interviews"),
    "Interviews",
  );
  assert.equal(getRecruitmentGroupForPath("/recruitment/jobs"), null);
});
