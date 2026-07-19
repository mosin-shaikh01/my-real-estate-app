# Deploying to Render (Free Plan) — Step-by-Step Guide

A complete, beginner-friendly walkthrough for deploying this **Real Estate CRM**
to [Render](https://render.com) on the **Free plan**. No prior Render experience
assumed.

This project is a monorepo:

| Part | Stack | Role |
|---|---|---|
| `apps/web` | React 19 + Vite 8 + TypeScript | The SPA (frontend) |
| `apps/api` | Express 5 + Prisma 7 + PostgreSQL | The API **and** the web server |
| `packages/shared` | Zod schemas + types | Shared between the two |

**Key idea — one service, one origin.** In production the **API process also
serves the built React app**, so the whole thing is a *single* web service on one
URL. You do **not** deploy the frontend and backend separately. This is what keeps
the login cookies working. Everything below deploys that one service.

---

## ⚠️ Read this first — Render Free plan limitations

The free plan is great for demos, but know these before you start:

- **Uploaded files do NOT persist.** Free web services have **no persistent
  disk**. This app stores uploaded property images/documents on disk
  (`UPLOAD_DIR`). On the free plan those files are **wiped on every restart,
  redeploy, and spin-down**. The app runs fine; only *previously uploaded media*
  disappears. To keep media, upgrade to a paid instance with a Disk (or move media
  to S3 — future work). Text data in PostgreSQL is unaffected and persists.
- **The service sleeps after 15 minutes of inactivity.** The first request after
  it sleeps takes ~30–60 seconds to wake ("cold start"). Normal for free.
- **The free PostgreSQL database expires after 30 days** and is capped at ~1 GB.
  Render emails you before expiry. Fine for a demo; back up anything you care about.
- **No Shell access** on free instances. That's why we seed the database via the
  build/start commands below instead of running a command manually.

> 💡 If this is a client demo that must "just work" long-term, the paid **Starter**
> instance ($7/mo) removes the sleep, and adding a **Disk** makes uploads persist.
> The steps are identical — you just pick a paid instance type.

---

## 1. Prerequisites

### Accounts you need (all free)

1. **A GitHub account** with this repository pushed to it. This project's remote is:
   `https://github.com/mosin-shaikh01/my-real-estate-app` on branch `feat/foundation`.
2. **A Render account** — sign up at <https://render.com> and choose *"Sign in with
   GitHub"* so Render can see your repositories.

### What Render will host for you

- **One Web Service** (the Node app that serves API + React).
- **One PostgreSQL database** (created on Render, free).

### Environment variables you'll need ready

You must generate **two secrets** before you start (details in
[section 5](#5-environment-variables)). Generate them now with Node:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Run it **twice** and keep both values — one for `JWT_ACCESS_SECRET`, one for
`JWT_REFRESH_SECRET`. Each must be at least 32 characters (these are 64). The app
**refuses to start** without them.

---

## 2. Project Preparation (do this locally first)

Always confirm the project builds on your own machine before deploying — it's far
easier to debug locally than in Render's logs.

From the project root (`my-real-estate-app/`):

```bash
# 1. Install dependencies (this also runs `prisma generate` via postinstall)
npm install

# 2. Generate the Prisma client explicitly (safe to re-run; part of build too)
npm run db:generate

# 3. Build everything: Prisma client + the React SPA into apps/web/dist
npm run build

# 4. (Optional but recommended) run the full test suite
npm test
```

- `npm run build` runs `prisma generate` **and** `vite build`. If it finishes with
  a `✓ built in ...` line and no errors, you're good.
- The API itself is **not** compiled to JavaScript — it runs directly from
  TypeScript through **`tsx`** (which is a *production* dependency, so Render will
  have it). This is intentional; don't look for a `dist/` folder for the API.

> ⚠️ The generated Prisma client (`apps/api/src/generated/`) is **gitignored on
> purpose**. Don't try to commit it. Render regenerates it during the build. This
> is why `postinstall` and the build command both run `prisma generate`.

### Commit and push

Render deploys whatever is on your GitHub branch, so commit and push:

```bash
git add -A
git commit -m "chore: prepare for Render deployment"
git push origin feat/foundation
```

> 💡 If your work is already on `feat/foundation` and pushed, you can skip this.
> You'll point Render at that branch in [section 4](#4-render-deployment).

---

## 3. Database Setup (create PostgreSQL on Render)

Create the database **before** the web service, so its connection string is ready.

1. In the Render dashboard, click **New +** → **PostgreSQL**.
2. Fill in:
   - **Name:** `real-estate-crm-db` (anything you like)
   - **Database:** `real_estate_crm`
   - **User:** `crm_app`
   - **Region:** pick one close to you — **remember it**, your web service must use
     the **same region** for the fast internal connection.
   - **Plan:** **Free**
3. Click **Create Database** and wait until its status is **Available**.

> 📸 *Screenshot: the "New PostgreSQL" form with Free plan selected.*

### Get the connection string

On the database's page, find the **Connections** section. You'll see two URLs:

| URL | Use it for |
|---|---|
| **Internal Database URL** | ✅ Your web service (same region). Faster, no egress. |
| **External Database URL** | Connecting from your laptop / outside Render. |

Copy the **Internal Database URL** — you'll paste it as `DATABASE_URL` when creating
the web service. It looks like:

```
postgresql://crm_app:SdCj98CnxNjDDystcOxN4XiG9jpYz9dM@dpg-d9d6dt37uimc73fm9ce0-a/real_estate_crm_5oet
```

> 💡 **Prisma tip:** append `?schema=public` to the URL if it isn't already there.
> If your password contains special characters (`@`, `#`, `:`…), they must be
> **URL-encoded** (`@` → `%40`). Render's generated passwords are usually safe, but
> check.

Migrations are applied automatically at deploy time (see the Start Command in
[section 4](#4-render-deployment) and [section 6](#6-prisma-configuration)) — you
do **not** need to run them by hand.

---

## 4. Render Deployment (create the Web Service)

1. Click **New +** → **Web Service**.
2. **Connect the GitHub repository**: choose `mosin-shaikh01/my-real-estate-app`.
   If you don't see it, click *"Configure account"* and grant Render access to the
   repo, then come back.

   > 📸 *Screenshot: repository picker showing the repo.*

3. Now fill in the settings:

| Setting | Value | Notes |
|---|---|---|
| **Name** | `real-estate-crm` | Becomes your URL: `real-estate-crm.onrender.com` |
| **Region** | **Same as the database** | Required for the Internal Database URL to work |
| **Branch** | `feat/foundation` | Or `main` if you merge there first |
| **Root Directory** | *(leave blank)* | It's a monorepo — build runs from the repo root |
| **Runtime / Language** | **Node** | Auto-detected |
| **Instance Type** | **Free** | |

4. **Build Command** — this installs deps, generates the Prisma client, and builds
   the React app:

   ```bash
   npm ci && npm run build
   ```

   > 💡 If `npm ci` ever errors about the lockfile, use `npm install && npm run build`
   > instead. `npm ci` is stricter and preferred (the lockfile is committed).

   > ℹ️ **Why this works even though Render sets `NODE_ENV=production`.** Render (and
   > most hosts) set `NODE_ENV=production`, which normally makes npm **skip
   > `devDependencies`** — and this build needs them (Vite, the Vite plugins,
   > TypeScript, and the Prisma CLI). A committed **`.npmrc`** at the repo root with
   > `include=dev` forces them to install anyway, so the command above needs no
   > special flags. Don't remove that file.

5. **Start Command** — apply any pending migrations, then start the server. This is
   the reliable free-plan pattern (no separate pre-deploy step needed):

   ```bash
   npm run db:deploy && npm start
   ```

   `db:deploy` runs `prisma migrate deploy`, which is **idempotent** — it does
   nothing when there are no new migrations, so it's safe to run on every boot.

   > 💡 **First deploy only — seed the demo data.** The free plan has no Shell, so to
   > create the seeded admin/agent/client/property records, temporarily use:
   >
   > ```bash
   > npm run db:deploy && npm run db:seed && npm start
   > ```
   >
   > The seed is idempotent (safe to re-run), but after the first successful deploy
   > you can edit the Start Command back to `npm run db:deploy && npm start` to speed
   > up cold starts. Do this in **Settings → Build & Deploy** later.

6. **Advanced → Health Check Path:** set it to:

   ```
   /api/health
   ```

   This endpoint returns `{ ok: true }` and touches no database, so Render can tell
   when your app is live.

7. **Auto-Deploy:** leave it **On** (default). Every push to the selected branch
   redeploys automatically.

8. Don't click *Create* yet — first add the environment variables (next section).
   Render lets you add them on this same screen under **Environment Variables**.

> 📸 *Screenshot: the Web Service settings form with Build/Start commands filled in.*

---

## 5. Environment Variables

Add these under **Environment Variables** on the service (you can also add/edit them
later in **Environment**). The app validates them at startup with Zod and **exits
with a clear error** if a required one is missing or invalid.

### Required

| Variable | Example / Value | Secret? | What it does |
|---|---|:---:|---|
| `DATABASE_URL` | *(the Internal Database URL from section 3)* | 🔒 Yes | PostgreSQL connection string Prisma uses. |
| `JWT_ACCESS_SECRET` | *(64-char value you generated)* | 🔒 Yes | Signs short-lived access tokens. Must be ≥ 32 chars. |
| `JWT_REFRESH_SECRET` | *(a different 64-char value)* | 🔒 Yes | Signs refresh tokens. Must be ≥ 32 chars, **different** from the access secret. |
| `NODE_ENV` | `production` | No | Turns on secure cookies **and** SPA serving. Deploy will misbehave without it. |

### Do NOT set

| Variable | Why |
|---|---|
| `PORT` | **Render sets this automatically** and the app reads it (`process.env.PORT`). If you set it yourself, Render's health check may fail. Leave it alone. |

### Optional (sensible defaults already exist)

| Variable | Default | When to set it |
|---|---|---|
| `SERVE_WEB` | on when `NODE_ENV=production` | Leave unset. Only set `false` if you ever split the frontend off. |
| `UPLOAD_DIR` | `./uploads` | Where media is written. ⚠️ Ephemeral on free plan. Leave default. |
| `ACCESS_TOKEN_TTL` | `15m` | Change token lifetime. |
| `REFRESH_TOKEN_TTL` | `7d` | Change refresh lifetime. |
| `MAILER` | `console` | Password-reset transport. `console` logs reset links to the Render logs. |
| `WEB_ORIGIN` | `http://localhost:5173` | Currently **not used at runtime** (there's no CORS — the app is single-origin). Safe to set to your Render URL `https://real-estate-crm.onrender.com` for correctness/future use, but not required. |
| `WEB_DIST_DIR` | *(auto: `apps/web/dist`)* | Only if the built SPA is somewhere non-standard. |

> 🔒 **Secrets:** `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are
> secrets. Never commit them to Git — they live only in Render's Environment
> settings. The repo's real `.env` is gitignored; only `apps/api/.env.example`
> (a template with placeholders) is committed.

Now click **Create Web Service**. Render will run the build. Watch the logs
(section 7).

> 📸 *Screenshot: Environment Variables section with the three secrets added.*

---

## 6. Prisma Configuration (how it works here)

This project uses **Prisma 7**, which is configured a little differently from older
guides you may find online. You don't need to change anything — this explains what's
happening so nothing surprises you.

- **Prisma Client generation.** The client is generated into
  `apps/api/src/generated/prisma` (gitignored). It's produced:
  - on `npm install` via the `postinstall` script (`prisma generate`), and
  - again during `npm run build`.

  So by the time your app starts, the client exists. **You never commit it.**

- **`prisma migrate deploy`** (our `npm run db:deploy`) applies committed migrations
  to the production database. It's in the **Start Command**, runs at boot, and is
  idempotent. This is the correct production command — **never** use
  `prisma migrate dev` or `prisma migrate reset` against production (they can prompt,
  create shadow databases, or wipe data).

- **Driver adapter (Prisma 7 specifics).** Prisma 7 removed `datasource.url` from
  `schema.prisma`. Instead:
  - **Migrations** read the URL from `apps/api/prisma.config.ts`, which reads
    `process.env.DATABASE_URL`.
  - **The running app** connects through a **driver adapter** (`@prisma/adapter-pg`)
    in `apps/api/src/lib/prisma.ts`, also using `DATABASE_URL`.

  The single thing you must get right is the `DATABASE_URL` environment variable —
  both paths use it.

### Common Prisma deployment issues

| Symptom | Cause & fix |
|---|---|
| `Cannot find module '../generated/prisma/client'` | `prisma generate` didn't run. Ensure the **Build Command** is `npm ci && npm run build` (both run generate). |
| `Environment variable not found: DATABASE_URL` | `DATABASE_URL` isn't set on the service, or has a typo. Add it in **Environment**. |
| Migrations "can't reach database" during deploy | The Internal Database URL only works **within the same region**. Confirm DB and web service share a region. |
| `P3009` / failed migration | A previous migration failed midway. Check the DB state; you may need to resolve it (paid Shell) or recreate the free DB for a demo. |

---

## 7. Post-Deployment Verification

Once Render shows the service as **Live** (green), verify it end to end. Replace
`YOUR-APP` with your service name.

1. **App starts** — in **Logs**, look for:
   ```
   {"level":"info","msg":"API listening on http://localhost:10000","env":"production"}
   ```
   (The port will be Render's internal port, not 4000 — that's expected.)

2. **Health endpoint** — open in a browser or curl:
   ```bash
   curl https://YOUR-APP.onrender.com/api/health
   # → {"ok":true,"ts":"..."}
   ```

3. **The React app loads** — visit:
   ```
   https://YOUR-APP.onrender.com/
   ```
   You should see the login screen (not a 404). Visiting a client route like
   `/properties` directly should also load the app (proves SPA fallback works).

4. **Authentication works** — log in with a seeded demo account (created if you ran
   the seed in the Start Command):
   - Email: `admin@demo.local`
   - Password: `Passw0rd!`

   A successful login proves cookies are being set and the database is connected.
   (Other seeded logins: `agent@demo.local`, `agent2@demo.local`, same password.)

5. **Database connectivity** — after logging in, the dashboard and Properties list
   loading real data confirms Prisma is talking to PostgreSQL.

6. **Check the logs** — in Render's **Logs** tab you'll see one JSON line per
   request (`method`, `path`, `status`, `ms`). Errors are logged there too.

> 📸 *Screenshot: Render Logs showing "API listening" and a successful request.*

---

## 8. Troubleshooting

### Build failures
- Open **Logs** → the build section. Reproduce locally with `npm ci && npm run build`.
- Lockfile mismatch on `npm ci`? Switch the Build Command to
  `npm install && npm run build`, or run `npm install` locally and commit the updated
  `package-lock.json`.

### `Cannot find package 'vite'` / `@vitejs/plugin-react` / `@tailwindcss/vite` (devDependencies missing)
- **Cause:** Render sets `NODE_ENV=production`, and npm then **omits
  `devDependencies`** — but the SPA build needs Vite, its plugins, and TypeScript,
  all of which are devDependencies.
- **Fix (already in this repo):** the root **`.npmrc`** contains `include=dev`,
  which forces devDependencies to install even under `NODE_ENV=production`. If you
  hit this error, confirm `.npmrc` exists at the repo root and is committed. As a
  one-off you can also set the Build Command to `npm ci --include=dev && npm run build`,
  but the `.npmrc` makes that unnecessary on every platform.
- The same `.npmrc` is why the **Prisma CLI** (also a devDependency) is available
  for `prisma generate` and `migrate deploy`.

### Missing Prisma Client (`Cannot find module '.../generated/prisma/client'`)
- The Build Command must include a step that runs `prisma generate`. Use
  `npm ci && npm run build` (both `postinstall` and `build` generate it). Don't try
  to commit the generated folder — it's gitignored intentionally.

### TypeScript errors during build
- The **web** build type-checks (`tsc -b && vite build`). Run `npm run build` locally
  to see the exact file/line. The API runs via `tsx` and is type-checked separately
  with `npm run typecheck` — run that locally if the API misbehaves at runtime.

### Environment variable issues
- The app prints exactly which variable is wrong at startup, e.g.
  `JWT_ACCESS_SECRET: must be >= 32 chars`. Read the first lines of the logs after a
  crash — the Zod validator lists every problem. Fix the value in **Environment**;
  Render redeploys automatically.

### Database connection failures
- `DATABASE_URL` wrong/missing → set the **Internal Database URL**.
- DB and web service in **different regions** → the internal URL won't resolve.
  Recreate the web service in the database's region (or vice-versa).
- Password with special characters → URL-encode them (`@` → `%40`, etc.).

### Module resolution issues (`Cannot find package '@app/shared'`)
- This is an npm **workspaces** monorepo. Ensure **Root Directory is blank** so the
  install runs from the repo root and links the workspaces. Never set the Root
  Directory to `apps/api`.

### Port binding issues ("No open ports detected")
- **Do not set `PORT` yourself.** Render injects it; the app reads `process.env.PORT`
  and listens on all interfaces automatically. Remove any manual `PORT` variable.
- Make sure the Health Check Path is `/api/health`.

### Startup failures / app crashes on boot
- `NODE_ENV` not set to `production` → set it (also required for secure cookies +
  SPA serving).
- Migration failure at start → check the `db:deploy` output in the logs.
- App boots but `/` shows a JSON 404 instead of the site → the SPA wasn't built.
  Confirm the Build Command ran `npm run build` and produced `apps/web/dist`.

### Uploaded images disappear
- Expected on the **free plan** (no persistent disk). See the limitations at the top.
  Upgrade to a paid instance + Disk to persist media.

---

## 9. Deployment Checklist

Tick these off:

- [ ] Repo is pushed to GitHub on the branch Render will deploy (`feat/foundation`).
- [ ] Local `npm install` succeeds (Prisma client generated via postinstall).
- [ ] Local `npm run build` succeeds (Prisma client + `apps/web/dist`).
- [ ] Two JWT secrets generated (≥ 32 chars each).
- [ ] Render **PostgreSQL (Free)** created and **Available**.
- [ ] **Internal Database URL** copied (with `?schema=public`).
- [ ] Web Service created, **Root Directory blank**, **Runtime = Node**, **same region** as DB.
- [ ] **Build Command:** `npm ci && npm run build`.
- [ ] **Start Command:** `npm run db:deploy && npm start` (add `&& npm run db:seed` for the first deploy).
- [ ] **Health Check Path:** `/api/health`.
- [ ] Env vars set: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`. `PORT` **not** set.
- [ ] Service shows **Live**; logs show `API listening`.
- [ ] `/api/health` returns `{ ok: true }`.
- [ ] Site loads at `/` and a deep link like `/properties` loads the app.
- [ ] Login works with `admin@demo.local` / `Passw0rd!`.
- [ ] Dashboard/Properties show data (DB connected).

---

## 10. Future Updates

### Redeploy after new commits
With **Auto-Deploy** on, just push:

```bash
git push origin feat/foundation
```

Render detects the push and rebuilds automatically. You can also click **Manual
Deploy → Deploy latest commit** in the dashboard.

### Apply new Prisma migrations
1. Create the migration locally and commit it (it lands in `apps/api/prisma/migrations/`).
2. Push. Because the Start Command runs `npm run db:deploy` on boot, the new
   migration is applied automatically on the next deploy. No manual step.

> ⚠️ Only ever commit migrations made with the proper local workflow. Never point
> `prisma migrate dev`/`reset` at the production database.

### Monitor logs
- **Logs** tab shows live output (one JSON line per request, plus errors).
- **Events** tab shows deploy history and health-check status.
- **Metrics** tab shows CPU/memory (limited detail on free).

### Roll back a bad deploy
- Go to the service → **Events** (or **Deploys**), find the last good deploy, and
  click **Rollback** / **Redeploy** on it.
- Alternatively `git revert <bad-commit>` and push — Render redeploys the reverted
  code.
- ⚠️ Rolling back **code** does **not** undo a **database migration**. Prisma
  migrations are forward-only; to reverse a schema change you write a new migration.

---

### Related docs
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — platform-agnostic deployment notes
  (Docker, VPS, the single-origin model, and the serverless caveat).
- [`CLAUDE.md`](CLAUDE.md) — project rules and environment reference.
- [`apps/api/.env.example`](apps/api/.env.example) — annotated environment template.
</content>
