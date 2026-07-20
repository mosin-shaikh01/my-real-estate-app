import type { Request } from 'express'
import type { OwnerCreateInput, OwnerUpdateInput } from '@app/shared'
import { conflict, notFound } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import { diffForLog, humanizeFields, logActivityTx } from './activity-service.js'

// Property Owner (master). Admin-only surface (owner.* permissions) — no scope
// resolver, the route guard is the whole gate. Duplicate detection is a WARNING
// exposed via findOwnerByMobile; it never blocks a create.

const normalizeMobile = (m: string) => m.replace(/\D/g, '')
const orNull = (v: string | null | undefined) => (v == null || v === '' ? null : v)

const OWNER_SELECT = {
  id: true,
  code: true,
  fullName: true,
  mobile: true,
  altMobile: true,
  email: true,
  address: true,
  city: true,
  pan: true,
  aadhaar: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { properties: { where: { deletedAt: null } } } },
} satisfies Prisma.PropertyOwnerSelect

export interface OwnerListParams {
  q?: string
  page: number
  pageSize: number
  /** true = the Deleted view (soft-deleted owners only). Default: active only. */
  deleted?: boolean
}

export async function listOwners(params: OwnerListParams) {
  const where: Prisma.PropertyOwnerWhereInput = params.deleted
    ? { deletedAt: { not: null } }
    : { deletedAt: null }
  const q = params.q?.trim()
  if (q) {
    const digits = q.replace(/\D/g, '')
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      ...(digits ? [{ mobileNormalized: { contains: digits } }] : []),
    ]
  }

  const take = Math.min(Math.max(params.pageSize, 1), 100)
  const page = Math.max(params.page, 1)
  const [rows, total] = await Promise.all([
    prisma.propertyOwner.findMany({
      where,
      select: OWNER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    }),
    prisma.propertyOwner.count({ where }),
  ])
  return { rows, total, page, pageSize: take }
}

export async function getOwner(id: string) {
  const owner = await prisma.propertyOwner.findFirst({
    where: { id, deletedAt: null },
    select: OWNER_SELECT,
  })
  if (!owner) throw notFound('Owner not found')
  return owner
}

/** Compact list for the property form's owner picker. */
export async function listOwnerOptions() {
  return prisma.propertyOwner.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, fullName: true, mobile: true },
    orderBy: { fullName: 'asc' },
    take: 1000,
  })
}

/**
 * Duplicate detection — a WARNING, never a block. Returns the first active owner
 * with the same normalised mobile (optionally excluding one id, for edits).
 */
export async function findOwnerByMobile(mobile: string, excludeId?: string) {
  const digits = normalizeMobile(mobile)
  if (digits.length < 6) return null
  // Match on the last 10 digits so a country code ("+91…") on either the stored
  // or searched number doesn't defeat detection. Cheap on this table; the goal is
  // a helpful warning, not a hard uniqueness constraint.
  const key = digits.length >= 10 ? digits.slice(-10) : digits
  return prisma.propertyOwner.findFirst({
    where: {
      mobileNormalized: { endsWith: key },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, code: true, fullName: true, mobile: true },
  })
}

export async function createOwner(actorId: string, input: OwnerCreateInput, req: Request) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.propertyOwner.create({
      data: {
        fullName: input.fullName,
        mobile: input.mobile.trim(),
        mobileNormalized: normalizeMobile(input.mobile),
        altMobile: orNull(input.altMobile),
        email: orNull(input.email),
        address: orNull(input.address),
        city: orNull(input.city),
        pan: orNull(input.pan),
        aadhaar: orNull(input.aadhaar),
        notes: orNull(input.notes),
      },
      select: OWNER_SELECT,
    })
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'owner.created',
      entityType: 'property_owner',
      entityId: owner.id,
      summary: `Created owner ${owner.fullName}`,
      req,
    })
    return owner
  })
}

export async function updateOwner(actorId: string, id: string, input: OwnerUpdateInput, req: Request) {
  // Full row (incl. mobileNormalized) so the diff compares like-for-like.
  const before = await prisma.propertyOwner.findFirst({ where: { id, deletedAt: null } })
  if (!before) throw notFound('Owner not found')

  const data: Prisma.PropertyOwnerUpdateInput = {
    ...(input.fullName !== undefined && { fullName: input.fullName }),
    ...(input.mobile !== undefined && {
      mobile: input.mobile.trim(),
      mobileNormalized: normalizeMobile(input.mobile),
    }),
    ...('altMobile' in input && { altMobile: orNull(input.altMobile) }),
    ...('email' in input && { email: orNull(input.email) }),
    ...('address' in input && { address: orNull(input.address) }),
    ...('city' in input && { city: orNull(input.city) }),
    ...('pan' in input && { pan: orNull(input.pan) }),
    ...('aadhaar' in input && { aadhaar: orNull(input.aadhaar) }),
    ...('notes' in input && { notes: orNull(input.notes) }),
  }

  const { changed, values } = diffForLog(
    before as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
  )
  // No real change → no write, no activity log, no updatedAt bump.
  if (changed.length === 0) return getOwner(id)

  return prisma.$transaction(async (tx) => {
    const owner = await tx.propertyOwner.update({
      where: { id },
      // Only the changed columns.
      data: Object.fromEntries(
        Object.entries(data).filter(([k]) => changed.includes(k)),
      ) as Prisma.PropertyOwnerUpdateInput,
      select: OWNER_SELECT,
    })
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'owner.updated',
      entityType: 'property_owner',
      entityId: id,
      summary: `Updated ${owner.code}: ${humanizeFields(changed)}`,
      metadata: { changed, values },
      req,
    })
    return owner
  })
}

export async function deleteOwner(actorId: string, id: string, req: Request) {
  const owner = await getOwner(id)
  // Non-destructive: don't orphan or silently unlink listings. Make the admin
  // reassign first — clearer than nulling ownerId across their properties.
  if (owner._count.properties > 0) {
    throw conflict(
      `${owner.fullName} still owns ${owner._count.properties} propert${owner._count.properties === 1 ? 'y' : 'ies'}. Reassign or remove them first.`,
    )
  }
  await prisma.$transaction(async (tx) => {
    await tx.propertyOwner.update({ where: { id }, data: { deletedAt: new Date() } })
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'owner.deleted',
      entityType: 'property_owner',
      entityId: id,
      summary: `Deleted owner ${owner.fullName}`,
      req,
    })
  })
}

/**
 * Restore a soft-deleted owner — the reverse of deleteOwner, gated by the same
 * owner.delete permission (whoever can delete may undo it). Deleted owners have
 * no properties (delete is guarded on that), so there's nothing to reconcile.
 */
export async function restoreOwner(actorId: string, id: string, req: Request) {
  const existing = await prisma.propertyOwner.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, fullName: true },
  })
  if (!existing) throw notFound('Deleted owner not found')

  return prisma.$transaction(async (tx) => {
    // Select within the tx so the returned row reflects the just-committed state
    // (a non-tx read here would miss the uncommitted deletedAt: null).
    const owner = await tx.propertyOwner.update({
      where: { id },
      data: { deletedAt: null },
      select: OWNER_SELECT,
    })
    await logActivityTx(tx, {
      actorUserId: actorId,
      action: 'owner.restored',
      entityType: 'property_owner',
      entityId: id,
      summary: `Restored owner ${existing.fullName}`,
      req,
    })
    return owner
  })
}
