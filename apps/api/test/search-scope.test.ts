import { describe, expect, it } from 'vitest'
import { AGENT_PERMISSIONS } from '@app/shared'
import { buildActor } from '../src/auth/permissions.js'
import { scopeForProperty } from '../src/auth/scope.js'

// ============================================================================
// The search scope-composition trap
// ============================================================================
// A search that SPREADS a scope and then adds its OWN top-level `OR` for the
// search terms silently OVERWRITES any `OR` the scope carried (two `OR` keys,
// last wins) — the row-level restriction vanishes and the search returns rows it
// shouldn't. It leaked once (an agent's search returned other agents' inventory)
// and no unit test saw it; only diffing search results against the scoped list
// did.
//
// The agent PROPERTY scope is currently strict (assignedAgentId = self, no OR),
// so this specific clobber isn't reachable through it today. But the AND-
// composition pattern is the standing defence — any scope that gains an OR later
// (a widened role, a client scope) is protected for free. This test pins both:
// the current strict shape, and the principle.
// ============================================================================

const agent = buildActor({
  userId: 'agent-1',
  sessionId: 's1',
  rolePermissions: AGENT_PERMISSIONS,
  userPermissions: [],
})

describe('scope composition in search', () => {
  it('the agent property scope is strict (assignedAgentId only, no OR to clobber)', () => {
    const scope = scopeForProperty(agent)
    expect(scope).toEqual({ deletedAt: null, assignedAgentId: 'agent-1' })
    expect(scope.OR).toBeUndefined()
  })

  it('AND composition is safe even for a scope that DOES carry an OR', () => {
    // Synthetic scope-with-OR (as a widened role would produce), to pin the
    // principle regardless of the current strict shape.
    const scopeWithOr = { deletedAt: null, OR: [{ assignedAgentId: 'a' }, { featured: true }] }
    const searchOr = [{ title: { contains: 'x' } }, { code: { contains: 'x' } }]

    // The BUG, reproduced: spread the scope, then add a top-level OR — the
    // scope's OR is replaced by the search terms, and the restriction is lost.
    const buggy = { ...scopeWithOr, OR: searchOr }
    expect(buggy.OR).toBe(searchOr)
    expect(buggy.OR).not.toBe(scopeWithOr.OR)

    // The FIX search uses: AND, so both predicates survive independently.
    const safe = { AND: [scopeWithOr, { OR: searchOr }] }
    expect(safe.AND[0]?.OR).toBeDefined() // scope's restriction intact
    expect(safe.AND[1].OR).toBe(searchOr) // search terms intact
  })
})
