import type {
  ClientCreateInput,
  ClientUpdateInput,
  InteractionCreateInput,
  RequirementInput,
} from '@app/shared'
import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient } from '../auth/scope.js'
import { notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import { diffForLog, logActivityTx } from './activity-service.js'

/** Digits only, India country code stripped. Must match the seed's normaliser. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('91') && digits.length > 10 ? digits.slice(-10) : digits
}

/** Empty strings from optional form fields become null, not "". */
const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

async function assertAssignableAgent(agentId: string | null | undefined) {
  if (!agentId) return
  const agent = await prisma.user.findFirst({
    where: { id: agentId, deletedAt: null, status: 'ACTIVE', agentProfile: { isNot: null } },
    select: { id: true },
  })
  if (!agent) throw validationFailed({ assignedAgentId: ['That agent does not exist or is not active'] })
}

async function assertAmenitiesExist(ids: string[] | undefined) {
  if (!ids?.length) return
  const found = await prisma.amenity.count({ where: { id: { in: ids } } })
  if (found !== ids.length) throw validationFailed({ amenityIds: ['One or more amenities no longer exist'] })
}

export async function createClient(actor: Actor, input: ClientCreateInput, req: Request) {
  await assertAssignableAgent(input.assignedAgentId)
  if (input.requirement) await assertAmenitiesExist(input.requirement.amenityIds)

  const { requirement, ...client } = input

  return prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        fullName: client.fullName,
        phone: client.phone,
        phoneNormalized: normalisePhone(client.phone),
        email: orNull(client.email),
        whatsapp: orNull(client.whatsapp),
        priority: client.priority,
        source: orNull(client.source),
        notes: orNull(client.notes),
        assignedAgentId: client.assignedAgentId ?? null,
        // `code` (CLI-00001) comes from the DB sequence.
      },
      select: { id: true, code: true, fullName: true },
    })

    // The atomic requirement — this is why create takes it inline. A separate
    // call would leave a window where the client exists with no requirement,
    // which the Phase 5 matching screen would render as an empty search.
    if (requirement) {
      const { amenityIds, ...reqRest } = requirement
      const req0 = await tx.clientRequirement.create({
        data: { ...reqRest, clientId: created.id, isActive: true },
        select: { id: true },
      })
      if (amenityIds?.length) {
        await tx.requirementAmenity.createMany({
          data: amenityIds.map((amenityId) => ({ requirementId: req0.id, amenityId })),
          skipDuplicates: true,
        })
      }
    }

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.created',
      entityType: 'client',
      entityId: created.id,
      summary: `Created ${created.code} — ${created.fullName}`,
      req,
    })

    return created
  })
}

export async function updateClient(actor: Actor, id: string, input: ClientUpdateInput, req: Request) {
  const before = await prisma.client.findFirst({ where: { ...scopeForClient(actor), id } })
  if (!before) throw notFound('Client not found')
  if ('assignedAgentId' in input) await assertAssignableAgent(input.assignedAgentId)

  const data: Record<string, unknown> = { ...input }
  // Keep the search-normalised phone in step whenever phone changes.
  if (input.phone) data.phoneNormalized = normalisePhone(input.phone)
  if ('email' in input) data.email = orNull(input.email)
  if ('whatsapp' in input) data.whatsapp = orNull(input.whatsapp)
  if ('source' in input) data.source = orNull(input.source)

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id },
      data: data as Prisma.ClientUpdateInput,
      select: { id: true, code: true },
    })

    const { changed, values } = diffForLog(
      before as unknown as Record<string, unknown>,
      data,
    )
    if (changed.length) {
      await logActivityTx(tx, {
        actorUserId: actor.userId,
        action: 'client.updated',
        entityType: 'client',
        entityId: id,
        summary: `Updated ${client.code}: ${changed.join(', ')}`,
        metadata: { changed, values },
        req,
      })
    }
    return client
  })
}

/**
 * Add an interaction, and update the client's contact state in the SAME
 * transaction.
 *
 * This is the canonical lastContactAt pattern named in the schema. lastContactAt
 * is a DELIBERATE denormalisation — it exists so the client list can sort and
 * filter on recency without an aggregate join. Writing it here, atomically with
 * the interaction, is what keeps it honest; a cron or a trigger would let it
 * drift. Do not "fix" it into a computed field.
 */
export async function addInteraction(
  actor: Actor,
  clientId: string,
  input: InteractionCreateInput,
  req: Request,
) {
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: clientId },
    select: { id: true, code: true },
  })
  if (!client) throw notFound('Client not found')

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()

  return prisma.$transaction(async (tx) => {
    const interaction = await tx.clientInteraction.create({
      data: {
        clientId,
        authorId: actor.userId,
        type: input.type,
        body: input.body ?? null,
        occurredAt,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        outcome: input.outcome ?? null,
      },
      select: { id: true },
    })

    // lastContactAt only moves forward — logging a backdated note must not
    // overwrite a more recent contact.
    const clientUpdate: Prisma.ClientUpdateInput = {}
    const current = await tx.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { lastContactAt: true },
    })
    if (!current.lastContactAt || occurredAt > current.lastContactAt) {
      clientUpdate.lastContactAt = occurredAt
    }
    if (input.followUpStatus) clientUpdate.followUpStatus = input.followUpStatus
    if ('nextFollowUp' in input) {
      clientUpdate.nextFollowUp = input.nextFollowUp ? new Date(input.nextFollowUp) : null
    }
    if (Object.keys(clientUpdate).length) {
      await tx.client.update({ where: { id: clientId }, data: clientUpdate })
    }

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.interaction.added',
      entityType: 'client',
      entityId: clientId,
      summary: `${input.type} logged on ${client.code}`,
      req,
    })

    return interaction
  })
}

export async function upsertRequirement(actor: Actor, clientId: string, input: RequirementInput, req: Request) {
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: clientId },
    select: { id: true, code: true },
  })
  if (!client) throw notFound('Client not found')
  await assertAmenitiesExist(input.amenityIds)

  const { amenityIds, ...reqRest } = input

  return prisma.$transaction(async (tx) => {
    // One active requirement per client. Deactivate the old, create the new —
    // history is preserved rather than overwritten, so "what did they want in
    // March?" stays answerable.
    await tx.clientRequirement.updateMany({
      where: { clientId, isActive: true },
      data: { isActive: false },
    })
    const requirement = await tx.clientRequirement.create({
      data: { ...reqRest, clientId, isActive: true },
      select: { id: true },
    })
    if (amenityIds?.length) {
      await tx.requirementAmenity.createMany({
        data: amenityIds.map((amenityId) => ({ requirementId: requirement.id, amenityId })),
        skipDuplicates: true,
      })
    }

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.requirement.updated',
      entityType: 'client',
      entityId: clientId,
      summary: `Updated requirements for ${client.code}`,
      req,
    })
    return requirement
  })
}

export async function assignClientAgent(actor: Actor, clientId: string, agentId: string | null, req: Request) {
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: clientId },
    select: { id: true, code: true },
  })
  if (!client) throw notFound('Client not found')
  await assertAssignableAgent(agentId)

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id: clientId }, data: { assignedAgentId: agentId } })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.agent.assigned',
      entityType: 'client',
      entityId: clientId,
      summary: agentId ? `Assigned an agent to ${client.code}` : `Unassigned agent from ${client.code}`,
      req,
    })
  })
}
