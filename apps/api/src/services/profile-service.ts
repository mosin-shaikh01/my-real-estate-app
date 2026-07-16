import type { ProfileResponse, ProfileUpdateInput } from '@app/shared'
import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { hashPassword, verifyPassword } from '../auth/tokens.js'
import { conflict, notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivity } from './activity-service.js'
import { revokeOtherSessions } from './session-service.js'

// Self-service: everything here operates on the ACTOR's own id. There is no
// scope resolver and no target-id parameter — a user acts only on themselves,
// which is the entire safety model. Never accept a userId from the request body.

const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

export async function getOwnProfile(userId: string): Promise<ProfileResponse> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      roles: { select: { role: { select: { slug: true, name: true } } } },
      agentProfile: {
        select: {
          code: true,
          specialization: true,
          experienceYears: true,
          address: true,
          commissionRate: true,
        },
      },
    },
  })
  if (!user) throw notFound('Profile not found')

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    roles: user.roles.map((r) => r.role),
    agent: user.agentProfile
      ? {
          code: user.agentProfile.code,
          specialization: user.agentProfile.specialization,
          experienceYears: user.agentProfile.experienceYears,
          address: user.agentProfile.address,
          commissionRate: user.agentProfile.commissionRate?.toFixed(2) ?? null,
        }
      : null,
  }
}

export async function updateOwnProfile(actor: Actor, input: ProfileUpdateInput, req: Request) {
  const isAgent = (await prisma.agentProfile.count({ where: { userId: actor.userId } })) > 0

  let normalisedEmail: string | undefined
  if (input.email !== undefined) {
    normalisedEmail = input.email.toLowerCase().trim()
    const clash = await prisma.user.findFirst({
      where: { email: normalisedEmail, deletedAt: null, id: { not: actor.userId } },
      select: { id: true },
    })
    if (clash) throw conflict('Another account already uses that email')
  }

  await prisma.user.update({
    where: { id: actor.userId },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(normalisedEmail !== undefined && { email: normalisedEmail }),
      ...('phone' in input && { phone: orNull(input.phone) }),
      // Agent descriptive fields only take effect if the actor IS an agent.
      // Silently ignored otherwise — a super admin PATCHing `specialization`
      // shouldn't error, it just has no profile to write it to.
      ...(isAgent && {
        agentProfile: {
          update: {
            ...('specialization' in input && { specialization: orNull(input.specialization) }),
            ...('experienceYears' in input && { experienceYears: input.experienceYears ?? null }),
            ...('address' in input && { address: orNull(input.address) }),
          },
        },
      }),
    },
  })

  await logActivity({
    actorUserId: actor.userId,
    action: 'profile.updated',
    entityType: 'user',
    entityId: actor.userId,
    summary: 'Updated their own profile',
    req,
  })

  return getOwnProfile(actor.userId)
}

export async function changeOwnPassword(
  actor: Actor,
  currentPassword: string,
  newPassword: string,
  req: Request,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { passwordHash: true },
  })

  // Verifying the current password is what makes this safe to do without a
  // fresh login: a hijacked session still can't rotate the password blindly.
  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) throw validationFailed({ currentPassword: ['That is not your current password'] })

  await prisma.user.update({
    where: { id: actor.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  })

  // Sign out every OTHER device — a leaked session elsewhere is now dead — but
  // keep this one, so changing a password doesn't immediately eject the person
  // who changed it.
  await revokeOtherSessions(actor.userId, actor.sessionId)

  await logActivity({
    actorUserId: actor.userId,
    action: 'profile.password_changed',
    entityType: 'user',
    entityId: actor.userId,
    summary: 'Changed their password',
    req,
  })
}
