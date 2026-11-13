import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LEAVE_POLICIES,
  customLeavePolicyId,
  isDefaultLeavePolicyName,
  mergeLeavePolicies,
  normalizeLeavePolicyName,
  validateLeavePolicyName,
} from "../utils/leavePolicy.js";

test("keeps all four default leave types and allowances", () => {
  assert.deepEqual(DEFAULT_LEAVE_POLICIES, [
    { id: "annual", name: "Annual leave", days: 20, carryForward: 5 },
    { id: "casual", name: "Casual leave", days: 7, carryForward: 0 },
    { id: "medical", name: "Medical / sick leave", days: 14, carryForward: 0 },
    { id: "unpaid", name: "Unpaid leave", days: 0, carryForward: 0 },
  ]);
  assert.deepEqual(mergeLeavePolicies([]), DEFAULT_LEAVE_POLICIES);
});

test("merges saved policies without dropping or resetting defaults", () => {
  const policies = mergeLeavePolicies([
    { id: "annual", name: "Annual leave", days: 22, carryForward: 6 },
    { id: "custom_wellness", name: "Wellness leave", days: 2, carryForward: 0 },
  ]);

  assert.equal(policies.length, 5);
  assert.equal(policies[0].days, 22);
  assert.equal(policies[0].carryForward, 6);
  assert.equal(policies.find((policy) => policy.id === "casual").days, 7);
  assert.equal(policies.at(-1).name, "Wellness leave");
});

test("normalizes names and produces stable IDs for duplicate checks", () => {
  assert.equal(normalizeLeavePolicyName("  Wellness   Leave "), "wellness leave");
  assert.equal(isDefaultLeavePolicyName("  ANNUAL   LEAVE "), true);
  assert.equal(isDefaultLeavePolicyName("Wellness leave"), false);
  assert.equal(
    customLeavePolicyId(" Wellness Leave "),
    customLeavePolicyId("wellness   leave"),
  );
});

test("validates and normalizes new leave type names", () => {
  assert.deepEqual(validateLeavePolicyName("  Wellness   Leave  "), {
    value: { name: "Wellness Leave", normalizedName: "wellness leave" },
  });
  assert.match(validateLeavePolicyName("   ").error, /required/);
  assert.match(validateLeavePolicyName("x".repeat(81)).error, /80 characters/);
});
