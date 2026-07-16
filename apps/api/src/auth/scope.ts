import type { Prisma } from '../generated/prisma/client.js'
import type { Actor } from './permissions.js'

// ============================================================================
// The scope resolver — row-level visibility
// ============================================================================
// ONE place. Not `if (isAgent) where.agentId = me` in forty handlers, and not a
// global Prisma query extension either — that is Rails' default_scope, and the
// footguns are known: findUnique cannot take an injected predicate, scoped-out
// rows become 404s you cannot override, and admin bypass turns ugly.
//
// Note that "sees everything" is ITSELF a permission (`*.list.all`). That is
// what keeps scoping data-driven without dragging in a policy engine. There are
// exactly two shapes per resource. No CASL, no OPA — a DSL and type gymnastics
// to express `{} | { assignedAgentId }` is the wrong trade at this size.
// ============================================================================

export function scopeForClient(actor: Actor): Prisma.ClientWhereInput {
  const base: Prisma.ClientWhereInput = { deletedAt: null }
  if (actor.has('client.list.all')) return base
  return { ...base, assignedAgentId: actor.userId }
}

export function scopeForProperty(actor: Actor): Prisma.PropertyWhereInput {
  const base: Prisma.PropertyWhereInput = { deletedAt: null }
  if (actor.has('property.list.all')) return base

  // Shared-pool model: an agent browses the whole listable inventory so they can
  // match stock to their clients — NOT just their own listings. Assignment marks
  // who is responsible, not who may look.
  //
  // Three clauses, OR'd:
  //   1. everything that is not off-market (PUBLIC/INTERNAL) — the browsable pool
  //   2. anything assigned to them            — including off-market they handle
  //   3. anything assigned to one of their clients — the "Open Client -> View
  //      Assigned Properties" workflow, including off-market shortlisted stock
  //
  // PRIVATE (off-market) stays restricted to the people handling it. Field
  // redaction is unchanged: a browsed listing shows its price but hides another
  // agent's internal notes.
  return {
    ...base,
    OR: [
      { visibility: { not: 'PRIVATE' } },
      { assignedAgentId: actor.userId },
      { assignments: { some: { removedAt: null, client: { assignedAgentId: actor.userId } } } },
    ],
  }
}

export function scopeForAgent(actor: Actor): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { deletedAt: null }
  if (actor.has('agent.list')) return base
  // An agent has no agent.list permission at all, so this is defence in depth
  // rather than a real branch: they can only ever resolve to themselves.
  return { ...base, id: actor.userId }
}
