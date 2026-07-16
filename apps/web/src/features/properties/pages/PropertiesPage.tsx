import { Search, X } from 'lucide-react'
import { Link } from 'react-router'
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyStatus,
} from '@app/shared'
import { Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { usePermissions } from '@/features/auth/api/use-auth'
import {
  useProperties,
  usePropertyCities,
  type PropertyDTO,
} from '@/features/properties/api/use-properties'
import { formatArea, formatMoneyShort } from '@/lib/format'
import { useUrlFilters } from '@/lib/use-url-filters'

// ONE page for admin and agent. The scope resolver returned the right rows and
// the serializer stripped the right columns — this file never learns which.

const FILTER_KEYS = [
  'q',
  'status',
  'propertyType',
  'listingType',
  'bedrooms',
  'city',
  'sort',
  'page',
] as const

const STATUS_OPTIONS = (Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((s) => ({
  value: s,
  label: PROPERTY_STATUS_LABELS[s],
}))

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

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

export default function PropertiesPage() {
  const { filters, setFilter, clearAll, activeCount } = useUrlFilters(FILTER_KEYS)
  const { has } = usePermissions()
  const canSeePrice = has('property.price.view')

  const { data: cities } = usePropertyCities()
  const { data, isLoading, isError, error } = useProperties({
    ...filters,
    page: Number(filters.page ?? 1),
  })

  // Sorting by a price you cannot see leaks it — row order IS the value. The
  // server enforces this; hiding the option keeps the UI from offering
  // something that would silently do nothing.
  const sortOptions = canSeePrice
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((o) => !o.value.includes('salePrice'))

  return (
    <>
      <PageHeader
        title="Properties"
        description={
          data
            ? `${data.meta.total} ${data.meta.total === 1 ? 'property' : 'properties'} visible to you`
            : undefined
        }
      />

      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              defaultValue={filters.q ?? ''}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Title, code, locality…"
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

          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X aria-hidden="true" />
              Clear {activeCount}
            </Button>
          ) : null}
        </div>

        {isError ? (
          <div
            role="alert"
            className="rounded-lg border border-danger-100 bg-danger-100/40 p-4 text-base text-danger-700"
          >
            {(error as Error).message}
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH className="w-28">Code</TH>
                  <TH>Property</TH>
                  <TH className="w-32">Status</TH>
                  <TH className="w-20">Beds</TH>
                  <TH numeric className="w-28">Area</TH>
                  <TH numeric className="w-32">Price</TH>
                  <TH className="w-32">Agent</TH>
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={7} title="Loading…" />
                ) : data?.data.length ? (
                  data.data.map((p) => (
                    <PropertyRow key={p.id} property={p} canSeePrice={canSeePrice} />
                  ))
                ) : (
                  <TableEmpty
                    colSpan={7}
                    title={activeCount ? 'No properties match those filters' : 'No properties yet'}
                    hint={
                      activeCount
                        ? 'Try clearing a filter, or search by code like PROP-00001.'
                        : 'Properties assigned to you, or to your clients, appear here.'
                    }
                  />
                )}
              </tbody>
            </Table>
          </TableWrapper>
        )}

        {data && data.meta.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Page {data.meta.page} of {data.meta.totalPages} — {data.meta.total} total
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={data.meta.page <= 1}
                onClick={() => setFilter('page', String(data.meta.page - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                disabled={data.meta.page >= data.meta.totalPages}
                onClick={() => setFilter('page', String(data.meta.page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

function priceLabel(p: PropertyDTO): string {
  // A BOTH listing has two prices in different units. Showing one would be a
  // lie; showing "sale / rent" is the honest compact form.
  const sale = p.salePrice ? formatMoneyShort(p.salePrice) : null
  const rent = p.rentPricePerMonth ? `${formatMoneyShort(p.rentPricePerMonth)}/mo` : null
  if (sale && rent) return `${sale} · ${rent}`
  return sale ?? rent ?? '—'
}

function PropertyRow({ property, canSeePrice }: { property: PropertyDTO; canSeePrice: boolean }) {
  return (
    <TR>
      <TD className="font-mono text-xs text-text-muted">{property.code}</TD>
      <TD className="max-w-0">
        <Link
          to={`/properties/${property.id}`}
          className="block truncate font-medium text-text-primary hover:text-brand-700 hover:underline"
        >
          {property.title}
        </Link>
        <span className="block truncate text-2xs text-text-muted">
          {[property.locality, property.city].filter(Boolean).join(', ')}
          {property.featured ? ' · Featured' : ''}
        </span>
      </TD>
      <TD>
        <StatusBadge status={property.status as PropertyStatus} />
      </TD>
      <TD className="text-text-secondary">{property.bedrooms ?? '—'}</TD>
      <TD numeric className="text-text-secondary">
        {formatArea(property.areaSqft)}
      </TD>
      <TD numeric className="font-medium">
        {canSeePrice ? priceLabel(property) : <Locked />}
      </TD>
      <TD className="truncate text-text-secondary">{property.assignedAgent?.fullName ?? '—'}</TD>
    </TR>
  )
}
