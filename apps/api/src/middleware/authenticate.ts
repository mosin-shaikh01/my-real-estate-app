import type { RequestHandler } from 'express'
import type { PermissionKey } from '@app/shared'
import { ACCESS_COOKIE } from '../auth/cookies.js'
import { buildActor, type Actor } from '../auth/permissions.js'
import { verifyAccessToken } from '../auth/tokens.js'
import { forbidden, unauthenticated } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor
    }
  }
}

// ============================================================================
// authenticate
// ============================================================================
// Loads session + user + roles + permissions in ONE indexed query, every
// request.
//
// This is the deliberate trade named in docs/RBAC.md. Two spec requirements
// force a DB read regardless:
//   * deactivating an agent must lock them out NOW, not in <=15 minutes
//   * permission changes must take effect live
// Given the session row must be validated anyway, loading the permissions in
// the same query is free. That is why they are not in the JWT.
// ============================================================================

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE]
  if (typeof token !== 'string' || !token) return next(unauthenticated())

  const claims = await verifyAccessToken(token)
  if (!claims) return next(unauthenticated('Session expired'))

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          status: true,
          deletedAt: true,
          roles: {
            select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
          },
          permissions: { select: { effect: true, permission: { select: { key: true } } } },
        },
      },
    },
  })

  // A token whose session is gone, revoked, or expired is not a session.
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return next(unauthenticated('Session expired'))
  }

  // Deactivation and soft-delete take effect on the NEXT request — the payoff
  // for keeping permissions out of the token.
  if (session.user.deletedAt) return next(unauthenticated('Account no longer exists'))
  if (session.user.status !== 'ACTIVE') return next(forbidden('This account is suspended'))

  const rolePermissions = session.user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.key),
  )
  const userPermissions = session.user.permissions.map((up) => ({
    key: up.permission.key,
    effect: up.effect,
  }))

  req.actor = buildActor({
    userId: session.userId,
    sessionId: session.id,
    rolePermissions,
    userPermissions,
  })

  // Best-effort recency for the sessions UI. Deliberately not awaited: it must
  // never add latency to, or fail, the request it is decorating.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  next()
}

/**
 * Route-level authorization gate.
 *
 * Every route declares one. That declaration is not the smear we were avoiding
 * — the smear is one IMPLEMENTATION per route. One middleware, one scope
 * resolver, one serializer, plus a manifest test proving nothing was missed.
 */
export function requirePermission(permission: PermissionKey): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    if (!req.actor) return next(unauthenticated())
    if (!req.actor.has(permission)) return next(forbidden())
    next()
  }
  // Read by the route-manifest test to prove this route is guarded.
  Object.defineProperty(handler, 'requiredPermission', { value: permission })
  return handler
}

/**
 * Passes if the actor holds ANY of the permissions.
 *
 * For shared read surfaces reached by more than one workflow — the assignable-
 * agents dropdown feeds both "assign agent to client" and "assign agent to
 * property", which are different permissions. Guarding with the union keeps a
 * narrow role (only one of them) from being locked out of the list it needs.
 */
export function requireAnyPermission(...permissions: PermissionKey[]): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    if (!req.actor) return next(unauthenticated())
    if (!req.actor.hasAny(permissions)) return next(forbidden())
    next()
  }
  // The manifest test reads requiredPermission; expose the first as the
  // representative, plus the full set for anything that wants it.
  Object.defineProperty(handler, 'requiredPermission', { value: permissions[0] })
  Object.defineProperty(handler, 'requiredAnyPermission', { value: permissions })
  return handler
}
