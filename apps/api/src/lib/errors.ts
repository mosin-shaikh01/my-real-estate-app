import type { ErrorCode } from '@app/shared'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const unauthenticated = (m = 'Not signed in') =>
  new AppError('UNAUTHENTICATED', 401, m)

export const forbidden = (m = 'You do not have access to this') =>
  new AppError('FORBIDDEN', 403, m)

/**
 * Use for scope misses as well as genuine absences.
 *
 * The rule: scope miss -> 404, permission miss on a VISIBLE resource -> 403.
 * An agent asking for another agent's client must not learn it exists — a 403
 * would confirm it. One rule, no case-by-case debate.
 */
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', 404, m)

export const conflict = (m: string) => new AppError('CONFLICT', 409, m)

export const rateLimited = (m = 'Too many requests — please try again later') =>
  new AppError('RATE_LIMITED', 429, m)

export const validationFailed = (details: Record<string, string[]>) =>
  new AppError('VALIDATION_FAILED', 400, 'Check the highlighted fields', details)

/** A 400 with a single human message and no field details (shown at form root). */
export const badRequest = (m: string) => new AppError('VALIDATION_FAILED', 400, m)
