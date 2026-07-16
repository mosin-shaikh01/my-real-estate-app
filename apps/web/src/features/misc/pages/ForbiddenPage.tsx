import { ShieldX } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'

// Rendered in place when an agent reaches an admin-only route (by URL or
// otherwise). The UI guard here mirrors the server's — every admin API is also
// permission-gated, so this page is the friendly face of a denial the backend
// enforces regardless.
export default function ForbiddenPage() {
  return (
    <div className="grid min-h-full place-items-center px-6 py-20">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-danger-100">
          <ShieldX className="size-5 text-danger-700" aria-hidden="true" />
        </div>
        <p className="mt-4 text-2xs font-semibold tracking-widest text-text-muted uppercase">
          403
        </p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary">Access denied</h1>
        <p className="mt-1 text-base text-text-secondary">
          This page is restricted to administrators. If you think you need access, ask an
          admin.
        </p>
        <Button variant="primary" asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
