import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/lib/errors.js'
import { rateLimit } from '../src/middleware/rate-limit.js'

// The rate limiter guards the unauthenticated password-reset endpoints. These
// pin the behavior that matters: it allows a budget, then blocks with a 429, and
// buckets are isolated per key.

function invoke(mw: ReturnType<typeof rateLimit>, ip = '1.1.1.1') {
  const req = { ip } as unknown as Request
  const res = { setHeader: vi.fn() } as unknown as Response
  const next = vi.fn()
  mw(req, res, next)
  return next
}

describe('rateLimit', () => {
  it('allows up to max requests, then blocks with a 429 AppError', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2 })

    expect(invoke(mw)).toHaveBeenCalledWith() // 1st: allowed, next() with no error
    expect(invoke(mw)).toHaveBeenCalledWith() // 2nd: allowed

    const blocked = invoke(mw) // 3rd: over budget
    const err = blocked.mock.calls[0]?.[0]
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(429)
    expect((err as AppError).code).toBe('RATE_LIMITED')
  })

  it('isolates buckets per key (one IP hitting the limit does not affect another)', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })

    expect(invoke(mw, 'a')).toHaveBeenCalledWith() // a: allowed
    expect(invoke(mw, 'a').mock.calls[0]?.[0]).toBeInstanceOf(AppError) // a: blocked
    expect(invoke(mw, 'b')).toHaveBeenCalledWith() // b: still allowed
  })

  it('honors a custom key function', () => {
    const mw = rateLimit({
      windowMs: 60_000,
      max: 1,
      key: (req) => String((req as unknown as { body?: { email?: string } }).body?.email ?? ''),
    })
    const call = (email: string) => {
      const req = { ip: 'x', body: { email } } as unknown as Request
      const res = { setHeader: vi.fn() } as unknown as Response
      const next = vi.fn()
      mw(req, res, next)
      return next
    }
    expect(call('a@x.com')).toHaveBeenCalledWith()
    expect(call('a@x.com').mock.calls[0]?.[0]).toBeInstanceOf(AppError) // same email blocked
    expect(call('b@x.com')).toHaveBeenCalledWith() // different email allowed
  })
})
