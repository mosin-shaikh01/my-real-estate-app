import 'dotenv/config'
import { z } from 'zod'

// Fail fast at boot on a missing secret, rather than at 2am on the first
// token refresh. This file is imported before anything touches the DB.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Windows note: special characters in the password MUST be URL-encoded here.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAILER: z.enum(['console', 'ethereal', 'smtp']).default('console'),

  // Public base URL used to build absolute links in emails (e.g. the password
  // reset link). Optional: when unset we derive it from the request in
  // production (single origin) and fall back to WEB_ORIGIN in dev (the Vite
  // server that actually serves the SPA). Set it explicitly behind proxies/CDNs
  // where the request host isn't the public host.
  APP_URL: z.string().url().optional(),

  // Key material for encrypting stored secrets at rest (e.g. the SMTP password).
  // Optional: when unset we derive a stable key from JWT_REFRESH_SECRET, so the
  // app is deployable with ZERO extra config. Set a dedicated value if you want
  // to rotate it independently of the auth secrets. Rotating the source
  // invalidates stored secrets (re-enter them in Settings) — never the app.
  APP_ENCRYPTION_KEY: z.string().min(16).optional(),

  // Deployment: in production the API process also serves the built SPA so the
  // whole app is one origin (which is what keeps the httpOnly auth cookies
  // working without CORS). Defaults to on in production; override to decouple
  // the two behind a reverse proxy. WEB_DIST_DIR points at apps/web/dist and is
  // only consulted when serving is on.
  SERVE_WEB: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1')),
  WEB_DIST_DIR: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
