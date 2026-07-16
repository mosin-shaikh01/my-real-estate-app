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
const PropertyEdit = lazy(() => import('@/features/properties/pages/PropertyEditPage'))
const Agents = lazy(() => import('@/features/agents/pages/AgentsPage'))
const RequirementMatch = lazy(() => import('@/features/requirements/pages/RequirementMatchPage'))
const Activity = lazy(() => import('@/features/activity/pages/ActivityPage'))
const Roles = lazy(() => import('@/features/rbac/pages/RolesPage'))
const Settings = lazy(() => import('@/features/settings/pages/SettingsPage'))
const Profile = lazy(() => import('@/features/profile/pages/ProfilePage'))
const DesignSystem = lazy(() => import('@/features/design-system/pages/DesignSystemPage'))
const Login = lazy(() => import('@/features/auth/pages/LoginPage'))
const NotFound = lazy(() => import('@/features/misc/pages/NotFoundPage'))

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
      // Self-service — any authenticated user, no permission guard.
      { path: 'profile', element: lazyRoute(<Profile />) },
      { path: 'clients', element: lazyRoute(<Clients />) },
      // 'new' before ':id', or the detail route swallows it as an id. Creating
      // is admin-only, so guard it — an agent hitting /clients/new by URL is
      // denied, not shown a form whose submit would 403 anyway.
      {
        path: 'clients/new',
        element: lazyRoute(
          <RequirePermission permission="client.create">
            <ClientCreate />
          </RequirePermission>,
        ),
      },
      { path: 'clients/:id', element: lazyRoute(<ClientDetail />) },
      { path: 'properties', element: lazyRoute(<Properties />) },
      {
        path: 'properties/new',
        element: lazyRoute(
          <RequirePermission permission="property.create">
            <PropertyCreate />
          </RequirePermission>,
        ),
      },
      // 'edit' before ':id' so the detail route doesn't swallow it. Editing is
      // gated — an agent reaching /properties/:id/edit by URL is denied rather
      // than shown a form whose submit would 403.
      {
        path: 'properties/:id/edit',
        element: lazyRoute(
          <RequirePermission permission="property.update">
            <PropertyEdit />
          </RequirePermission>,
        ),
      },
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
      // The matching screen is admin territory — it creates clients and assigns
      // properties. Gated by client.assignProperty, which agents don't hold.
      {
        path: 'requirements',
        element: lazyRoute(
          <RequirePermission permission="client.assignProperty">
            <RequirementMatch />
          </RequirePermission>,
        ),
      },
      {
        path: 'activity',
        element: lazyRoute(
          <RequirePermission permission="activity.list">
            <Activity />
          </RequirePermission>,
        ),
      },
      {
        path: 'settings',
        element: lazyRoute(
          <RequirePermission permission="settings.view">
            <Settings />
          </RequirePermission>,
        ),
      },
      {
        path: 'settings/roles',
        element: lazyRoute(
          <RequirePermission permission="rbac.role.list">
            <Roles />
          </RequirePermission>,
        ),
      },
      { path: 'design-system', element: lazyRoute(<DesignSystem />) },
      { path: '*', element: lazyRoute(<NotFound />) },
    ],
  },
])
