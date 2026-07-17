# Deployment

How this app deploys, and why it deploys the way it does. Read this before
putting it on any host.

## The one idea: single origin

The SPA calls the API with **relative `/api/...`** paths, and auth is carried by
**httpOnly cookies** that are `SameSite=Lax` and (in production) `Secure`. For
those cookies to be sent, the browser must load the SPA and reach the API on the
**same origin**. So the supported production topology is:

```
        ┌─────────────────────────────────────────┐
 HTTPS  │  one Node process (apps/api, via tsx)    │
───────▶│   • GET /            → apps/web/dist SPA  │
        │   • GET /assets/*     → hashed bundles    │
        │   • /api/*            → Express + Prisma  │──▶ PostgreSQL
        │   • uploaded media    → UPLOAD_DIR volume │──▶ persistent disk
        └─────────────────────────────────────────┘
```

`NODE_ENV=production` turns on SPA serving automatically (`SERVE_WEB` defaults to
on). One build, one process, one origin — which is exactly why it runs the same
on a VPS, Docker, Railway, Render, Fly, or Hostinger's Node hosting with no
code changes.

> **Serverless caveat (Vercel/Netlify Functions, Lambda).** This API is a
> long-running Express server that writes uploaded media to a local disk. That is
> a poor fit for ephemeral, read-only serverless filesystems: uploads would
> vanish between invocations. Host the **API** on a persistent runtime (any of
> the platforms above). You *may* serve the static SPA from a CDN/Vercel, but
> then you must reverse-proxy `/api` to the API origin so cookies stay
> same-origin — otherwise auth breaks. The turnkey path is the single process
> above. Moving media to object storage (S3) is the prerequisite for a truly
> serverless API and is already flagged as future work.

## Requirements

- **Node 22+** (`.nvmrc` pins 22; `engines.node` enforces `>=22`).
- **PostgreSQL 16/17**, reachable via `DATABASE_URL`.
- A **persistent, writable directory** for `UPLOAD_DIR`.
- HTTPS in front (any platform's managed TLS, or a reverse proxy). Required
  because production auth cookies are `Secure`.

## Environment variables

Set these on the host (see `apps/api/.env.example` for the annotated template).
The app **validates them at boot and exits** if any required one is missing.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. URL-encode special chars in the password. |
| `JWT_ACCESS_SECRET` | ✅ | ≥ 32 chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_REFRESH_SECRET` | ✅ | ≥ 32 chars, different from the access secret. |
| `NODE_ENV` | ▲ | Set to `production`. Enables `Secure` cookies + SPA serving. |
| `PORT` | ▲ | Defaults to `4000`. Most platforms inject this. |
| `WEB_ORIGIN` | ▲ | The app's public URL in production (e.g. `https://crm.example.com`). |
| `UPLOAD_DIR` | ▲ | Absolute path to a persistent volume (e.g. `/data/uploads`). |
| `SERVE_WEB` | — | `true`/`false`. Defaults to on in production. |
| `WEB_DIST_DIR` | — | Absolute path to the built SPA if not the default `apps/web/dist`. |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | — | Default `15m` / `7d`. |
| `MAILER` | — | `console` (default) logs reset links; `smtp` for a real transport. |

## Build & run (any Node host)

From a clean clone:

```bash
npm ci                    # installs deps; postinstall runs `prisma generate`
npm run build             # generates the Prisma client + builds apps/web/dist
npm run db:deploy         # applies migrations (prisma migrate deploy)
npm run db:seed           # optional: demo admin/agents/clients/properties
NODE_ENV=production npm start
```

- **`npm run build`** generates the Prisma client and the SPA bundle. The API
  itself is **not** transpiled — it runs from TypeScript through `tsx` (a
  production dependency), which resolves the path aliases and the `@app/shared`
  source that a plain `tsc` emit cannot. This is a deliberate, documented choice
  (see `docs/ARCHITECTURE.md`).
- **`npm start`** runs the API, which serves both `/api` and the SPA.
- **`db:deploy` is the release step** — `prisma migrate deploy` is idempotent and
  applies only pending migrations. Never run `migrate dev` or `migrate reset`
  against a production database.

## Docker (covers Docker, VPS, Railway, Render, Fly, DO/AWS/Azure/GCP)

A multi-stage `Dockerfile` builds the SPA + Prisma client and runs the
single-origin process. `docker-compose.yml` adds Postgres and volumes for local
parity with production:

```bash
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") \
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") \
docker compose up --build
# → http://localhost:4000
docker compose exec api npm run db:seed -w @app/api   # optional demo data
```

The container's `CMD` runs `db:deploy` (idempotent) then starts the server.
Mount a volume at `UPLOAD_DIR` (`/data/uploads` in the image) and point
`DATABASE_URL` at a managed Postgres in real deployments.

## Platform notes

- **Railway / Render / Fly / any Node buildpack** — Build command `npm run build`,
  start command `npm start`, and a release/pre-deploy command `npm run db:deploy`.
  Set the env vars above; attach a persistent disk mounted at `UPLOAD_DIR`. Point
  the platform's health check at `GET /api/health`.
- **Hostinger Node / generic VPS** — `npm ci && npm run build && npm run db:deploy`,
  then run `npm start` under a process manager (pm2/systemd) behind Nginx with TLS.
- **Health check** — `GET /api/health` returns `{ ok: true, ts }` and touches no
  database, so it is safe as a liveness/readiness probe.

## What to verify after a deploy

1. `GET /api/health` → `200 { ok: true }`.
2. The site loads at `/` and a client-side route (e.g. `/properties`) returns the
   SPA, not a 404.
3. Login works (cookies are set and sent back — proves same-origin + HTTPS).
4. An image upload survives a process restart (proves `UPLOAD_DIR` is persistent).
