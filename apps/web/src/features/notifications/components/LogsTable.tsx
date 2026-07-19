import { useState } from 'react'
import type { NotificationStatus } from '@app/shared'
import { Button } from '@/components/ui/Button'
import { Table, TableEmpty, TableWrapper, TD, TH, THead } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import { useNotificationLogs } from '@/features/notifications/api/use-notifications'

const STATUS_STYLES: Record<NotificationStatus, string> = {
  sent: 'bg-surface-success-soft text-text-success',
  failed: 'bg-surface-danger-soft text-text-danger',
  skipped: 'bg-surface-hover text-text-muted',
  queued: 'bg-surface-brand-soft text-text-brand',
  not_implemented: 'bg-surface-hover text-text-muted',
}

export function LogsTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useNotificationLogs(page)
  const rows = data?.data ?? []
  const meta = data?.meta

  return (
    <TableWrapper>
      <Table>
        <THead>
          <tr>
            <TH>Time</TH>
            <TH>Channel</TH>
            <TH>Template</TH>
            <TH>Recipient</TH>
            <TH>Provider</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <tbody>
          {isLoading ? (
            <TableEmpty colSpan={6} title="Loading…" />
          ) : rows.length === 0 ? (
            <TableEmpty colSpan={6} title="No notifications yet" hint="Sent messages will appear here." />
          ) : (
            rows.map((log) => (
              <tr key={log.id} className="border-b border-border-subtle last:border-0">
                <TD className="whitespace-nowrap text-xs text-text-muted">
                  {new Date(log.createdAt).toLocaleString()}
                </TD>
                <TD className="text-text-secondary">{log.channel}</TD>
                <TD className="text-text-secondary">{log.templateKey ?? '—'}</TD>
                <TD className="text-text-secondary">{log.recipient}</TD>
                <TD className="text-text-secondary">{log.provider ?? '—'}</TD>
                <TD>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-2xs font-medium',
                      STATUS_STYLES[log.status],
                    )}
                    title={log.error ?? undefined}
                  >
                    {log.status.replace('_', ' ')}
                  </span>
                </TD>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </span>
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
  )
}
