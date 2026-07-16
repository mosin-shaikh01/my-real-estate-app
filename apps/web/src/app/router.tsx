import { lazy, Suspense } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'

// Route-level code splitting. Every page is lazy so the initial bundle carries
// the shell and nothing else.
const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const DesignSystem = lazy(() => import('@/features/design-system/pages/DesignSystemPage'))
const NotFound = lazy(() => import('@/features/misc/pages/NotFoundPage'))
const Placeholder = lazy(() => import('@/features/misc/pages/PlaceholderPage'))

function Fallback() {
  return (
    <div className="p-6">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-hover" />
    </div>
  )
}

// ONE route tree. There is deliberately no separate /admin branch: the agent's
// "Clients" and the admin's "Clients" are the same route, and the server's scope
// resolver returns the right rows. Admin-only SURFACES (roles, activity) will
// get <RequirePermission> guards in Phase 2 -- not a parallel tree.
const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'design-system', element: <DesignSystem /> },
      { path: 'properties', element: <Placeholder /> },
      { path: 'clients', element: <Placeholder /> },
      { path: 'requirements', element: <Placeholder /> },
      { path: 'agents', element: <Placeholder /> },
      { path: 'activity', element: <Placeholder /> },
      { path: 'search', element: <Placeholder /> },
      { path: 'settings/roles', element: <Placeholder /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(
  routes.map((r) => ({
    ...r,
    element: <Suspense fallback={<Fallback />}>{r.element}</Suspense>,
  })),
)
