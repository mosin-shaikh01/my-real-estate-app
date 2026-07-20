import type { PropertyCreateInput, PropertyStatus, PropertyUpdateInput } from '@app/shared'
import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { scopeForProperty } from '../auth/scope.js'
import { conflict, notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { diffForLog, logActivityTx } from './activity-service.js'

// ============================================================================
// The server's refinement layer
// ============================================================================
// Shared Zod owns shape/format/coercion. THIS owns everything that needs the
// database. One schema cannot do both, and pretending it can is how you end up
// with validation that only runs in the browser.
//
// Errors are keyed by FIELD PATH so the client maps them onto RHF setError —
// same schema, same paths, no translation layer.
// ============================================================================

async function assertAssignableAgent(agentId: string | null | undefined) {
  if (!agentId) return
  const agent = await prisma.user.findFirst({
    where: { id: agentId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  })
  // Not expressible in shared Zod: it needs a row. A suspended agent silently
  // owning live inventory is exactly the drift this catches.
  if (!agent) {
    throw validationFailed({ assignedAgentId: ['That agent does not exist or is not active'] })
  }
}

async function assertAmenitiesExist(ids: string[]) {
  if (!ids.length) return
  const found = await prisma.amenity.count({ where: { id: { in: ids } } })
  if (found !== ids.length) {
    throw validationFailed({ amenityIds: ['One or more amenities no longer exist'] })
  }
}

async function assertOwnerExists(ownerId: string | null | undefined) {
  if (!ownerId) return
  const owner = await prisma.propertyOwner.findFirst({
    where: { id: ownerId, deletedAt: null },
    select: { id: true },
  })
  // Needs a row — not expressible in shared Zod. A friendly 400 beats a raw FK
  // constraint violation.
  if (!owner) throw validationFailed({ ownerId: ['That owner no longer exists'] })
}

// Optional string fields that a cleared form sends as "". Store them as NULL,
// not empty string, so "no maps link" is one value everywhere and downstream
// `?? null` checks behave. Required fields (title, city…) are min-length
// validated upstream, so they never arrive empty.
const NULLABLE_STRINGS = [
  'googleMapUrl',
  'locality',
  'internalNotes',
  'latitude',
  'longitude',
  'facing',
  'surveyNumber',
  'propertyNumber',
  'ownerId',
  'landmark',
] as const

function normaliseEmptyToNull(data: Record<string, unknown>) {
  const out = { ...data }
  for (const key of NULLABLE_STRINGS) {
    if (out[key] === '') out[key] = null
  }
  return out
}

/** Only what the actor is permitted to write reaches Prisma. */
function stripUnwritable(data: Record<string, unknown>, actor: Actor) {
  const out = { ...data }
  // An actor who cannot READ internal notes must not be able to overwrite them
  // blind — a write gate is not implied by a hidden field.
  if (!actor.has('property.internalNotes.view')) delete out.internalNotes
  if (!actor.has('property.price.view')) {
    delete out.salePrice
    delete out.rentPricePerMonth
    delete out.securityDeposit
    delete out.maintenanceCharges
  }
  return out
}

export async function createProperty(actor: Actor, input: PropertyCreateInput, req: Request) {
  await assertAssignableAgent(input.assignedAgentId)
  await assertOwnerExists(input.ownerId)
  const amenityIds = input.amenityIds ?? []
  await assertAmenitiesExist(amenityIds)

  const { amenityIds: _drop, ...rest } = normaliseEmptyToNull(
    stripUnwritable(input, actor),
  ) as PropertyCreateInput

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        ...rest,
        // Never let the array column go in as NULL — the schema field is a
        // required String[], and a NULL would fail Prisma's read on the next
        // fetch. An omitted or absent value means "no external videos" = [].
        videoUrls: rest.videoUrls ?? [],
        // `code` omitted deliberately — the Postgres sequence default fills it
        // (PROP-00007). Status/visibility/etc. omitted when absent → the DB's
        // @default fills them. That is why the Zod defaults were removed.
        amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
      },
      select: { id: true, code: true, title: true },
    })

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'property.created',
      entityType: 'property',
      entityId: property.id,
      summary: `Created ${property.code} — ${property.title}`,
      metadata: { code: property.code },
      req,
    })

    return property
  })
}

export async function updateProperty(
  actor: Actor,
  id: string,
  input: PropertyUpdateInput,
  req: Request,
) {
  // Scope first: an agent must not be able to edit a property they cannot see,
  // and the 404 must be indistinguishable from a genuine absence.
  const before = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
  })
  if (!before) throw notFound('Property not found')

  if ('assignedAgentId' in input) await assertAssignableAgent(input.assignedAgentId)
  if ('ownerId' in input) await assertOwnerExists(input.ownerId)
  if (input.amenityIds) await assertAmenitiesExist(input.amenityIds)

  const { amenityIds, ...rest } = normaliseEmptyToNull(
    stripUnwritable(input, actor),
  ) as PropertyUpdateInput

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.update({
      where: { id },
      data: rest,
      select: { id: true, code: true, title: true },
    })

    if (amenityIds) {
      // Replace wholesale. A diff would be more code for the same result at
      // this size, and a partial failure would leave a half-set of amenities.
      await tx.propertyAmenity.deleteMany({ where: { propertyId: id } })
      await tx.propertyAmenity.createMany({
        data: amenityIds.map((amenityId) => ({ propertyId: id, amenityId })),
        skipDuplicates: true,
      })
    }

    // Field NAMES for sensitive fields, values for the rest. Without this the
    // audit trail becomes a second, unguarded copy of internalNotes.
    const { changed, values } = diffForLog(
      before as unknown as Record<string, unknown>,
      rest as Record<string, unknown>,
    )

    if (changed.length || amenityIds) {
      await logActivityTx(tx, {
        actorUserId: actor.userId,
        action: 'property.updated',
        entityType: 'property',
        entityId: id,
        summary: `Updated ${property.code}: ${[...changed, ...(amenityIds ? ['amenities'] : [])].join(', ')}`,
        metadata: { changed, values },
        req,
      })
    }

    return property
  })
}

export async function setPropertyStatus(
  actor: Actor,
  id: string,
  status: PropertyStatus,
  req: Request,
) {
  const before = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
    select: { id: true, code: true, status: true },
  })
  if (!before) throw notFound('Property not found')
  if (before.status === status) return before

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.update({
      where: { id },
      data: { status },
      select: { id: true, code: true, status: true },
    })

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'property.status.updated',
      entityType: 'property',
      entityId: id,
      summary: `${property.code}: ${before.status} → ${status}`,
      metadata: { from: before.status, to: status },
      req,
    })

    return property
  })
}

/**
 * Assign (or clear) the agent responsible for a property.
 *
 * A dedicated endpoint with its OWN permission (property.assignAgent), separate
 * from property.update: a manager might reassign inventory without being able to
 * edit prices or descriptions. Reassigning also changes who can SEE the
 * property — scopeForProperty keys off assignedAgentId — so it is a genuine
 * authorization action, not just a field edit.
 */
export async function assignPropertyAgent(
  actor: Actor,
  id: string,
  agentId: string | null,
  req: Request,
) {
  const before = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
    select: { id: true, code: true, assignedAgentId: true },
  })
  if (!before) throw notFound('Property not found')
  await assertAssignableAgent(agentId)
  if (before.assignedAgentId === agentId) {
    return { id: before.id, code: before.code }
  }

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.update({
      where: { id },
      data: { assignedAgentId: agentId },
      select: { id: true, code: true },
    })

    const agentName = agentId
      ? (await tx.user.findUnique({ where: { id: agentId }, select: { fullName: true } }))?.fullName
      : null

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: agentId ? 'property.agent.assigned' : 'property.agent.unassigned',
      entityType: 'property',
      entityId: id,
      summary: agentId
        ? `Assigned ${agentName} to ${property.code}`
        : `Unassigned the agent from ${property.code}`,
      metadata: { agentId },
      req,
    })

    return property
  })
}

export async function archiveProperty(actor: Actor, id: string, archived: boolean, req: Request) {
  const before = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
    select: { id: true, code: true, title: true, propertyNumber: true, archivedAt: true },
  })
  if (!before) throw notFound('Property not found')

  // archivedAt is orthogonal to status and to deletedAt — three concepts, three
  // columns. Archiving does not make a property "not sold". Restoring only
  // clears the archive flags; status, assignments, media and history are
  // untouched, so a restored property returns exactly as it was.
  if (archived && before.archivedAt) throw conflict('Already archived')
  if (!archived && !before.archivedAt) throw conflict('Not archived')

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.update({
      where: { id },
      // archivedById is set with archivedAt and cleared together on restore, so
      // the pair is always consistent (both set or both null).
      data: {
        archivedAt: archived ? new Date() : null,
        archivedById: archived ? actor.userId : null,
      },
      select: { id: true, code: true, archivedAt: true },
    })

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: archived ? 'property.archived' : 'property.unarchived',
      entityType: 'property',
      entityId: id,
      summary: `${archived ? 'Archived' : 'Restored'} ${before.code} — ${before.title}`,
      // Name + number denormalised into the log so the entry stays legible even
      // after the property is later deleted (the log has no FK to it).
      metadata: { code: before.code, title: before.title, propertyNumber: before.propertyNumber },
      req,
    })

    return property
  })
}

export async function deleteProperty(actor: Actor, id: string, req: Request) {
  const before = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
    select: { id: true, code: true, title: true, propertyNumber: true },
  })
  if (!before) throw notFound('Property not found')

  return prisma.$transaction(async (tx) => {
    // SOFT delete. The activity log references this row by id with no FK, and
    // a hard delete would strand every historical entry about it. deletedAt is
    // filtered by scopeForProperty, so the row vanishes from every read (list,
    // detail, dashboard) while the data — and its history — is preserved.
    await tx.property.update({ where: { id }, data: { deletedAt: new Date() } })

    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'property.deleted',
      entityType: 'property',
      entityId: id,
      summary: `Deleted ${before.code} — ${before.title}`,
      metadata: { code: before.code, title: before.title, propertyNumber: before.propertyNumber },
      req,
    })
  })
}
