import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Can } from '@/components/auth/Can'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { usePermissions } from '@/features/auth/api/use-auth'
import { PropertyFilterBar } from '@/features/properties/components/PropertyFilterBar'
import { PropertyTable } from '@/features/properties/components/PropertyTable'
import { useProperties } from '@/features/properties/api/use-properties'
import { PROPERTY_FILTER_KEYS } from '@/features/properties/lib/property-filters'
import { useUrlFilters } from '@/lib/use-url-filters'

// ONE page for admin and agent. The scope resolver returned the right rows and
// the serializer stripped the right columns — this file never learns which. The
// search bar and results table are shared with the dashboard's Recent Properties
// widget (PropertyFilterBar / PropertyTable), so the two can never drift.

export default function PropertiesPage() {
  const { filters, setFilter, clearAll, activeCount } = useUrlFilters(PROPERTY_FILTER_KEYS)
  const { has } = usePermissions()
  const canSeePrice = has('property.price.view')

  const { data, isLoading, isError, error } = useProperties({
    ...filters,
    page: Number(filters.page ?? 1),
  })

  return (
    <>
      <PageHeader
        title="Properties"
        description={
          data
            ? `${data.meta.total} ${data.meta.total === 1 ? 'property' : 'properties'} visible to you`
            : undefined
        }
        action={
          // Gated by the same permission the server enforces on POST. This is
          // UX — hiding a button an agent's request would be 403'd anyway.
          <Can permission="property.create">
            <Button variant="primary" asChild>
              <Link to="/properties/new">
                <Plus aria-hidden="true" />
                New property
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="p-6">
        <div className="mb-4">
          <PropertyFilterBar
            filters={filters}
            setFilter={setFilter}
            clearAll={clearAll}
            activeCount={activeCount}
            canSeePrice={canSeePrice}
          />
        </div>

        {isError ? (
          <div
            role="alert"
            className="rounded-lg border border-border-danger-soft bg-surface-danger-soft/40 p-4 text-base text-text-danger"
          >
            {(error as Error).message}
          </div>
        ) : (
          <PropertyTable
            rows={data?.data}
            isLoading={isLoading}
            canSeePrice={canSeePrice}
            activeCount={activeCount}
          />
        )}

        {data && data.meta.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Page {data.meta.page} of {data.meta.totalPages} — {data.meta.total} total
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
