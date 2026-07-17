// The property filter contract, shared by the Properties page, the dashboard
// Recent Properties widget, and the PropertyFilterBar. Kept in its own module
// (not the component file) so both can import the keys/types without tripping
// react-refresh, and so there is ONE source of truth for the filter set.

export const PROPERTY_FILTER_KEYS = [
  'q',
  'status',
  'propertyType',
  'listingType',
  'bedrooms',
  'city',
  'sort',
  'page',
] as const

export type PropertyFilterKey = (typeof PROPERTY_FILTER_KEYS)[number]

/** The shape useUrlFilters returns for these keys — what the filter bar consumes. */
export interface PropertyFilterControls {
  filters: Partial<Record<PropertyFilterKey, string>>
  setFilter: (key: PropertyFilterKey, value: string | undefined) => void
  clearAll: () => void
  activeCount: number
}
