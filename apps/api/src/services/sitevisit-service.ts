import type { Request } from 'express'
import type { SiteVisitCreateInput, SiteVisitListQuery, SiteVisitUpdateInput } from '@app/shared'
import type { Prisma } from '../generated/prisma/client.js'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../auth/scope.js'
import { notFound, validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'

// Site visits are scoped: an admin (list.all) sees all; an agent sees a visit
// they're on, or one for a client OR property assigned to them. Same "which
// rows" mechanism as clients/properties — never a permission, always a WHERE.

export function scopeForSiteVisit(actor: Actor): Prisma.SiteVisitWhereInput {
  if (actor.has('property.list.all') || actor.has('client.list.all')) return {}
  return {
    OR: [
      { agentId: actor.userId },
      { client: { assignedAgentId: actor.userId } },
      { property: { assignedAgentId: actor.userId } },
    ],
  }
}

const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

const SELECT = {
  id: true,
  scheduledAt: true,
  status: true,
  feedback: true,
  remarks: true,
  createdAt: true,
  property: { select: { id: true, code: true, title: true } },
  client: { select: { id: true, code: true, fullName: true } },
  agent: { select: { id: true, fullName: true } },
} satisfies Prisma.SiteVisitSelect

export async function listSiteVisits(actor: Actor, query: SiteVisitListQuery) {
  const where: Prisma.SiteVisitWhereInput = { ...scopeForSiteVisit(actor) }
  const and: Prisma.SiteVisitWhereInput[] = []
  if (query.status) and.push({ status: query.status })
  if (query.clientId) and.push({ clientId: query.clientId })
  if (query.propertyId) and.push({ propertyId: query.propertyId })
  if (query.from) and.push({ scheduledAt: { gte: new Date(query.from) } })
  if (query.to) and.push({ scheduledAt: { lte: new Date(query.to) } })
  if (and.length) where.AND = and

  const take = query.pageSize
  const skip = (query.page - 1) * take
  const [rows, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      select: SELECT,
      orderBy: { scheduledAt: query.sort === 'scheduledAt' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.siteVisit.count({ where }),
  ])
  return { rows, total }
}

async function getInScope(actor: Actor, id: string) {
  const visit = await prisma.siteVisit.findFirst({ where: { ...scopeForSiteVisit(actor), id }, select: SELECT })
  if (!visit) throw notFound('Site visit not found')
  return visit
}

async function assertAgent(agentId: string | null | undefined) {
  if (!agentId) return
  const agent = await prisma.user.findFirst({
    where: { id: agentId, deletedAt: null, agentProfile: { isNot: null } },
    select: { id: true },
  })
  if (!agent) throw validationFailed({ agentId: ['That agent does not exist'] })
}

export async function createSiteVisit(actor: Actor, input: SiteVisitCreateInput, req: Request) {
  // The property AND client must both be in the actor's scope — you cannot
  // schedule a visit against inventory or a client you can't see.
  const property = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id: input.propertyId },
    select: { id: true, code: true },
  })
  if (!property) throw validationFailed({ propertyId: ['That property is unavailable'] })
  const client = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id: input.clientId },
    select: { id: true, code: true },
  })
  if (!client) throw validationFailed({ clientId: ['That client is unavailable'] })
  await assertAgent(input.agentId)

  return prisma.$transaction(async (tx) => {
    const visit = await tx.siteVisit.create({
      data: {
        propertyId: input.propertyId,
        clientId: input.clientId,
        agentId: input.agentId ?? null,
        scheduledAt: new Date(input.scheduledAt),
        remarks: orNull(input.remarks),
        createdById: actor.userId,
      },
      select: SELECT,
    })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'sitevisit.created',
      entityType: 'site_visit',
      entityId: visit.id,
      summary: `Scheduled a site visit for ${client.code} at ${property.code}`,
      req,
    })
    return visit
  })
}

export async function updateSiteVisit(actor: Actor, id: string, input: SiteVisitUpdateInput, req: Request) {
  await getInScope(actor, id)
  if ('agentId' in input) await assertAgent(input.agentId)

  const data: Prisma.SiteVisitUncheckedUpdateInput = {}
  if (input.status) data.status = input.status
  if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt)
  if ('agentId' in input) data.agentId = input.agentId ?? null
  if ('feedback' in input) data.feedback = orNull(input.feedback)
  if ('remarks' in input) data.remarks = orNull(input.remarks)

  return prisma.$transaction(async (tx) => {
    const visit = await tx.siteVisit.update({ where: { id }, data, select: SELECT })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'sitevisit.updated',
      entityType: 'site_visit',
      entityId: id,
      summary: `Updated site visit${input.status ? ` → ${input.status}` : ''}`,
      req,
    })
    return visit
  })
}

export async function deleteSiteVisit(actor: Actor, id: string, req: Request) {
  await getInScope(actor, id)
  await prisma.$transaction(async (tx) => {
    await tx.siteVisit.delete({ where: { id } })
    await logActivityTx(tx, {
      actorUserId: actor.userId,
      action: 'sitevisit.deleted',
      entityType: 'site_visit',
      entityId: id,
      summary: 'Deleted a site visit',
      req,
    })
  })
}
