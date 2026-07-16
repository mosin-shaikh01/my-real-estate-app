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

  // An agent sees properties assigned to them OR assigned to one of their
  // clients. The second clause is not optional: the spec's own workflow is
  // "Open Client -> View Assigned Properties", which is unreachable without it.
  return {
    ...base,
    OR: [
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
