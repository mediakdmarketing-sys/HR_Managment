import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimit } from "../middleware/rateLimitMiddleware.js";

const mockRequest = (user, ip = "127.0.0.1", path = "/test") => ({
  user,
  ip,
  path,
});

const mockResponse = () => {
  const headers = {};
  return {
    statusCode: 200,
    body: undefined,
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(key, value) {
      headers[key] = value;
      return this;
    },
  };
};

test("Rate limiter allows requests within limit", async () => {
  const rateLimit = createRateLimit(5, "Test limit exceeded");
  const req = mockRequest({ uid: "test-user" });
  const res = mockResponse();
  let nextCalled = 0;

  for (let i = 0; i < 5; i++) {
    await rateLimit(req, res, () => { nextCalled++; });
  }

  assert.equal(nextCalled, 5);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["X-RateLimit-Limit"], 5);
  assert.equal(res.headers["X-RateLimit-Remaining"], 0);
});

test("Rate limiter blocks requests exceeding limit", async () => {
  const rateLimit = createRateLimit(3, "Test limit exceeded");
  const req = mockRequest({ uid: "test-user-2" });
  const res = mockResponse();
  let nextCalled = 0;

  // First 3 requests should pass
  for (let i = 0; i < 3; i++) {
    await rateLimit(req, res, () => { nextCalled++; });
  }

  // 4th request should be blocked
  await rateLimit(req, res, () => { nextCalled++; });

  assert.equal(nextCalled, 3);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(res.body.message, "Test limit exceeded");
  assert.ok(typeof res.body.retryAfter === "number");
});

test("Rate limiter uses separate counters per user and path", async () => {
  const rateLimit = createRateLimit(2, "Test limit");
  let nextCalled = 0;

  // User 1, path A
  const req1a = mockRequest({ uid: "user1" }, "127.0.0.1", "/pathA");
  await rateLimit(req1a, mockResponse(), () => { nextCalled++; });
  await rateLimit(req1a, mockResponse(), () => { nextCalled++; });

  // User 2, path A (different user, should have separate limit)
  const req2a = mockRequest({ uid: "user2" }, "127.0.0.1", "/pathA");
  await rateLimit(req2a, mockResponse(), () => { nextCalled++; });
  await rateLimit(req2a, mockResponse(), () => { nextCalled++; });

  // User 1, path B (same user, different path, should have separate limit)
  const req1b = mockRequest({ uid: "user1" }, "127.0.0.1", "/pathB");
  await rateLimit(req1b, mockResponse(), () => { nextCalled++; });

  assert.equal(nextCalled, 5);
});

test("Rate limiter uses IP address when user is not authenticated", async () => {
  const rateLimit = createRateLimit(2, "IP limit");
  const req = mockRequest(null, "192.168.1.100", "/test");
  const res = mockResponse();
  let nextCalled = 0;

  await rateLimit(req, res, () => { nextCalled++; });
  await rateLimit(req, res, () => { nextCalled++; });
  await rateLimit(req, res, () => { nextCalled++; }); // Should be blocked

  assert.equal(nextCalled, 2);
  assert.equal(res.statusCode, 429);
});
