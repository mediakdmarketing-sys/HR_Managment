import { onRequest } from "firebase-functions/v2/https";
import { app, initializeDatabase } from "./index.js";

const ready = initializeDatabase();

export const api = onRequest({ cors: true }, async (request, response) => {
  await ready;
  return app(request, response);
});
