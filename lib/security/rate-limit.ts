type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit = Number(process.env.RATE_LIMIT_MAX || 100),
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}
