import type { Router } from 'express'
import { describe, expect, it } from 'vitest'
import { isPermissionKey } from '@app/shared'
import { ROUTE_MOUNTS } from '../src/app.js'
import { activityRouter, rbacRouter, searchRouter } from '../src/routes/admin-routes.js'
import { agentRouter } from '../src/routes/agent-routes.js'
import { amenityRouter } from '../src/routes/amenity-routes.js'
import { authRouter } from '../src/routes/auth-routes.js'
import { clientRouter } from '../src/routes/client-routes.js'
import { dashboardRouter } from '../src/routes/dashboard-routes.js'
import { mediaRouter } from '../src/routes/media-routes.js'
import { meRouter } from '../src/routes/me-routes.js'
import { notificationRouter } from '../src/routes/notification-routes.js'
import { profileRouter } from '../src/routes/profile-routes.js'
import { propertyRouter } from '../src/routes/property-routes.js'
import { settingsRouter } from '../src/routes/settings-routes.js'

// ============================================================================
// The route-manifest test
// ============================================================================
// Asserts that EVERY route either carries a requirePermission(...) guard or an
// explicit publicRoute('<why>') exemption.
//
// This is the answer to "how do you stop someone forgetting a guard": you make
// forgetting it a build failure rather than a silent public endpoint. You
// cannot avoid one DECLARATION per route and shouldn't try — but you can prove
// none was missed.
//
// It reads route.path/route.stack (stable) and the declared ROUTE_MOUNTS table
// rather than layer.regexp — Express 5 removed that field, which is exactly why
// mounts are declared in app.ts instead of reverse-engineered from internals.
// ============================================================================

interface RouteInfo {
  method: string
  path: string
  permission: string | null
  publicReason: string | null
}

function routesOf(router: Router, prefix: string): RouteInfo[] {
  const stack = (router as unknown as { stack: RouterLayer[] }).stack
  const out: RouteInfo[] = []

  for (const layer of stack) {
    if (!layer.route) continue
    const handlers = layer.route.stack.map((s) => s.handle as Record<string, unknown>)
    const permission = (handlers.map((h) => h?.['requiredPermission']).find(Boolean) as string) ?? null
    const publicReason = (handlers.map((h) => h?.['publicReason']).find(Boolean) as string) ?? null

    for (const method of Object.keys(layer.route.methods)) {
      if (method === '_all') continue
      out.push({
        method: method.toUpperCase(),
        path: prefix + (layer.route.path === '/' ? '' : layer.route.path),
        permission,
        publicReason,
      })
    }
  }
  return out
}

interface RouterLayer {
  route?: {
    path: string
    methods: Record<string, boolean>
    stack: Array<{ handle: unknown }>
  }
}

const ALL_ROUTES: RouteInfo[] = [
  // /api/health is declared inline on the app rather than in a router.
  { method: 'GET', path: '/api/health', permission: null, publicReason: 'Liveness probe' },
  ...routesOf(authRouter, '/api/auth'),
  ...routesOf(settingsRouter, '/api/settings'),
  ...routesOf(meRouter, '/api/me'),
  ...routesOf(profileRouter, '/api/profile'),
  ...routesOf(clientRouter, '/api/clients'),
  ...routesOf(propertyRouter, '/api/properties'),
  ...routesOf(agentRouter, '/api/agents'),
  ...routesOf(amenityRouter, '/api/amenities'),
  ...routesOf(dashboardRouter, '/api/dashboard'),
  ...routesOf(notificationRouter, '/api/notifications'),
  ...routesOf(mediaRouter, '/api/media'),
  ...routesOf(activityRouter, '/api/activity-logs'),
  ...routesOf(searchRouter, '/api/search'),
  ...routesOf(rbacRouter, '/api/rbac'),
]

describe('route manifest', () => {
  it('finds the routes at all (guards the walker itself)', () => {
    // Without this, a walker that silently returned [] would make every
    // assertion below vacuously pass — a test worse than no test.
    expect(ALL_ROUTES.length).toBeGreaterThan(5)
  })

  it('the mount table covers every router the app registers', () => {
    // If someone adds a router to createApp() but not to ROUTE_MOUNTS, its
    // routes would never be audited here. Catch that.
    expect(ROUTE_MOUNTS.map((m) => m.path).sort()).toEqual([
      '/api/activity-logs',
      '/api/agents',
      '/api/amenities',
      '/api/auth',
      '/api/clients',
      '/api/dashboard',
      '/api/me',
      '/api/media',
      '/api/notifications',
      '/api/profile',
      '/api/properties',
      '/api/rbac',
      '/api/search',
      '/api/settings',
    ])
  })

  it('every route is either permission-guarded or explicitly public', () => {
    const unguarded = ALL_ROUTES.filter((r) => !r.permission && !r.publicReason)
    expect(
      unguarded,
      'Unguarded routes. Add requirePermission(...) or publicRoute("<why>"):\n' +
        unguarded.map((r) => `  ${r.method} ${r.path}`).join('\n'),
    ).toEqual([])
  })

  it('every declared permission exists in the shared catalog', () => {
    // Catches a typo'd or deleted permission, which would otherwise fail closed
    // at runtime and silently lock real users out.
    for (const r of ALL_ROUTES) {
      if (r.permission) {
        expect(isPermissionKey(r.permission), `${r.method} ${r.path} -> ${r.permission}`).toBe(true)
      }
    }
  })

  it('public routes carry a stated reason', () => {
    for (const r of ALL_ROUTES) {
      if (r.publicReason !== null) {
        expect(r.publicReason.length, `${r.method} ${r.path}`).toBeGreaterThan(10)
      }
    }
  })

  it('the public surface is exactly what we expect', () => {
    // A snapshot of intent. If this list grows, someone made an endpoint public
    // and this forces it into the diff where a reviewer will see it.
    const publicPaths = ALL_ROUTES.filter((r) => r.publicReason)
      .map((r) => `${r.method} ${r.path}`)
      .sort()

    expect(publicPaths).toEqual([
      'DELETE /api/auth/sessions/:id',
      'GET /api/auth/me',
      'GET /api/auth/sessions',
      'GET /api/health',
      // Self-service: authenticated, but no permission gate — a user acting on
      // their own identity.
      'GET /api/me/preferences',
      'GET /api/profile',
      // Branding must be readable before anyone signs in.
      'GET /api/settings',
      'GET /api/settings/favicon',
      'GET /api/settings/logo',
      'PATCH /api/me/preferences',
      'PATCH /api/profile',
      // Password reset — all pre-auth (they run before a session exists) and all
      // rate limited. forgot never reveals whether an email exists.
      'POST /api/auth/forgot-password',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/logout-all',
      'POST /api/auth/refresh',
      'POST /api/auth/reset-password',
      'POST /api/auth/reset-password/verify',
      'POST /api/profile/change-password',
    ])
  })

  it.each(['/api/clients', '/api/properties', '/api/dashboard'])('every %s route is guarded, none is public', (prefix) => {
    const routes = ALL_ROUTES.filter((r) => r.path.startsWith(prefix))
    expect(routes.length).toBeGreaterThan(0)
    for (const r of routes) {
      expect(r.publicReason, `${r.method} ${r.path} must not be public`).toBeNull()
      expect(r.permission, `${r.method} ${r.path} must declare a permission`).toBeTruthy()
    }
  })

  it.each(['/api/clients', '/api/properties', '/api/dashboard'])(
    '%s sits behind authenticate',
    (prefix) => {
      expect(ROUTE_MOUNTS.find((m) => m.path === prefix)?.requiresAuth).toBe(true)
    },
  )

  it('every permission-guarded write declares a WRITE permission, not a read one', () => {
    // A POST guarded by property.list would be a real hole and would pass every
    // other assertion in this file.
    //
    // Explicitly-public writes are exempt: auth (login/logout/refresh) and
    // self-service profile edits act on the caller's own session/identity, have
    // no resource permission by design, and are pinned by the public-surface
    // snapshot above. The rule here is about writes to OTHER people's data.
    const writes = ALL_ROUTES.filter(
      (r) => ['POST', 'PATCH', 'DELETE'].includes(r.method) && r.publicReason === null,
    )
    expect(writes.length).toBeGreaterThan(0)
    for (const r of writes) {
      expect(r.permission, `${r.method} ${r.path}`).toBeTruthy()
      expect(r.permission, `${r.method} ${r.path} is guarded by a read permission`).not.toMatch(
        /\.(list|view)$/,
      )
    }
  })
})
