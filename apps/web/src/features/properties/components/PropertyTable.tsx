import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { PropertyStatus } from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useToast } from '@/components/ui/use-toast'
import type { PropertyDTO } from '@/features/properties/api/use-properties'
import { useArchiveProperty, useDeleteProperty } from '@/features/properties/api/use-property-mutations'
import { formatArea, formatMoneyShort, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'

// ============================================================================
// The property results table — shared by the Properties page and the dashboard
// Recent Properties widget, so both render rows identically and the scope /
// redaction handled server-side is presented the same way everywhere.
//
// `compact` drops the secondary columns (beds, agent, actions) for the narrower
// dashboard card; the full table shows everything, including the archive/restore
// actions and the archive badge.
// ============================================================================

function priceLabel(p: PropertyDTO): string {
  // A BOTH listing has two prices in different units. Showing one would be a
  // lie; showing "sale / rent" is the honest compact form.
  const sale = p.salePrice ? formatMoneyShort(p.salePrice) : null
  const rent = p.rentPricePerMonth ? `${formatMoneyShort(p.rentPricePerMonth)}/mo` : null
  if (sale && rent) return `${sale} · ${rent}`
  return sale ?? rent ?? '—'
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : undefined)

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
            <TH className="w-40">Status</TH>
            {compact ? null : <TH className="w-20">Beds</TH>}
            <TH numeric className="w-28">Area</TH>
            <TH numeric className="w-32">Price</TH>
            {compact ? null : <TH className="w-32">Agent</TH>}
            {compact ? null : (
              <TH className="w-24">
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
  const archived = Boolean(property.archivedAt)
  return (
    <TR className={cn(archived && 'bg-surface-sunken/40')}>
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
          {/* Archived date + by (optional columns) shown inline, only when it
              applies, rather than two mostly-empty columns for every row. */}
          {archived && property.archivedAt
            ? ` · Archived ${formatRelative(property.archivedAt)}${
                property.archivedBy ? ` by ${property.archivedBy.fullName}` : ''
              }`
            : ''}
        </span>
      </TD>
      <TD>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={property.status as PropertyStatus} />
          {archived ? <ArchiveBadge /> : null}
        </div>
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
          <PropertyRowActions property={property} archived={archived} />
        </TD>
      )}
    </TR>
  )
}

function ArchiveBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text-muted"
      title="This property is archived and hidden from active listings"
    >
      <Archive className="size-2.5" aria-hidden="true" />
      Archived
    </span>
  )
}

const ICON_BTN =
  'inline-flex rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500'

function PropertyRowActions({ property, archived }: { property: PropertyDTO; archived: boolean }) {
  const { toast } = useToast()
  const archive = useArchiveProperty(property.id)
  const del = useDeleteProperty(property.id)
  const [dialog, setDialog] = useState<null | 'archive' | 'restore' | 'delete'>(null)
  const close = () => setDialog(null)
  const busy = archive.isPending || del.isPending

  const runArchive = async (flag: boolean) => {
    try {
      await archive.mutateAsync(flag)
      toast({ variant: 'success', title: flag ? 'Property archived' : 'Property restored' })
      close()
    } catch (err) {
      toast({
        variant: 'error',
        title: flag ? 'Could not archive property' : 'Could not restore property',
        description: errMsg(err),
      })
    }
  }

  const runDelete = async () => {
    try {
      await del.mutateAsync()
      toast({ variant: 'success', title: 'Property deleted' })
      close()
    } catch (err) {
      toast({ variant: 'error', title: 'Could not delete property', description: errMsg(err) })
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Can permission="property.update">
        <Link
          to={`/properties/${property.id}/edit`}
          aria-label={`Edit ${property.title}`}
          title="Edit"
          className={ICON_BTN}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Link>
      </Can>

      {archived ? (
        <>
          <Can permission="property.archive">
            <button
              type="button"
              onClick={() => setDialog('restore')}
              aria-label={`Restore ${property.title}`}
              title="Restore"
              className={ICON_BTN}
            >
              <ArchiveRestore className="size-4" aria-hidden="true" />
            </button>
          </Can>
          <Can permission="property.delete">
            <button
              type="button"
              onClick={() => setDialog('delete')}
              aria-label={`Permanently delete ${property.title}`}
              title="Permanently delete"
              className={cn(ICON_BTN, 'hover:bg-surface-danger-soft/50 hover:text-text-danger')}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Can>
        </>
      ) : (
        <Can permission="property.archive">
          <button
            type="button"
            onClick={() => setDialog('archive')}
            aria-label={`Archive ${property.title}`}
            title="Archive"
            className={ICON_BTN}
          >
            <Archive className="size-4" aria-hidden="true" />
          </button>
        </Can>
      )}

      {/* ---- Archive confirmation (spec copy verbatim) ---- */}
      <Dialog
        open={dialog === 'archive'}
        onClose={close}
        title="Archive property"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void runArchive(true)} disabled={busy}>
              {archive.isPending ? 'Archiving…' : 'Archive Property'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Are you sure you want to archive this property? Archived properties will no longer appear in
          active property listings but can be restored later.
        </p>
      </Dialog>

      {/* ---- Restore confirmation ---- */}
      <Dialog
        open={dialog === 'restore'}
        onClose={close}
        title="Restore property"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void runArchive(false)} disabled={busy}>
              {archive.isPending ? 'Restoring…' : 'Restore Property'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Restore this property to active listings? All existing data, assignments, images, documents
          and history are preserved and reappear exactly as before.
        </p>
      </Dialog>

      {/* ---- Permanent delete (admin only, destructive) ---- */}
      <Dialog
        open={dialog === 'delete'}
        onClose={close}
        title="Permanently delete property"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void runDelete()} disabled={busy}>
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Permanently delete <span className="font-medium text-text-primary">{property.title}</span>?
          It will be removed from every listing across the app. This cannot be undone from here.
        </p>
      </Dialog>
    </div>
  )
}
