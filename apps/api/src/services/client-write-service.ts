import type {
  ClientCreateInput,
  ClientUpdateInput,
  InteractionCreateInput,
  RequirementInput,
} from '@app/shared'
import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../auth/scope.js'
import { conflict, notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import { diffForLog, humanizeFields, logActivityTx } from './activity-service.js'
import { assignPropertiesTx } from './assignment-service.js'

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

  // Validate the shortlisted properties BEFORE opening the transaction — a bad
  // id should 400, not roll back a half-built client.
  if (input.propertyIds?.length) {
    const found = await prisma.property.findMany({
      where: { ...scopeForProperty(actor), id: { in: input.propertyIds } },
      select: { id: true },
    })
    if (found.length !== input.propertyIds.length) {
      throw validationFailed({ propertyIds: ['One or more properties are unavailable'] })
    }
  }

  const { requirement, propertyIds, ...client } = input

  return prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        fullName: client.fullName,
        phone: client.phone,
        phoneNormalized: normalisePhone(client.phone),
        email: orNull(client.email),
        whatsapp: orNull(client.whatsapp),
        buyerType: client.buyerType ?? null,
        city: orNull(client.city),
        importantLead: client.importantLead ?? false,
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

    // The shortlisted properties, in the SAME transaction. This is what makes
    // the whole Requirement screen atomic: client, requirement and assignments
    // commit together or not at all.
    if (propertyIds?.length) {
      await assignPropertiesTx(tx, {
        actorId: actor.userId,
        clientId: created.id,
        clientCode: created.code,
        propertyIds,
        req,
      })
    }

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
  if ('city' in input) data.city = orNull(input.city)

  const { changed, values } = diffForLog(before as unknown as Record<string, unknown>, data)

  // No real change → no write, no log, no updatedAt bump.
  if (changed.length === 0) {
    return { id: before.id, code: before.code, changed: false }
  }

  const client = await prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id },
      // Only the changed columns.
      data: Object.fromEntries(
        Object.entries(data).filter(([k]) => changed.includes(k)),
      ) as Prisma.ClientUpdateInput,
      select: { id: true, code: true },
    })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.updated',
      entityType: 'client',
      entityId: id,
      summary: `Updated ${updated.code}: ${humanizeFields(changed)}`,
      metadata: { changed, values },
      req,
    })
    return updated
  })
  return { ...client, changed: true }
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

/**
 * Archive (or restore) a client — the reversible hide, mirroring properties.
 * archivedAt is orthogonal to deletedAt: archiving does not delete, and restore
 * only clears the flags, leaving requirements, interactions, assignments and
 * history exactly as they were.
 */
export async function archiveClient(actor: Actor, id: string, archived: boolean, req: Request) {
  const before = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id },
    select: { id: true, code: true, fullName: true, archivedAt: true },
  })
  if (!before) throw notFound('Client not found')
  if (archived && before.archivedAt) throw conflict('Already archived')
  if (!archived && !before.archivedAt) throw conflict('Not archived')

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id },
      // archivedById set with archivedAt, cleared together on restore.
      data: {
        archivedAt: archived ? new Date() : null,
        archivedById: archived ? actor.userId : null,
      },
      select: { id: true, code: true, archivedAt: true },
    })

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: archived ? 'client.archived' : 'client.unarchived',
      entityType: 'client',
      entityId: id,
      summary: `${archived ? 'Archived' : 'Restored'} ${before.code} — ${before.fullName}`,
      metadata: { code: before.code, fullName: before.fullName },
      req,
    })

    return client
  })
}

/**
 * Soft-delete a client (admin, terminal). deletedAt is filtered by
 * scopeForClient, so the row vanishes from every read while its data and
 * activity history are preserved (the log references it by id with no FK).
 */
export async function deleteClient(actor: Actor, id: string, req: Request) {
  const before = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id },
    select: { id: true, code: true, fullName: true },
  })
  if (!before) throw notFound('Client not found')

  return prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { deletedAt: new Date() } })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'client.deleted',
      entityType: 'client',
      entityId: id,
      summary: `Deleted ${before.code} — ${before.fullName}`,
      metadata: { code: before.code, fullName: before.fullName },
      req,
    })
  })
}
