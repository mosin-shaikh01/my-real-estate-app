import type { ErrorRequestHandler, RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import type { ApiError } from '@app/shared'
import { AppError } from '../lib/errors.js'
import { isProd } from '../lib/env.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
}

/** Zod issues -> details keyed by field path, matching RHF's setError paths. */
function zodDetails(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

// Express 5 propagates async errors natively — no express-async-errors needed.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const rid = req.requestId ?? 'unknown'

  if (err instanceof AppError) {
    const body: ApiError = {
      error: { code: err.code, message: err.message, requestId: rid, ...(err.details && { details: err.details }) },
    }
    res.status(err.status).json(body)
    return
  }

  if (err instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields',
        details: zodDetails(err),
        requestId: rid,
      },
    }
    res.status(400).json(body)
    return
  }

  // Unexpected. Log the real thing; tell the client nothing — an internal
  // message can leak schema, paths, or query fragments.
  console.error(JSON.stringify({ level: 'error', requestId: rid, path: req.path, err: String(err), stack: isProd ? undefined : (err as Error)?.stack }))

  const body: ApiError = {
    error: { code: 'INTERNAL', message: 'Something failed on our side', requestId: rid },
  }
  res.status(500).json(body)
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: {
      code: 'NOT_FOUND',
      message: `No route for ${req.method} ${req.path}`,
      requestId: req.requestId ?? 'unknown',
    },
  }
  res.status(404).json(body)
}
