import {
  Building2,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  UserSquare2,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'
import type { PropertyStatus } from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableEmpty, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { useMe } from '@/features/auth/api/use-auth'
import { useDashboard } from '@/features/dashboard/api/use-dashboard'
import { useProperties } from '@/features/properties/api/use-properties'
import { formatArea, formatMoneyShort, formatRelative } from '@/lib/format'

// Every figure here is live and SCOPED. An agent's "properties" tile counts the
// properties an agent can actually open — a tile showing 6 next to a list
// showing 4 would either look broken or leak how much inventory exists that
// they cannot see.

export default function DashboardPage() {
  const { data: me } = useMe()
  const { data, isLoading } = useDashboard()
  const { data: recent } = useProperties({ page: 1, sort: '-createdAt' })

  const firstName = me?.user.fullName.split(' ')[0]

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="Everything below is scoped to what you can access."
        action={
          <Button variant="secondary" asChild>
            <Link to="/properties">View properties</Link>
          </Button>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Active properties"
            value={data?.activeProperties}
            hint={data ? `of ${data.totalProperties} total` : 'Available, not archived'}
            icon={Building2}
            loading={isLoading}
          />
          <Tile
            label="Clients"
            value={data?.totalClients}
            hint={data?.followUpsDue ? `${data.followUpsDue} follow-up due` : 'No follow-ups due'}
            icon={Users}
            loading={isLoading}
          />
          <Tile
            label="Closed"
            value={data ? data.soldProperties + data.rentedProperties : undefined}
            hint={data ? `${data.soldProperties} sold · ${data.rentedProperties} rented` : ''}
            icon={CheckCircle2}
            loading={isLoading}
          />

          {/* null means gated, not zero. Rendering "0 agents" to someone who
              may not see agents would be a lie dressed as data. */}
          {data?.totalAgents != null ? (
            <Tile label="Agents" value={data.totalAgents} hint="Active" icon={UserSquare2} loading={false} />
          ) : data?.commissionEarned != null ? (
            <Tile
              label="Commission earned"
              value={formatMoneyShort(data.commissionEarned)}
              hint="From closed deals"
              icon={IndianRupee}
              loading={false}
            />
          ) : (
            <Tile
              label="Follow-ups due"
              value={data?.followUpsDue}
              hint="Clients awaiting contact"
              icon={CalendarClock}
              loading={isLoading}
            />
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <Card.Header
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/properties">View all</Link>
                </Button>
              }
            >
              <Card.Title>Recent inventory</Card.Title>
              <Card.Description>The newest properties you have access to.</Card.Description>
            </Card.Header>

            <TableWrapper className="rounded-none border-0">
              <Table>
                <THead>
                  <tr>
                    <TH className="w-28">Code</TH>
                    <TH>Property</TH>
                    <TH className="w-32">Status</TH>
                    <TH numeric className="w-24">Area</TH>
                    <TH numeric className="w-28">Price</TH>
                  </tr>
                </THead>
                <tbody>
                  {recent?.data.length ? (
                    recent.data.slice(0, 6).map((p) => (
                      <TR key={p.id}>
                        <TD className="font-mono text-xs text-text-muted">{p.code}</TD>
                        <TD className="max-w-0">
                          <Link
                            to={`/properties/${p.id}`}
                            className="block truncate hover:text-text-brand hover:underline"
                          >
                            {p.title}
                          </Link>
                        </TD>
                        <TD>
                          <StatusBadge status={p.status as PropertyStatus} />
                        </TD>
                        <TD numeric className="text-text-secondary">
                          {formatArea(p.areaSqft)}
                        </TD>
                        <TD numeric className="font-medium">
                          {p.salePrice
                            ? formatMoneyShort(p.salePrice)
                            : p.rentPricePerMonth
                              ? `${formatMoneyShort(p.rentPricePerMonth)}/mo`
                              : '—'}
                        </TD>
                      </TR>
                    ))
                  ) : (
                    <TableEmpty
                      colSpan={5}
                      title={isLoading ? 'Loading…' : 'Nothing assigned to you yet'}
                      hint={isLoading ? undefined : 'Properties assigned to you, or to your clients, appear here.'}
                    />
                  )}
                </tbody>
              </Table>
            </TableWrapper>
          </Card>

          {/* Only rendered for actors with activity.list — an agent has no
              business reading the audit trail. */}
          {data?.recentActivity.length ? (
            <Card>
              <Card.Header>
                <Card.Title>Recent activity</Card.Title>
                <Card.Description>Sensitive values are logged by name only.</Card.Description>
              </Card.Header>
              <Card.Body className="flex flex-col gap-3">
                {data.recentActivity.map((a) => (
                  <div key={a.id} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                    <p className="text-xs text-text-primary">{a.summary}</p>
                    <p className="mt-0.5 text-2xs text-text-muted">
                      {a.actorName ?? 'System'} · {formatRelative(a.createdAt)}
                    </p>
                  </div>
                ))}
              </Card.Body>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string
  value: number | string | undefined
  hint?: string
  icon: typeof Building2
  loading: boolean
}) {
  return (
    <Card>
      <Card.Body className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          {loading ? (
            <div className="mt-1.5 h-6 w-10 animate-pulse rounded bg-surface-hover" />
          ) : (
            <p className="mt-1 text-xl font-semibold text-text-primary tabular-nums">
              {value ?? '—'}
            </p>
          )}
          {hint ? <p className="mt-0.5 truncate text-2xs text-text-muted">{hint}</p> : null}
        </div>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-sunken">
          <Icon className="size-4 text-text-muted" aria-hidden="true" />
        </div>
      </Card.Body>
    </Card>
  )
}
