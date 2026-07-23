import { describe, expect, it } from 'vitest'
import { activityActionLabel } from '@/features/activity/lib/activity-format'

// The internal `action` key (property.updated, auth.login) must never reach a
// user. Pin: known keys map to friendly labels, and NOTHING renders a raw
// dotted/underscored identifier — including keys with no explicit mapping.

describe('activityActionLabel', () => {
  it('maps known action keys to friendly labels', () => {
    expect(activityActionLabel('auth.login')).toBe('Signed in')
    expect(activityActionLabel('property.updated')).toBe('Property updated')
    expect(activityActionLabel('client.created')).toBe('Client created')
    expect(activityActionLabel('deal.created')).toBe('Deal recorded')
  })

  it('labels the multi-segment auth/security actions meaningfully', () => {
    expect(activityActionLabel('auth.password_reset.requested')).toBe('Password reset requested')
    expect(activityActionLabel('auth.password_reset.completed')).toBe('Password reset completed')
    expect(activityActionLabel('auth.refresh.reuse_detected')).toBe('Suspicious session activity')
    expect(activityActionLabel('profile.password_changed')).toBe('Password changed')
  })

  it('never surfaces a raw dotted/underscored key for an unmapped action', () => {
    const label = activityActionLabel('widget.sub_thing.frobnicated')
    expect(label).toBe('Widget sub thing frobnicated')
    expect(label).not.toMatch(/[._]/)
  })

  it('degrades to a generic label for a degenerate key', () => {
    expect(activityActionLabel('')).toBe('Activity')
  })
})
