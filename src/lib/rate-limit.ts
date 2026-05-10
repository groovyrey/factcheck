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
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return await rateLimitUpstash(upstashUrl, upstashToken, identifier, limit, windowMs);
  }

  return rateLimitMemory(identifier, limit, windowMs);
}

async function rateLimitUpstash(
  baseUrl: string,
  token: string,
  identifier: string,
  limit: number,
  windowMs: number,
) {
  const key = `rl:${identifier}`;
  const headers = { Authorization: `Bearer ${token}` };

  const incr = await fetch(`${baseUrl}/incr/${encodeURIComponent(key)}`, { headers }).then((r) =>
    r.json().catch(() => ({} as unknown)),
  );

  const current = readNumberResult(incr);
  if (current === null) {
    // Fall back to in-memory if Upstash is misconfigured or returns unexpected output.
    return rateLimitMemory(identifier, limit, windowMs);
  }

  if (current === 1) {
    // Best-effort expiry; if this fails, the counter will still work but won't reset.
    await fetch(`${baseUrl}/pexpire/${encodeURIComponent(key)}/${Math.max(1, Math.trunc(windowMs))}`, {
      headers,
    }).catch(() => {});
  }

  const pttl = await fetch(`${baseUrl}/pttl/${encodeURIComponent(key)}`, { headers }).then((r) =>
    r.json().catch(() => ({} as unknown)),
  );
  const resetIn = readNumberResult(pttl) ?? 0;

  if (current > limit) {
    return { success: false, remaining: 0, resetIn };
  }

  return { success: true, remaining: Math.max(0, limit - current), resetIn };
}

function readNumberResult(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return typeof record.result === "number" ? record.result : null;
}

function rateLimitMemory(identifier: string, limit: number, windowMs: number) {
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
