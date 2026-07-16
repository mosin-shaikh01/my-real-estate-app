import type { RequestHandler } from 'express'

// ============================================================================
// Explicit public allowlist
// ============================================================================
// You cannot avoid ONE DECLARATION per route, and you shouldn't try — an
// unguarded route must be a build failure, not a silent default. What you avoid
// is one IMPLEMENTATION per route.
//
// So a route is legitimate only if it either:
//   * carries requirePermission(...), or
//   * carries publicRoute('<why>') — a deliberate, reviewable exemption.
//
// The reason string is mandatory. "Someone will remember why" is how an
// accidental public endpoint survives review.
// ============================================================================

export function publicRoute(reason: string): RequestHandler {
  const handler: RequestHandler = (_req, _res, next) => next()
  Object.defineProperty(handler, 'publicReason', { value: reason })
  return handler
}
