import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMailReceived, sortMailInbox } from "../src/utils/mailInbox.js";

test("mail inbox orders by received time, newest first, not by storage time", () => {
  const rows = [
    { id: "a", receivedAt: "2026-11-01T08:00:00.000Z", createdAt: "2026-11-23T10:00:00.000Z" },
    { id: "b", receivedAt: "2026-11-22T08:00:00.000Z", createdAt: "2026-11-22T08:01:00.000Z" },
    { id: "c", createdAt: "2026-11-10T08:00:00.000Z" },
    { id: "d", receivedAt: "not a date" },
  ];
  assert.deepEqual(sortMailInbox(rows).map((row) => row.id), ["b", "c", "a", "d"]);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b", "c", "d"], "input must not be mutated");
});

test("mail inbox handles missing data and formats dates safely", () => {
  assert.deepEqual(sortMailInbox(undefined), []);
  assert.deepEqual(sortMailInbox(null), []);
  assert.equal(formatMailReceived({}), "");
  assert.equal(formatMailReceived({ receivedAt: "bad" }), "");
  assert.notEqual(formatMailReceived({ receivedAt: "2026-11-22T08:00:00.000Z" }), "");
});
