import type { PropertyListQuery } from '@app/shared'
import { parseSort } from '@app/shared'
import type { Prisma } from '../generated/prisma/client.js'
import type { Actor } from '../auth/permissions.js'
import { scopeForProperty } from '../auth/scope.js'
import { notFound } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { canFilterByPrice, sortablePropertyFields } from '../serializers/property-serializer.js'

const DETAIL_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  propertyType: true,
  listingType: true,
  status: true,
  constructionStatus: true,
  visibility: true,
  featured: true,
  salePrice: true,
  rentPricePerMonth: true,
  securityDeposit: true,
  maintenanceCharges: true,
  negotiable: true,
  areaSqft: true,
  bedrooms: true,
  bathrooms: true,
  parking: true,
  furnished: true,
  facing: true,
  floor: true,
  totalFloor: true,
  builtYear: true,
  address: true,
  locality: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  latitude: true,
  longitude: true,
  videoUrl: true,
  internalNotes: true,
  assignedAgentId: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  assignedAgent: { select: { id: true, fullName: true } },
  amenities: {
    select: { amenity: { select: { id: true, name: true, slug: true, category: true } } },
  },
  media: {
    select: { id: true, type: true, storageKey: true, isCover: true, sortOrder: true },
    // Cover first, then explicit order. No `as const` on this object: it would
    // make this nested array readonly, which Prisma's Select type rejects.
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
  },
  _count: { select: { assignments: { where: { removedAt: null } } } },
} satisfies Prisma.PropertySelect

export async function listProperties(actor: Actor, query: PropertyListQuery) {
  const where: Record<string, unknown> = { ...scopeForProperty(actor) }
  const and: unknown[] = []

  // Archived is orthogonal to status and to deletion — three concepts, three
  // columns. Hidden by default rather than gone.
  if (query.includeArchived !== 'true') and.push({ archivedAt: null })

  if (query.q) {
    and.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
        { locality: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ],
    })
  }

  if (query.status?.length) and.push({ status: { in: query.status } })
  if (query.propertyType?.length) and.push({ propertyType: { in: query.propertyType } })
  if (query.listingType) {
    // BOTH is a real listing: a property listed for sale AND rent must appear
    // under either filter, or half the inventory silently vanishes.
    and.push({ OR: [{ listingType: query.listingType }, { listingType: 'BOTH' }] })
  }
  if (query.bedrooms?.length) and.push({ bedrooms: { in: query.bedrooms } })
  if (query.city) and.push({ city: { equals: query.city, mode: 'insensitive' } })
  if (query.locality) and.push({ locality: { contains: query.locality, mode: 'insensitive' } })
  if (query.furnished) and.push({ furnished: query.furnished })
  if (query.constructionStatus) and.push({ constructionStatus: query.constructionStatus })
  if (query.featured) and.push({ featured: query.featured === 'true' })

  if (query.minArea) and.push({ areaSqft: { gte: query.minArea } })
  if (query.maxArea) and.push({ areaSqft: { lte: query.maxArea } })

  // Price filters only for actors who may SEE prices. Narrowing ?minPrice until
  // the result set shifts is a binary search of a value you were never shown.
  if (canFilterByPrice(actor)) {
    const priceOr = (op: 'gte' | 'lte', value: string) => ({
      OR: [{ salePrice: { [op]: value } }, { rentPricePerMonth: { [op]: value } }],
    })
    if (query.minPrice) and.push(priceOr('gte', query.minPrice))
    if (query.maxPrice) and.push(priceOr('lte', query.maxPrice))
  }

  if (and.length) where.AND = and

  const sort = parseSort(query.sort, sortablePropertyFields(actor))
  const orderBy = sort ? { [sort.field]: sort.dir } : { createdAt: 'desc' as const }

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where: where as never,
      select: DETAIL_SELECT,
      orderBy: orderBy as never,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.property.count({ where: where as never }),
  ])

  return { rows, total }
}

export async function getProperty(actor: Actor, id: string) {
  // Scope is in the WHERE, not a post-fetch check: a scoped-out row is
  // indistinguishable from a missing one, which is the point.
  const row = await prisma.property.findFirst({
    where: { ...scopeForProperty(actor), id },
    select: DETAIL_SELECT,
  })
  if (!row) throw notFound('Property not found')
  return row
}

/** Distinct cities present in the actor's scope — powers the filter dropdown. */
export async function listPropertyCities(actor: Actor) {
  const rows = await prisma.property.findMany({
    where: { ...scopeForProperty(actor), archivedAt: null },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })
  return rows.map((r) => r.city)
}
