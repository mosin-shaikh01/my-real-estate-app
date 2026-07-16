import { describe, expect, it } from 'vitest'
import { propertyUpdateSchema } from '@app/shared'
import { diffForLog, isSensitiveField } from '../src/services/activity-service.js'

// ============================================================================
// The PII trap, guarded.
// ============================================================================
// Logging before/after VALUES copies internalNotes, phones and budgets into a
// second table the redaction serializer does not cover. An agent with
// activity.list would then read, in the audit trail, exactly the negotiating
// position they were denied on the record itself.
//
// The whole point of these tests is that the leak is silent: nothing fails, no
// error appears, the data is just quietly in the wrong place.
// ============================================================================

describe('activity log redaction', () => {
  it('records that a sensitive field changed, but never its values', () => {
    const diff = diffForLog(
      { internalNotes: 'Owner will take 6.9cr for a quick close' },
      { internalNotes: 'Owner now firm at 7.1cr' },
    )
    expect(diff.changed).toEqual(['internalNotes'])
    // The name is in. The value is not — in either direction.
    expect(diff.values).toEqual({})
    expect(JSON.stringify(diff)).not.toContain('6.9cr')
    expect(JSON.stringify(diff)).not.toContain('7.1cr')
  })

  it('never logs a price, a budget, a phone or a commission', () => {
    const diff = diffForLog(
      { salePrice: '72500000.00', budgetMax: '80000000.00', phone: '+91 98765 43210', commissionRate: '2.50' },
      { salePrice: '69000000.00', budgetMax: '75000000.00', phone: '+91 90000 00000', commissionRate: '3.00' },
    )
    expect(diff.changed.sort()).toEqual(['budgetMax', 'commissionRate', 'phone', 'salePrice'])
    expect(diff.values).toEqual({})
    const json = JSON.stringify(diff)
    for (const secret of ['72500000', '69000000', '98765', '2.50']) {
      expect(json, `leaked ${secret}`).not.toContain(secret)
    }
  })

  it('does log values for non-sensitive fields — the log has to be useful', () => {
    const diff = diffForLog({ status: 'AVAILABLE', city: 'Mumbai' }, { status: 'SOLD', city: 'Mumbai' })
    expect(diff.changed).toEqual(['status'])
    expect(diff.values).toEqual({ status: { from: 'AVAILABLE', to: 'SOLD' } })
  })

  it('ignores unchanged fields', () => {
    expect(diffForLog({ title: 'A' }, { title: 'A' }).changed).toEqual([])
  })

  it('does not report a change when a Decimal equals its string form', () => {
    // Prisma hands back Decimal; the input is a string. Comparing raw would
    // mark every field dirty on every save and fill the log with noise.
    const decimal = { toString: () => '72500000.00' }
    expect(diffForLog({ areaSqft: decimal }, { areaSqft: '72500000.00' }).changed).toEqual([])
  })

  it('stringifies Dates — a Json column rejects them at runtime', () => {
    const diff = diffForLog({ archivedAt: null }, { archivedAt: new Date('2026-07-16T00:00:00Z') })
    expect(diff.values.archivedAt?.to).toBe('2026-07-16T00:00:00.000Z')
  })

  it('is JSON-serialisable, which is the actual requirement', () => {
    const diff = diffForLog({ a: 1, archivedAt: new Date() }, { a: 2, archivedAt: null })
    expect(() => JSON.parse(JSON.stringify(diff))).not.toThrow()
  })

  it('treats null and undefined as the same absence', () => {
    expect(diffForLog({ locality: null }, { locality: undefined }).changed).toEqual([])
  })

  it('a PATCH sends ONLY the fields it names — no defaults leak in', () => {
    // Regression, and the nastiest bug in this phase. `.partial()` keeps every
    // `.default()`, so a one-field edit arrived carrying status, visibility,
    // parking, furnished, amenityIds — silently rewriting real values back to
    // their defaults. It corrupted data and passed every unit test, because
    // the defaults are valid values. Only driving the live endpoint exposed it.
    //
    // The contract now: parsed update === exactly what was sent.
    const parsed = propertyUpdateSchema.parse({ featured: true })
    expect(Object.keys(parsed)).toEqual(['featured'])

    // Specifically, none of the previously-defaulted fields materialise.
    for (const field of ['status', 'visibility', 'parking', 'furnished', 'amenityIds', 'country']) {
      expect(field in parsed, `${field} leaked into a PATCH that never sent it`).toBe(false)
    }
  })

  it('knows which fields are sensitive', () => {
    for (const f of ['internalNotes', 'phone', 'budgetMin', 'passwordHash', 'commissionAmount']) {
      expect(isSensitiveField(f), f).toBe(true)
    }
    for (const f of ['status', 'city', 'title', 'bedrooms']) {
      expect(isSensitiveField(f), f).toBe(false)
    }
  })
})
