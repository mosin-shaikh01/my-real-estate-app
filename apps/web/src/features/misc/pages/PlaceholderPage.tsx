import { Construction } from 'lucide-react'
import { useLocation } from 'react-router'
import { PageHeader } from '@/components/layout/AppShell'

const PHASE: Record<string, string> = {
  '/properties': 'Phase 3',
  '/clients': 'Phase 4',
  '/agents': 'Phase 4',
  '/requirements': 'Phase 5',
  '/activity': 'Phase 6',
  '/search': 'Phase 7',
  '/settings/roles': 'Phase 2',
}

const TITLE: Record<string, string> = {
  '/properties': 'Properties',
  '/clients': 'Clients',
  '/agents': 'Agents',
  '/requirements': 'Requirements',
  '/activity': 'Activity log',
  '/search': 'Search',
  '/settings/roles': 'Roles & access',
}

export default function PlaceholderPage() {
  const { pathname } = useLocation()
  const title = TITLE[pathname] ?? 'Coming soon'
  const phase = PHASE[pathname] ?? 'a later phase'

  return (
    <>
      <PageHeader title={title} />
      <div className="grid place-items-center px-6 py-20">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-surface-hover">
            <Construction className="size-5 text-text-muted" aria-hidden="true" />
          </div>
          <p className="mt-4 text-base font-medium text-text-secondary">
            {title} lands in {phase}
          </p>
          {/* Empty states say what happens next -- never just "No data". */}
          <p className="mt-1 text-xs text-text-muted">
            The route, shell and navigation are wired. Phase 2 builds the API and the
            RBAC spine first, so every screen after it inherits scoping and field
            redaction rather than retrofitting them.
          </p>
        </div>
      </div>
    </>
  )
}
