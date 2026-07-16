import { Building2, CheckCircle2, IndianRupee, Users } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  Table,
  TableWrapper,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/Table'
import { formatArea, formatMoneyShort } from '@/lib/format'

// ============================================================================
// FOUNDATION PREVIEW -- not the real dashboard.
// ============================================================================
// These numbers are hard-coded and mirror the seed. They exist to prove the
// shell, tokens and primitives compose correctly at real density.
//
// Phase 2 replaces every value here with a TanStack Query call against
// GET /api/dashboard. Nothing on this page should survive that.
// ============================================================================

const TILES = [
  { label: 'Active properties', value: '3', icon: Building2, hint: 'AVAILABLE, not archived' },
  { label: 'Clients', value: '4', icon: Users, hint: '2 high priority' },
  { label: 'Closed this quarter', value: '1', icon: CheckCircle2, hint: 'Lonavala villa' },
  { label: 'Commission earned', value: '₹9.88 L', icon: IndianRupee, hint: 'From 1 deal' },
] as const

const RECENT = [
  { code: 'PROP-00001', title: '3 BHK Sea-Facing Apartment, Bandra West', status: 'AVAILABLE', price: '72500000.00', area: '1850.00' },
  { code: 'PROP-00002', title: '2 BHK in Powai with Lake View', status: 'AVAILABLE', price: '24000000.00', area: '1120.00' },
  { code: 'PROP-00003', title: 'Commercial Office Floor, BKC', status: 'UNDER_OFFER', price: '1250000.00', area: '6200.00' },
  { code: 'PROP-00004', title: '4 BHK Villa in Lonavala', status: 'SOLD', price: '41000000.00', area: '3400.00' },
  { code: 'PROP-00005', title: '1 BHK Starter Flat, Thane West', status: 'RENTED', price: '28000.00', area: '610.00' },
] as const

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Foundation preview — these figures are seeded, not live."
        action={
          <Button variant="secondary" asChild>
            <Link to="/design-system">View design system</Link>
          </Button>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TILES.map((t) => (
            <Card key={t.label}>
              <Card.Body className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted">{t.label}</p>
                  <p className="mt-1 text-xl font-semibold text-text-primary tabular-nums">
                    {t.value}
                  </p>
                  <p className="mt-0.5 truncate text-2xs text-text-muted">{t.hint}</p>
                </div>
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-sunken">
                  <t.icon className="size-4 text-text-muted" aria-hidden="true" />
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <Card className="overflow-hidden">
            <Card.Header
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/properties">View all</Link>
                </Button>
              }
            >
              <Card.Title>Recent inventory</Card.Title>
              <Card.Description>
                Sold is neutral, not red — red is reserved for destructive actions.
              </Card.Description>
            </Card.Header>

            <TableWrapper className="rounded-none border-0">
              <Table>
                <THead>
                  <tr>
                    <TH className="w-28">Code</TH>
                    <TH>Property</TH>
                    <TH className="w-32">Status</TH>
                    <TH numeric className="w-28">Area</TH>
                    <TH numeric className="w-32">Price</TH>
                  </tr>
                </THead>
                <tbody>
                  {RECENT.map((p) => (
                    <TR key={p.code}>
                      <TD className="font-mono text-xs text-text-muted">{p.code}</TD>
                      <TD className="max-w-0 truncate">{p.title}</TD>
                      <TD>
                        <StatusBadge status={p.status} />
                      </TD>
                      <TD numeric className="text-text-secondary">
                        {formatArea(p.area)}
                      </TD>
                      <TD numeric className="font-medium">
                        {formatMoneyShort(p.price)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </Card>
        </div>
      </div>
    </>
  )
}
