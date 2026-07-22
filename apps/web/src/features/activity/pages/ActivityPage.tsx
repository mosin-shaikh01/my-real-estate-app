import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useActivity, type ActivityEntry } from '@/features/activity/api/use-activity'
import { activityActionLabel } from '@/features/activity/lib/activity-format'
import { useUrlFilters } from '@/lib/use-url-filters'
import { formatDateTime, formatRelative } from '@/lib/format'

// Admin-only surface (activity.list). The data has accumulated since Phase 2 —
// every mutation wrote a row here; this just surfaces it. Note the audit trail
// records sensitive fields by NAME, never value (see activity-service), so it
// is safe to render in full. The internal `action` key is never shown — only its
// friendly label (activityActionLabel).

const ENTITY_OPTIONS = [
  { value: 'property', label: 'Properties' },
  { value: 'client', label: 'Clients' },
  { value: 'user', label: 'Agents & auth' },
]

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
                  const href = entityLink(e)
                  const actorName = e.actor?.fullName ?? 'System'
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                      <Avatar name={e.actor?.fullName ?? null} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-text-primary">{actorName}</span>
                          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text-muted">
                            {activityActionLabel(e.action)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-text-secondary">
                          {href ? (
                            <Link to={href} className="hover:text-text-brand hover:underline">
                              {e.summary}
                            </Link>
                          ) : (
                            e.summary
                          )}
                        </p>
                        {/* Exact date + time; hover reveals the relative form. */}
                        <p className="mt-0.5 text-2xs text-text-muted" title={formatRelative(e.createdAt)}>
                          {formatDateTime(e.createdAt)}
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
