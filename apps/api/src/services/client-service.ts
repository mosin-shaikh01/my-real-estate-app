import type { ClientListQuery } from '@app/shared'
import { parseSort } from '@app/shared'
import type { Actor } from '../auth/permissions.js'
import { scopeForClient } from '../auth/scope.js'
import { prisma } from '../lib/prisma.js'
import { notFound } from '../lib/errors.js'
import { sortableClientFields } from '../serializers/client-serializer.js'

// ALL Prisma access for this resource lives here. An ESLint no-restricted-imports
// rule keeps `prisma` out of routes, so scoping cannot be bypassed by accident.

const LIST_SELECT = {
  id: true,
  code: true,
  fullName: true,
  email: true,
  phone: true,
  whatsapp: true,
  buyerType: true,
  city: true,
  importantLead: true,
  priority: true,
  source: true,
  notes: true,
  followUpStatus: true,
  lastContactAt: true,
  nextFollowUp: true,
  assignedAgentId: true,
  createdAt: true,
  assignedAgent: { select: { id: true, fullName: true } },
  requirements: {
    where: { isActive: true },
    take: 1,
    select: {
      id: true,
      budgetMin: true,
      budgetMax: true,
      areaMin: true,
      areaMax: true,
      propertyType: true,
      listingType: true,
      bedrooms: true,
      city: true,
      locality: true,
    },
  },
  _count: { select: { assignments: { where: { removedAt: null } } } },
} as const

export async function listClients(actor: Actor, query: ClientListQuery) {
  const scope = scopeForClient(actor)

  const where: Record<string, unknown> = { ...scope }
  const and: unknown[] = []

  if (query.q) {
    const digits = query.q.replace(/\D/g, '')
    and.push({
      OR: [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
        // Normalised phone: without this, "9876543210" never matches
        // "+91 98765 43210" and search looks broken on day one.
        ...(digits.length >= 4 ? [{ phoneNormalized: { contains: digits } }] : []),
      ],
    })
  }
  if (query.followUpStatus) and.push({ followUpStatus: query.followUpStatus })
  if (query.priority) and.push({ priority: query.priority })
  if (query.importantLead === 'true') and.push({ importantLead: true })
  if (query.assignedAgentId) and.push({ assignedAgentId: query.assignedAgentId })
  if (query.city) and.push({ requirements: { some: { isActive: true, city: query.city } } })

  // Budget filters are applied ONLY if the actor may see budgets. Otherwise an
  // agent narrows ?minBudget= until the set changes and reads the value off the
  // result count. Redaction without this is decorative.
  if (actor.has('client.budget.view')) {
    if (query.minBudget) and.push({ requirements: { some: { isActive: true, budgetMax: { gte: query.minBudget } } } })
    if (query.maxBudget) and.push({ requirements: { some: { isActive: true, budgetMin: { lte: query.maxBudget } } } })
  }

  if (and.length) where.AND = and

  const sort = parseSort(query.sort, sortableClientFields(actor))
  const orderBy = sort
    ? { [sort.field]: sort.dir }
    : ({ createdAt: 'desc' } as Record<string, 'asc' | 'desc'>)

  const skip = (query.page - 1) * query.pageSize

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where: where as never,
      select: LIST_SELECT,
      orderBy: orderBy as never,
      skip,
      take: query.pageSize,
    }),
    prisma.client.count({ where: where as never }),
  ])

  return { rows, total }
}

export async function getClient(actor: Actor, id: string) {
  // Scope is part of the WHERE, not a post-fetch check. A scoped-out row is
  // indistinguishable from a missing one — which is the point: a 403 here would
  // confirm that another agent's client exists.
  const row = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id },
    select: LIST_SELECT,
  })
  if (!row) throw notFound('Client not found')
  return row
}

const DETAIL_SELECT = {
  ...LIST_SELECT,
  interactions: {
    orderBy: { occurredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      body: true,
      occurredAt: true,
      scheduledAt: true,
      outcome: true,
      author: { select: { id: true, fullName: true } },
    },
  },
  assignments: {
    where: { removedAt: null },
    orderBy: { assignedAt: 'desc' },
    select: {
      id: true,
      status: true,
      // assignedAgentId is carried so the serializer can drop shortlisted
      // properties that belong to OTHER agents — strict RBAC applies even to a
      // client's shortlist, not only to the property endpoints.
      property: { select: { id: true, code: true, title: true, status: true, assignedAgentId: true } },
    },
  },
} as const

export async function getClientDetail(actor: Actor, id: string) {
  const row = await prisma.client.findFirst({
    where: { ...scopeForClient(actor), id },
    select: DETAIL_SELECT,
  })
  if (!row) throw notFound('Client not found')
  return row
}
