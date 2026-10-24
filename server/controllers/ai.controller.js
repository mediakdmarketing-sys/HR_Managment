import * as aiService from "../services/aiService.js";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;
// Keeps one user from using up the shared free Gemini quota.
const REQUESTS_PER_MINUTE = 8;
const recentRequests = new Map();

const isRateLimited = (userId) => {
  const now = Date.now();
  const times = (recentRequests.get(userId) || []).filter((time) => now - time < 60_000);
  if (times.length >= REQUESTS_PER_MINUTE) return true;
  recentRequests.set(userId, [...times, now]);
  return false;
};

export const chat = async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({ success: false, message: "The AI assistant is not set up yet (GEMINI_API_KEY is missing)." });
    }
    const messages = Array.isArray(req.body.messages) ? req.body.messages.slice(-MAX_MESSAGES) : [];
    const valid =
      messages.length > 0 &&
      messages.every(
        (message) =>
          ["user", "assistant"].includes(message?.role) &&
          typeof message.text === "string" &&
          message.text.trim() &&
          message.text.length <= MAX_MESSAGE_LENGTH,
      ) &&
      messages.at(-1).role === "user";
    if (!valid) return res.status(400).json({ success: false, message: "Please enter a question (up to 2000 characters)." });
    if (isRateLimited(req.user.id)) {
      return res.status(429).json({ success: false, message: "You're asking very quickly. Please wait a moment." });
    }
    // Gemini expects the conversation to start with the user.
    while (messages[0].role !== "user") messages.shift();

    const reply = await aiService.ask(messages, req.user);
    return res.json({ success: true, data: { reply } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
