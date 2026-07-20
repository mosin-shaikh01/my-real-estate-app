import type { RequestHandler } from 'express'
import { isProd } from '../lib/env.js'

// ============================================================================
// Baseline security headers on every response
// ============================================================================
// Hand-rolled rather than pulling in helmet: the app is single-origin, self-
// hosts its fonts, and loads no external scripts, so a tight policy is realistic
// and a whole dependency for ~7 headers isn't worth it.
//
// HSTS is PROD-ONLY. Sending Strict-Transport-Security over dev http would pin
// the browser to https for a host that serves none, which is exactly the kind of
// self-inflicted outage that makes people distrust security headers.
//
// The CSP is enforced (not report-only). 'unsafe-inline' on script/style is the
// one concession: index.html carries an inline theme-boot script and Tailwind
// emits inline styles. It still blocks every EXTERNAL script/style/frame/object
// and confines connect/img/font/media to this origin — the injection paths that
// actually matter. A per-response nonce is the next step up and is noted in
// docs as future hardening.
// ============================================================================

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "form-action 'self'",
].join('; ')

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  res.setHeader('Content-Security-Policy', CSP)
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}
