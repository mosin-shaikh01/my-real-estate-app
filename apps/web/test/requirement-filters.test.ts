import { describe, expect, it } from 'vitest'
import { requirementToFilters } from '@/features/requirements/lib/requirement-to-filters'

// The bridge that makes the matching screen intelligent: a client's requirement
// becomes a property search. Pure and central, so it's worth pinning.

describe('requirementToFilters', () => {
  it('maps budget to a price band and location to a city', () => {
    const f = requirementToFilters({
      budgetMin: '5000000',
      budgetMax: '8000000',
      city: 'Pune',
      bedrooms: 2,
      propertyType: 'APARTMENT',
    })
    expect(f).toMatchObject({
      minPrice: '5000000',
      maxPrice: '8000000',
      city: 'Pune',
      bedrooms: '2',
      propertyType: 'APARTMENT',
    })
  })

  it('always defaults to AVAILABLE — a sold flat is not a match', () => {
    expect(requirementToFilters({}).status).toBe('AVAILABLE')
  })

  it('omits fields the requirement did not specify', () => {
    const f = requirementToFilters({ city: 'Mumbai' })
    expect(f.minPrice).toBeUndefined()
    expect(f.bedrooms).toBeUndefined()
    expect(f.propertyType).toBeUndefined()
    expect(f.city).toBe('Mumbai')
  })

  it('coerces bedrooms to the string the query layer expects', () => {
    // bedrooms is a number on the requirement, a string in the query params.
    expect(requirementToFilters({ bedrooms: 0 }).bedrooms).toBe('0')
  })
})
