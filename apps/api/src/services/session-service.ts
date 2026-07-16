import type { Request } from 'express'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { generateRefreshToken, hashToken, parseDuration } from '../auth/tokens.js'

export interface IssuedSession {
  sessionId: string
  refreshToken: string
}

function clientMeta(req: Request) {
  return {
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
    ip: (req.ip ?? '').slice(0, 64) || null,
  }
}

export async function createSession(userId: string, req: Request): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken()
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_TTL)),
      ...clientMeta(req),
    },
  })
  return { sessionId: session.id, refreshToken }
}

export class RefreshReuseError extends Error {}

/**
 * Rotate a refresh token.
 *
 * The security property that matters: presenting an ALREADY-REVOKED token means
 * the chain is compromised — either the legitimate holder's token was stolen and
 * replayed, or ours was. We cannot tell which, so we revoke every session for
 * that user and force a re-login. That is the whole point of rotation; without
 * reuse detection, a stolen refresh token is valid for its full TTL and nobody
 * ever finds out.
 */
export async function rotateSession(
  rawToken: string,
  req: Request,
): Promise<IssuedSession & { userId: string }> {
  const tokenHash = hashToken(rawToken)
  const existing = await prisma.session.findUnique({ where: { refreshTokenHash: tokenHash } })

  if (!existing) throw new RefreshReuseError('Unknown refresh token')

  if (existing.revokedAt) {
    await revokeAllSessions(existing.userId)
    await prisma.activityLog.create({
      data: {
        actorUserId: existing.userId,
        action: 'auth.refresh.reuse_detected',
        entityType: 'session',
        entityId: existing.id,
        summary: 'Revoked refresh token was replayed; all sessions revoked',
        ...clientMeta(req),
      },
    })
    throw new RefreshReuseError('Refresh token reuse detected')
  }

  if (existing.expiresAt < new Date()) throw new RefreshReuseError('Refresh token expired')

  const refreshToken = generateRefreshToken()

  // One transaction: the old session must never be revoked without the new one
  // existing, or a crash between the two logs the user out silently.
  const next = await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        userId: existing.userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_TTL)),
        ...clientMeta(req),
      },
    })
    await tx.session.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBySessionId: created.id, lastUsedAt: new Date() },
    })
    return created
  })

  return { sessionId: next.id, refreshToken, userId: existing.userId }
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Used on logout-all, password reset, and agent deactivation. */
export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Revoke every session EXCEPT the one making the request.
 *
 * For a password change by a logged-in user: sign them out everywhere else
 * (a leaked session elsewhere is now dead) without logging them out of the
 * device they just used — which would be a hostile "you changed your password,
 * now log in again" experience.
 */
export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, id: { not: keepSessionId } },
    data: { revokedAt: new Date() },
  })
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
}
