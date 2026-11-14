const parseIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value;
};

const isSchedulingStatus = (status) =>
  status === "Pending" || status === "Approved";

export const findLeaveRequestConflicts = (request, requests) => {
  if (
    !request ||
    !isSchedulingStatus(request.status) ||
    !request.employeeId
  ) {
    return [];
  }
  const requestStart = parseIsoDate(request.startDate);
  const requestEnd = parseIsoDate(request.endDate);
  if (!requestStart || !requestEnd || requestEnd < requestStart) return [];

  return requests.flatMap((other) => {
    if (
      !other ||
      !isSchedulingStatus(other.status) ||
      !other.employeeId ||
      other.employeeId === request.employeeId ||
      (request.id && other.id === request.id)
    ) {
      return [];
    }
    const otherStart = parseIsoDate(other.startDate);
    const otherEnd = parseIsoDate(other.endDate);
    if (!otherStart || !otherEnd || otherEnd < otherStart) return [];

    const overlapStart = requestStart > otherStart ? requestStart : otherStart;
    const overlapEnd = requestEnd < otherEnd ? requestEnd : otherEnd;
    if (overlapStart > overlapEnd) return [];

    return [{
      requestId: other.id,
      employeeId: other.employeeId,
      employeeName: other.employeeName || "Unknown employee",
      status: other.status,
      overlapStart,
      overlapEnd,
    }];
  });
};

export const findAllLeaveRequestConflicts = (requests) => {
  const conflicts = [];
  const seen = new Set();
  for (const request of requests) {
    for (const conflict of findLeaveRequestConflicts(request, requests)) {
      const requestId = String(request.id || "");
      const otherId = String(conflict.requestId || "");
      if (!requestId || !otherId) continue;
      const key = [requestId, otherId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        requestId,
        employeeId: request.employeeId,
        employeeName: request.employeeName || "Unknown employee",
        status: request.status,
        ...conflict,
      });
    }
  }
  return conflicts;
};
