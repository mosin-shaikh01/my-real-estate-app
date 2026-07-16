import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { PermissionKey } from '@app/shared'
import { useMe, usePermissions } from '@/features/auth/api/use-auth'
import { cn } from '@/lib/cn'

// ============================================================================
// <Can> IS UX. IT IS NOT SECURITY.
// ============================================================================
// Every gate here has a server counterpart — requirePermission for actions,
// the boundary serializer for fields — or it is not a gate at all. A column
// hidden by CSS whose data sits in the JSON payload is not hidden.
//
// `permission` is typed as PermissionKey, so a typo is a COMPILE ERROR rather
// than a silently-always-false check that quietly hides a feature forever.
// ============================================================================

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
}) {
  const { has } = usePermissions()
  return has(permission) ? <>{children}</> : <>{fallback}</>
}

/**
 * The affordance that makes redaction feel deliberate rather than broken.
 *
 * Pair it with the API's `_redacted` array: the server says WHAT it stripped,
 * this says the user isn't allowed to see it. A silently missing column reads
 * as a bug; a lock reads as a policy.
 */
export function Locked({ className, label = 'Hidden' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-text-muted', className)}
      title="You do not have permission to view this"
    >
      <Lock className="size-3" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </span>
  )
}

/** Route guard for genuinely admin-only SURFACES — not a second route tree. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey
  children: ReactNode
}) {
  const { has, isLoading } = usePermissions()
  if (isLoading) return null
  // 404, not 403: consistent with the API's rule that you don't get told what
  // exists but isn't yours.
  if (!has(permission)) return <Navigate to="/404" replace />
  return <>{children}</>
}

/** Gate for the whole authenticated app. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMe()
  const location = useLocation()

  if (isLoading) return null
  if (isError || !data) {
    // Remember where they were headed, so login returns them there instead of
    // dumping everyone on the dashboard.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
