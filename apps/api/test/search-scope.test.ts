import { describe, expect, it } from 'vitest'
import { AGENT_PERMISSIONS } from '@app/shared'
import { buildActor } from '../src/auth/permissions.js'
import { scopeForProperty } from '../src/auth/scope.js'

// ============================================================================
// The search scope-composition trap
// ============================================================================
// scopeForProperty for an AGENT returns an object containing `OR` — the
// "assigned to me OR to my client" clause. A search that spreads that scope and
// then adds its OWN top-level `OR` for the search terms silently OVERWRITES the
// scope's OR (two `OR` keys, last wins), and the agent's search returns every
// property. It leaked in the demo and a unit test never saw it — only diffing
// search results against the scoped list did.
//
// This pins the property of the scope that makes the bug possible, so a future
// refactor of either side gets a loud reminder.
// ============================================================================

const agent = buildActor({
  userId: 'agent-1',
  sessionId: 's1',
  rolePermissions: AGENT_PERMISSIONS,
  userPermissions: [],
})

describe('search must compose scope with AND, not spread it', () => {
  it('the agent property scope contains an OR that a naive spread would clobber', () => {
    const scope = scopeForProperty(agent)
    // If this ever stops being true, the spread-then-OR bug becomes impossible
    // and this test can relax — but until then, the OR is exactly the thing a
    // second top-level OR would overwrite.
    expect(scope.OR).toBeDefined()
    expect(scope.OR?.length).toBeGreaterThan(1)
  })

  it('demonstrates the clobber: spreading loses the scope OR', () => {
    const scope = scopeForProperty(agent)
    const searchOr = [{ title: { contains: 'x' } }, { code: { contains: 'x' } }]

    // The BUG, reproduced: spread the scope, then add a top-level OR.
    const buggy = { ...scope, OR: searchOr }
    // The scope's OR is gone — replaced by the search terms. deletedAt survives,
    // but the row-level restriction does not.
    expect(buggy.OR).toBe(searchOr)
    expect(buggy.OR).not.toBe(scope.OR)

    // The FIX: compose with AND so both predicates survive independently.
    const safe = { AND: [scope, { OR: searchOr }] }
    expect(safe.AND[0]).toBe(scope)
    expect(safe.AND[0]?.OR).toBeDefined() // scope's row restriction intact
    expect(safe.AND[1].OR).toBe(searchOr) // search terms intact
  })
})
