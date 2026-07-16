import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-full place-items-center px-6 py-20">
      <div className="max-w-sm text-center">
        <p className="text-2xs font-semibold tracking-widest text-text-muted uppercase">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-1 text-base text-text-secondary">
          That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
        </p>
        <Button variant="primary" asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
