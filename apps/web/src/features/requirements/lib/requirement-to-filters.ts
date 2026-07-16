import type { RequirementInput } from '@app/shared'
import type { PropertyFilters } from '@/features/properties/api/use-properties'

// The bridge that makes the Requirement screen intelligent rather than two
// widgets stacked: a client's requirement becomes a property search. Budget
// becomes a price band, preferred location becomes a city filter, and so on.
//
// This runs client-side — the requirement form's watched values map to the same
// PropertyFilters the list page already uses, so there is no new search endpoint
// and no new query shape to keep in step.
export function requirementToFilters(r: Partial<RequirementInput>): PropertyFilters {
  const f: PropertyFilters = {
    // You match AVAILABLE inventory by default — a sold flat is not a match.
    status: 'AVAILABLE',
  }
  if (r.budgetMin) f.minPrice = r.budgetMin
  if (r.budgetMax) f.maxPrice = r.budgetMax
  if (r.propertyType) f.propertyType = r.propertyType
  if (r.listingType) f.listingType = r.listingType
  if (r.bedrooms != null) f.bedrooms = String(r.bedrooms)
  if (r.city) f.city = r.city
  return f
}
