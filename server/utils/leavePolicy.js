import { createHash } from "node:crypto";

export const DEFAULT_LEAVE_POLICIES = [
  { id: "annual", name: "Annual leave", days: 20, carryForward: 5 },
  { id: "casual", name: "Casual leave", days: 7, carryForward: 0 },
  { id: "medical", name: "Medical / sick leave", days: 14, carryForward: 0 },
  { id: "unpaid", name: "Unpaid leave", days: 0, carryForward: 0 },
];

export const normalizeLeavePolicyName = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";

export const isDefaultLeavePolicyName = (value) => {
  const normalizedName = normalizeLeavePolicyName(value);
  return DEFAULT_LEAVE_POLICIES.some(
    (policy) => normalizeLeavePolicyName(policy.name) === normalizedName,
  );
};

export const validateLeavePolicyName = (value) => {
  if (typeof value !== "string") {
    return { error: "Leave type name is required." };
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Leave type name is required." };
  if (name.length > 80) {
    return { error: "Leave type name must be 80 characters or fewer." };
  }
  return { value: { name, normalizedName: normalizeLeavePolicyName(name) } };
};

export const customLeavePolicyId = (name) =>
  `custom_${createHash("sha256")
    .update(normalizeLeavePolicyName(name))
    .digest("hex")
    .slice(0, 24)}`;

export const mergeLeavePolicies = (savedPolicies) => {
  const persistedById = new Map(
    savedPolicies.map((policy) => [policy.id, policy]),
  );
  const defaultIds = new Set(DEFAULT_LEAVE_POLICIES.map((policy) => policy.id));

  return [
    ...DEFAULT_LEAVE_POLICIES.map((policy) => ({
      ...policy,
      ...(persistedById.get(policy.id) || {}),
      id: policy.id,
    })),
    ...savedPolicies
      .filter((policy) => !defaultIds.has(policy.id))
      .map((policy) => ({ ...policy }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];
};
