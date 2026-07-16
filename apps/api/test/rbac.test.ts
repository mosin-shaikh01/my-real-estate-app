import { describe, expect, it } from 'vitest'
import { AGENT_PERMISSIONS, SUPER_ADMIN_PERMISSIONS, type PermissionKey } from '@app/shared'
import { buildActor, resolvePermissions } from '../src/auth/permissions.js'
import { scopeForClient, scopeForProperty } from '../src/auth/scope.js'
import {
  filterableClientFields,
  sortableClientFields,
  toClientDTO,
  type ClientRow,
} from '../src/serializers/client-serializer.js'

// ============================================================================
// The four tests that matter.
// ============================================================================
// Not coverage-chasing. This is the surface where a bug is a DATA BREACH rather
// than a visual glitch, and every function under test is pure — no fixtures, no
// database, no HTTP.
// ============================================================================

const actorWith = (perms: readonly string[], userId = 'agent-1') =>
  buildActor({ userId, sessionId: 's1', rolePermissions: perms, userPermissions: [] })

const AGENT = actorWith(AGENT_PERMISSIONS)
const ADMIN = actorWith(SUPER_ADMIN_PERMISSIONS, 'admin-1')

// ---------------------------------------------------------------------------
// 1. Permission resolver
// ---------------------------------------------------------------------------
describe('permission resolver: (roles ∪ ALLOWs) \\ DENYs', () => {
  it('unions role permissions', () => {
    const p = resolvePermissions({
      userId: 'u',
      sessionId: 's',
      rolePermissions: ['client.list', 'client.view'],
      userPermissions: [],
    })
    expect([...p].sort()).toEqual(['client.list', 'client.view'])
  })

  it('adds per-user ALLOW grants on top of roles', () => {
    const p = resolvePermissions({
      userId: 'u',
      sessionId: 's',
      rolePermissions: ['client.list'],
      userPermissions: [{ key: 'client.budget.view', effect: 'ALLOW' }],
    })
    expect(p.has('client.budget.view' as PermissionKey)).toBe(true)
  })

  it('DENY beats a role grant', () => {
    const p = resolvePermissions({
      userId: 'u',
      sessionId: 's',
      rolePermissions: ['client.list', 'client.phone.view'],
      userPermissions: [{ key: 'client.phone.view', effect: 'DENY' }],
    })
    expect(p.has('client.phone.view' as PermissionKey)).toBe(false)
  })

  it('DENY beats an explicit ALLOW regardless of order', () => {
    // The whole point of deny-wins: "revoke this ONE agent's budget access"
    // must be possible without editing the shared role.
    const p = resolvePermissions({
      userId: 'u',
      sessionId: 's',
      rolePermissions: [],
      userPermissions: [
        { key: 'client.budget.view', effect: 'ALLOW' },
        { key: 'client.budget.view', effect: 'DENY' },
      ],
    })
    expect(p.has('client.budget.view' as PermissionKey)).toBe(false)
  })

  it('has/hasAny/hasAll behave', () => {
    expect(AGENT.has('client.list')).toBe(true)
    expect(AGENT.has('client.budget.view')).toBe(false)
    expect(AGENT.hasAny(['client.budget.view', 'client.list'])).toBe(true)
    expect(AGENT.hasAll(['client.budget.view', 'client.list'])).toBe(false)
    expect(ADMIN.hasAll(['client.budget.view', 'client.list'])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Scope resolver
// ---------------------------------------------------------------------------
describe('scope resolver', () => {
  it('scopes an agent to their assigned clients', () => {
    expect(scopeForClient(AGENT)).toEqual({ deletedAt: null, assignedAgentId: 'agent-1' })
  })

  it('lets client.list.all see everything (scope-widening is itself a permission)', () => {
    expect(scopeForClient(ADMIN)).toEqual({ deletedAt: null })
  })

  it('always excludes soft-deleted rows, for both actors', () => {
    // There is no global soft-delete middleware by design; the resolver is the
    // only thing standing between a deleted row and a response.
    expect(scopeForClient(AGENT).deletedAt).toBeNull()
    expect(scopeForClient(ADMIN).deletedAt).toBeNull()
  })

  it("includes properties assigned to the agent's clients, not just to the agent", () => {
    // The spec's own workflow -- Open Client -> View Assigned Properties -- is
    // unreachable without the second clause.
    const scope = scopeForProperty(AGENT)
    expect(scope.OR).toHaveLength(2)
    expect(scope.OR?.[0]).toEqual({ assignedAgentId: 'agent-1' })
    expect(JSON.stringify(scope.OR?.[1])).toContain('assignedAgentId')
  })
})

// ---------------------------------------------------------------------------
// 3. Redaction serializer
// ---------------------------------------------------------------------------
const dec = (v: string) => ({ toFixed: () => v })

const ROW: ClientRow = {
  id: 'c1',
  code: 'CLI-00001',
  fullName: 'Vikram Malhotra',
  email: 'vikram@example.com',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
  priority: 'HIGH',
  source: 'Referral',
  notes: 'Decision-maker is his wife',
  followUpStatus: 'NEGOTIATING',
  lastContactAt: new Date('2026-07-14'),
  nextFollowUp: null,
  assignedAgentId: 'agent-1',
  createdAt: new Date('2026-07-01'),
  assignedAgent: { id: 'agent-1', fullName: 'Rohan' },
  requirements: [
    {
      id: 'r1',
      budgetMin: dec('60000000.00'),
      budgetMax: dec('80000000.00'),
      propertyType: 'APARTMENT',
      bedrooms: 3,
      city: 'Mumbai',
      locality: 'Bandra West',
    },
  ],
  _count: { assignments: 2 },
}

describe('redaction serializer', () => {
  it('omits budget from an agent — the key must be ABSENT, not null', () => {
    const dto = toClientDTO(ROW, AGENT)
    // `in` rather than a truthiness check: null would legitimately mean "no
    // budget recorded", and the UI must distinguish hidden from empty.
    expect('budgetMin' in (dto.requirement ?? {})).toBe(false)
    expect('budgetMax' in (dto.requirement ?? {})).toBe(false)
  })

  it('omits internal notes from an agent', () => {
    expect('notes' in toClientDTO(ROW, AGENT)).toBe(false)
  })

  it('keeps phone and email for an agent — they hold those permissions', () => {
    const dto = toClientDTO(ROW, AGENT)
    expect(dto.phone).toBe('+91 98765 43210')
    expect(dto.email).toBe('vikram@example.com')
  })

  it('gives admin everything, redacting nothing', () => {
    const dto = toClientDTO(ROW, ADMIN)
    expect(dto._redacted).toEqual([])
    expect(dto.requirement?.budgetMin).toBe('60000000.00')
    expect(dto.notes).toBe('Decision-maker is his wife')
  })

  it('reports what it stripped, so the UI can show a lock not a blank', () => {
    expect(toClientDTO(ROW, AGENT)._redacted).toEqual([
      'notes',
      'requirement.budgetMin',
      'requirement.budgetMax',
    ])
  })

  it('redacts phone when the permission is absent', () => {
    const noPhone = actorWith(AGENT_PERMISSIONS.filter((p) => p !== 'client.phone.view'))
    const dto = toClientDTO(ROW, noPhone)
    expect('phone' in dto).toBe(false)
    expect('whatsapp' in dto).toBe(false)
    expect(dto._redacted).toContain('phone')
  })

  it('serialises money as a string, never a number', () => {
    // Decimal does not survive a JS number; a number here is a precision bug
    // waiting for a ₹99,99,99,999.99 listing.
    expect(typeof toClientDTO(ROW, ADMIN).requirement?.budgetMin).toBe('string')
  })

  it('never leaks a raw Decimal or Date object', () => {
    const json = JSON.parse(JSON.stringify(toClientDTO(ROW, ADMIN)))
    expect(typeof json.createdAt).toBe('string')
    expect(typeof json.lastContactAt).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// 4. The leak most designs miss
// ---------------------------------------------------------------------------
describe('sort/filter allowlists are permission-filtered', () => {
  it('does not let an agent sort by a budget they cannot see', () => {
    // Sorting by a hidden column leaks it: row order IS the value.
    expect(sortableClientFields(AGENT)).not.toContain('budgetMax')
    expect(sortableClientFields(ADMIN)).toContain('budgetMax')
  })

  it('does not let an agent filter by budget', () => {
    // Narrowing ?minBudget until the result set changes is a binary search of
    // a value they were never shown.
    expect(filterableClientFields(AGENT)).not.toContain('minBudget')
    expect(filterableClientFields(AGENT)).not.toContain('maxBudget')
    expect(filterableClientFields(ADMIN)).toContain('minBudget')
  })

  it('always allows the non-sensitive fields', () => {
    for (const f of ['fullName', 'code', 'createdAt']) {
      expect(sortableClientFields(AGENT)).toContain(f)
    }
  })
})
