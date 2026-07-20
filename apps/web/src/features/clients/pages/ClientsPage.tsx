import { Archive, ArchiveRestore, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FOLLOW_UP_STATUS_LABELS, type FollowUpStatus } from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  Table,
  TableEmpty,
  TableWrapper,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/Table'
import { useToast } from '@/components/ui/use-toast'
import { usePermissions } from '@/features/auth/api/use-auth'
import { useArchiveClient, useDeleteClient } from '@/features/clients/api/use-client'
import { useClients, type ClientDTO } from '@/features/clients/api/use-clients'
import { cn } from '@/lib/cn'
import { formatMoneyShort, formatRelative } from '@/lib/format'

// ============================================================================
// ONE page for admin and agent.
// ============================================================================
// Not "AdminClientsPage" and "AgentClientsPage". The server's scope resolver
// already returns the right rows and the serializer already stripped the right
// columns — the UI does not need to know which actor it is rendering for.
//
// That is the payoff of doing RBAC properly, and it is why this file exists
// once instead of twice.
// ============================================================================

const PRIORITY_TONE: Record<string, string> = {
  HIGH: 'text-text-danger bg-surface-danger-soft',
  MEDIUM: 'text-text-secondary bg-surface-hover',
  LOW: 'text-text-muted bg-surface-hover',
}

export default function ClientsPage() {
  // Filters live in the URL, not a store: an admin must be able to send
  // "?q=vikram" to a colleague and have them see the same screen.
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1)
  const importantOnly = params.get('importantLead') === 'true'
  const archivedOnly = params.get('archived') === 'only'

  const { has } = usePermissions()
  const canSeeBudget = has('client.budget.view')
  const canSeePhone = has('client.phone.view')

  const { data, isLoading, isError, error } = useClients({
    q: q || undefined,
    page,
    importantLead: importantOnly ? 'true' : undefined,
    archived: archivedOnly ? 'only' : undefined,
  })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Any filter change resets to page 1, or you land on an empty page 3.
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          data ? `${data.meta.total} ${data.meta.total === 1 ? 'client' : 'clients'} visible to you` : undefined
        }
        action={
          <Can permission="client.create">
            <Button variant="primary" asChild>
              <Link to="/clients/new">
                <Plus aria-hidden="true" />
                New client
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              defaultValue={q}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Name, code or phone…"
              aria-label="Search clients"
              className="h-9 w-full rounded-md border border-border-default bg-surface pr-3 pl-9 text-base placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setParam('importantLead', importantOnly ? '' : 'true')}
            aria-pressed={importantOnly}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
              importantOnly
                ? 'border-brand-500 bg-surface-brand-soft text-text-brand'
                : 'border-border-default text-text-secondary hover:border-border-strong',
            )}
          >
            <Star className={cn('size-3.5', importantOnly && 'fill-current')} aria-hidden="true" />
            Important leads
          </button>
          <button
            type="button"
            onClick={() => setParam('archived', archivedOnly ? '' : 'only')}
            aria-pressed={archivedOnly}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
              archivedOnly
                ? 'border-brand-500 bg-surface-brand-soft text-text-brand'
                : 'border-border-default text-text-secondary hover:border-border-strong',
            )}
          >
            <Archive className="size-3.5" aria-hidden="true" />
            Archived
          </button>
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
                  <TH>Client</TH>
                  <TH className="w-40">Phone</TH>
                  <TH className="w-36">Follow-up</TH>
                  <TH numeric className="w-40">Budget</TH>
                  <TH className="w-32">Agent</TH>
                  <TH className="w-28">Last contact</TH>
                  <TH className="w-16"><span className="sr-only">Actions</span></TH>
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={8} title="Loading…" />
                ) : data?.data.length ? (
                  data.data.map((c) => (
                    <ClientRow key={c.id} client={c} canSeeBudget={canSeeBudget} canSeePhone={canSeePhone} />
                  ))
                ) : (
                  <TableEmpty
                    colSpan={8}
                    title={
                      archivedOnly
                        ? 'No archived clients'
                        : q
                          ? 'No clients match that search'
                          : 'No clients assigned to you yet'
                    }
                    hint={
                      archivedOnly
                        ? 'Archived clients are hidden from the main list. Archive one from its row to see it here.'
                        : q
                          ? 'Try a name, a client code like CLI-00001, or a phone number.'
                          : 'An admin assigns clients to agents. Ask yours to assign you one.'
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
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setParam('page', String(page + 1))}
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

function ClientRow({
  client,
  canSeeBudget,
  canSeePhone,
}: {
  client: ClientDTO
  canSeeBudget: boolean
  canSeePhone: boolean
}) {
  const budget = client.requirement
  const archived = Boolean(client.archivedAt)
  return (
    <TR className={cn(archived && 'bg-surface-sunken/40')}>
      <TD className="font-mono text-xs text-text-muted">{client.code}</TD>
      <TD>
        <Link
          to={`/clients/${client.id}`}
          className="font-medium text-text-primary hover:text-text-brand hover:underline"
        >
          {client.fullName}
        </Link>
        <span
          className={cn(
            'ml-2 rounded px-1.5 py-0.5 text-2xs font-medium',
            PRIORITY_TONE[client.priority],
          )}
        >
          {client.priority}
        </span>
        {client.importantLead ? (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-surface-brand-soft px-1.5 py-0.5 text-2xs font-medium text-text-brand" title="Important lead">
            <Star className="size-2.5 fill-current" aria-hidden="true" />
            Important
          </span>
        ) : null}
        {archived ? (
          <span
            className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-text-muted"
            title={`Archived${client.archivedBy ? ` by ${client.archivedBy.fullName}` : ''}${client.archivedAt ? ` ${formatRelative(client.archivedAt)}` : ''}`}
          >
            <Archive className="size-2.5" aria-hidden="true" />
            Archived
          </span>
        ) : null}
      </TD>

      {/* Absent vs null are DIFFERENT. `phone` missing means redacted -> lock.
          A null phone would mean none recorded -> em dash. */}
      <TD>
        {canSeePhone ? (
          client.phone ? (
            <a href={`tel:${client.phone}`} className="text-text-secondary hover:text-text-brand hover:underline">
              {client.phone}
            </a>
          ) : (
            <span className="text-text-muted">—</span>
          )
        ) : (
          <Locked />
        )}
      </TD>

      <TD className="text-text-secondary">
        {FOLLOW_UP_STATUS_LABELS[client.followUpStatus as FollowUpStatus] ?? client.followUpStatus}
      </TD>

      <TD numeric>
        {canSeeBudget ? (
          budget?.budgetMin ? (
            <span className="text-text-primary">
              {formatMoneyShort(budget.budgetMin)}–{formatMoneyShort(budget.budgetMax ?? null)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )
        ) : (
          <Locked />
        )}
      </TD>

      <TD className="truncate text-text-secondary">{client.assignedAgent?.fullName ?? '—'}</TD>
      <TD className="text-text-muted">{formatRelative(client.lastContactAt)}</TD>

      {/* Actions are UX affordances; the API re-checks the permission AND scope,
          so a missing button is not the security boundary — the server is. */}
      <TD>
        <ClientRowActions client={client} archived={archived} />
      </TD>
    </TR>
  )
}

const ICON_BTN =
  'inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500'

function ClientRowActions({ client, archived }: { client: ClientDTO; archived: boolean }) {
  const { toast } = useToast()
  const archive = useArchiveClient(client.id)
  const del = useDeleteClient(client.id)
  const [dialog, setDialog] = useState<null | 'archive' | 'restore' | 'delete'>(null)
  const close = () => setDialog(null)
  const busy = archive.isPending || del.isPending
  const msg = (err: unknown) => (err instanceof Error ? err.message : undefined)

  const runArchive = async (flag: boolean) => {
    try {
      await archive.mutateAsync(flag)
      toast({ variant: 'success', title: flag ? 'Client archived' : 'Client restored' })
      close()
    } catch (err) {
      toast({ variant: 'error', title: flag ? 'Could not archive client' : 'Could not restore client', description: msg(err) })
    }
  }
  const runDelete = async () => {
    try {
      await del.mutateAsync()
      toast({ variant: 'success', title: 'Client deleted' })
      close()
    } catch (err) {
      toast({ variant: 'error', title: 'Could not delete client', description: msg(err) })
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Can permission="client.update">
        <Link
          to={`/clients/${client.id}/edit`}
          aria-label={`Edit ${client.fullName}`}
          title="Edit"
          className={ICON_BTN}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </Link>
      </Can>

      {archived ? (
        <>
          <Can permission="client.archive">
            <button type="button" onClick={() => setDialog('restore')} aria-label={`Restore ${client.fullName}`} title="Restore" className={ICON_BTN}>
              <ArchiveRestore className="size-3.5" aria-hidden="true" />
            </button>
          </Can>
          <Can permission="client.delete">
            <button type="button" onClick={() => setDialog('delete')} aria-label={`Permanently delete ${client.fullName}`} title="Permanently delete" className={cn(ICON_BTN, 'hover:bg-surface-danger-soft/50 hover:text-text-danger')}>
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </Can>
        </>
      ) : (
        <Can permission="client.archive">
          <button type="button" onClick={() => setDialog('archive')} aria-label={`Archive ${client.fullName}`} title="Archive" className={ICON_BTN}>
            <Archive className="size-3.5" aria-hidden="true" />
          </button>
        </Can>
      )}

      <Dialog
        open={dialog === 'archive'}
        onClose={close}
        title="Archive client"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={() => void runArchive(true)} disabled={busy}>
              {archive.isPending ? 'Archiving…' : 'Archive client'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Are you sure you want to archive this client? Archived clients no longer appear in the main
          list but can be restored later, with their requirement, activity and shared properties intact.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'restore'}
        onClose={close}
        title="Restore client"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={() => void runArchive(false)} disabled={busy}>
              {archive.isPending ? 'Restoring…' : 'Restore client'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Restore this client to the active list? All existing data, requirement, interactions and
          shared properties are preserved exactly as before.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onClose={close}
        title="Permanently delete client"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={() => void runDelete()} disabled={busy}>
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Permanently delete <span className="font-medium text-text-primary">{client.fullName}</span>?
          They will be removed from every list across the app. This cannot be undone from here.
        </p>
      </Dialog>
    </div>
  )
}
