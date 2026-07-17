import { Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS, type PropertyStatus } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { usePropertyCities } from '@/features/properties/api/use-properties'
import type { PropertyFilterControls } from '@/features/properties/lib/property-filters'

// ============================================================================
// The property search + filter bar — shared by the Properties page and the
// dashboard's Recent Properties widget, so the two never drift and the codebase
// has ONE place that knows the filter set. It is driven by the generic filter
// controls (the useUrlFilters shape), so each host supplies its own state.
// ============================================================================

const STATUS_OPTIONS = (Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((s) => ({
  value: s,
  label: PROPERTY_STATUS_LABELS[s],
}))
const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} BHK` }))
const LISTING_OPTIONS = [
  { value: 'SALE', label: 'For sale' },
  { value: 'RENT', label: 'For rent' },
]
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-areaSqft', label: 'Largest first' },
  { value: '-salePrice', label: 'Price: high to low' },
  { value: 'salePrice', label: 'Price: low to high' },
]

export function PropertyFilterBar({
  filters,
  setFilter,
  clearAll,
  activeCount,
  canSeePrice,
}: PropertyFilterControls & { canSeePrice: boolean }) {
  const reduce = useReducedMotion()
  const { data: cities } = usePropertyCities()

  // Sorting by a price you cannot see leaks it — row order IS the value. The
  // server enforces this; hiding the option keeps the UI from offering something
  // that would silently do nothing.
  const sortOptions = canSeePrice
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((o) => !o.value.includes('salePrice'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          defaultValue={filters.q ?? ''}
          onChange={(e) => setFilter('q', e.target.value)}
          placeholder="Title, code, city, agent, type…"
          aria-label="Search properties"
          className="h-8 w-full rounded-md border border-border-default bg-surface pr-3 pl-9 text-xs placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
        />
      </div>

      <div className="w-32">
        <Select
          aria-label="Status"
          placeholder="Any status"
          value={filters.status ?? ''}
          options={STATUS_OPTIONS}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </div>
      <div className="w-32">
        <Select
          aria-label="Type"
          placeholder="Any type"
          value={filters.propertyType ?? ''}
          options={TYPE_OPTIONS}
          onChange={(e) => setFilter('propertyType', e.target.value)}
        />
      </div>
      <div className="w-28">
        <Select
          aria-label="Sale or rent"
          placeholder="Sale/Rent"
          value={filters.listingType ?? ''}
          options={LISTING_OPTIONS}
          onChange={(e) => setFilter('listingType', e.target.value)}
        />
      </div>
      <div className="w-24">
        <Select
          aria-label="Bedrooms"
          placeholder="Beds"
          value={filters.bedrooms ?? ''}
          options={BEDROOM_OPTIONS}
          onChange={(e) => setFilter('bedrooms', e.target.value)}
        />
      </div>
      <div className="w-32">
        <Select
          aria-label="City"
          placeholder="Any city"
          value={filters.city ?? ''}
          options={(cities ?? []).map((c) => ({ value: c, label: c }))}
          onChange={(e) => setFilter('city', e.target.value)}
        />
      </div>
      <div className="w-40">
        <Select
          aria-label="Sort"
          placeholder="Sort"
          value={filters.sort ?? ''}
          options={sortOptions}
          onChange={(e) => setFilter('sort', e.target.value)}
        />
      </div>

      {/* Native <select> dropdowns can't be animated, so the subtle motion lives
          on the Clear control appearing/leaving. */}
      <AnimatePresence>
        {activeCount > 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X aria-hidden="true" />
              Clear {activeCount}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
