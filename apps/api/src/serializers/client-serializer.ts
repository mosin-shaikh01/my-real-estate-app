import type { Actor } from '../auth/permissions.js'

// ============================================================================
// Boundary serializer — column-level visibility
// ============================================================================
// A PURE FUNCTION at the response boundary. Deliberately not:
//
//   * a per-actor Prisma `select` — dynamic select collapses result types into
//     unions, and business logic frequently needs a field the actor cannot SEE
//     (matching a property against a budget the agent may not view). Filtering
//     at fetch time makes that impossible.
//   * a Prisma result extension — needs an ambient actor via AsyncLocalStorage.
//     Magic; breaks in seeds and jobs; admin bypass gets ugly.
//
// TWO RULES:
//   1. Redact by OMISSION, not null. `null` legitimately means "no phone
//      recorded" — the UI must distinguish hidden from empty.
//   2. Report what was stripped in `_redacted`, so the UI renders a lock
//      instead of silently vanishing a column. Cheap; it is the difference
//      between feeling deliberate and feeling broken.
// ============================================================================

/** Money is a STRING on the wire. Prisma Decimal does not JSON-serialize. */
type Decimalish = { toFixed: (d: number) => string } | null

const money = (d: Decimalish): string | null => (d == null ? null : d.toFixed(2))

export interface ClientRow {
  id: string
  code: string
  fullName: string
  email: string | null
  phone: string
  whatsapp: string | null
  priority: string
  source: string | null
  notes: string | null
  followUpStatus: string
  lastContactAt: Date | null
  nextFollowUp: Date | null
  assignedAgentId: string | null
  createdAt: Date
  assignedAgent?: { id: string; fullName: string } | null
  requirements?: Array<{
    id: string
    budgetMin: Decimalish
    budgetMax: Decimalish
    propertyType: string | null
    bedrooms: number | null
    city: string | null
    locality: string | null
  }>
  _count?: { assignments: number }
}

export interface ClientDTO {
  id: string
  code: string
  fullName: string
  priority: string
  followUpStatus: string
  source: string | null
  lastContactAt: string | null
  nextFollowUp: string | null
  createdAt: string
  assignedAgent: { id: string; fullName: string } | null
  assignedPropertyCount: number

  // All optional: absent means REDACTED, null means empty.
  email?: string | null
  phone?: string
  whatsapp?: string | null
  notes?: string | null
  requirement?: {
    id: string
    propertyType: string | null
    bedrooms: number | null
    city: string | null
    locality: string | null
    budgetMin?: string | null
    budgetMax?: string | null
  }

  /** What the actor was not allowed to see. Drives the UI's lock affordance. */
  _redacted: string[]
}

export function toClientDTO(row: ClientRow, actor: Actor): ClientDTO {
  const redacted: string[] = []

  const dto: ClientDTO = {
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    priority: row.priority,
    followUpStatus: row.followUpStatus,
    source: row.source,
    lastContactAt: row.lastContactAt?.toISOString() ?? null,
    nextFollowUp: row.nextFollowUp?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    assignedAgent: row.assignedAgent ?? null,
    assignedPropertyCount: row._count?.assignments ?? 0,
    _redacted: redacted,
  }

  if (actor.has('client.phone.view')) {
    dto.phone = row.phone
    dto.whatsapp = row.whatsapp
  } else {
    redacted.push('phone', 'whatsapp')
  }

  if (actor.has('client.email.view')) {
    dto.email = row.email
  } else {
    redacted.push('email')
  }

  if (actor.has('client.internalNotes.view')) {
    dto.notes = row.notes
  } else {
    redacted.push('notes')
  }

  const req = row.requirements?.[0]
  if (req) {
    dto.requirement = {
      id: req.id,
      propertyType: req.propertyType,
      bedrooms: req.bedrooms,
      city: req.city,
      locality: req.locality,
    }
    if (actor.has('client.budget.view')) {
      dto.requirement.budgetMin = money(req.budgetMin)
      dto.requirement.budgetMax = money(req.budgetMax)
    } else {
      redacted.push('requirement.budgetMin', 'requirement.budgetMax')
    }
  }

  return dto
}

// ============================================================================
// Detail view — the list DTO plus interactions and a fuller requirement
// ============================================================================
// A separate DTO rather than bloating the list row: the list renders 25 clients
// and must stay lean, while the detail page shows one client in full. Same
// redaction rules apply — the timeline and requirement obey the same
// permissions as everything else.

export interface InteractionRow {
  id: string
  type: string
  body: string | null
  occurredAt: Date
  scheduledAt: Date | null
  outcome: string | null
  author: { id: string; fullName: string } | null
}

export interface ClientDetailDTO extends ClientDTO {
  interactions: Array<{
    id: string
    type: string
    body: string | null
    occurredAt: string
    scheduledAt: string | null
    outcome: string | null
    authorName: string | null
  }>
  assignedProperties: Array<{
    id: string
    propertyId: string
    code: string
    title: string
    status: string
    assignmentStatus: string
  }>
}

export interface AssignmentRow {
  id: string
  status: string
  property: { id: string; code: string; title: string; status: string; assignedAgentId: string | null }
}

export function toClientDetailDTO(
  row: ClientRow & { interactions?: InteractionRow[]; assignments?: AssignmentRow[] },
  actor: Actor,
): ClientDetailDTO {
  const base = toClientDTO(row, actor)

  return {
    ...base,
    interactions: (row.interactions ?? []).map((i) => ({
      id: i.id,
      type: i.type,
      // Interaction bodies are NOT gated. This is the shared operational
      // timeline — an agent logs "called, no answer" and must read it back.
      // The admin-only commercial notes live on Client.notes, which IS gated by
      // client.internalNotes.view. Two different kinds of note; don't conflate
      // them, or agents can't see their own call log.
      body: i.body,
      occurredAt: i.occurredAt.toISOString(),
      scheduledAt: i.scheduledAt?.toISOString() ?? null,
      outcome: i.outcome,
      authorName: i.author?.fullName ?? null,
    })),
    // Strict RBAC reaches the shortlist too: an agent sees only the properties
    // that are BOTH shortlisted for this client AND assigned to them. An admin
    // (property.list.all) sees the whole shortlist. Without this, an agent could
    // read another agent's property code/title through their client's page.
    assignedProperties: (row.assignments ?? [])
      .filter(
        (a) => actor.has('property.list.all') || a.property.assignedAgentId === actor.userId,
      )
      .map((a) => ({
        id: a.id,
        propertyId: a.property.id,
        code: a.property.code,
        title: a.property.title,
        status: a.property.status,
        assignmentStatus: a.status,
      })),
  }
}

// ============================================================================
// Permission-filtered sort/filter allowlists
// ============================================================================
// THE LEAK MOST DESIGNS MISS. An agent without client.budget.view who can sort
// by budget, or filter ?minBudget=5000000, infers the values from result
// ordering and set membership — and the redaction above becomes decorative.
//
// This is a security control, not a convenience. It is near-impossible to
// retrofit once handlers are parsing query params ad hoc, which is why it lives
// beside the serializer rather than in a route.
// ============================================================================

const ALWAYS_SORTABLE = ['fullName', 'code', 'createdAt', 'lastContactAt', 'nextFollowUp', 'priority'] as const

export function sortableClientFields(actor: Actor): string[] {
  const fields: string[] = [...ALWAYS_SORTABLE]
  if (actor.has('client.budget.view')) fields.push('budgetMax')
  return fields
}

export function filterableClientFields(actor: Actor): string[] {
  const fields = ['q', 'followUpStatus', 'priority', 'city', 'assignedAgentId']
  if (actor.has('client.budget.view')) fields.push('minBudget', 'maxBudget')
  return fields
}
