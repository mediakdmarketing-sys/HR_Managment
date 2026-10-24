import { firebaseAuth } from "../config/firebase.js";
import { allowedOrigins } from "../config/origins.js";
import { isMailConfigured, sendPasswordResetMail } from "../services/mailService.js";

// Firebase won't let this project point its reset emails at our own page, so the server
// creates the reset code with the Admin SDK and emails a link to /reset-password itself.
const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { email: 3, ip: 10 };
const attempts = new Map();

const isLimited = (key, limit) => {
  const now = Date.now();
  const times = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  attempts.set(key, [...times, now]);
  return times.length >= limit;
};

// The link goes back to the site the request came from, if it is one of ours.
const frontendUrl = (req) => {
  const origin = String(req.get("origin") || "").replace(/\/$/, "");
  if (allowedOrigins.includes(origin)) return origin;
  return allowedOrigins.find((url) => url.startsWith("https://")) || allowedOrigins[0];
};

export const requestPasswordReset = async (req, res) => {
  // The client falls back to Firebase's own reset email when this isn't set up.
  if (!isMailConfigured()) {
    return res.status(503).json({ success: false, code: "MAIL_NOT_CONFIGURED", message: "Email is not configured" });
  }

  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (isLimited(`ip:${req.ip}`, LIMITS.ip) || isLimited(`email:${email}`, LIMITS.email)) {
    return res.status(429).json({ success: false, message: "Too many reset requests. Please try again in 15 minutes." });
  }

  // Same reply whether or not the account exists, so the form can't be used to find accounts.
  const done = () => res.json({ success: true });
  try {
    const user = await firebaseAuth.getUserByEmail(email).catch((error) => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (!user || user.disabled) return done();

    const firebaseLink = await firebaseAuth.generatePasswordResetLink(email);
    const code = new URL(firebaseLink).searchParams.get("oobCode");
    const link = `${frontendUrl(req)}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(code)}`;
    await sendPasswordResetMail({ to: email, name: user.displayName, link });
    return done();
  } catch (error) {
    console.error("Password reset email failed:", error.message);
    return res.status(500).json({ success: false, message: "We couldn't send the email. Please try again later." });
  }
};
