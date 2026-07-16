import { ArrowLeft, Lock } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { PropertyForm } from '@/features/properties/components/PropertyForm'
import { useProperty } from '@/features/properties/api/use-properties'
import { ApiClientError } from '@/lib/api'

export default function PropertyEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: p, isLoading, isError, error } = useProperty(id)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  // Same strict-RBAC distinction the detail page draws: 403 = someone else's
  // property, 404 = doesn't exist. An agent reaching this by URL sees the guard.
  if (isError || !p) {
    const denied = error instanceof ApiClientError && error.code === 'FORBIDDEN'
    return (
      <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
          {denied ? <Lock className="mx-auto size-8 text-text-muted" aria-hidden="true" /> : null}
          <h1 className="mt-3 text-lg font-semibold text-text-primary">
            {denied ? 'Access denied' : 'Property not found'}
          </h1>
          <p className="mt-1 text-base text-text-secondary">
            {denied
              ? 'This property is not assigned to you.'
              : ((error as Error | null)?.message ?? 'It may not exist, or it may not be assigned to you.')}
          </p>
          <Button variant="secondary" asChild className="mt-6">
            <Link to="/properties">
              <ArrowLeft aria-hidden="true" />
              Back to properties
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={`Edit ${p.title}`}
        description={`${p.code} · update details, amenities, location and media`}
      />
      <PropertyForm mode="edit" property={p} />
    </>
  )
}
