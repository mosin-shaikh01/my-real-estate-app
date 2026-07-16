import { describe, expect, it } from 'vitest'
import * as shared from '@app/shared'
import * as prismaEnums from '../src/generated/prisma/enums.js'

// ============================================================================
// The only thing standing between you and a silent enum drift.
// ============================================================================
// packages/shared hand-writes its enums because it must never import
// @prisma/client (that would drag the Prisma runtime into the browser bundle).
// The cost of that isolation is drift risk. This test is how it's bought off.
//
// If this fails: someone changed prisma/schema.prisma without updating
// packages/shared/src/enums.ts, or vice versa. Fix the mismatch -- do not
// weaken the test.
// ============================================================================

const PAIRS: ReadonlyArray<[string, readonly string[], Record<string, string>]> = [
  ['UserStatus', shared.userStatusSchema.options, prismaEnums.UserStatus],
  ['PermissionEffect', shared.permissionEffectSchema.options, prismaEnums.PermissionEffect],
  ['PropertyType', shared.propertyTypeSchema.options, prismaEnums.PropertyType],
  ['ListingType', shared.listingTypeSchema.options, prismaEnums.ListingType],
  ['PropertyStatus', shared.propertyStatusSchema.options, prismaEnums.PropertyStatus],
  ['Visibility', shared.visibilitySchema.options, prismaEnums.Visibility],
  ['FurnishedStatus', shared.furnishedStatusSchema.options, prismaEnums.FurnishedStatus],
  ['Facing', shared.facingSchema.options, prismaEnums.Facing],
  ['ConstructionStatus', shared.constructionStatusSchema.options, prismaEnums.ConstructionStatus],
  ['MediaType', shared.mediaTypeSchema.options, prismaEnums.MediaType],
  ['ClientPriority', shared.clientPrioritySchema.options, prismaEnums.ClientPriority],
  ['FollowUpStatus', shared.followUpStatusSchema.options, prismaEnums.FollowUpStatus],
  ['InteractionType', shared.interactionTypeSchema.options, prismaEnums.InteractionType],
  ['AssignmentStatus', shared.assignmentStatusSchema.options, prismaEnums.AssignmentStatus],
  ['DealType', shared.dealTypeSchema.options, prismaEnums.DealType],
]

describe('shared enums match the Prisma schema', () => {
  it.each(PAIRS)('%s', (_name, sharedOptions, prismaEnum) => {
    expect([...sharedOptions].sort()).toEqual(Object.values(prismaEnum).sort())
  })

  it('covers every enum Prisma generates (nothing silently unguarded)', () => {
    const generated = Object.keys(prismaEnums).filter(
      (k) => typeof (prismaEnums as Record<string, unknown>)[k] === 'object',
    )
    const covered = PAIRS.map(([name]) => name)
    expect(generated.sort()).toEqual(covered.sort())
  })
})

describe('permission catalog', () => {
  it('has no duplicate keys', () => {
    const keys = shared.PERMISSIONS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('derives every key from its resource/action/field triple', () => {
    for (const p of shared.PERMISSIONS) {
      const field = 'field' in p ? (p.field as string) : undefined
      const expected = field ? `${p.resource}.${field}.${p.action}` : `${p.resource}.${p.action}`
      expect(p.key).toBe(expected)
    }
  })

  it('never grants an agent the sensitive fields', () => {
    // Regression guard on the actual security boundary, not a style rule.
    const forbidden = [
      'client.budget.view',
      'client.internalNotes.view',
      'property.internalNotes.view',
      'agent.commission.view',
      'report.export',
      'client.list.all',
      'property.list.all',
    ] as const
    for (const key of forbidden) {
      expect(shared.AGENT_PERMISSIONS).not.toContain(key)
    }
  })

  it('gives super admin every permission', () => {
    expect([...shared.SUPER_ADMIN_PERMISSIONS].sort()).toEqual([...shared.PERMISSION_KEYS].sort())
  })
})
