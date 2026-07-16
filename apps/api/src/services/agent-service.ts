import type {
  AgentCreateInput,
  AgentPermissionsInput,
  AgentPermissionsResponse,
  AgentUpdateInput,
  UserStatus,
} from '@app/shared'
import { isPermissionKey, ROLE_SLUGS } from '@app/shared'
import type { Request } from 'express'
import { resolvePermissions } from '../auth/permissions.js'
import { hashPassword } from '../auth/tokens.js'
import { conflict, notFound, validationFailed } from '../lib/errors.js'
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
      code: true,
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

  // email lives on User; the rest on AgentProfile. Destructure explicitly so a
  // stray field can't spread into the wrong table.
  const { fullName, email, phone, address, experienceYears, specialization, commissionRate } = input

  // Uniqueness before the transaction: a friendly 409 beats the partial unique
  // index (email WHERE deleted_at IS NULL) throwing a raw constraint violation.
  let normalisedEmail: string | undefined
  if (email !== undefined) {
    normalisedEmail = email.toLowerCase().trim()
    const clash = await prisma.user.findFirst({
      where: { email: normalisedEmail, deletedAt: null, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw conflict('Another account already uses that email')
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(normalisedEmail !== undefined && { email: normalisedEmail }),
        ...('phone' in input && { phone: orNull(phone) }),
        agentProfile: {
          update: {
            ...('address' in input && { address: orNull(address) }),
            ...('experienceYears' in input && { experienceYears: experienceYears ?? null }),
            ...('specialization' in input && { specialization: orNull(specialization) }),
            ...('commissionRate' in input && { commissionRate: orNull(commissionRate) }),
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

// ---------------------------------------------------------------------------
// Per-agent access
// ---------------------------------------------------------------------------

const PERMISSION_LOAD = {
  roles: { select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } } },
  permissions: { select: { effect: true, permission: { select: { key: true } } } },
} as const

function toPermissionsResponse(user: {
  roles: Array<{ role: { permissions: Array<{ permission: { key: string } }> } }>
  permissions: Array<{ effect: 'ALLOW' | 'DENY'; permission: { key: string } }>
}): AgentPermissionsResponse {
  const rolePermissionKeys = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
  ]
  const overrides = user.permissions.map((p) => ({ key: p.permission.key, effect: p.effect }))

  // Reuse the ONE resolver the request path uses, so the preview here can never
  // disagree with what authenticate() will actually enforce.
  const effective = resolvePermissions({
    userId: '',
    sessionId: '',
    rolePermissions: rolePermissionKeys,
    userPermissions: overrides,
  })

  return {
    rolePermissionKeys: rolePermissionKeys.sort(),
    overrides,
    effectivePermissionKeys: [...effective].sort(),
  }
}

export async function getAgentPermissions(id: string): Promise<AgentPermissionsResponse> {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, agentProfile: { isNot: null } },
    select: PERMISSION_LOAD,
  })
  if (!user) throw notFound('Agent not found')
  return toPermissionsResponse(user)
}

/**
 * Replace an agent's permission overrides.
 *
 * Takes effect on the agent's NEXT request, not one token-TTL later —
 * authenticate() reloads permissions every request, which is the same
 * JWT-not-stateless property that makes deactivation instant. No token to
 * refresh, no cache to bust.
 */
export async function setAgentPermissions(
  actorId: string,
  id: string,
  input: AgentPermissionsInput,
  req: Request,
): Promise<AgentPermissionsResponse> {
  await getAgent(id) // 404 if not an agent; also refuses super-admins (no profile)

  // Reject unknown keys rather than silently storing a row nothing enforces —
  // a typo'd override that reads as "granted" in the UI but does nothing is
  // exactly the kind of quiet RBAC failure we design against.
  for (const o of input.overrides) {
    if (!isPermissionKey(o.key)) {
      throw validationFailed({ overrides: [`Unknown permission: ${o.key}`] })
    }
  }

  const keys = input.overrides.map((o) => o.key)
  const perms = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  })
  const idByKey = new Map(perms.map((p) => [p.key, p.id]))

  await prisma.$transaction(async (tx) => {
    // Replace wholesale: the payload is the complete desired override set, so
    // an override removed on the client (toggled back to the role default)
    // disappears here. Simpler and less error-prone than diffing.
    await tx.userPermission.deleteMany({ where: { userId: id } })
    if (input.overrides.length) {
      await tx.userPermission.createMany({
        data: input.overrides.map((o) => ({
          userId: id,
          permissionId: idByKey.get(o.key)!,
          effect: o.effect,
        })),
      })
    }

    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'agent.permissions.changed',
      entityType: 'user',
      entityId: id,
      // Permission KEYS are not PII — safe to record which access changed.
      summary: `Changed access for an agent`,
      metadata: {
        allow: input.overrides.filter((o) => o.effect === 'ALLOW').map((o) => o.key),
        deny: input.overrides.filter((o) => o.effect === 'DENY').map((o) => o.key),
      },
      req,
    })
  })

  return getAgentPermissions(id)
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
