// Startup regression tests: background jobs (mailbox polling) must start only after the
// HTTP server has bound its port, and a process that cannot bind must exit without polling.
// Bug: Express 5 reports EADDRINUSE through the listen callback; the old code ignored it,
// printed "Server running" and kept polling, so stray instances duplicated inbox records.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import net from "node:net";
import { test } from "node:test";
import express from "express";
import { startServer } from "../utils/startServer.js";

const silentLog = () => {
  const lines = [];
  return { lines, log: (...a) => lines.push(a.join(" ")), error: (...a) => lines.push(a.join(" ")) };
};

test("an occupied port exits with code 1 and never starts background jobs", async () => {
  const blocker = net.createServer();
  // Same default (all-interfaces) address a second backend instance would bind.
  await new Promise((resolve) => blocker.listen(0, resolve));
  const { port } = blocker.address();
  const log = silentLog();
  let jobsStarted = false;
  let exitCode = null;
  try {
    const app = express();
    const server = await startServer({
      app,
      port,
      startBackgroundJobs: async () => { jobsStarted = true; },
      exit: (code) => { exitCode = code; },
      log,
    });
    assert.equal(server, null);
    assert.equal(exitCode, 1);
    assert.equal(jobsStarted, false, "email polling started although the port was taken");
    assert.match(log.lines.join("\n"), /already in use/);
    assert.match(log.lines.join("\n"), /without starting email polling/);
    assert.doesNotMatch(log.lines.join("\n"), /Server running/);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("background jobs start only after the server is listening", async () => {
  const log = silentLog();
  let listeningWhenJobsStarted = null;
  const server = await startServer({
    app: express(),
    port: 0,
    startBackgroundJobs: async (listeningServer) => { listeningWhenJobsStarted = listeningServer.listening === true; },
    exit: () => { throw new Error("must not exit"); },
    log,
  });
  try {
    assert.ok(server.listening);
    assert.equal(listeningWhenJobsStarted, true);
    assert.match(log.lines.join("\n"), /Server running on port/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("index.js starts email polling only through startServer's background jobs", () => {
  const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");
  const jobs = source.slice(source.indexOf("const startBackgroundJobs"), source.indexOf("const initializeDatabase"));
  assert.match(jobs, /initializeEmailPolling\(\)/, "polling must be started from startBackgroundJobs");
  const rest = source.replace(jobs, "");
  assert.doesNotMatch(rest, /initializeEmailPolling\(\)|startEmailPolling\(\)/, "polling must not start elsewhere");
  assert.match(source, /startServer\(\{/);
  assert.doesNotMatch(source, /app\.listen\(/, "listen must go through startServer");
});
