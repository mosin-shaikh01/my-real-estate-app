import express, { type Router } from 'express'
import cookieParser from 'cookie-parser'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler, notFoundHandler, requestId } from './middleware/error-handler.js'
import { requestLog } from './middleware/request-log.js'
import { publicRoute } from './middleware/route-registry.js'
import { authRouter } from './routes/auth-routes.js'
import { clientRouter } from './routes/client-routes.js'
import { dashboardRouter } from './routes/dashboard-routes.js'
import { propertyRouter } from './routes/property-routes.js'

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
  { path: '/api/clients', router: clientRouter, requiresAuth: true },
  { path: '/api/properties', router: propertyRouter, requiresAuth: true },
  { path: '/api/dashboard', router: dashboardRouter, requiresAuth: true },
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

  // Express 5 / path-to-regexp v8: no bare '*' wildcard. Omitting the path
  // entirely is the catch-all now.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
