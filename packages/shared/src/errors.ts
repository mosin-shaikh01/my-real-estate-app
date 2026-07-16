// Shared so the client can switch on `code` without stringly-typed guesswork.
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiError {
  error: {
    code: ErrorCode
    message: string
    /** Zod issues keyed by field path, so the client maps them onto RHF setError. */
    details?: Record<string, string[]>
    requestId: string
  }
}

export interface Paginated<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
