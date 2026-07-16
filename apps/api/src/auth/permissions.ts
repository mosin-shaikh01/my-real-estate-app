import type { PermissionKey } from '@app/shared'

// ============================================================================
// The permission resolver
// ============================================================================
// effective = (rolePermissions ∪ ALLOWs) \ DENYs      -- deny wins
//
// A pure function on purpose: it is the highest-consequence logic in the
// codebase, and purity is what makes it testable with zero fixtures. Keep it
// that way — no DB access, no request object, no clock.
// ============================================================================

export interface ActorInput {
  userId: string
  sessionId: string
  rolePermissions: readonly string[]
  /** Per-user overrides. DENY beats everything, including a role grant. */
  userPermissions: ReadonlyArray<{ key: string; effect: 'ALLOW' | 'DENY' }>
}

export interface Actor {
  userId: string
  sessionId: string
  permissions: ReadonlySet<PermissionKey>
  has: (key: PermissionKey) => boolean
  hasAny: (keys: readonly PermissionKey[]) => boolean
  hasAll: (keys: readonly PermissionKey[]) => boolean
}

export function resolvePermissions(input: ActorInput): Set<PermissionKey> {
  const effective = new Set<string>(input.rolePermissions)

  for (const p of input.userPermissions) {
    if (p.effect === 'ALLOW') effective.add(p.key)
  }

  // Deny last, unconditionally. A DENY override must beat a role grant AND an
  // explicit ALLOW — otherwise "revoke this one agent's budget access" is
  // unimplementable without editing their role.
  for (const p of input.userPermissions) {
    if (p.effect === 'DENY') effective.delete(p.key)
  }

  return effective as Set<PermissionKey>
}

export function buildActor(input: ActorInput): Actor {
  const permissions = resolvePermissions(input)
  return {
    userId: input.userId,
    sessionId: input.sessionId,
    permissions,
    has: (key) => permissions.has(key),
    hasAny: (keys) => keys.some((k) => permissions.has(k)),
    hasAll: (keys) => keys.every((k) => permissions.has(k)),
  }
}

/**
 * The anonymous actor for the future public listing site. Not used in v1.
 *
 * It exists to make the point structural rather than aspirational: the public
 * site is `actor = publicActor(...)` and then the SAME middleware, the SAME
 * scope resolver and the SAME serializer apply. Zero new authorization code.
 */
export function publicActor(rolePermissions: readonly string[]): Actor {
  return buildActor({
    userId: '',
    sessionId: '',
    rolePermissions,
    userPermissions: [],
  })
}
