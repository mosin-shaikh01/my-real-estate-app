# Architecture

---

## Layout

```
my-real-estate-app/
├── apps/
│   ├── web/               Vite 8 + React 19 SPA — the CRM
│   │   └── src/
│   │       ├── app/       router, providers, query client
│   │       ├── features/  auth/ properties/ clients/ agents/ rbac/ ...
│   │       │              each: api/ components/ pages/
│   │       ├── components/ui/      primitives
│   │       ├── components/layout/  AppShell, Sidebar, Topbar
│   │       ├── lib/       api client, permissions, formatters, cn
│   │       └── styles/    tokens.css
│   └── api/               Express 5 + Prisma 7
│       ├── prisma/        schema, migrations, seed
│       ├── src/lib/       env, prisma, auth
│       ├── src/services/  ALL database access lives here
│       ├── src/routes/
│       └── test/
└── packages/shared/       Zod schemas, permission catalog, enums, DTOs
```

**Feature-first, not type-first.** The property module touches six file types;
colocating them beats scattering across six top-level folders.

---

## Why npm workspaces

Exactly one reason: **`packages/shared` must be importable by both client and
server.**

A plain `/server` sibling would force either `../../server/src/schemas` imports
— which drag server dependencies into the Vite graph, break `optimizeDeps`, and
fight TS project references — or duplicated schemas, which produce precisely the
client/server drift the RBAC design exists to prevent.

If we weren't sharing Zod and the permission catalog, `/server` would be correct
and workspaces would be ceremony.

**No Turborepo.** Three packages, no CI, no remote cache.

### packages/shared rules

- Consumed **as source** (`"exports": { ".": "./src/index.ts" }`). Vite compiles
  it; tsx compiles it. No build step, no watch-mode dance.
- **Never imports `@prisma/client`.** That ships the Prisma runtime to the
  browser. Enums are hand-written and kept honest by
  `apps/api/test/enum-parity.test.ts`, which also asserts that every enum Prisma
  generates is covered — so a new one can't slip in unguarded.
- **No TS `enum`** (`erasableSyntaxOnly`). Zod enums are better regardless: one
  declaration yields a runtime validator *and* a static union.

---

## The dev loop

```
npm run dev     →  concurrently
                     ├── vite        :5173
                     └── tsx watch   :4000
```

Vite proxies `/api` → `:4000`.

**That proxy is load-bearing, not convenience.** It makes dev same-origin, so the
API's httpOnly auth cookies work with no CORS credentials dance, no
`SameSite=None`, and no third-party-cookie roulette. This is the detail people
get wrong and then "solve" by moving tokens to localStorage — which trades a
config problem for an XSS credential-theft problem.

**API runs on `tsx`,** not Node's native type stripping. Native stripping is
tempting (zero deps) but doesn't resolve TS path aliases, and this stack has
enough novelty without betting the dev loop on it.

**`rootDir` cannot span a monorepo** — it forbids importing `packages/shared`
from `apps/api`. So the API typechecks (`noEmit`) and runs through tsx. A
production bundle step (esbuild/tsup) is deferred to deploy, when we know the
target.

---

## Request lifecycle

```
request
  ↓ cookie-parser
  ↓ authenticate      → load session + user + roles + permissions (one indexed query)
  ↓ requirePermission → 403 on miss                    [AUTHORIZATION]
  ↓ validate(zod)     → 400 with details keyed by field path
  ↓ route handler
      ↓ service       → scopeFor(actor, resource)      [SCOPING]  404 on miss
      ↓ prisma
  ↓ serializer        → toXDTO(entity, permSet)        [PROJECTION]
  ↓ response
```

Those three bracketed stages are three different problems. See [RBAC.md](./RBAC.md).

**403 vs 404:** scope miss → **404** (never reveal another agent's client
exists). Permission miss on a visible resource → **403**. One rule, no
case-by-case debate.

### Guardrails

- All Prisma access behind `src/services/**`, enforced by an ESLint
  `no-restricted-imports` rule.
- A **route-manifest test** walks the router and fails the build if any route
  lacks a guard or an explicit public allowlist entry. An unguarded route should
  be a build failure, not a silent default.

---

## State ownership (frontend)

Blurring these is the most common way this kind of app rots.

| State | Owner | Never |
|---|---|---|
| Server data, current user, permissions | TanStack Query | a store |
| Form drafts | React Hook Form | a store |
| Filters, pagination, sort | URL search params | a store |
| Row selection | `useState` | a store |
| Sidebar collapsed, theme | `localStorage` | server |

**Zustand is deliberately not installed.** Once Query owns server state, RHF owns
forms, the URL owns filters and `useState` owns selection, nothing is left. The
predictable harm is specific: someone puts `currentUser`/`permissions` in it, and
it goes stale the moment an admin changes a permission. If a genuine
cross-cutting UI need appears, add it then — **for UI prefs only**.

**Filters belong in the URL** so an admin can send "Pune, 2BHK, under ₹80L" to a
colleague as a link. A store makes that impossible and you rebuild it later.

---

## One route tree, not two

The agent's "my clients" and the admin's "all clients" are the **same page** —
the scope resolver already returns the right rows. Two trees means two
implementations that drift, and every bug gets fixed twice.

`<Can permission="client.delete">` hides the delete button. Only genuinely
admin-only *surfaces* — RBAC settings, agent management, activity log, reports —
get `<RequirePermission>` route guards.

This roughly halves the UI surface, and it's the second payoff of doing RBAC
properly.

**React Router 8, data mode** (`createBrowserRouter`). Not framework/RSC mode —
this is a Vite SPA talking to an Express API; framework mode drags in SSR
concerns we don't want.

---

## Validation

Shared Zod owns **shape, format, coercion**. The server **adds a refinement
layer** for what needs the database: uniqueness, "assignedAgentId must reference
an active agent", "salePrice required if listingType includes SALE".

One schema does not do both, and pretending otherwise is how people end up with
client-only validation. What makes the split pay: the server returns `details`
keyed by field path → the client maps them onto RHF via `setError`. Same schema,
same paths, no translation layer.

---

## Errors

```ts
{ error: { code, message, details?, requestId } }
```

`code` is a shared string union — `VALIDATION_FAILED`, `UNAUTHENTICATED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`. One `AppError`
class, one error middleware.

**Express 5** gives async error propagation for free (no `express-async-errors`).
Gotcha: path-to-regexp v8 — no bare `*` wildcards, no `:param?` (it's
`{/:param}`). This bites on the catch-all 404.

---

## Logging

Structured JSON to stdout, one line per request: `requestId`, method, path,
status, duration, `actorUserId`. `requestId` is echoed in the error envelope so
a user-reported error maps to a log line.

`ActivityLog` is a **product feature**, not logging. Different audience,
different retention. Don't conflate them.

---

## Media

Uploads land on local disk under `UPLOAD_DIR`. `PropertyMedia.storageKey` is a
**relative** path — never absolute, never a URL — so swapping to S3 later becomes
a serializer change instead of a data migration.

**Served through `GET /api/media/:id`**, which checks permission and scope, then
streams. **Never `express.static`.** There is a `property.media.download`
permission and `internalNotes`-grade confidentiality; static hosting would make
every document world-readable to anyone with a URL and invalidate the entire RBAC
design.

---

## The public site is a separate app

Later: `apps/public-web` (Astro or Next), consuming **the same API** and **the
same `packages/shared`**, authenticating as the seeded `public` role whose scope
is `{ visibility: PUBLIC }`.

It needs SSR/SEO, anonymous auth, a marketing design language, and a different
deploy cadence. Cramming it into the CRM SPA gets the worst of both.

The CRM needs **no public routes at all**. That's what "additive, not a rewrite"
means — and the workspace layout plus a clean API boundary is what buys it.

---

## Toolchain reality

Verified working: React 19.2.7, Vite 8.1.4, TypeScript 6.0.3, ESLint 10,
Tailwind 4.3.2, React Router 8.2, Prisma 7.8, Express 5.2, Node 24.13.

The plan called this combination the biggest schedule risk. It installed with
**zero peer conflicts**. The real costs were elsewhere:

| Surprise | Resolution |
|---|---|
| Prisma 7 removed `datasource.url` | `prisma.config.ts` + `@prisma/adapter-pg` |
| TS 6 deprecated `baseUrl` (hard error) | dropped; paths resolve relative to tsconfig |
| React Router is v8, not v7 | data mode intact, no change needed |
| `rootDir` can't span a monorepo | API typechecks only, runs via tsx |
| npm 11 blocks install scripts | harmless — Prisma 7 uses a WASM query compiler |
