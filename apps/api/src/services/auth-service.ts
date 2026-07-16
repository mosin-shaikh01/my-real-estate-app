import type { Request } from 'express'
import { prisma } from '../lib/prisma.js'

// Data access for auth. Split out of the routes because the ESLint guardrail
// forbids importing prisma outside src/services/** — and it was right to: the
// route was doing raw user lookups, which is exactly the drift the rule exists
// to stop.
//
// Nothing here takes an Actor: these run BEFORE an actor exists (login) or are
// inherently self-scoped (own sessions). That is why they need no scopeFor().

export async function findUserForLogin(email: string) {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: { id: true, passwordHash: true, status: true },
  })
}

export async function findUserWithRoles(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      roles: { select: { role: { select: { slug: true, name: true } } } },
    },
  })
}

export async function findOwnSession(sessionId: string, userId: string) {
  // Scoped by userId, not just id — otherwise anyone could revoke anyone's
  // session by guessing a cuid.
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  })
}

export async function logAuthEvent(params: {
  userId: string | null
  action: string
  entityId: string
  summary: string
  req: Request
}) {
  await prisma.activityLog.create({
    data: {
      actorUserId: params.userId,
      action: params.action,
      entityType: 'user',
      entityId: params.entityId,
      summary: params.summary,
      ip: params.req.ip?.slice(0, 64) ?? null,
      userAgent: params.req.get('user-agent')?.slice(0, 512) ?? null,
    },
  })
}
