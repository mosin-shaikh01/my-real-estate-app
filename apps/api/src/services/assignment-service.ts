import type { Request } from 'express'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../auth/scope.js'
import { notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import { logActivityTx } from './activity-service.js'

// ============================================================================
// Property ↔ client assignment — the output of the matching screen
// ============================================================================

/**
 * Assign properties to a client, inside the caller's transaction.
 *
 * Shared by BOTH entry points: the atomic client-create (Phase 5 new-client
 * flow) and the bulk-assign endpoint (existing client). Keeping it one function
 * means the idempotency, the re-activation of removed rows, and the
 * one-log-per-assignment rule can't drift between the two.
 *
 * ONE ActivityLog row PER assignment, never a batched "assigned 5 properties".
 * The question an admin actually asks is "which properties did we show this
 * client, and when" — a count cannot answer it.
 */
export async function assignPropertiesTx(
  tx: Prisma.TransactionClient,
  params: {
    actorId: string
    clientId: string
    clientCode: string
    propertyIds: string[]
    req?: Request
  },
): Promise<number> {
  let assigned = 0

  for (const propertyId of params.propertyIds) {
    const existing = await tx.propertyAssignment.findUnique({
      where: { clientId_propertyId: { clientId: params.clientId, propertyId } },
      select: { id: true, removedAt: true },
    })

    // Re-ticking a property that is already actively assigned is a genuine
    // no-op — no write, no log. The timeline must not fill with noise every
    // time someone re-opens the screen and re-saves.
    if (existing && !existing.removedAt) continue

    if (existing) {
      // Revive a previously-removed assignment rather than leaving it orphaned,
      // so the activity log rows that reference it stay valid.
      await tx.propertyAssignment.update({
        where: { id: existing.id },
        data: { removedAt: null, status: 'SHORTLISTED', assignedById: params.actorId },
      })
    } else {
      await tx.propertyAssignment.create({
        data: { clientId: params.clientId, propertyId, status: 'SHORTLISTED', assignedById: params.actorId },
      })
    }

    // ONE log per assignment. "Assigned 5 properties" cannot answer "which ones,
    // and when" — the question an admin actually asks.
    await logActivityTx(tx, {
      actorUserId: params.actorId,
      action: 'property.assigned',
      entityType: 'client',
      entityId: params.clientId,
      summary: `Shared a property with ${params.clientCode}`,
      metadata: { propertyId },
      req: params.req,
    })
    assigned++
  }

  return assigned
}

/** Bulk-assign to an existing client. */
export async function bulkAssignProperties(
  actor: Actor,
  clientId: string,
  propertyIds: string[],
  req: Request,
) {
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: clientId },
    select: { id: true, code: true },
  })
  if (!client) throw notFound('Client not found')

  // Every property must be real and within the actor's scope — an admin can
  // assign anything visible; this stops a stale or spoofed id sneaking in.
  const found = await prisma.property.findMany({
    where: { ...scopeForProperty(actor), id: { in: propertyIds } },
    select: { id: true },
  })
  if (found.length !== propertyIds.length) {
    throw validationFailed({ propertyIds: ['One or more properties are unavailable'] })
  }

  return prisma.$transaction(async (tx) => {
    const count = await assignPropertiesTx(tx, {
      actorId: actor.userId,
      clientId,
      clientCode: client.code,
      propertyIds,
      req,
    })
    return { assigned: count }
  })
}

/** Soft-remove an assignment — the log rows that reference it must survive. */
export async function removeAssignment(actor: Actor, clientId: string, propertyId: string, req: Request) {
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: clientId },
    select: { id: true, code: true },
  })
  if (!client) throw notFound('Client not found')

  const assignment = await prisma.propertyAssignment.findUnique({
    where: { clientId_propertyId: { clientId, propertyId } },
    select: { id: true, removedAt: true },
  })
  if (!assignment || assignment.removedAt) throw notFound('Assignment not found')

  await prisma.$transaction(async (tx) => {
    await tx.propertyAssignment.update({
      where: { id: assignment.id },
      data: { removedAt: new Date() },
    })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'property.unassigned',
      entityType: 'client',
      entityId: clientId,
      summary: `Removed a property from ${client.code}`,
      metadata: { propertyId },
      req,
    })
  })
}
