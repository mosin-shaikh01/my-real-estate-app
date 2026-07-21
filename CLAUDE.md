# CLAUDE.md

Primary context for this repository. Read this before doing anything.

If a rule here conflicts with a habit or a default, **this file wins**. If a rule
here conflicts with something the user says in conversation, **the user wins** —
then update this file.

---

## 1. What this is

A **Real Estate CRM & Property Management System**. Not a listing website.

Admins manage properties, agents and clients. Agents see only what they are
assigned and only the fields they are permitted. Clients are records, not users —
they never log in. The core feature is the **Property Requirement flow**: an
admin captures a client's requirements, searches matching inventory, ticks rows,
and assigns properties to that client.

Runs entirely on one machine as a **client-demo prototype that must look and
behave like production**. Production deployment and a public listing site come
after client approval.

### Business goals

- Win client approval with a demo that feels like a shipped product.
- Model RBAC properly enough that new roles never require a deploy.
- Keep the public listing site an **additive** step, never a rewrite.

### Success criteria for the demo

An admin can create a client, capture requirements, match inventory, and assign
properties. An agent can log in and see **only** their assigned clients — with
budget and commission genuinely absent from the API response, not merely hidden
in the UI.

---

## 2. Non-negotiable rules

Each of these is here because violating it silently produces a bug that is
expensive or invisible.

| Rule | Why |
|---|---|
| **Money is `Decimal(14,2)` in the DB and a `string` in DTOs. Never `number`.** | `Float` rounds in binary; Int-paise overflows at ~₹21 lakh; JS numbers lose precision. Prisma `Decimal` does not JSON-serialize. |
| **`packages/shared` must never import `@prisma/client`.** | It ships in the browser bundle. Importing Prisma drags the runtime client-side. Parity is enforced by a test instead. |
| **Server data never enters a client store.** | TanStack Query owns server state. A copy in a store goes stale the moment an admin changes a permission. |
| **`<Can>` is UX, not security.** | Every client-side gate needs a server counterpart or it is not a gate. A hidden column whose data is in the payload is not hidden. |
| **No TS `enum`.** | `erasableSyntaxOnly` is on. Use `as const` objects or Zod enums. |
| **Redact by omission, not `null`.** | `null` legitimately means "no phone recorded". The UI must distinguish hidden from empty. |
| **Filter/sort allowlists must be permission-filtered.** | An agent who can sort by budget infers budgets from row order. This is a security control, not a convenience. |
| **Media is served through an authorized route, never `express.static`.** | Static hosting makes every document world-readable by URL and invalidates the entire RBAC design. |
| **Log changed field *names*, not values, for sensitive fields.** | Otherwise PII lands in a log table the redactor does not cover. |
| **Compose a scope with `AND`, never by spreading it alongside your own `OR`.** | `scopeForProperty` for an agent *contains* an `OR`. Spread it and add a second top-level `OR` and the last one wins — the scope silently vanishes and the query leaks every row. Wrap both in `AND: [scope, { OR: [...] }]`. |

---

## 3. Architecture in one screen

```
my-real-estate-app/
├── apps/web/          Vite + React 19 SPA (the CRM)
├── apps/api/          Express 5 + Prisma 7
├── packages/shared/   Zod schemas, permission catalog, enums, DTO types
└── docs/              see docs/README.md
```

**Why workspaces:** so `packages/shared` can be imported by both sides. That is
the *only* justification, and it is sufficient — duplicated schemas produce the
client/server drift the RBAC design exists to prevent.

**Dev:** `npm run dev` runs both. Vite proxies `/api` → `localhost:4000`. That
proxy is **load-bearing**: it makes dev same-origin so httpOnly auth cookies work
without CORS credentials or `SameSite=None`. Do not "fix" cookie problems by
moving tokens to localStorage.

### RBAC — three problems, three mechanisms

Never collapse these into one table. That is the failure mode of every homegrown
RBAC.

| Problem | Question | Mechanism |
|---|---|---|
| **Authorization** | Can this actor do this action on this resource type? | Permission strings + route middleware |
| **Scoping** | *Which rows?* | `scopeFor(actor, resource)` → `WhereInput`. **Not a permission.** |
| **Projection** | *Which columns?* | Serializer at the response boundary |

**The catalog is code; the assignment is data.** `packages/shared/src/permissions.ts`
owns the list; the seed upserts it. Add a key → restart → an admin can assign it.
Roles and mappings are pure data, so new roles need no deploy. **New permissions
do** — a permission only does something because code checks it. Do not promise
otherwise.

- Permissions are **not in the JWT**. Deactivation and live permission changes
  both require a DB read per request anyway. Consequence, stated plainly: this
  JWT is **not stateless**. That is fine — but never design around statelessness
  we don't have.
- Scope miss → **404**. Permission miss on a visible resource → **403**. One
  rule, no case-by-case debate. Never reveal that another agent's client exists.
- Field-level permissions are **curated** (the ten named in the spec), not a
  generic engine. A generic engine destroys static DTO types to buy capability
  nobody uses.

### Data access

All Prisma access goes through `apps/api/src/services/**`. There is deliberately
**no soft-delete middleware and no global query extension** — both are Rails'
`default_scope`: `findUnique` cannot take an injected predicate, scoped-out rows
become 404s you can't override, and admin bypass turns ugly. Scoping is explicit.

---

## 4. Conventions

### Naming

| Thing | Convention | Example |
|---|---|---|
| DB tables / columns | `snake_case` | `property_assignments.assigned_at` |
| Prisma models / fields | `PascalCase` / `camelCase` + `@map` | `PropertyAssignment.assignedAt` |
| TS types / components | `PascalCase` | `PropertyCard` |
| Variables / functions | `camelCase` | `scopeFor` |
| Constants | `SCREAMING_SNAKE` | `AGENT_PERMISSIONS` |
| Enum values | `SCREAMING_SNAKE` | `UNDER_OFFER` |
| Permission keys | `resource.action` / `resource.field.action` | `client.phone.view` |
| Files (components) | `PascalCase.tsx` | `DataTable.tsx` |
| Files (everything else) | `kebab-case.ts` | `use-permissions.ts` |
| Routes | plural, kebab | `/api/property-assignments` |

**Every Prisma field whose column would be camelCase needs `@map`.** There are
currently zero camelCase columns; keep it that way.

### Database

- PKs are `cuid(2)`. Never `Int` — sequential IDs in URLs leak row counts.
- Human-facing IDs are `code` (`PROP-00123`), from a Postgres sequence.
- Soft delete is `deletedAt`. `status`, `archivedAt` and `deletedAt` are three
  orthogonal concepts — never overload them.
- **"Active property"** = `status = AVAILABLE AND archived_at IS NULL AND deleted_at IS NULL`.
- Some things Prisma cannot express live in hand-written migration SQL: the code
  sequences (which must be **prepended** — Prisma inlines `nextval()` into
  `CREATE TABLE`), the partial unique index on `users(email)`, and the **`pg_trgm`
  extension + GIN trigram indexes** for `ILIKE '%term%'` search
  (`20260721120000_search_trgm_indexes`). **If you regenerate a migration,
  re-apply those blocks.**
- Don't over-index speculatively. No single composite serves
  budget × city × bedrooms × type × status; Postgres bitmap-ANDs. Measure.

### Frontend

- **One route tree, not two.** The agent's "my clients" and the admin's "all
  clients" are the *same page* — the scope resolver already returns the right
  rows. `<Can>` hides the delete button. Only genuinely admin-only surfaces
  (RBAC, agents, activity, reports) get `<RequirePermission>` guards.
- **Filters live in the URL**, never a store. An admin must be able to send
  "Pune, 2BHK, under ₹80L" to a colleague as a link.
- **State ownership** — do not blur these:
  | State | Owner |
  |---|---|
  | Server data, current user, permissions | TanStack Query |
  | Form drafts | React Hook Form |
  | Filters, pagination, sort | URL search params |
  | Row selection | `useState` |
  | Sidebar/theme prefs | `localStorage` |
- **Zustand is deliberately not installed.** Nothing is left for it. If a real
  cross-cutting UI need appears, add it for UI prefs only.
- Feature-first folders (`features/properties/{api,components,pages}`), not
  type-first. A feature touches six file types; colocating beats scattering.
- Validation: shared Zod schema for shape/format/coercion; the **server adds a
  refinement layer** for uniqueness and cross-field DB rules. One schema does not
  do both — pretending otherwise is how you get client-only validation.

### API

- Offset pagination: `?page=1&pageSize=25` → `{ data, meta: { page, pageSize, total, totalPages } }`.
  CRM tables need page numbers and "1,234 results"; cursor pagination can't do either.
- Filters are flat query params; `sort=-price` means descending.
- Errors: `{ error: { code, message, details?, requestId } }`. Zod issues go in
  `details` keyed by field path, so the client maps them onto RHF via `setError`.
- Express 5 gotcha: path-to-regexp v8 — no bare `*` wildcards, no `:param?`.
- Every route declares a permission. An unguarded route is a **test failure**,
  not a silent default.

---

## 5. UI/UX rules

- **Sold is not red.** Red is reserved exclusively for destructive actions. Sold
  is a terminal success and must not shout over the actionable rows.
  Available = emerald, under-offer = amber, rented = blue, sold = neutral slate.
- **Never color-only.** Status is always a dot **plus** a text label.
- **Base 14px** for chrome and tables. Not 16.
- **`tabular-nums` on every money and numeric column.** Non-negotiable.
- **No zebra striping.** Hairline row borders. Zebra fights hover + selection,
  and row selection is a core feature.
- **Selection must be visually distinct from hover** — brand tint + left accent
  bar vs. a neutral wash. The bulk-assign table lives or dies on this.
- **Mostly flat**: borders and surface steps. Shadows only for true overlays.
- **Elevation is a semantic token**, never raw `shadow-md` at call sites — in
  dark mode shadows must become borders.
- **Tokens**: `@theme` for primitives (it *snapshots* values); `:root` +
  **`@theme inline`** for anything that remaps at runtime. Miss this and dark
  mode silently no-ops.
- **Dark mode**: SHIPPED, and the theme is a **per-user, database-backed**
  preference. A `ThemeProvider` (`app/theme-provider.tsx`) toggles `.dark` on
  `<html>`; the token layer remaps every semantic var. The source of truth is
  `UserPreference.theme`, carried on `/me` and written via self-service
  `PATCH /api/me/preferences` (a user only ever touches their own). `localStorage`
  is a CACHE only, and **keyed per user** (`estate-theme` = `{ [userId]: theme }`,
  plus `estate-last-user` cleared on logout) — never a single global value, which
  is what leaks the previous user's theme onto the next. The boot script in
  `index.html` paints the active user's cached theme before `/me` resolves (no
  FOUC), and a logged-out browser resolves to the system theme. The applied theme
  is the CURRENT user's DB pref (via `['me']`); the fallback resets to system on
  logout, applied in a `useLayoutEffect` so the protected app's first frame is
  correct. First login with no saved theme seeds the DB default from
  `prefers-color-scheme`.
  `UserPreference` is built to grow (language, timezone, …) — one nullable column
  each. The header `ThemeToggle` is visible to every signed-in user. Raw `-700`
  brand/status text and `-100` tints don't adapt on dark surfaces — use the
  semantic `text-brand/danger/success/warning` and `surface-*-soft` tokens.

### Accessibility (WCAG 2.1 AA — treat as a requirement, not a nicety)

- Semantic HTML first. Radix for anything with focus management.
- Visible focus ring on every interactive element.
- Text contrast ≥ 4.5:1; UI/graphical ≥ 3:1.
- Keyboard-complete: every flow works without a mouse. This is a keyboard-heavy CRM.
- `prefers-reduced-motion` is honored globally.
- Forms: real `<label>`s, errors tied by `aria-describedby`.

### Animation

Framer Motion (`motion`) for **overlays only** — modal/drawer `AnimatePresence`,
toasts. CSS transitions for hover/press. **Never animate table rows on filter
change**: it makes a data grid feel slower, and feeling fast is the one thing a
CRM cannot compromise. Durations 120/180/240ms, ease-out enter / ease-in exit.

### Responsive

Mobile-first. Breakpoints 375 / 768 / 1024 / 1440. The body never scrolls
horizontally — wide tables scroll inside their own `overflow-x:auto` container.

---

## 6. Performance targets

- LCP < 2.0s, CLS < 0.1, INP < 200ms on local dev hardware.
- Route-level code splitting via `React.lazy`.
- Initial JS < 250 kB gzipped.
- List endpoints always paginated. Never `findMany()` unbounded.
- Watch for N+1: prefer `include`/`select` over per-row queries.

---

## 7. Security

- httpOnly cookies for both tokens. **Never localStorage** — this app renders
  user-generated notes and uploaded filenames everywhere, so XSS surface is real
  and a readable token turns any XSS into total credential theft.
- Refresh rotation with reuse detection: a revoked token presented ⇒ chain
  compromised ⇒ revoke all that user's sessions and log it.
- Store the **sha256 hash** of refresh tokens, never the token.
- Password reset: always return 200 (no user enumeration); single-use, hashed,
  30-minute expiry; reset or change ⇒ revoke all sessions.
- Hashing is `@node-rs/argon2` (prebuilt — no node-gyp on this machine).
- Env is validated at boot by Zod. Fail fast, not at 2am.
- Uploads: MIME allowlist, size cap, path-traversal guard, never trust
  `originalName` as a path.

---

## 8. Workflow

Build **incrementally**. Never attempt the whole app in one step. For each
feature: explain the approach → name dependencies → flag trade-offs → get
approval where it matters → implement → review and optimize before moving on.

At the end of each task, review as a senior engineer: correctness, consistency,
responsiveness, a11y, performance, and whether docs need updating.

### Git

Branch from `main` as `feat/<area>`. Conventional commits. Commit messages
explain **why**, not what.

**Never without explicit permission:**
- push to remote
- merge branches
- force-push
- delete branches
- rewrite history (rebase, amend, reset --hard)

Inspecting, reviewing, suggesting commits, and committing locally are fine.

### Documentation

Update `docs/` in the same change that alters behaviour. `CHANGELOG.md` gets an
entry per merged feature. If a decision was hard, record **why** — the reasoning
is the part that decays.

---

## 9. Environment

- Windows 10, Node 24, npm 11. **No Docker on the dev machine** — local dev is
  bare `npm run dev`. (Production ships as a single-origin container; the
  `Dockerfile`/compose are for deploy, not local dev. See `docs/DEPLOYMENT.md`.)
- PostgreSQL 17 local, port 5432, database `real_estate_crm`, role `crm_app`
  (has `CREATEDB` — Prisma migrate needs it for the shadow DB).
- Secrets in `apps/api/.env` (gitignored). Template: `.env.example`.
- Windows gotcha: special characters in the DB password **must** be URL-encoded
  inside `DATABASE_URL`. The generated password is alphanumeric to sidestep this.
- Dev logins (seeded): `admin@demo.local`, `agent@demo.local`,
  `agent2@demo.local` — all `Passw0rd!`.

### Commands

```bash
npm run dev          # web + api together
npm run build        # web production build
npm run typecheck    # all workspaces, strict
npm test             # vitest
npm run db:migrate   # prisma migrate dev
npm run db:seed      # idempotent
npm run db:studio    # prisma studio
```

### Toolchain notes (learned the hard way — don't rediscover these)

- **Prisma 7 removed `datasource.url`.** Connection config is in
  `prisma.config.ts` + a driver adapter (`@prisma/adapter-pg`).
- **TS 6 deprecated `baseUrl`** — a hard error. `paths` resolve relative to the
  tsconfig.
- **React Router is v8.** Data mode (`createBrowserRouter`) is intact.
- **`rootDir` cannot span a monorepo**, so the API typechecks rather than emits
  and runs via `tsx`. A production bundle step is deferred to deploy.
- **npm 11 blocks install scripts.** Harmless here: Prisma 7 uses a WASM query
  compiler and needs no native engine.
- **Don't run `npm audit fix --force`** — it downgrades Prisma 7 → 6 to patch a
  dev-only `@prisma/dev` transitive we don't use.
- If a Prisma command hangs on "advisory lock", a killed migration left a
  backend open: terminate it via `pg_locks` / `pg_terminate_backend`.
- **Express 5 removed `layer.regexp`** (opaque `matchers` functions now), so
  mount paths are not recoverable from router internals. `ROUTE_MOUNTS` in
  `app.ts` declares them — that's what the route-manifest test reads.
- **Express 5 types `req.params.x` as `string | string[] | undefined`.** Parse
  with `idParamSchema`, don't cast.
- **`erasableSyntaxOnly` bans constructor parameter properties.** Assign fields
  explicitly in `apps/web`. (`apps/api` doesn't set the flag.)
- **TS 6 raises `TS2882`** on side-effect imports of CSS-only packages — declare
  the module in `src/types/globals.d.ts`.
- **React Hooks v7 lint is compiler-aware**: no `setState` in an effect (adjust
  during render instead), no impure calls like `Date.now()` during render.
- **Zod `.partial()` keeps `.default()`.** A partial (PATCH) schema built from a
  defaulted base carries those defaults on every request, silently overwriting
  fields the caller never sent. Keep create/update field defaults in the DB
  (`@default`), not in shared Zod, or a one-field edit corrupts the rest.
- **`.refine()` returns the object, not a wrapper.** Declare the base shape
  separately so PATCH can `.partial()` it without the cross-field rules.

---

## 10. Roadmap

| Phase | Status |
|---|---|
| 0 · De-risk (install spike, strict, gitignore, Postgres) | ✅ done |
| 1 · Foundation (workspaces, tokens, schema, seed, docs, shell) | ✅ done |
| 2 · Auth + RBAC end-to-end | ✅ done — verified: agent sees 2/4 clients, `budget` absent from the payload, suspension locks out on the next request |
| 3 · Properties (CRUD, media, dashboard) | ✅ done — read, write, live dashboard, authorized media upload/stream |
| 4 · Clients + Agents | ✅ done — client CRUD + interactions (lastContactAt in tx), agent CRUD + activate/deactivate (revokes sessions), commission redaction |
| 5 · Requirement + match + bulk assign (core feature) | ✅ done — atomic new-client create + existing-client bulk assign, two-form matching screen, one log per assignment |
| 6 · Activity log + dashboard | ✅ done — dashboard live since Phase 3; activity log page surfaced |
| 7 · Global search | ✅ done — scoped, phone-normalized, properties + clients |
| 8 · Reports | ⬜ (roles matrix done; transactional reports need a Deal-close flow) |
| 9 · Settings (branding + company config) | ✅ done — `AppSetting` singleton, `settings.view/update` perms, public branding (name/logo/favicon/colour read pre-auth), admin tabbed form. `GET /api/settings\|logo\|favicon` are deliberately PUBLIC; all writes need `settings.update`. |
| 10 · Auth self-service (forgot/reset password) | ✅ done — hashed single-use tokens (30 min), always-200 (no enumeration), reset revokes all sessions, per-IP rate limiting. |
| 11 · Notification Service | ✅ done — centralized `notificationService.send()`; **nothing calls SMTP directly**. Real email (nodemailer, retry/timeout, console fallback), DB templates + encrypted provider config + logs, Settings → Notifications admin UI, `notifications.view/manage` perms. SMS/WhatsApp/Push/In-App/Webhook are stub providers. See `docs/NOTIFICATION_SERVICE.md`. |
| 12 · CRM expansion — Phase 1 (Owner master) | ✅ done — `PropertyOwner` master (CRUD, `owner.*` perms, activity log, dupe detection, delete-guard), `Property.ownerId` FK + `surveyNumber`/`propertyNumber` (indexed, searchable), owner picker in the property form. Phase 1 of the larger multi-phase expansion (owners → property fields/enums → client+matching → follow-ups/site-visits → agent/admin → analytics/tables → platform). |

**Phase 2 precedes properties deliberately.** Build properties first and you
retrofit scoping into every query — the exact smear the design prevents. Prove
the pattern on one vertical slice, then generalize.

### Explicitly out of scope for v1

Non-email notification channels (SMS/WhatsApp/Push/In-App/Webhook — the WhatsApp
Business API alone is a multi-week compliance project) are stubbed but not sent;
**email is shipped** via the Notification Service (Phase 11). Video upload (URL
field instead), radius/map
search (no PostGIS), a calendar UI (`scheduledAt` + a list), outbound messaging
(`tel:`/`wa.me` links only), an editable permission matrix
(read-only in v1), and global search beyond properties + clients.

### Future

Public listing site as `apps/public-web` (Astro/Next) consuming the same API and
the same `packages/shared`, authenticating as the seeded `public` role whose
scope is `{ visibility: PUBLIC }`. **Same middleware, same scope resolver, same
serializer — zero new authorization code.** That is what "additive, not a
rewrite" means, and it is the payoff for doing RBAC properly now.

Then: S3 media (swap `storageKey` resolution), `pg_trgm` for search when ILIKE
hurts, per-agent DENY overrides in the UI (schema already supports it).

---

## 11. Never do without asking

- Push, merge, force-push, delete a branch, or rewrite history.
- Run `prisma migrate reset` or drop a schema against a database holding data
  you did not create.
- Install system-level software.
- Commit anything resembling a secret.
- Add a dependency that duplicates something already installed.
- Weaken a test to make it pass.
- Downgrade a major dependency to silence an audit warning.
- Widen a permission or scope to make a feature work.
