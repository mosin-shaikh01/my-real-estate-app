import { Plus, Search, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { FOLLOW_UP_STATUS_LABELS, type FollowUpStatus } from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import {
  Table,
  TableEmpty,
  TableWrapper,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/Table'
import { usePermissions } from '@/features/auth/api/use-auth'
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

  const { has } = usePermissions()
  const canSeeBudget = has('client.budget.view')
  const canSeePhone = has('client.phone.view')

  const { data, isLoading, isError, error } = useClients({
    q: q || undefined,
    page,
    importantLead: importantOnly ? 'true' : undefined,
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
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={7} title="Loading…" />
                ) : data?.data.length ? (
                  data.data.map((c) => (
                    <ClientRow key={c.id} client={c} canSeeBudget={canSeeBudget} canSeePhone={canSeePhone} />
                  ))
                ) : (
                  <TableEmpty
                    colSpan={7}
                    title={q ? 'No clients match that search' : 'No clients assigned to you yet'}
                    hint={
                      q
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
  return (
    <TR>
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
    </TR>
  )
}
