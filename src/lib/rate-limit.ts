/**
 * Simple in-memory rate limiter for serverless environments.
 * Note: In a production multi-instance environment, you should use Redis (e.g., Upstash).
 */

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

const store = new Map<string, RateLimitRecord>();

export async function rateLimit(identifier: string, limit: number, windowMs: number) {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || now > record.resetTime) {
    store.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}
