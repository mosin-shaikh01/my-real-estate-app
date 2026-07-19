import { randomBytes } from 'node:crypto'
import type { Request } from 'express'
import { hashPassword, hashToken } from '../auth/tokens.js'
import { appOrigin } from '../lib/app-url.js'
import { prisma } from '../lib/prisma.js'
import { notificationService } from '../notification/index.js'
import { logAuthEvent } from './auth-service.js'
import { revokeAllSessions } from './session-service.js'

// ============================================================================
// Password reset
// ============================================================================
// Security properties, all deliberate:
//   * The RAW token is never stored — only its sha256 hash, exactly like refresh
//     tokens. A leaked database row cannot be turned back into a working link.
//   * Single-use: consumed tokens are stamped usedAt and never accepted again.
//   * 30-minute expiry.
//   * requestPasswordReset ALWAYS resolves the same way whether or not the email
//     exists — the ROUTE returns 200 regardless, so there is no user enumeration.
//   * A successful reset revokes every session: a password change must invalidate
//     anything a thief already holds.
// ============================================================================

export const RESET_TOKEN_TTL_MINUTES = 30
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60_000
// Per-account throttle (defence in depth behind the per-IP rate limiter): if a
// live token was minted in the last minute, don't mint/send another. Stops
// email-bombing one address from many IPs.
const RESEND_COOLDOWN_MS = 60_000

/**
 * Begin a reset. Finds an active user for the email and, if found, mints a fresh
 * token and emails the link. Returns nothing and reveals nothing — the caller
 * responds 200 either way.
 */
export async function requestPasswordReset(email: string, req: Request): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: { id: true, email: true, fullName: true, status: true },
  })

  // Unknown email or suspended account: do nothing, silently. Same 200 upstream.
  if (!user || user.status !== 'ACTIVE') return

  const mostRecent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (mostRecent && mostRecent.createdAt.getTime() > Date.now() - RESEND_COOLDOWN_MS) return

  const rawToken = randomBytes(32).toString('base64url')

  await prisma.$transaction(async (tx) => {
    // One live link at a time — a new request invalidates prior unused tokens.
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })
  })

  const resetUrl = `${appOrigin(req)}/reset-password?token=${rawToken}`

  // The CRM never talks to SMTP directly — every message goes through the
  // NotificationService, which resolves the template, injects branding, sends,
  // and logs. Email failure here must not change the always-200 response, so we
  // don't rethrow.
  await notificationService.send({
    channel: 'email',
    template: 'forgot-password',
    recipient: { email: user.email, name: user.fullName, userId: user.id },
    data: { reset_link: resetUrl },
  })

  await logAuthEvent({
    userId: user.id,
    action: 'auth.password_reset.requested',
    entityId: user.id,
    summary: 'Password reset link requested',
    req,
  })
}

/** True if the token is currently usable (exists, unused, unexpired). */
export async function verifyResetToken(rawToken: string): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { usedAt: true, expiresAt: true },
  })
  return Boolean(row && !row.usedAt && row.expiresAt.getTime() > Date.now())
}

export class ResetTokenError extends Error {}

/**
 * Complete a reset: set the new password, consume the token, and revoke every
 * session. Throws ResetTokenError for any invalid/expired/already-used token —
 * all with the SAME message, so a caller can't distinguish the cases.
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
  req: Request,
): Promise<void> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  })

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new ResetTokenError('This reset link is invalid or has expired')
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction(async (tx) => {
    // Guarded update: usedAt must still be null. If a concurrent request consumed
    // it first, updateMany touches 0 rows and we treat it as already-used.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (consumed.count === 0) throw new ResetTokenError('This reset link is invalid or has expired')

    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } })
    // Drop any other outstanding links for this user, too.
    await tx.passwordResetToken.deleteMany({
      where: { userId: row.userId, usedAt: null },
    })
  })

  // A password change must kill everything an attacker might already hold.
  await revokeAllSessions(row.userId)

  await logAuthEvent({
    userId: row.userId,
    action: 'auth.password_reset.completed',
    entityId: row.userId,
    summary: 'Password reset completed; all sessions revoked',
    req,
  })
}
