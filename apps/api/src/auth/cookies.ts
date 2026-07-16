import type { Response } from 'express'
import { env, isProd } from '../lib/env.js'
import { parseDuration } from './tokens.js'

// ============================================================================
// Both tokens are httpOnly cookies. Not localStorage.
// ============================================================================
// This CRM renders user-generated notes and uploaded filenames on nearly every
// screen, so the XSS surface is real. A token readable from JS turns any XSS
// into total credential exfiltration; httpOnly does not.
//
// SameSite=Lax means cross-site POSTs send no cookies at all, so CSRF is mostly
// handled structurally. Add double-submit tokens on state-changing methods
// anyway before production — Lax has edge cases.
//
// Dev works because Vite proxies /api, making everything same-origin. That is
// why the proxy is load-bearing: without it you need CORS credentials and
// SameSite=None, and people "solve" that by moving to localStorage.
// ============================================================================

export const ACCESS_COOKIE = 'rec_at'
export const REFRESH_COOKIE = 'rec_rt'

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: parseDuration(env.ACCESS_TOKEN_TTL),
  })

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    // Scoped to the refresh endpoint: the token is never sent on ordinary
    // requests, so it cannot leak through a logging proxy or an error report.
    path: '/api/auth/refresh',
    maxAge: parseDuration(env.REFRESH_TOKEN_TTL),
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' })
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' })
}
