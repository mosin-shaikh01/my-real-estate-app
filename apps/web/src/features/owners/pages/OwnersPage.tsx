import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useToast } from '@/components/ui/use-toast'
import { ApiClientError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { OwnerFormDialog } from '@/features/owners/components/OwnerFormDialog'
import { useDeleteOwner, useOwner, useOwners, useRestoreOwner } from '@/features/owners/api/use-owners'

// Property Owner master — admin-only surface (route guarded by owner.list).
export default function OwnersPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [deleted, setDeleted] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useOwners({ q, page, deleted })
  const rows = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="Owners"
        description={meta ? `${meta.total} owner${meta.total === 1 ? '' : 's'}` : undefined}
        action={
          <Can permission="owner.create">
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New owner
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Name, code, mobile, email, city…"
              className="pl-8"
              aria-label="Search owners"
            />
          </div>
          <Can permission="owner.delete">
            <button
              type="button"
              onClick={() => {
                setDeleted((d) => !d)
                setPage(1)
              }}
              aria-pressed={deleted}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
                deleted
                  ? 'border-brand-500 bg-surface-brand-soft text-text-brand'
                  : 'border-border-default text-text-secondary hover:border-border-strong',
              )}
            >
              <Archive className="size-3.5" aria-hidden="true" />
              Deleted
            </button>
          </Can>
        </div>

        {isError ? (
          <div role="alert" className="rounded-lg border border-border-danger-soft bg-surface-danger-soft/40 p-4 text-base text-text-danger">
            {(error as Error).message}
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH className="w-28">Code</TH>
                  <TH>Owner</TH>
                  <TH className="w-40">Mobile</TH>
                  <TH>City</TH>
                  <TH numeric className="w-28">Properties</TH>
                  <TH className="w-28" />
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={6} title="Loading…" />
                ) : rows.length ? (
                  rows.map((o) => (
                    <TR key={o.id} className={cn(deleted && 'bg-surface-sunken/40')}>
                      <TD className="font-mono text-xs text-text-muted">{o.code}</TD>
                      <TD className="font-medium text-text-primary">
                        {o.fullName}
                        {o.deletedAt ? (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-text-muted">
                            <Archive className="size-2.5" aria-hidden="true" />
                            Deleted
                          </span>
                        ) : null}
                      </TD>
                      <TD className="text-text-secondary">
                        <a href={`tel:${o.mobile}`} className="hover:text-text-brand hover:underline">
                          {o.mobile}
                        </a>
                      </TD>
                      <TD className="text-text-secondary">{o.city ?? '—'}</TD>
                      <TD numeric className="text-text-secondary">{o.propertyCount}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          {deleted ? (
                            <Can permission="owner.delete">
                              <RestoreOwnerButton id={o.id} name={o.fullName} />
                            </Can>
                          ) : (
                            <>
                              <Can permission="owner.update">
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(o.id)}>
                                  <Pencil aria-hidden="true" />
                                  Edit
                                </Button>
                              </Can>
                              <Can permission="owner.delete">
                                <DeleteOwnerButton id={o.id} name={o.fullName} />
                              </Can>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TableEmpty
                    colSpan={6}
                    title={deleted ? 'No deleted owners' : q ? 'No owners match your search' : 'No owners yet'}
                    hint={
                      deleted
                        ? 'Deleted owners appear here and can be restored.'
                        : q
                          ? undefined
                          : 'Add an owner to reference them from properties.'
                    }
                  />
                )}
              </tbody>
            </Table>

            {meta && meta.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
                <span>Page {meta.page} of {meta.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </TableWrapper>
        )}
      </div>

      {creating ? <OwnerFormDialog onClose={() => setCreating(false)} /> : null}
      {editingId ? <EditOwnerDialog id={editingId} onClose={() => setEditingId(null)} /> : null}
    </>
  )
}

// Fetch the full owner (the list row is a lighter shape) before editing.
function EditOwnerDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: owner } = useOwner(id)
  if (!owner) return null
  return <OwnerFormDialog owner={owner} onClose={onClose} />
}

function DeleteOwnerButton({ id, name }: { id: string; name: string }) {
  const del = useDeleteOwner()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    setError(null)
    if (!window.confirm(`Delete owner ${name}? They can be restored later from the Deleted view.`)) return
    try {
      await del.mutateAsync(id)
      toast({ variant: 'success', title: 'Owner deleted', description: 'Restore it from the Deleted view.' })
    } catch (err) {
      // The server refuses to delete an owner who still owns properties.
      const message = err instanceof ApiClientError ? err.message : 'Could not delete owner'
      setError(message)
      toast({ variant: 'error', title: 'Could not delete owner', description: message })
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onDelete}
      disabled={del.isPending}
      title={error ?? undefined}
      className={error ? 'text-text-danger' : undefined}
    >
      <Trash2 aria-hidden="true" />
      {error ? 'In use' : 'Delete'}
    </Button>
  )
}

function RestoreOwnerButton({ id, name }: { id: string; name: string }) {
  const restore = useRestoreOwner()
  const { toast } = useToast()

  async function onRestore() {
    if (!window.confirm(`Restore owner ${name} to the active list?`)) return
    try {
      await restore.mutateAsync(id)
      toast({ variant: 'success', title: 'Owner restored' })
    } catch (err) {
      toast({ variant: 'error', title: 'Could not restore owner', description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onRestore} disabled={restore.isPending}>
      <ArchiveRestore aria-hidden="true" />
      Restore
    </Button>
  )
}
