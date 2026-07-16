import { Building2, FileText, User, Users } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useActivity, type ActivityEntry } from '@/features/activity/api/use-activity'
import { useUrlFilters } from '@/lib/use-url-filters'
import { formatRelative } from '@/lib/format'

// Admin-only surface (activity.list). The data has accumulated since Phase 2 —
// every mutation wrote a row here; this just surfaces it. Note the audit trail
// records sensitive fields by NAME, never value (see activity-service), so it
// is safe to render in full.

const ENTITY_OPTIONS = [
  { value: 'property', label: 'Properties' },
  { value: 'client', label: 'Clients' },
  { value: 'user', label: 'Agents & auth' },
]

const ENTITY_ICON: Record<string, typeof Building2> = {
  property: Building2,
  client: Users,
  user: User,
}

function entityLink(e: ActivityEntry): string | null {
  if (e.entityType === 'property') return `/properties/${e.entityId}`
  if (e.entityType === 'client') return `/clients/${e.entityId}`
  return null
}

export default function ActivityPage() {
  const { filters, setFilter } = useUrlFilters(['entityType', 'page'] as const)
  const { data, isLoading } = useActivity({
    entityType: filters.entityType,
    page: Number(filters.page ?? 1),
  })

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every significant action, most recent first. Sensitive values are recorded by name only."
      />

      <div className="p-6">
        <div className="mb-4 w-48">
          <Select
            aria-label="Filter by type"
            placeholder="All activity"
            value={filters.entityType ?? ''}
            options={ENTITY_OPTIONS}
            onChange={(e) => setFilter('entityType', e.target.value)}
          />
        </div>

        <Card>
          <Card.Body className="p-0">
            {isLoading ? (
              <p className="p-8 text-center text-sm text-text-muted">Loading…</p>
            ) : data?.data.length ? (
              <ol className="divide-y divide-border-subtle">
                {data.data.map((e) => {
                  const Icon = ENTITY_ICON[e.entityType] ?? FileText
                  const href = entityLink(e)
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken">
                        <Icon className="size-3.5 text-text-muted" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">
                          {href ? (
                            <Link to={href} className="hover:text-brand-700 hover:underline">
                              {e.summary}
                            </Link>
                          ) : (
                            e.summary
                          )}
                        </p>
                        <p className="mt-0.5 text-2xs text-text-muted">
                          {e.actor?.fullName ?? 'System'} · {formatRelative(e.createdAt)} ·{' '}
                          <span className="font-mono">{e.action}</span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="p-8 text-center text-sm text-text-muted">No activity recorded yet.</p>
            )}
          </Card.Body>
        </Card>

        {data && data.meta.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Page {data.meta.page} of {data.meta.totalPages} — {data.meta.total} entries
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={data.meta.page <= 1}
                onClick={() => setFilter('page', String(data.meta.page - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                disabled={data.meta.page >= data.meta.totalPages}
                onClick={() => setFilter('page', String(data.meta.page + 1))}
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
