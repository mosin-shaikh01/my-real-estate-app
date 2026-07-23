// Friendly labels for the internal activity `action` keys. These keys
// (auth.login, property.updated…) are developer identifiers and must NEVER reach
// a user — the UI renders the label, or, for an unmapped key, a title-cased
// fallback that still can't leak the raw dotted string.

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.logout_all': 'Signed out everywhere',
  'auth.password_reset.requested': 'Password reset requested',
  'auth.password_reset.completed': 'Password reset completed',
  'auth.refresh.reuse_detected': 'Suspicious session activity',

  'property.created': 'Property created',
  'property.updated': 'Property updated',
  'property.deleted': 'Property deleted',
  'property.status.updated': 'Status changed',
  'property.assigned': 'Property assigned',
  'property.unassigned': 'Property unassigned',
  'property.media.uploaded': 'Media uploaded',
  'property.media.deleted': 'Media deleted',

  'client.created': 'Client created',
  'client.updated': 'Client updated',
  'client.deleted': 'Client deleted',
  'client.agent.assigned': 'Agent assigned',
  'client.interaction.added': 'Interaction logged',
  'client.requirement.updated': 'Requirement updated',

  'owner.created': 'Owner created',
  'owner.updated': 'Owner updated',
  'owner.deleted': 'Owner deleted',
  'owner.restored': 'Owner restored',

  'agent.created': 'Agent created',
  'agent.updated': 'Agent updated',
  'agent.permissions.changed': 'Access changed',

  'sitevisit.created': 'Site visit scheduled',
  'sitevisit.updated': 'Site visit updated',
  'sitevisit.deleted': 'Site visit deleted',

  'deal.created': 'Deal recorded',

  'rbac.role.created': 'Role created',
  'rbac.role.updated': 'Role updated',
  'rbac.role.deleted': 'Role deleted',

  'settings.updated': 'Settings updated',
  'profile.updated': 'Profile updated',
  'profile.password_changed': 'Password changed',
}

/**
 * A user-facing label for an activity action. For an unmapped key it title-cases
 * the WHOLE key (all `.`/`_` segments, e.g. "foo.bar_baz" -> "Foo bar baz") — so
 * a new action added server-side reads sensibly, never drops the resource
 * context, and never surfaces the raw `resource.action` string.
 */
export function activityActionLabel(action: string): string {
  const mapped = ACTIVITY_ACTION_LABELS[action]
  if (mapped) return mapped

  const words = action.replace(/[._]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Activity'
}
