import assert from "node:assert/strict";
import { test } from "node:test";
import { createFirebaseHrAuthenticator } from "../middleware/authMiddlewareFactory.js";

const mockResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const firestoreFor = (record) => ({
  collection() {
    return {
      where() {
        return this;
      },
      limit() {
        return this;
      },
      async get() {
        if (!record) return { empty: true, docs: [] };
        return {
          empty: false,
          docs: [{ id: "hr-1", data: () => record }],
        };
      },
    };
  },
});

test("Recruitment authentication rejects a request without a bearer token", async () => {
  const authenticate = createFirebaseHrAuthenticator({
    firebaseAuth: { verifyIdToken: async () => ({ uid: "unused" }) },
    firestore: firestoreFor({ role: "HR", status: "Active" }),
    isActiveHrRecord: (record) => record.role === "HR" && record.status === "Active",
  });
  const res = mockResponse();
  let nextCalled = false;

  await authenticate({ headers: {} }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, message: "No token provided" });
  assert.equal(nextCalled, false);
});

test("Recruitment authentication rejects an invalid Firebase token", async () => {
  const authenticate = createFirebaseHrAuthenticator({
    firebaseAuth: { verifyIdToken: async () => { throw new Error("invalid"); } },
    firestore: firestoreFor({ role: "HR", status: "Active" }),
    isActiveHrRecord: (record) => record.role === "HR" && record.status === "Active",
  });
  const res = mockResponse();
  let nextCalled = false;

  await authenticate({ headers: { authorization: "Bearer bad-token" } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Invalid Firebase token");
  assert.equal(nextCalled, false);
});

test("Recruitment authentication rejects an active non-HR employee", async () => {
  const authenticate = createFirebaseHrAuthenticator({
    firebaseAuth: { verifyIdToken: async () => ({ uid: "employee-1", auth_time: 123 }) },
    firestore: firestoreFor({ role: "Employee", status: "Active" }),
    isActiveHrRecord: (record) => record.role === "HR" && record.status === "Active",
  });
  const res = mockResponse();
  let nextCalled = false;

  await authenticate({ headers: { authorization: "Bearer employee-token" } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Active HR access is required");
  assert.equal(nextCalled, false);
});

test("Recruitment authentication accepts an active HR employee", async () => {
  const authenticate = createFirebaseHrAuthenticator({
    firebaseAuth: { verifyIdToken: async () => ({ uid: "hr-1", auth_time: 123 }) },
    firestore: firestoreFor({ role: "HR", status: "Active" }),
    isActiveHrRecord: (record) => record.role === "HR" && record.status === "Active",
  });
  const res = mockResponse();
  let nextCalled = false;
  const req = { headers: { authorization: "Bearer hr-token" } };

  await authenticate(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, "hr-1");
  assert.equal(req.user.role, "HR");
});
