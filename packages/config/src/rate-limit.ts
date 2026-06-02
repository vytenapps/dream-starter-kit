export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  hits: number[];
}

/**
 * Pure sliding-window rate limiter. Given the prior hit timestamps, returns
 * whether a new request at `now` is allowed and the updated hit list (callers
 * persist it, e.g. in an in-memory Map keyed by user id, or Redis in prod).
 *
 * @param hits     prior request timestamps (ms)
 * @param now      current time (ms)
 * @param windowMs window length (ms)
 * @param limit    max requests per window
 */
export function slidingWindow(
  hits: number[],
  now: number,
  windowMs: number,
  limit: number,
): RateLimitResult {
  const recent = hits.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    return { allowed: false, remaining: 0, hits: recent };
  }
  const updated = [...recent, now];
  return { allowed: true, remaining: limit - updated.length, hits: updated };
}
