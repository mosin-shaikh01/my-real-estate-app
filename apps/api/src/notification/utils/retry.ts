// A tiny retry helper for transient send failures. Exponential-ish backoff; the
// caller decides which errors are worth retrying (auth errors never are).

export interface RetryOptions {
  retries: number
  delayMs: number
  shouldRetry: (error: unknown) => boolean
}

export interface RetryOutcome<T> {
  value?: T
  error?: unknown
  attempts: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<RetryOutcome<T>> {
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
    try {
      const value = await fn()
      return { value, attempts: attempt }
    } catch (err) {
      lastError = err
      if (attempt > opts.retries || !opts.shouldRetry(err)) {
        return { error: err, attempts: attempt }
      }
      await new Promise((r) => setTimeout(r, opts.delayMs * attempt))
    }
  }
  return { error: lastError, attempts: opts.retries + 1 }
}
