import type { RequestHandler } from 'express'
import { rateLimited } from '../lib/errors.js'

// ============================================================================
// In-memory fixed-window rate limiter
// ============================================================================
// Deliberately dependency-free and in-process. It protects the unauthenticated
// password-reset endpoints from brute force and email-bombing.
//
// Scope, stated honestly: the counters live in this process's memory, so the
// limit is PER INSTANCE. On the single-instance deploys this app targets (Render
// free, one VPS, one container) that is the whole app. If you ever scale to
// multiple instances, move the store to Redis — the interface here (a keyed
// counter with a TTL) maps onto it directly. This is a security control, not a
// billing meter, so a slightly loose per-instance bound is acceptable.
// ============================================================================

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number
  /** Max requests allowed per key per window. */
  max: number
  /**
   * Derive the bucket key from the request. Defaults to the client IP. Pass a
   * custom function to also fold in the body (e.g. the target email) so one IP
   * can't hammer many accounts, or many IPs can't hammer one.
   */
  key?: (req: Parameters<RequestHandler>[0]) => string
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>()

  // Opportunistic sweep so an idle-then-busy process doesn't retain dead keys
  // forever. Cheap: only runs when the map has grown past a small threshold.
  function sweep(now: number) {
    if (buckets.size < 5000) return
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }

  const keyOf = opts.key ?? ((req) => (req.ip ?? 'unknown'))

  return (req, res, next) => {
    const now = Date.now()
    sweep(now)

    const key = keyOf(req)
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
      next()
      return
    }

    if (bucket.count >= opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      next(rateLimited())
      return
    }

    bucket.count += 1
    next()
  }
}
