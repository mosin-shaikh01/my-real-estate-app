import { Pencil } from 'lucide-react'
import { Link } from 'react-router'
import type { PropertyStatus } from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import type { PropertyDTO } from '@/features/properties/api/use-properties'
import { formatArea, formatMoneyShort } from '@/lib/format'
import { cn } from '@/lib/cn'

// ============================================================================
// The property results table — shared by the Properties page and the dashboard
// Recent Properties widget, so both render rows identically and the scope /
// redaction handled server-side is presented the same way everywhere.
//
// `compact` drops the secondary columns (beds, agent, edit) for the narrower
// dashboard card; the full table shows everything.
// ============================================================================

function priceLabel(p: PropertyDTO): string {
  // A BOTH listing has two prices in different units. Showing one would be a
  // lie; showing "sale / rent" is the honest compact form.
  const sale = p.salePrice ? formatMoneyShort(p.salePrice) : null
  const rent = p.rentPricePerMonth ? `${formatMoneyShort(p.rentPricePerMonth)}/mo` : null
  if (sale && rent) return `${sale} · ${rent}`
  return sale ?? rent ?? '—'
}

export function PropertyTable({
  rows,
  isLoading,
  canSeePrice,
  activeCount,
  compact = false,
  emptyHint,
}: {
  rows: PropertyDTO[] | undefined
  isLoading: boolean
  canSeePrice: boolean
  /** How many filters are active — drives the empty-state message. */
  activeCount: number
  compact?: boolean
  emptyHint?: string
}) {
  const colSpan = compact ? 5 : 8
  const hint =
    emptyHint ??
    (activeCount
      ? 'Try clearing a filter, or search by code like PROP-00001.'
      : 'Properties assigned to you, or to your clients, appear here.')

  return (
    <TableWrapper className={cn(compact && 'rounded-none border-0')}>
      <Table>
        <THead>
          <tr>
            <TH className="w-28">Code</TH>
            <TH>Property</TH>
            <TH className="w-32">Status</TH>
            {compact ? null : <TH className="w-20">Beds</TH>}
            <TH numeric className="w-28">Area</TH>
            <TH numeric className="w-32">Price</TH>
            {compact ? null : <TH className="w-32">Agent</TH>}
            {compact ? null : (
              <TH className="w-14">
                <span className="sr-only">Actions</span>
              </TH>
            )}
          </tr>
        </THead>
        <tbody>
          {isLoading ? (
            <TableEmpty colSpan={colSpan} title="Loading…" />
          ) : rows?.length ? (
            rows.map((p) => (
              <PropertyRow key={p.id} property={p} canSeePrice={canSeePrice} compact={compact} />
            ))
          ) : (
            <TableEmpty
              colSpan={colSpan}
              title={activeCount ? 'No properties match those filters' : 'No properties yet'}
              hint={hint}
            />
          )}
        </tbody>
      </Table>
    </TableWrapper>
  )
}

function PropertyRow({
  property,
  canSeePrice,
  compact,
}: {
  property: PropertyDTO
  canSeePrice: boolean
  compact: boolean
}) {
  return (
    <TR>
      <TD className="font-mono text-xs text-text-muted">{property.code}</TD>
      <TD className="max-w-0">
        <Link
          to={`/properties/${property.id}`}
          className="block truncate font-medium text-text-primary hover:text-text-brand hover:underline"
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
      {compact ? null : <TD className="text-text-secondary">{property.bedrooms ?? '—'}</TD>}
      <TD numeric className="text-text-secondary">
        {formatArea(property.areaSqft)}
      </TD>
      <TD numeric className="font-medium">
        {canSeePrice ? priceLabel(property) : <Locked />}
      </TD>
      {compact ? null : (
        <TD className="truncate text-text-secondary">{property.assignedAgent?.fullName ?? '—'}</TD>
      )}
      {compact ? null : (
        <TD>
          <Can permission="property.update">
            <Link
              to={`/properties/${property.id}/edit`}
              aria-label={`Edit ${property.title}`}
              title="Edit"
              className="inline-flex rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          </Can>
        </TD>
      )}
    </TR>
  )
}
