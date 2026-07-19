import { ArrowLeft, Lock } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { ClientForm } from '@/features/clients/components/ClientForm'
import { useClient } from '@/features/clients/api/use-client'
import { ApiClientError } from '@/lib/api'

export default function ClientEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: c, isLoading, isError, error } = useClient(id)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
      </div>
    )
  }

  // Strict RBAC, same as the property edit page: 403 = someone else's client,
  // 404 = doesn't exist. An agent reaching this by URL for a client that isn't
  // theirs sees the guard, not a form whose submit would 404.
  if (isError || !c) {
    const denied = error instanceof ApiClientError && error.code === 'FORBIDDEN'
    return (
      <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
          {denied ? <Lock className="mx-auto size-8 text-text-muted" aria-hidden="true" /> : null}
          <h1 className="mt-3 text-lg font-semibold text-text-primary">
            {denied ? 'Access denied' : 'Client not found'}
          </h1>
          <p className="mt-1 text-base text-text-secondary">
            {denied
              ? 'This client is not assigned to you.'
              : ((error as Error | null)?.message ?? 'It may not exist, or it may not be assigned to you.')}
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

  return (
    <>
      <PageHeader title={`Edit ${c.fullName}`} description={`${c.code} · update contact details and requirement`} />
      <ClientForm mode="edit" client={c} />
    </>
  )
}
