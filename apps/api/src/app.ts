import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Express, type Router } from 'express'
import cookieParser from 'cookie-parser'
import { env, isProd } from './lib/env.js'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler, notFoundHandler, requestId } from './middleware/error-handler.js'
import { requestLog } from './middleware/request-log.js'
import { publicRoute } from './middleware/route-registry.js'
import { activityRouter, rbacRouter, searchRouter } from './routes/admin-routes.js'
import { agentRouter } from './routes/agent-routes.js'
import { amenityRouter } from './routes/amenity-routes.js'
import { authRouter } from './routes/auth-routes.js'
import { clientRouter } from './routes/client-routes.js'
import { dashboardRouter } from './routes/dashboard-routes.js'
import { mediaRouter } from './routes/media-routes.js'
import { meRouter } from './routes/me-routes.js'
import { profileRouter } from './routes/profile-routes.js'
import { propertyRouter } from './routes/property-routes.js'
import { settingsRouter } from './routes/settings-routes.js'

/**
 * Declared mount table.
 *
 * Exported so the route-manifest test can walk every router without reaching
 * into Express internals. That matters: Express 5 dropped `layer.regexp` in
 * favour of opaque `matchers` functions, so mount paths are no longer
 * recoverable from the stack. Declaring them is both more honest and more
 * stable than reverse-engineering a private field that already broke once.
 *
 * `requiresAuth` documents which mounts sit behind authenticate(). Routes still
 * declare their own permission — authenticate answers "who", requirePermission
 * answers "may they".
 */
export const ROUTE_MOUNTS: ReadonlyArray<{
  path: string
  router: Router
  requiresAuth: boolean
}> = [
  { path: '/api/auth', router: authRouter, requiresAuth: false },
  // Mixed public/protected (branding is read pre-auth), so authenticate is NOT
  // applied at the mount — the write routes declare it themselves.
  { path: '/api/settings', router: settingsRouter, requiresAuth: false },
  { path: '/api/me', router: meRouter, requiresAuth: true },
  { path: '/api/profile', router: profileRouter, requiresAuth: true },
  { path: '/api/clients', router: clientRouter, requiresAuth: true },
  { path: '/api/properties', router: propertyRouter, requiresAuth: true },
  { path: '/api/amenities', router: amenityRouter, requiresAuth: true },
  { path: '/api/agents', router: agentRouter, requiresAuth: true },
  { path: '/api/dashboard', router: dashboardRouter, requiresAuth: true },
  { path: '/api/media', router: mediaRouter, requiresAuth: true },
  { path: '/api/activity-logs', router: activityRouter, requiresAuth: true },
  { path: '/api/search', router: searchRouter, requiresAuth: true },
  { path: '/api/rbac', router: rbacRouter, requiresAuth: true },
]

export function createApp() {
  const app = express()

  // req.ip is logged and stored on sessions; behind the Vite proxy it would
  // otherwise always read as the proxy's address.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(requestId)
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(requestLog)

  // No CORS middleware, deliberately: dev is same-origin through the Vite
  // proxy and prod serves the SPA from the same origin. Adding CORS here would
  // invite the cross-origin cookie problems the proxy exists to avoid.

  app.get('/api/health', publicRoute('Liveness probe'), (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() })
  })

  for (const mount of ROUTE_MOUNTS) {
    if (mount.requiresAuth) app.use(mount.path, authenticate, mount.router)
    else app.use(mount.path, mount.router)
  }

  // In production the same process serves the built SPA, so the whole app is one
  // origin. Registered AFTER the /api routes and BEFORE the 404 handler, so API
  // misses still return the JSON error envelope while browser navigations fall
  // back to index.html.
  if (env.SERVE_WEB ?? isProd) serveWebApp(app)

  // Express 5 / path-to-regexp v8: no bare '*' wildcard. Omitting the path
  // entirely is the catch-all now.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Serve the compiled SPA (apps/web/dist) and fall back to index.html for client
 * routes. Uses a plain middleware for the fallback rather than a wildcard route
 * to sidestep path-to-regexp v8 entirely. Assets are content-hashed by Vite, so
 * they cache hard; index.html is never cached, so a deploy is picked up at once.
 */
function serveWebApp(app: Express): void {
  const here = path.dirname(fileURLToPath(import.meta.url)) // apps/api/src
  const webDist = env.WEB_DIST_DIR
    ? path.resolve(env.WEB_DIST_DIR)
    : path.resolve(here, '../../web/dist')
  const indexHtml = path.join(webDist, 'index.html')

  app.use(
    express.static(webDist, {
      index: false,
      maxAge: '1y',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(indexHtml, (err) => {
      // Missing build output → let the JSON 404 handler answer rather than 500.
      if (err) next()
    })
  })
}
