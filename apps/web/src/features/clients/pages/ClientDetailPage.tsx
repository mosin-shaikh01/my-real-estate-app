import { ArrowLeft, Mail, MessageCircle, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router'
import {
  ASSIGNMENT_STATUS_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  type AssignmentStatus,
  type FollowUpStatus,
  type PropertyStatus,
} from '@app/shared'
import { Can, Locked } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { InteractionForm } from '@/features/clients/components/InteractionForm'
import { useClient } from '@/features/clients/api/use-client'
import { cn } from '@/lib/cn'
import { formatDate, formatMoneyShort, formatRelative } from '@/lib/format'

const PRIORITY_TONE: Record<string, string> = {
  HIGH: 'text-danger-700 bg-danger-100',
  MEDIUM: 'text-text-secondary bg-surface-hover',
  LOW: 'text-text-muted bg-surface-hover',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: c, isLoading, isError, error } = useClient(id)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  if (isError || !c) {
    return (
      <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-text-primary">Client not found</h1>
          <p className="mt-1 text-base text-text-secondary">
            {(error as Error | null)?.message ?? 'It may not exist, or it may not be assigned to you.'}
          </p>
          <Button variant="secondary" asChild className="mt-6">
            <Link to="/clients">
              <ArrowLeft aria-hidden="true" />
              Back to clients
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const phoneHidden = !('phone' in c)
  const budget = c.requirement

  return (
    <>
      <PageHeader
        title={c.fullName}
        description={`${c.code} · ${FOLLOW_UP_STATUS_LABELS[c.followUpStatus as FollowUpStatus] ?? c.followUpStatus}`}
        action={
          <span className={cn('rounded px-2 py-1 text-xs font-medium', PRIORITY_TONE[c.priority])}>
            {c.priority} priority
          </span>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Interactions — the shared operational timeline. Adding one is
              gated by client.interaction.create (agents have it); reading is
              open to anyone who can see the client. */}
          <Card>
            <Card.Header>
              <Card.Title>Activity</Card.Title>
              <Card.Description>Calls, notes and meetings. Newest first.</Card.Description>
            </Card.Header>
            <Card.Body className="flex flex-col gap-4">
              <Can permission="client.interaction.create">
                <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
                  <InteractionForm clientId={c.id} />
                </div>
              </Can>

              {c.interactions.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No activity logged yet.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {c.interactions.map((i) => (
                    <li key={i.id} className="flex gap-3 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-hover text-2xs font-semibold text-text-secondary">
                        {i.type.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-text-primary">
                            {i.type.charAt(0) + i.type.slice(1).toLowerCase().replace('_', ' ')}
                          </span>
                          <span className="text-2xs text-text-muted">{formatRelative(i.occurredAt)}</span>
                        </div>
                        {i.body ? <p className="mt-0.5 text-sm text-text-secondary">{i.body}</p> : null}
                        {i.outcome ? (
                          <p className="mt-0.5 text-2xs text-text-muted">Outcome: {i.outcome}</p>
                        ) : null}
                        {i.authorName ? (
                          <p className="mt-0.5 text-2xs text-text-muted">— {i.authorName}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card.Body>
          </Card>

          {/* Assigned properties — the output of the Phase 5 matching flow. */}
          <Card>
            <Card.Header>
              <Card.Title>Shared properties</Card.Title>
              <Card.Description>{c.assignedProperties.length} assigned to this client.</Card.Description>
            </Card.Header>
            <Card.Body>
              {c.assignedProperties.length === 0 ? (
                <p className="py-2 text-sm text-text-muted">
                  No properties shared yet. Match some from the requirement screen.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {c.assignedProperties.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <Link
                        to={`/properties/${p.propertyId}`}
                        className="min-w-0 flex-1 truncate text-sm text-text-primary hover:text-brand-700 hover:underline"
                      >
                        <span className="font-mono text-xs text-text-muted">{p.code}</span> {p.title}
                      </Link>
                      <span className="shrink-0 text-2xs text-text-muted">
                        {ASSIGNMENT_STATUS_LABELS[p.assignmentStatus as AssignmentStatus] ?? p.assignmentStatus}
                      </span>
                      <StatusBadge status={p.status as PropertyStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>Contact</Card.Title>
            </Card.Header>
            <Card.Body className="flex flex-col gap-2.5">
              {phoneHidden ? (
                <Locked label="Phone hidden" />
              ) : c.phone ? (
                <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-700">
                  <Phone className="size-3.5 text-text-muted" aria-hidden="true" />
                  {c.phone}
                </a>
              ) : null}
              {'phone' in c && c.whatsapp ? (
                <a
                  href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-700"
                >
                  <MessageCircle className="size-3.5 text-text-muted" aria-hidden="true" />
                  WhatsApp
                </a>
              ) : null}
              {'email' in c ? (
                c.email ? (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-brand-700">
                    <Mail className="size-3.5 text-text-muted" aria-hidden="true" />
                    {c.email}
                  </a>
                ) : null
              ) : (
                <Locked label="Email hidden" />
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Requirement</Card.Title>
            </Card.Header>
            <Card.Body className="flex flex-col gap-2 text-sm">
              {budget ? (
                <>
                  <Fact label="Budget">
                    {'budgetMin' in budget ? (
                      budget.budgetMin ? (
                        <>
                          {formatMoneyShort(budget.budgetMin)}–{formatMoneyShort(budget.budgetMax ?? null)}
                        </>
                      ) : (
                        '—'
                      )
                    ) : (
                      <Locked />
                    )}
                  </Fact>
                  <Fact label="Type">{budget.propertyType ?? '—'}</Fact>
                  <Fact label="Bedrooms">{budget.bedrooms ?? '—'}</Fact>
                  <Fact label="Location">{[budget.locality, budget.city].filter(Boolean).join(', ') || '—'}</Fact>
                </>
              ) : (
                <p className="text-text-muted">No requirement captured.</p>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Details</Card.Title>
            </Card.Header>
            <Card.Body className="flex flex-col gap-2 text-sm">
              <Fact label="Assigned agent">{c.assignedAgent?.fullName ?? 'Unassigned'}</Fact>
              <Fact label="Source">{c.source ?? '—'}</Fact>
              <Fact label="Last contact">{c.lastContactAt ? formatRelative(c.lastContactAt) : 'Never'}</Fact>
              <Fact label="Next follow-up">{c.nextFollowUp ? formatDate(c.nextFollowUp) : '—'}</Fact>
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-right text-text-primary tabular-nums">{children}</span>
    </div>
  )
}
