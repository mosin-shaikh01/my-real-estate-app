import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { PropertyStatus } from '@app/shared'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableWrapper, TD, TH, THead, TR } from '@/components/ui/Table'
import { formatMoney, formatMoneyShort, formatRelative } from '@/lib/format'

// Living reference for the design system. Kept in-app rather than in Storybook:
// one less toolchain, and it renders in the real shell with the real tokens.

const NEUTRALS = ['0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const BRAND = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const STATUSES: readonly PropertyStatus[] = ['AVAILABLE', 'UNDER_OFFER', 'RENTED', 'SOLD']

const TYPE_SCALE = [
  { cls: 'text-2xs', name: '2xs · 11px', use: 'micro labels, table meta' },
  { cls: 'text-xs', name: 'xs · 12px', use: 'captions' },
  { cls: 'text-sm', name: 'sm · 13px', use: 'table cells' },
  { cls: 'text-base', name: 'base · 14px', use: 'body, default' },
  { cls: 'text-md', name: 'md · 16px', use: 'emphasis' },
  { cls: 'text-lg', name: 'lg · 20px', use: 'section heads' },
  { cls: 'text-xl', name: 'xl · 24px', use: 'page titles' },
] as const

const ROWS = [
  { id: '1', code: 'PROP-00001', price: '72500000.00' },
  { id: '2', code: 'PROP-00002', price: '24000000.00' },
  { id: '3', code: 'PROP-00003', price: '1250000.00' },
] as const

export default function DesignSystemPage() {
  const [selected, setSelected] = useState<string[]>(['2'])
  const [err, setErr] = useState(false)

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <>
      <PageHeader
        title="Design system"
        description="Tokens and primitives. Defined from scratch — DesignMD was never present on this machine."
      />

      <div className="flex flex-col gap-6 p-6">
        {/* ---- Colour ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Colour</Card.Title>
            <Card.Description>
              oklch — perceptually uniform, so a ramp stepped by lightness actually looks
              even. Components use semantic tokens only; these primitives are the paint,
              not the API.
            </Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-col gap-5">
            <Ramp label="Neutral — the workhorse. A CRM is 90% grey." steps={NEUTRALS} prefix="neutral" />
            <Ramp label="Brand — deep indigo, not generic-SaaS-blue" steps={BRAND} prefix="brand" />
          </Card.Body>
        </Card>

        {/* ---- Status ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Status</Card.Title>
            <Card.Description>
              Always a dot plus a label, never colour alone. Sold is neutral slate: red
              means destructive, and sold is a terminal success that must not shout over
              the actionable rows.
            </Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </Card.Body>
        </Card>

        {/* ---- Type ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Type</Card.Title>
            <Card.Description>
              Base 14px for chrome and tables — the honest CRM call, not the 16px
              reading-page default. Inter, self-hosted.
            </Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-col gap-3">
            {TYPE_SCALE.map((t) => (
              <div key={t.cls} className="flex items-baseline gap-4">
                <span className="w-28 shrink-0 font-mono text-2xs text-text-muted">
                  {t.name}
                </span>
                <span className={`${t.cls} text-text-primary`}>Bandra West, Mumbai</span>
                <span className="ml-auto hidden text-2xs text-text-muted sm:block">
                  {t.use}
                </span>
              </div>
            ))}
          </Card.Body>
        </Card>

        {/* ---- Buttons ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Buttons</Card.Title>
            <Card.Description>
              Danger is the only red in the system. That is why status colours never use
              it.
            </Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Assign properties</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">View all</Button>
            <Button variant="danger">
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
          </Card.Body>
        </Card>

        {/* ---- Forms ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Forms</Card.Title>
            <Card.Description>
              FormField owns label, error and aria-describedby wiring, so accessibility
              can&rsquo;t be forgotten one field at a time.
            </Card.Description>
          </Card.Header>
          <Card.Body className="grid max-w-xl gap-4 sm:grid-cols-2">
            <FormField label="Client name" required>
              {(p) => <Input {...p} placeholder="Vikram Malhotra" />}
            </FormField>
            <FormField label="Phone" hint="Normalised for search on save">
              {(p) => <Input {...p} placeholder="+91 98765 43210" />}
            </FormField>
            <FormField
              label="Budget max"
              error={err ? 'Must be greater than budget min' : undefined}
            >
              {(p) => <Input {...p} defaultValue="50,00,000" />}
            </FormField>
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => setErr((v) => !v)}>
                Toggle error state
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* ---- Table ---- */}
        <Card className="overflow-hidden">
          <Card.Header>
            <Card.Title>Table & selection</Card.Title>
            <Card.Description>
              Tick a row. Selection is brand tint plus a left accent bar — deliberately
              distinct from the neutral hover wash. The bulk-assign screen lives or dies
              on this. No zebra striping: it fights both states.
            </Card.Description>
          </Card.Header>
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10">
                    <span className="sr-only">Select</span>
                  </TH>
                  <TH>Code</TH>
                  <TH numeric>Price (short)</TH>
                  <TH numeric>Price (full)</TH>
                </tr>
              </THead>
              <tbody>
                {ROWS.map((r) => (
                  <TR key={r.id} selected={selected.includes(r.id)}>
                    <TD>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.code}`}
                        className="size-3.5 accent-brand-600"
                      />
                    </TD>
                    <TD className="font-mono text-xs text-text-muted">{r.code}</TD>
                    <TD numeric>{formatMoneyShort(r.price)}</TD>
                    <TD numeric className="font-medium">
                      {formatMoney(r.price)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
          <Card.Footer>
            <p className="mr-auto text-xs text-text-muted">
              {selected.length} selected — note the digits align (tabular-nums)
            </p>
            <Button variant="primary" size="sm" disabled={selected.length === 0}>
              Assign selected
            </Button>
          </Card.Footer>
        </Card>

        {/* ---- Formatters ---- */}
        <Card>
          <Card.Header>
            <Card.Title>Formatters</Card.Title>
            <Card.Description>
              Money is a string from the API to the DOM. Prisma Decimal doesn&rsquo;t
              JSON-serialize, and a JS number can&rsquo;t hold ₹99,99,99,999.99.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Row k='formatMoney("72500000.00")' v={formatMoney('72500000.00')} />
              <Row k='formatMoneyShort("72500000.00")' v={formatMoneyShort('72500000.00')} />
              <Row k='formatMoneyShort("850000.00")' v={formatMoneyShort('850000.00')} />
              <Row k="formatRelative(3 days ago)" v={formatRelative(new Date(Date.now() - 2.6e8))} />
            </dl>
          </Card.Body>
        </Card>
      </div>
    </>
  )
}

function Ramp({
  label,
  steps,
  prefix,
}: {
  label: string
  steps: readonly string[]
  prefix: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-text-secondary">{label}</p>
      <div className="flex overflow-hidden rounded-md border border-border-subtle">
        {steps.map((s) => (
          <div
            key={s}
            className="h-9 flex-1"
            style={{ backgroundColor: `var(--color-${prefix}-${s})` }}
            title={`${prefix}-${s}`}
          />
        ))}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-1.5">
      <dt className="font-mono text-2xs text-text-muted">{k}</dt>
      <dd className="font-medium text-text-primary tabular-nums">{v}</dd>
    </div>
  )
}
