import type { Request } from 'express'
import { env, isProd } from './env.js'

/**
 * The public origin the browser is using, for building absolute links in emails.
 *
 * Priority: an explicit APP_URL wins (proxies/CDNs where the request host isn't
 * public). Otherwise, in dev the SPA is served by the Vite server, so links must
 * point at WEB_ORIGIN (:5173), not the API (:4000). In production the API serves
 * the SPA on one origin, so the request's own host is correct — and `trust proxy`
 * makes req.protocol reflect the real https scheme behind the platform's proxy.
 */
export function appOrigin(req: Request): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, '')
  if (!isProd) return env.WEB_ORIGIN.replace(/\/+$/, '')
  const host = req.get('host') ?? `localhost:${env.PORT}`
  return `${req.protocol}://${host}`
}
