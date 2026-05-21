/**
 * Simple in-memory rate limiter — token-bucket per key. Keyed by IP for
 * public endpoints, by API key for the partner API. Sliding window via
 * timestamps in a ring buffer.
 *
 * For multi-instance production, swap the Map for Redis (Upstash, Cloudflare
 * KV, etc.) — same API, different storage. Keeping this stateless-friendly
 * was a Phase 9 design goal.
 */

type Bucket = {
  hits: number[]; // millisecond timestamps within the window
};

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  limit: number; // max requests
  windowMs: number; // window size in milliseconds
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number; // ms until the next slot frees
};

/**
 * Check + record a hit for `key` against `config`. Returns whether it's
 * allowed plus standard X-RateLimit headers data.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop hits outside the window
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= config.limit) {
    const oldest = bucket.hits[0]!;
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - bucket.hits.length,
    resetMs: config.windowMs,
  };
}

/**
 * Wrap a Response with the standard rate-limit headers.
 */
export function withRateLimitHeaders(res: Response, result: RateLimitResult): Response {
  res.headers.set("X-RateLimit-Limit", String(result.limit));
  res.headers.set("X-RateLimit-Remaining", String(result.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
  return res;
}

/**
 * 429 response builder for when limit is exceeded.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  const res = new Response(
    JSON.stringify({
      error: {
        code: "rate_limited",
        message: `Too many requests — retry in ${Math.ceil(result.resetMs / 1000)}s`,
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.resetMs / 1000)),
      },
    },
  );
  withRateLimitHeaders(res, result);
  return res;
}

/**
 * Extract a stable client key from a request — prefer the auth header (so
 * per-API-key throttling kicks in), fall back to IP-ish proxy headers.
 */
export function keyFromRequest(req: Request): string {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return `key:${auth.slice(7, 30)}`;
  return (
    "ip:" +
    (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown")
  );
}

// Periodic GC — drop empty buckets every minute to bound memory growth.
// Skipped at build time (e.g. during Next's static analysis).
if (typeof setInterval !== "undefined" && process.env.NODE_ENV !== "test") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1]! < now - 60_000) {
        buckets.delete(key);
      }
    }
  }, 60_000).unref?.();
}
