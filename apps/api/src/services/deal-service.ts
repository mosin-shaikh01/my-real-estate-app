import type { Request } from 'express'
import type { DealCreateInput, DealListQuery } from '@app/shared'
import type { Prisma } from '../generated/prisma/client.js'
import { validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logActivityTx } from './activity-service.js'

// Closed deals — an admin-only surface (deal.list / deal.create). No scope
// resolver: an agent holds neither permission, so the route guard is the whole
// gate, exactly like owners/agents.

const DEAL_SELECT = {
  id: true,
  dealType: true,
  closedAt: true,
  closedPrice: true,
  commissionRate: true,
  commissionAmount: true,
  notes: true,
  createdAt: true,
  property: { select: { id: true, code: true, title: true } },
  client: { select: { id: true, code: true, fullName: true } },
  agent: { select: { id: true, fullName: true } },
} satisfies Prisma.DealSelect

const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

export async function listDeals(query: DealListQuery) {
  const where: Prisma.DealWhereInput = {}
  if (query.dealType) where.dealType = query.dealType
  if (query.agentId) where.agentId = query.agentId

  const take = query.pageSize
  const page = query.page
  const [rows, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      select: DEAL_SELECT,
      orderBy: { closedAt: 'desc' },
      skip: (page - 1) * take,
      take,
    }),
    prisma.deal.count({ where }),
  ])
  return { rows, total, page, pageSize: take }
}

export async function createDeal(actorUserId: string, input: DealCreateInput, req: Request) {
  // Property + client must exist (and not be soft-deleted). Admin-only surface,
  // so there is no scope check — only existence.
  const [property, client] = await Promise.all([
    prisma.property.findFirst({
      where: { id: input.propertyId, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.client.findFirst({
      where: { id: input.clientId, deletedAt: null },
      select: { id: true, code: true },
    }),
  ])
  if (!property) throw validationFailed({ propertyId: ['That property is unavailable'] })
  if (!client) throw validationFailed({ clientId: ['That client is unavailable'] })

  // Snapshot the agent's commission RATE at close and derive the amount — copying
  // rather than joining is the point: rates change, historical reports must not.
  let commissionRate: string | null = null
  let commissionAmount: string | null = null
  const agentId = orNull(input.agentId)
  if (agentId) {
    const agent = await prisma.user.findFirst({
      where: { id: agentId, deletedAt: null, agentProfile: { isNot: null } },
      select: { agentProfile: { select: { commissionRate: true } } },
    })
    if (!agent) throw validationFailed({ agentId: ['That agent does not exist'] })
    const rate = agent.agentProfile?.commissionRate ?? null
    if (rate != null) {
      commissionRate = rate.toFixed(2)
      commissionAmount = ((Number(input.closedPrice) * Number(commissionRate)) / 100).toFixed(2)
    }
  }

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        propertyId: input.propertyId,
        clientId: input.clientId,
        agentId,
        dealType: input.dealType,
        closedAt: new Date(input.closedAt),
        closedPrice: input.closedPrice,
        commissionRate,
        commissionAmount,
        notes: orNull(input.notes),
      },
      select: DEAL_SELECT,
    })
    await logActivityTx(tx, {
      actorUserId,
      action: 'deal.created',
      entityType: 'deal',
      entityId: created.id,
      summary: `Recorded a ${input.dealType === 'RENT' ? 'rental' : 'sale'} deal for ${client.code} on ${property.code}`,
      // closedPrice/commission are money — log the fact, not the figures.
      metadata: { dealType: input.dealType, propertyCode: property.code, clientCode: client.code },
      req,
    })
    return created
  })
  return deal
}
