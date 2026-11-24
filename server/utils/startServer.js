// Starts the HTTP server and only then the background jobs (email polling, AI processor).
// If the port cannot be bound (e.g. another backend instance already uses it) the process
// exits with a clear message and no background job is started, so stray instances can never
// poll the recruitment mailbox.
//
// Express 5 reports listen failures through the listen callback (not as a thrown error), so
// the callback's error argument must be checked explicitly.

export const listen = (app, port) => new Promise((resolve, reject) => {
  const server = app.listen(port, (error) => {
    if (error) reject(error);
    else resolve(server);
  });
});

export const startServer = async ({
  app,
  port,
  startBackgroundJobs,
  exit = (code) => process.exit(code),
  log = console,
}) => {
  let server;
  try {
    server = await listen(app, port);
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      log.error(`Port ${port} is already in use; another backend instance is probably running. Stop it before starting a new one. Exiting without starting email polling.`);
    } else {
      log.error(`Server could not listen on port ${port}: ${error?.code || error?.message || "unknown error"}. Exiting without starting email polling.`);
    }
    exit(1);
    return null;
  }
  log.log(`Server running on port ${port}`);
  await startBackgroundJobs(server);
  return server;
};
