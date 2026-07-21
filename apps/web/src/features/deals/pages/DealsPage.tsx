import { Plus } from 'lucide-react'
import { useState } from 'react'
import { DEAL_TYPE_LABELS, dealTypeSchema, type DealType } from '@app/shared'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useDeals } from '@/features/deals/api/use-deals'
import { RecordDealDialog } from '@/features/deals/components/RecordDealDialog'
import { formatDate, formatMoney } from '@/lib/format'

const TYPE_FILTER = [
  { value: '', label: 'All types' },
  ...dealTypeSchema.options.map((t) => ({ value: t, label: DEAL_TYPE_LABELS[t] })),
]

// Closed deals — admin-only surface (route guarded by deal.list). The single
// source of truth every transactional report is computed from.
export default function DealsPage() {
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [recording, setRecording] = useState(false)

  const { data, isLoading, isError, error } = useDeals({ dealType: type || undefined, page })
  const rows = data?.data ?? []
  const meta = data?.meta

  return (
    <>
      <PageHeader
        title="Deals"
        description={meta ? `${meta.total} closed deal${meta.total === 1 ? '' : 's'}` : undefined}
        action={
          <Can permission="deal.create">
            <Button variant="primary" onClick={() => setRecording(true)}>
              <Plus aria-hidden="true" />
              Record deal
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="max-w-[200px]">
          <Select
            options={TYPE_FILTER}
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            aria-label="Filter by deal type"
          />
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
                  <TH className="w-32">Closed</TH>
                  <TH className="w-20">Type</TH>
                  <TH>Property</TH>
                  <TH>Client</TH>
                  <TH className="w-36">Agent</TH>
                  <TH numeric className="w-36">Price</TH>
                  <TH numeric className="w-32">Commission</TH>
                </tr>
              </THead>
              <tbody>
                {isLoading ? (
                  <TableEmpty colSpan={7} title="Loading…" />
                ) : rows.length ? (
                  rows.map((d) => (
                    <TR key={d.id}>
                      <TD className="text-text-secondary">{formatDate(d.closedAt)}</TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-brand-soft px-2 py-0.5 text-2xs font-medium text-text-brand">
                          {DEAL_TYPE_LABELS[d.dealType as DealType] ?? d.dealType}
                        </span>
                      </TD>
                      <TD className="max-w-0">
                        <span className="block truncate font-medium text-text-primary">{d.property.title}</span>
                        <span className="block font-mono text-2xs text-text-muted">{d.property.code}</span>
                      </TD>
                      <TD className="max-w-0">
                        <span className="block truncate text-text-secondary">{d.client.fullName}</span>
                        <span className="block font-mono text-2xs text-text-muted">{d.client.code}</span>
                      </TD>
                      <TD className="text-text-secondary">{d.agent?.fullName ?? '—'}</TD>
                      <TD numeric className="font-medium tabular-nums">{formatMoney(d.closedPrice)}</TD>
                      <TD numeric className="text-text-secondary tabular-nums">
                        {d.commissionAmount ? formatMoney(d.commissionAmount) : '—'}
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TableEmpty
                    colSpan={7}
                    title={type ? 'No deals of this type' : 'No deals recorded yet'}
                    hint={type ? undefined : 'Record a closed sale or rental to start building your reports.'}
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
                  <Button variant="ghost" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </TableWrapper>
        )}
      </div>

      {recording ? <RecordDealDialog onClose={() => setRecording(false)} /> : null}
    </>
  )
}
