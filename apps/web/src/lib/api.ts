import type { ApiError, ErrorCode } from '@app/shared'

// ============================================================================
// API client
// ============================================================================
// Same-origin '/api' — the Vite proxy makes dev same-origin so httpOnly cookies
// just work. `credentials: 'include'` is belt-and-braces; same-origin would send
// them anyway, but being explicit stops someone "fixing" a cookie bug by
// reaching for localStorage.
// ============================================================================

export class ApiClientError extends Error {
  readonly status: number
  readonly code: ErrorCode
  /** Zod issues keyed by field path — map straight onto RHF setError. */
  readonly details?: Record<string, string[]>
  readonly requestId?: string

  // Fields assigned explicitly rather than via constructor parameter
  // properties: `erasableSyntaxOnly` is on for apps/web, and parameter
  // properties emit real code, so they are banned. See CLAUDE.md.
  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, string[]>,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * Single-flight refresh.
 *
 * Without this, a page firing five queries at once on an expired access token
 * sends five concurrent /refresh calls. Rotation would invalidate the first
 * token four times over and reuse-detection would nuke every session — the user
 * gets logged out for loading a page. Sharing one in-flight promise is what
 * makes rotation and parallel queries coexist.
 */
async function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  /** Internal: stops a refreshed retry from recursing forever. */
  _retried?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  // 401 -> try one refresh, then replay. Never retry a 403: a permission
  // failure will never succeed on retry, and retrying only delays the answer.
  if (res.status === 401 && !opts._retried && !path.startsWith('/auth/')) {
    if (await refreshOnce()) return request<T>(path, { ...opts, _retried: true })
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const json: unknown = text ? JSON.parse(text) : null

  if (!res.ok) {
    const err = (json as ApiError)?.error
    throw new ApiClientError(
      res.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? 'Request failed',
      err?.details,
      err?.requestId,
    )
  }

  return json as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Build a query string, dropping empty values so URLs stay readable. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
