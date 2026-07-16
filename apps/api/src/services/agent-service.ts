import type { AgentCreateInput, AgentUpdateInput, UserStatus } from '@app/shared'
import { ROLE_SLUGS } from '@app/shared'
import type { Request } from 'express'
import { hashPassword } from '../auth/tokens.js'
import { conflict, notFound } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'
import { revokeAllSessions } from './session-service.js'

// Agents are Users with an AgentProfile. There is no scope resolver call here:
// agent management is admin-only (agent.* permissions), so the route guard is
// the whole gate. An agent has no agent.list permission and never reaches this.

const AGENT_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  agentProfile: {
    select: {
      address: true,
      experienceYears: true,
      specialization: true,
      commissionRate: true,
      photoStorageKey: true,
    },
  },
  _count: {
    select: {
      assignedClients: { where: { deletedAt: null } },
      assignedProperties: { where: { deletedAt: null } },
    },
  },
} as const

export async function listAgents() {
  return prisma.user.findMany({
    where: { deletedAt: null, agentProfile: { isNot: null } },
    select: AGENT_SELECT,
    orderBy: { fullName: 'asc' },
  })
}

export async function getAgent(id: string) {
  const agent = await prisma.user.findFirst({
    where: { id, deletedAt: null, agentProfile: { isNot: null } },
    select: AGENT_SELECT,
  })
  if (!agent) throw notFound('Agent not found')
  return agent
}

const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

export async function createAgent(actorId: string, input: AgentCreateInput, req: Request) {
  const email = input.email.toLowerCase().trim()

  // The partial unique index (email WHERE deleted_at IS NULL) also enforces
  // this, but a friendly 409 beats a raw constraint violation.
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } })
  if (existing) throw conflict('An account with that email already exists')

  const agentRole = await prisma.role.findUniqueOrThrow({ where: { slug: ROLE_SLUGS.AGENT } })
  const passwordHash = await hashPassword(input.temporaryPassword)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName,
        phone: orNull(input.phone) ?? undefined,
        status: 'ACTIVE',
        agentProfile: {
          create: {
            address: orNull(input.address),
            experienceYears: input.experienceYears ?? null,
            specialization: orNull(input.specialization),
            commissionRate: orNull(input.commissionRate),
          },
        },
        roles: { create: { roleId: agentRole.id } },
      },
      select: { id: true, fullName: true },
    })

    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'agent.created',
      entityType: 'user',
      entityId: user.id,
      summary: `Created agent ${user.fullName}`,
      req,
    })
    return user
  })
}

export async function updateAgent(actorId: string, id: string, input: AgentUpdateInput, req: Request) {
  await getAgent(id) // 404 if not an agent

  const { fullName, phone, ...profile } = input

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...('phone' in input && { phone: orNull(phone) }),
        agentProfile: {
          update: {
            ...('address' in input && { address: orNull(profile.address) }),
            ...('experienceYears' in input && { experienceYears: profile.experienceYears ?? null }),
            ...('specialization' in input && { specialization: orNull(profile.specialization) }),
            ...('commissionRate' in input && { commissionRate: orNull(profile.commissionRate) }),
          },
        },
      },
      select: { id: true, fullName: true },
    })

    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'agent.updated',
      entityType: 'user',
      entityId: id,
      // Field names only — commissionRate is sensitive and diffForLog would
      // have caught it, but the summary is hand-written here so say it plainly.
      summary: `Updated agent ${user.fullName}`,
      req,
    })
    return user
  })
}

/**
 * Activate / deactivate.
 *
 * Suspending an agent REVOKES ALL THEIR SESSIONS in the same transaction — the
 * payoff of keeping permissions out of the JWT. Because authenticate() reloads
 * the session every request, a suspended agent is locked out on their very next
 * request, not one token-TTL later. Deactivation that takes 15 minutes is not
 * deactivation.
 */
export async function setAgentStatus(actorId: string, id: string, status: UserStatus, req: Request) {
  const agent = await getAgent(id)
  if (agent.status === status) return agent

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } })

    if (status === 'SUSPENDED') {
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }

    await logActivityTx(tx, {
      actorUserId: actorId,
      action: status === 'SUSPENDED' ? 'agent.deactivated' : 'agent.activated',
      entityType: 'user',
      entityId: id,
      summary: `${status === 'SUSPENDED' ? 'Deactivated' : 'Activated'} agent ${agent.fullName}`,
      req,
    })
  })

  // Belt and braces outside the tx too — revokeAllSessions is the canonical
  // path and stays the single source of truth for "what revocation means".
  if (status === 'SUSPENDED') await revokeAllSessions(id)

  return getAgent(id)
}

/** For assignment dropdowns — active agents only, minimal shape. */
export async function listAssignableAgents() {
  const agents = await prisma.user.findMany({
    where: { deletedAt: null, status: 'ACTIVE', agentProfile: { isNot: null } },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  return agents
}
