import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequirePermission } from '@/components/auth/Can'
import { AppShell } from '@/components/layout/AppShell'

// Route-level code splitting: the initial bundle carries the shell, nothing else.
const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const Clients = lazy(() => import('@/features/clients/pages/ClientsPage'))
const ClientDetail = lazy(() => import('@/features/clients/pages/ClientDetailPage'))
const ClientCreate = lazy(() => import('@/features/clients/pages/ClientCreatePage'))
const Properties = lazy(() => import('@/features/properties/pages/PropertiesPage'))
const PropertyDetail = lazy(() => import('@/features/properties/pages/PropertyDetailPage'))
const PropertyCreate = lazy(() => import('@/features/properties/pages/PropertyCreatePage'))
const Agents = lazy(() => import('@/features/agents/pages/AgentsPage'))
const DesignSystem = lazy(() => import('@/features/design-system/pages/DesignSystemPage'))
const Login = lazy(() => import('@/features/auth/pages/LoginPage'))
const NotFound = lazy(() => import('@/features/misc/pages/NotFoundPage'))
const Placeholder = lazy(() => import('@/features/misc/pages/PlaceholderPage'))

function Fallback() {
  return (
    <div className="p-6">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-hover" />
    </div>
  )
}

const lazyRoute = (element: ReactNode) => <Suspense fallback={<Fallback />}>{element}</Suspense>

// ONE route tree. There is deliberately no /admin branch: the agent's "Clients"
// and the admin's "Clients" are the same route, and the server's scope resolver
// returns the right rows. Admin-only SURFACES get <RequirePermission> — that is
// a guard, not a parallel tree.
export const router = createBrowserRouter([
  { path: '/login', element: lazyRoute(<Login />) },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: lazyRoute(<Dashboard />) },
      { path: 'clients', element: lazyRoute(<Clients />) },
      // 'new' before ':id', or the detail route swallows it as an id.
      { path: 'clients/new', element: lazyRoute(<ClientCreate />) },
      { path: 'clients/:id', element: lazyRoute(<ClientDetail />) },
      { path: 'properties', element: lazyRoute(<Properties />) },
      { path: 'properties/new', element: lazyRoute(<PropertyCreate />) },
      { path: 'properties/:id', element: lazyRoute(<PropertyDetail />) },
      // Admin-only SURFACE — a guard, not a parallel tree. An agent hitting
      // /agents gets the same 404 the API would give them.
      {
        path: 'agents',
        element: lazyRoute(
          <RequirePermission permission="agent.list">
            <Agents />
          </RequirePermission>,
        ),
      },
      { path: 'design-system', element: lazyRoute(<DesignSystem />) },
      { path: 'requirements', element: lazyRoute(<Placeholder />) },
      { path: 'activity', element: lazyRoute(<Placeholder />) },
      { path: 'search', element: lazyRoute(<Placeholder />) },
      { path: 'settings/roles', element: lazyRoute(<Placeholder />) },
      { path: '*', element: lazyRoute(<NotFound />) },
    ],
  },
])
