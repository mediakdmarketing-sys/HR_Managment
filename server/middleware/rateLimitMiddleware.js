/**
 * Simple in-memory rate limiting middleware for expensive operations
 * Protects AI screening, email, and SMS endpoints from abuse
 */

const requestCounts = new Map();
const WINDOW_MS = 60000; // 1 minute window
const CLEANUP_INTERVAL = 300000; // Clean up every 5 minutes

// Cleanup old entries periodically (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.resetTime > WINDOW_MS * 2) {
        requestCounts.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  if (cleanupTimer && cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Create a rate limit middleware
 * @param {number} maxRequests - Maximum requests per window
 * @param {string} message - Error message when limit exceeded
 */
export const createRateLimit = (maxRequests, message) => {
  return (req, res, next) => {
    const identifier = `${req.user?.uid || req.ip}:${req.path}`;
    const now = Date.now();
    
    let userData = requestCounts.get(identifier);
    
    if (!userData || now - userData.resetTime > WINDOW_MS) {
      userData = {
        count: 0,
        resetTime: now,
      };
      requestCounts.set(identifier, userData);
    }
    
    userData.count += 1;
    
    if (userData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: message || "Too many requests. Please try again later.",
        retryAfter: Math.ceil((WINDOW_MS - (now - userData.resetTime)) / 1000),
      });
    }
    
    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - userData.count));
    res.setHeader("X-RateLimit-Reset", new Date(userData.resetTime + WINDOW_MS).toISOString());
    
    next();
  };
};

// Preset rate limiters for common use cases
export const aiScreeningRateLimit = createRateLimit(
  10,
  "AI screening rate limit exceeded. Maximum 10 requests per minute."
);

export const emailRateLimit = createRateLimit(
  20,
  "Email rate limit exceeded. Maximum 20 emails per minute."
);

export const smsRateLimit = createRateLimit(
  10,
  "SMS rate limit exceeded. Maximum 10 messages per minute."
);
