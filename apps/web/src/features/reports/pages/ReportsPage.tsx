import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  FOLLOW_UP_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type ExportableReport,
  type FollowUpStatus,
  type PropertyStatus,
  type PropertyType,
} from '@app/shared'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Table, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useToast } from '@/components/ui/use-toast'
import { useReports } from '@/features/reports/api/use-reports'
import { formatMoneyShort } from '@/lib/format'

// Reports — admin-only surface (route guarded by report.view). One request
// returns every report; CSV export (report.export) is a separate permission.
export default function ReportsPage() {
  const { data, isLoading, isError, error } = useReports()
  const { toast } = useToast()

  async function downloadReport(report: ExportableReport) {
    try {
      const res = await fetch(`/api/reports/export/${report}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ variant: 'error', title: 'Could not export', description: err instanceof Error ? err.message : undefined })
    }
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Reports" />
        <div className="p-6">
          <div role="alert" className="rounded-lg border border-border-danger-soft bg-surface-danger-soft/40 p-4 text-base text-text-danger">
            {(error as Error).message}
          </div>
        </div>
      </>
    )
  }

  const maxMonth = data ? Math.max(1, ...data.monthlyRevenue.map((m) => Number(m.revenue))) : 1

  return (
    <>
      <PageHeader title="Reports" description="Performance, conversion and revenue across the business." />

      <div className="flex flex-col gap-6 p-6">
        {isLoading || !data ? (
          <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
        ) : (
          <>
            {/* ---- Client conversion — headline funnel ---- */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total clients" value={String(data.clientConversion.totalClients)} />
              <Stat label="With assignments" value={String(data.clientConversion.withAssignments)} />
              <Stat label="Converted to deals" value={String(data.clientConversion.converted)} />
              <Stat label="Conversion rate" value={`${data.clientConversion.conversionRate}%`} accent />
            </div>

            {/* ---- Agent performance ---- */}
            <Section
              title="Agent performance"
              description="Closed deals, revenue and commission per agent."
              onExport={() => void downloadReport('agent-performance')}
            >
              <TableWrapper>
                <Table>
                  <THead>
                    <tr>
                      <TH>Agent</TH>
                      <TH numeric className="w-24">Deals</TH>
                      <TH numeric className="w-32">Revenue</TH>
                      <TH numeric className="w-32">Commission</TH>
                      <TH numeric className="w-24">Clients</TH>
                      <TH numeric className="w-28">Properties</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {data.agentPerformance.map((a) => (
                      <TR key={a.agentId}>
                        <TD className="font-medium text-text-primary">
                          {a.agentName}
                          <span className="ml-2 font-mono text-2xs text-text-muted">{a.agentCode}</span>
                        </TD>
                        <TD numeric className="tabular-nums">{a.dealsClosed}</TD>
                        <TD numeric className="tabular-nums">{formatMoneyShort(a.revenue)}</TD>
                        <TD numeric className="tabular-nums text-text-secondary">{formatMoneyShort(a.commission)}</TD>
                        <TD numeric className="tabular-nums text-text-secondary">{a.activeClients}</TD>
                        <TD numeric className="tabular-nums text-text-secondary">{a.activeProperties}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrapper>
            </Section>

            {/* ---- Property sales + Follow-up status side by side ---- */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Section
                title="Property sales"
                description="Closed deals by property type."
                onExport={() => void downloadReport('property-sales')}
              >
                <MiniTable
                  head={['Type', 'Deals', 'Revenue']}
                  rows={data.propertySales.map((r) => [
                    PROPERTY_TYPE_LABELS[r.propertyType as PropertyType] ?? r.propertyType,
                    String(r.dealsClosed),
                    formatMoneyShort(r.revenue),
                  ])}
                  empty="No deals recorded yet."
                />
              </Section>

              <Section
                title="Follow-up status"
                description="Where clients sit in the pipeline."
                onExport={() => void downloadReport('follow-up-status')}
              >
                <MiniTable
                  head={['Status', 'Clients']}
                  rows={data.followUpStatus.map((r) => [
                    FOLLOW_UP_STATUS_LABELS[r.status as FollowUpStatus] ?? r.status,
                    String(r.count),
                  ])}
                  empty="No clients yet."
                />
              </Section>
            </div>

            {/* ---- Inventory ---- */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="Inventory by status" description={`${data.inventory.total} active properties.`}>
                <MiniTable
                  head={['Status', 'Count']}
                  rows={data.inventory.byStatus.map((r) => [
                    PROPERTY_STATUS_LABELS[r.status as PropertyStatus] ?? r.status,
                    String(r.count),
                  ])}
                  empty="No properties."
                />
              </Section>
              <Section title="Inventory by type" description="Active properties by category.">
                <MiniTable
                  head={['Type', 'Count']}
                  rows={data.inventory.byType.map((r) => [
                    PROPERTY_TYPE_LABELS[r.propertyType as PropertyType] ?? r.propertyType,
                    String(r.count),
                  ])}
                  empty="No properties."
                />
              </Section>
            </div>

            {/* ---- Monthly revenue — a compact inline bar chart ---- */}
            <Section
              title="Monthly revenue"
              description="Closed-deal value over the last 12 months."
              onExport={() => void downloadReport('monthly-revenue')}
            >
              <div className="flex flex-col gap-1.5">
                {data.monthlyRevenue.map((m) => {
                  const pct = Math.round((Number(m.revenue) / maxMonth) * 100)
                  return (
                    <div key={m.month} className="flex items-center gap-3 text-xs">
                      <span className="w-16 shrink-0 tabular-nums text-text-muted">{m.month}</span>
                      <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-sunken">
                        <div
                          className="h-full rounded bg-brand-500/70"
                          style={{ width: `${Number(m.revenue) > 0 ? Math.max(pct, 2) : 0}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right tabular-nums font-medium">
                        {Number(m.revenue) > 0 ? formatMoneyShort(m.revenue) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <Card.Body className="flex flex-col gap-1">
        <span className="text-2xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
        <span className={`text-2xl font-semibold tabular-nums ${accent ? 'text-text-brand' : 'text-text-primary'}`}>
          {value}
        </span>
      </Card.Body>
    </Card>
  )
}

function Section({
  title,
  description,
  onExport,
  children,
}: {
  title: string
  description?: string
  onExport?: () => void
  children: ReactNode
}) {
  return (
    <Card>
      <Card.Header className="flex flex-row items-start justify-between gap-4">
        <div>
          <Card.Title>{title}</Card.Title>
          {description ? <Card.Description>{description}</Card.Description> : null}
        </div>
        {onExport ? (
          <Can permission="report.export">
            <Button variant="secondary" size="sm" onClick={onExport}>
              <Download aria-hidden="true" />
              Export CSV
            </Button>
          </Can>
        ) : null}
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card>
  )
}

function MiniTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-text-muted">{empty}</p>
  return (
    <TableWrapper>
      <Table>
        <THead>
          <tr>
            {head.map((h, i) => (
              <TH key={h} numeric={i > 0} className={i > 0 ? 'w-28' : undefined}>
                {h}
              </TH>
            ))}
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <TR key={r[0]}>
              {r.map((cell, i) => (
                <TD key={i} numeric={i > 0} className={i === 0 ? 'text-text-primary' : 'tabular-nums text-text-secondary'}>
                  {cell}
                </TD>
              ))}
            </TR>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  )
}
