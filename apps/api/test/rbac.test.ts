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
import {
  canFilterByPrice,
  sortablePropertyFields,
  toPropertyDTO,
  type PropertyRow,
} from '../src/serializers/property-serializer.js'
import { toAgentDTO, type AgentRow } from '../src/serializers/agent-serializer.js'
import {
  toClientDetailDTO,
  type AssignmentRow,
  type InteractionRow,
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
// ---------------------------------------------------------------------------
// Agent serializer — commission redaction
// ---------------------------------------------------------------------------
const AGENT_ROW: AgentRow = {
  id: 'u2',
  fullName: 'Rohan Kulkarni',
  email: 'rohan@demo.local',
  phone: '+91 98201 44556',
  status: 'ACTIVE',
  createdAt: new Date('2026-07-01'),
  agentProfile: {
    address: 'Mumbai',
    experienceYears: 6,
    specialization: 'Residential',
    commissionRate: dec('2.50'),
    photoStorageKey: null,
  },
  _count: { assignedClients: 4, assignedProperties: 3 },
}

describe('agent serializer', () => {
  it('redacts commission from an actor without agent.commission.view', () => {
    // An agent that could read peers' commission rates is a leak even though
    // agents cannot list agents at all — defence in the serializer regardless.
    const noComm = actorWith(SUPER_ADMIN_PERMISSIONS.filter((p) => p !== 'agent.commission.view'))
    const dto = toAgentDTO(AGENT_ROW, noComm)
    expect('commissionRate' in dto).toBe(false)
    expect(dto._redacted).toContain('commissionRate')
  })

  it('shows commission as a string to admin', () => {
    const dto = toAgentDTO(AGENT_ROW, ADMIN)
    expect(dto.commissionRate).toBe('2.50')
    expect(dto._redacted).toEqual([])
  })

  it('surfaces assignment counts', () => {
    const dto = toAgentDTO(AGENT_ROW, ADMIN)
    expect(dto.assignedClientCount).toBe(4)
    expect(dto.assignedPropertyCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Client detail — interactions timeline is NOT gated; client.notes IS
// ---------------------------------------------------------------------------
describe('client detail serializer', () => {
  const interactions: InteractionRow[] = [
    {
      id: 'i1',
      type: 'CALL',
      body: 'Called, no answer. Will retry tomorrow.',
      occurredAt: new Date('2026-07-14'),
      scheduledAt: null,
      outcome: 'No answer',
      author: { id: 'agent-1', fullName: 'Rohan' },
    },
  ]
  const assignments: AssignmentRow[] = [
    { id: 'a1', status: 'SHARED', property: { id: 'p1', code: 'PROP-00001', title: 'Flat', status: 'AVAILABLE' } },
  ]

  it('shows interaction bodies to an agent — it is their own operational log', () => {
    // The bug I nearly shipped: gating interaction bodies behind
    // internalNotes.view would hide an agent's own call notes from them, while
    // they hold client.interaction.create. Operational timeline != admin notes.
    const dto = toClientDetailDTO({ ...ROW, interactions, assignments }, AGENT)
    expect(dto.interactions[0]?.body).toContain('no answer')
    expect(dto.interactions[0]?.authorName).toBe('Rohan')
  })

  it('still redacts the admin-only client.notes field from an agent', () => {
    const dto = toClientDetailDTO({ ...ROW, interactions, assignments }, AGENT)
    expect('notes' in dto).toBe(false)
  })

  it('lists assigned properties with their assignment status', () => {
    const dto = toClientDetailDTO({ ...ROW, interactions, assignments }, ADMIN)
    expect(dto.assignedProperties[0]).toMatchObject({ code: 'PROP-00001', assignmentStatus: 'SHARED' })
  })
})

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

// ---------------------------------------------------------------------------
// Property serializer — same three layers, second resource
// ---------------------------------------------------------------------------
const PROPERTY: PropertyRow = {
  id: 'p1',
  code: 'PROP-00001',
  title: '3 BHK Sea-Facing Apartment',
  description: 'A flat.',
  propertyType: 'APARTMENT',
  listingType: 'BOTH',
  status: 'AVAILABLE',
  constructionStatus: 'READY_TO_MOVE',
  visibility: 'PUBLIC',
  featured: true,
  salePrice: dec('72500000.00'),
  rentPricePerMonth: dec('185000.00'),
  securityDeposit: dec('1110000.00'),
  maintenanceCharges: dec('12000.00'),
  negotiable: true,
  areaSqft: dec('1850.00'),
  bedrooms: 3,
  bathrooms: 3,
  parking: 2,
  furnished: 'SEMI_FURNISHED',
  facing: 'WEST',
  floor: 14,
  totalFloor: 22,
  builtYear: 2019,
  address: 'Bandra West',
  locality: 'Bandra West',
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  pincode: '400050',
  latitude: dec('19.055000'),
  longitude: dec('72.826500'),
  videoUrl: null,
  internalNotes: 'Owner will take 6.9cr for a quick close.',
  assignedAgentId: 'agent-1',
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
  archivedAt: null,
  assignedAgent: { id: 'agent-1', fullName: 'Rohan' },
  amenities: [{ amenity: { id: 'a1', name: 'Swimming Pool', slug: 'swimming-pool', category: 'Recreation' } }],
  media: [{ id: 'm2', type: 'IMAGE', storageKey: 'x/2.jpg', isCover: true, sortOrder: 1 }],
  _count: { assignments: 2 },
}

describe('property serializer', () => {
  it('omits internal notes from an agent — the negotiating position stays private', () => {
    const dto = toPropertyDTO(PROPERTY, AGENT)
    expect('internalNotes' in dto).toBe(false)
    expect(dto._redacted).toContain('internalNotes')
  })

  it('keeps pricing for an agent — they legitimately hold property.price.view', () => {
    const dto = toPropertyDTO(PROPERTY, AGENT)
    expect(dto.salePrice).toBe('72500000.00')
    expect(dto.rentPricePerMonth).toBe('185000.00')
  })

  it('omits every price field when property.price.view is revoked', () => {
    // Per-agent DENY overrides make this reachable today, and the seeded
    // `public` role will hit these same endpoints later.
    const noPrice = actorWith(AGENT_PERMISSIONS.filter((p) => p !== 'property.price.view'))
    const dto = toPropertyDTO(PROPERTY, noPrice)
    expect('salePrice' in dto).toBe(false)
    expect('rentPricePerMonth' in dto).toBe(false)
    expect('securityDeposit' in dto).toBe(false)
    expect('maintenanceCharges' in dto).toBe(false)
  })

  it('gives admin everything, redacting nothing', () => {
    const dto = toPropertyDTO(PROPERTY, ADMIN)
    expect(dto._redacted).toEqual([])
    expect(dto.internalNotes).toContain('6.9cr')
  })

  it('serialises all money and coordinates as strings', () => {
    const dto = toPropertyDTO(PROPERTY, ADMIN)
    expect(typeof dto.salePrice).toBe('string')
    expect(typeof dto.areaSqft).toBe('string')
    // Coordinates are Decimal(9,6) — a float would drift the pin.
    expect(typeof dto.latitude).toBe('string')
  })

  it('picks the cover image', () => {
    expect(toPropertyDTO(PROPERTY, ADMIN).coverMediaId).toBe('m2')
  })

  it('does not let an agent sort by price when they cannot see it', () => {
    const noPrice = actorWith(AGENT_PERMISSIONS.filter((p) => p !== 'property.price.view'))
    expect(sortablePropertyFields(noPrice)).not.toContain('salePrice')
    expect(canFilterByPrice(noPrice)).toBe(false)
    expect(sortablePropertyFields(ADMIN)).toContain('salePrice')
    expect(canFilterByPrice(ADMIN)).toBe(true)
  })
})
