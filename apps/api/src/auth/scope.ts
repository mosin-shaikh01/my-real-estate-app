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

  // Admin (property.list.all): unrestricted — sees every property, assigned or
  // not, so an UNASSIGNED property is admin-only until it is assigned.
  if (actor.has('property.list.all')) return base

  // STRICT RBAC. An agent sees ONLY properties explicitly assigned to them by an
  // admin. There is no browse pool, no client-shortlist widening, no visibility
  // shortcut: assignedAgentId is the single, exclusive gate. This flows through
  // every read — list, search, filters, detail, dashboard counts, media — and
  // WRITE services scope-check with the same predicate, so an agent cannot
  // touch another agent's property even by forging an id. Reassignment (an admin
  // changing assignedAgentId) instantly moves the property between agents'
  // scopes on the next request.
  return { ...base, assignedAgentId: actor.userId }
}

export function scopeForAgent(actor: Actor): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { deletedAt: null }
  if (actor.has('agent.list')) return base
  // An agent has no agent.list permission at all, so this is defence in depth
  // rather than a real branch: they can only ever resolve to themselves.
  return { ...base, id: actor.userId }
}
