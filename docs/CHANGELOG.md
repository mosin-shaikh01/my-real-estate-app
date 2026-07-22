# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning starts at `0.1.0` when Phase 1 completes.

---

## [Unreleased]

### Changed — activity feed: exact time, no internal keys, avatars

Polish on the Recent Activity widget and the Activity Log page.

- **No internal event keys.** The Activity Log rendered the raw `action` key
  (`property.updated`, `auth.login`) in monospace — a developer identifier that
  must never reach a user. Replaced with a friendly label via a new
  `activityActionLabel()` map (auth.login → "Signed in", property.updated →
  "Property updated", …), whose fallback title-cases any unmapped key so a new
  server-side action can never surface a raw `resource.action` string.
- **Exact time.** Both surfaces showed only relative time ("Today"). New
  `formatDateTime()` renders "Today • 10:42 PM" / "Yesterday • 6:15 PM" /
  "18 Jul 2026 • 10:42 AM" (reusing `formatDate` for the absolute day, uppercased
  meridiem); the relative form moves to a hover title.
- **Timeline avatars.** New reusable `Avatar` initials primitive leads each row
  (actor name + friendly label + summary + timestamp), applied consistently to
  the dashboard widget and the Activity Log page. Friendly `summary` text was
  already stored, so messages needed no change. Filtering/pagination unchanged.

### Added — Deals & Reports (hardening Phase 6)

The last roadmap gap: transactional reporting, now computable because closed
deals are captured. Admin-only surface — agents hold no `deal.*`/`report.*`
permission, so the route guard is the whole gate (no scope resolver).

- **Deals**: `Deal` model + `deals` table already existed; this wires the
  feature. `POST /api/deals` (deal.create) records a closed sale/rental and
  **snapshots the agent's commission rate at close** (rates change, history must
  not) — deriving the amount server-side. `GET /api/deals` (deal.list) paginates.
  A new Deals page lists deals with a "Record deal" dialog (property/client/agent
  pickers + type + price + date).
- **Reports**: `GET /api/reports` (report.view) returns all six spec reports in
  one payload — agent performance, client conversion, property sales, inventory
  (by status/type), follow-up status, monthly revenue (12-month). Mostly Prisma
  `groupBy` aggregates over Deal + existing tables. A Reports page renders them as
  stat cards, tables and a monthly bar chart.
- **CSV export**: `GET /api/reports/export/:report` (report.export — a separate
  permission so a role can read reports without bulk-exfiltrating) streams RFC
  4180 CSV with a UTF-8 BOM for the four tabular reports. New `lib/csv.ts` with
  unit tests.
- Nav: Deals under Manage, Reports under Admin. Route-manifest test extended for
  both routers. 163 tests green; typecheck/lint/build clean; deal creation,
  commission snapshot, every report and CSV export verified end-to-end.

### Performance — lean property list + trigram search indexes (hardening Phase 5)

Two scale-oriented fixes; no behaviour change for the demo.

- **Lean property `LIST_SELECT`**: the results table reused the detail `SELECT`,
  loading every description, the full media array (storageKey/mime/size per row),
  amenities and documents for 25 rows a page — none of which the table renders.
  A new `LIST_SELECT` + `PropertyListItem` DTO + `toPropertyListItem` serializer
  fetch and emit only the ~12 fields the table shows, with the **same price
  redaction** as the detail view (covered by a new rbac test). Frontend list rows
  are now typed `PropertyListItem`; the full `PropertyDTO` is only fetched on the
  detail page. The list payload dropped from the full property graph to 15 flat
  fields per row.
- **pg_trgm**: every list and the global search filter with `ILIKE '%term%'`
  (Prisma `contains`), which a btree can't serve — Postgres sequential-scans.
  A hand-written migration enables the `pg_trgm` extension and adds GIN trigram
  indexes on the searched free-text columns (properties title/city/locality/
  address, clients full_name/phone_normalized, property_owners full_name/
  mobile_normalized, users full_name). Applied via `migrate deploy`. Like the
  `users_email_active_key` partial index, this block is hand-written and must be
  re-applied if migrations are regenerated.
- 155 (+3) tests green; typecheck/lint/build clean; list payload + search
  verified end-to-end against the DB.

### Changed — list UX parity (hardening Phase 4)

Bring the last two list surfaces up to the search + pagination standard the
Clients/Properties/Owners lists already set.

- **Agents**: `GET /api/agents` now takes `q`, `page`, `pageSize` and returns the
  standard `{ data, meta }` envelope instead of the full array. Search matches
  name, email, phone, profile code (AGT-…) and specialization (case-insensitive).
  The Agents page gains a search box and a Prev/Next footer; the header count
  reads `meta.total`. `listAgents()` → `listAgents({ q, page, pageSize })`.
- **Site visits**: the backend already paginated; the page now carries `page`
  state, renders the Prev/Next footer, and resets to page 1 when the status
  filter changes.
- No schema/permission changes. Verified end-to-end: agent search matches
  name/surname/code, paging returns distinct rows per page; typecheck, lint (0
  errors), 155 tests and build all clean.

### Added — Site Visit Management (CRM expansion Phase 4)

Schedule and track property visits. (Follow-ups §5 and enquiry history §7 are
already served by ClientInteraction — Call/Meeting/Site-visit/WhatsApp/Email with
nextFollowUp — and the PropertyAssignment status timeline + ActivityLog, so this
phase adds the genuinely-new Site Visits module.)

- **`SiteVisit` model** (Property × Client × optional Agent, scheduledAt, status,
  feedback, remarks) + **`SiteVisitStatus`** enum (Scheduled / Completed /
  Cancelled / Rescheduled). Cascade-deleted with its property/client; agent &
  creator SetNull. Mirrored in the enum-parity test.
- **Scoped** like clients/properties: an admin sees every visit; an agent sees a
  visit they're on, or one for a client OR property assigned to them — a WHERE,
  never a permission. New `sitevisit.list/create/update/delete` permissions
  (agents get list/create/update; delete is admin-only). Every write is
  activity-logged.
- **Site Visits page**: filterable list, a schedule dialog (property/client/agent
  pickers + date-time + remarks), inline status changes, and delete — under a new
  sidebar entry. Consistent with the design system, RBAC-gated.
- Migration applied; 155 tests green; typecheck/lint/build clean; CRUD + scoping +
  status filter verified end-to-end against the DB.
- **Dashboard** gained tiles for **Important leads**, **Reserved** properties, and
  **Today's / Upcoming site visits** — all scope-aware (site-visit tiles are null,
  not zero, for an actor without `sitevisit.list`), reusing the same resolvers as
  the list endpoints.

### Added — Client fields: buyer type, buyer city, important lead (CRM expansion Phase 3)

Additive client attributes. Email was already optional and phone already required,
matching the spec.

- **`BuyerType` enum** (Individual / Investor / Broker / Builder / Farmer / Other)
  + `Client.buyerType`; **`Client.city`** (the buyer's own city, distinct from the
  property city on ClientRequirement); **`Client.importantLead`** boolean.
- **Important-lead** is a first-class hot-lead flag: a ★ badge next to the name in
  the clients list and a one-click **"Important leads" filter** (URL-backed, so a
  filtered view is shareable). Server-side filter added to the (permission-checked)
  client filter allowlist.
- Wired through the shared schema (create + update + list query), write-service,
  serializer/DTO, the clients list, and the create form (buyer-type select, buyer
  city, and an important-lead toggle using the shared Switch). Mirrored in the
  enum-parity test.
- Migration applied; 154 tests green; typecheck/lint/build clean; create + filter
  verified end-to-end against the DB.

### Added — Property Documents (CRM expansion Phase 2)

Categorised legal documents per property, on top of the existing authorized media
pipeline (no new storage/streaming code).

- **`DocumentType` enum** (Sale Deed, 7/12 Extract, NA Order, Layout Plan, Title
  Document, Tax Receipt, Other) + `PropertyMedia.documentType` column. Mirrored in
  shared + the enum-parity test.
- **Upload** tags a document with its type (the shared media endpoint now accepts
  `documentType`); the property DTO exposes a dedicated **`documents`** array
  (name, type, MIME, size). The authorized media stream gained `?disposition=inline`
  so a PDF can be **previewed** in a tab as well as downloaded.
- **Documents manager** on the property detail page: categorised upload, a list
  with preview / download / delete, human-readable sizes and type badges. Viewing
  needs `property.media.download`; managing needs `property.media.upload` (agents
  can view/download, not upload/delete). Consistent with the design system.
- Migration applied; 153 tests green; typecheck/lint/build clean; document
  storage + serialization verified against the DB.

### Added — Property Owner master + property identification (CRM expansion Phase 1)

The reusable seller/owner backbone the wider CRM build hangs off. Additive and
non-breaking — every existing flow is untouched.

- **Owner master** (`PropertyOwner`): name, mobile (+ normalised for search/dupes),
  alt mobile, email, address, city, PAN, Aadhaar, notes; `OWN-00001` human code
  from a Postgres sequence. Full CRUD module — service, serializer, routes,
  `owner.list/view/create/update/delete` permissions (Super-Admin only), activity
  logging, soft-delete. Deletion is blocked while the owner still owns properties
  (reassign first) rather than orphaning listings.
- **Duplicate detection** (warning, never a block): a live check on the owner's
  mobile (last-10-digits match, so a country code doesn't defeat it), surfaced in
  the form and available for survey/property numbers via search.
- **Property → Owner**: `Property.ownerId` FK (SetNull) so a listing references the
  master instead of duplicating seller details. Plus **survey number** and
  **property number** identification fields — indexed, included in property search.
- **UI**: an Owners list (search + pagination + create/edit dialog + delete) under
  a new sidebar entry, and an owner picker + survey/property-number fields in the
  property form. Consistent with the existing design system, RBAC-gated.
- Migration applied; 149 tests green; typecheck, lint (0 errors) and build clean.
  Verified end-to-end against the database (create/dupe/search/FK/delete-guard).

**Phase 1b — property detail fields** (additive, all nullable):
- **Statuses extended**: `RESERVED`, `ON_HOLD`, `CANCELLED` added to `PropertyStatus`
  (with new `status-reserved/on-hold/cancelled` colour tokens + StatusBadge dots +
  labels; the status filter/select pick them up automatically).
- **New enums**: `PropertyCondition` (New/Resale), `SellerType` (Owner/Farmer/
  Builder/Broker/Other — the seller's role for this listing), `AreaUnit`
  (SqFt/SqM/SqYd/Acre/Guntha/Hectare) — all mirrored in shared + enum-parity test.
- **New columns**: condition, sellerType, landmark, pricePerSqft, governmentValue,
  plotArea, builtUpArea, carpetArea, areaUnit — wired through the shared schema,
  write-service, serializer/DTO, and the property form (new selects + money/area
  inputs, prefilled on edit). 152 tests green; verified round-trip against the DB.

### Fixed — secondary brand colour was applied nowhere

Root cause: the colour was saved, returned by the API, and received by the client
correctly, but `app/branding.tsx` only read `primaryColor` (→ `--brand-mark`) and
never read `secondaryColor` into any CSS variable — so nothing could consume it.

- **Both colours now flow through one mechanism**: `branding.tsx` sets
  `--brand-primary` and `--brand-secondary` on `<html>` from Settings (live, no
  refresh; cleared → falls back to the token default). `tokens.css` exposes them as
  `--color-brand-primary` / `--color-brand-secondary`, so **every component and any
  future email/PDF/report template** can use `bg-/text-/border-/ring-brand-primary`
  and `-brand-secondary`.
- **Secondary is now visibly used**: the brand mark (sidebar + all auth screens) is
  a live `primary → secondary` gradient, and the notification email layout gained a
  secondary accent stripe. Both update the instant Settings are saved.
- Semantic status colours (success/warning/danger/info) are untouched.

### Added — Notification Service (centralized communication layer)

A single, extensible service every feature sends through — **nothing in the CRM
talks to SMTP directly anymore**. Email is fully implemented; SMS/WhatsApp/Push/
In-App/Webhook are wired as honest stubs so new channels are additive.

- **`src/notification/`** — a Prisma-free module (clean DI): orchestrator, channel
  provider interface, a `Dispatcher` queue seam (inline today, BullMQ/Redis-ready),
  `{{placeholder}}` rendering with HTML escaping, a branded email layout, and
  default templates. The Prisma-backed `NotificationStore` lives in `services/` and
  is injected at the composition root — honouring "Prisma only in services/**".
- **Email provider** — real SMTP via `nodemailer` with retry on transient
  failures, connection/socket timeouts, and a console fallback when unconfigured
  (so dev/demo and forgot-password keep working with zero setup).
- **`NotificationService.send({ channel, template, recipient, data })`** — resolves
  template → injects branding (from CRM Settings) → renders → dispatches → logs.
  Never throws on delivery failure; returns a `SendResult`. **forgot-password now
  sends through it** (the old `lib/mailer` is removed).
- **Prisma**: `NotificationProviderConfig` (encrypted secrets), `NotificationTemplate`,
  `NotificationLog` + migration; 11 default templates seeded (create-only).
- **Security**: SMTP credentials **encrypted at rest** (AES-256-GCM, key derived
  from `APP_ENCRYPTION_KEY` or `JWT_REFRESH_SECRET` — no new required config);
  passwords never returned by the API; all routes Super-Admin gated
  (`notifications.view` / `notifications.manage`); test-sends rate limited.
- **Settings → Notifications** (admin) — tabs for Email (provider presets for
  Gmail/Outlook/365/Zoho/Hostinger/GoDaddy/cPanel/SendGrid/Brevo/SES/Mailgun/Custom,
  auto-filling defaults), a **Send Test Email** card (real send, Ethereal preview
  link), a **Template Manager** (subject + HTML editor + live sandboxed preview +
  placeholder chips), a **Logs** table, and "Coming soon" tabs for the other
  channels.
- Verified end-to-end: real SMTP delivery through an Ethereal account, encryption
  round-trip + tamper-fail-closed, template rendering/branding, channel routing,
  and logging. Docs: [NOTIFICATION_SERVICE.md](./NOTIFICATION_SERVICE.md).

### Added — Forgot / Reset Password

A complete self-service password-reset flow, built on the auth primitives the
schema already anticipated (`PasswordResetToken`, the `MAILER` setting, and the
`RATE_LIMITED` error code all pre-existed).

- **Two public pages** (`/forgot-password`, `/reset-password`) plus a "Forgot
  password?" link under the login password field. A new shared `AuthLayout`
  frames all three auth screens (login included) so they stay identical; the
  reset page shows a live password-strength meter, confirm-match validation,
  loading states, and success/invalid-link states. Fully responsive, design-token
  styled, keyboard- and screen-reader-accessible.
- **Backend** (`POST /api/auth/forgot-password`, `/reset-password`,
  `/reset-password/verify`) — all public (pre-session) and rate limited:
  - Tokens are 256-bit random, stored **sha256-hashed** (never raw), single-use,
    30-minute expiry. One live link per user (a new request invalidates the old).
  - `forgot-password` **always returns 200** whether or not the email exists — no
    account enumeration — and a per-account 60s cooldown blunts email-bombing.
  - A completed reset **revokes every session** and re-hashes the password with
    argon2 in one transaction; the token is consumed with a guarded update so a
    concurrent replay can't double-spend it.
- **Mailer seam** (`lib/mailer.ts`) — a transport-agnostic `Mailer` with a
  production-safe **console** transport that logs the reset link as one JSON line
  (what you copy when no SMTP is configured); `smtp`/`ethereal` degrade to console
  with a warning until a real transport is wired. New optional `APP_URL` builds
  the absolute link (derived from the request in prod, `WEB_ORIGIN` in dev).
- **Rate limiter** (`middleware/rate-limit.ts`) — dependency-free, in-memory,
  per-IP fixed window (per-instance; documented Redis path for multi-instance).
- Tests: rate-limiter (budget, per-key isolation, custom key) and mailer console
  transport; the public-route manifest snapshot updated to include the three new
  endpoints. Full reset flow verified end-to-end against the live database.

### Added — production deployment: single-origin serving + container/build config

Made the app deployable on any standard Node host from a clean clone, without
platform-specific hacks. The model is **one origin**: the API process serves the
built SPA and the JSON API together, so the httpOnly auth cookies keep working
without CORS.

- **API serves the SPA in production** (`apps/api/src/app.ts`) — `express.static`
  for hashed assets plus an `index.html` fallback for client routes, registered
  after `/api` (so API misses still return the JSON 404) and before the 404
  handler. Toggled by `SERVE_WEB` (defaults on when `NODE_ENV=production`);
  `WEB_DIST_DIR` overrides the bundle location. Verified end-to-end.
- **Fresh-clone build fixed** — the generated Prisma client is gitignored, so
  `apps/api` now runs `prisma generate` on `postinstall`; the root `build` also
  generates it before building web. Without this a clean clone had no Prisma
  client and the API could not start.
- **`tsx` moved to production dependencies** — it's the runtime for `start`, so a
  `--omit=dev` production install no longer breaks. Added `db:deploy`
  (`prisma migrate deploy`) as the release migration step, and root `start` /
  `build` / `db:deploy` scripts.
- **`Dockerfile` (multi-stage) + `.dockerignore` + `docker-compose.yml`** — builds
  the SPA + Prisma client and runs the single-origin process with a Postgres
  service, persistent `uploads`/`pgdata` volumes, and a `/api/health` healthcheck.
- **Committed `package-lock.json`** for reproducible `npm ci`, added `.nvmrc` (22),
  documented every env var and the serverless/disk caveat in
  [DEPLOYMENT.md](./DEPLOYMENT.md).

### Added — reusable Tooltip + contextual help (ⓘ) on non-obvious controls

A single, accessible Tooltip primitive and a curated set of hints — enough to
teach a first-time user, not enough to clutter the UI.

- **`components/ui/Tooltip`** — one tooltip, built on Radix (hover + keyboard
  focus, Esc/blur close, `role="tooltip"` + `aria-describedby`, collision-aware
  placement) with a subtle Framer Motion fade/scale that honours
  `prefers-reduced-motion`. Content is a `ReactNode`, so it takes a string today
  and rich content / a docs link later. `InfoHint` is the ⓘ affordance — a real,
  tab-reachable button (taps focus it on mobile → opens). One global
  `Tooltip.Provider` (delay) already lives in `app/providers`.
- **`FormField` gained a `help` prop** — renders an ⓘ next to the label, so any
  field can carry contextual help without permanent inline text.
- **Applied only where meaning is non-obvious** (self-explanatory controls left
  alone): property **Status**, **Visibility**, **Featured**, and **Assigned
  agent** (reassigning changes who can see it); client **Priority** and
  **Budget** (matching + who can see it); agents' **Commission** column, the
  **Access** action ("choose what this agent can view and manage"), and
  **Deactivate** ("signs the agent out of every device immediately"); and the
  property detail **Assigned agent** (admin only).
- `Button` now forwards its `ref`, so it can anchor a tooltip via Radix `asChild`.

### Changed — dashboard "Recent Properties" widget: search, filters, shared components

Aligned the dashboard's recent-inventory widget with the Property Management
module by REUSING its parts rather than duplicating them.

- **Renamed** "Recent inventory" → "Recent Properties".
- **Extracted** the Properties page's search/filter bar (`PropertyFilterBar`) and
  results table (`PropertyTable`, with a `compact` mode) into shared components.
  The Properties page and the dashboard widget now render from the same code —
  they can't drift, and the filter set lives in one place
  (`lib/property-filters.ts`).
- **Dashboard** now has the full search + filter bar (status, type, sale/rent,
  beds, city, sort) over the **same scoped `useProperties` query**, so it stays in
  sync with the live records and an agent only ever sees/searches/filters their
  assigned properties (enforced server-side). Loading, empty and responsive
  states come from the shared table; a subtle Framer Motion transition animates
  the Clear control.
- **Shared search widened** to also match **city**, **assigned agent name**, and
  **property type** (in addition to title/code/locality/address) — a single
  server-side change that benefits both surfaces. Verified: search by city, type
  ("villa"), agent ("Aisha") and code all resolve, and agent scoping is preserved.

### Added — tagline display + a "Show tagline" visibility toggle

The saved tagline was only wired into the login-screen subtitle, so in the app it
looked like it wasn't showing. Now it appears in the branding areas and has an
admin visibility control.

- **Display**: the tagline shows under the CRM name in the **sidebar** and as the
  **login** subtitle. It's hidden (no empty space) when unset or when Show tagline
  is off — the two are gated together (`showTagline && tagline`).
- **Setting**: `Show tagline` toggle in Settings → Branding, directly below the
  Tagline field (default on). Turning it off hides the tagline everywhere WITHOUT
  deleting the text — verified: disable keeps the value, edits persist while
  hidden, re-enabling restores the updated text.
- **DB**: a new `AppSetting.showTagline` boolean (`@default(true)`). This is the
  first of a family of visibility flags — `showLogo`, `showCompanyName`, … each a
  boolean column plus one `kind: 'boolean'` entry in the settings form config, so
  new toggles are additive, not a rewrite.
- **Live**: updating the tagline or the toggle updates the sidebar/login
  immediately via the shared settings query — no refresh.

### Added — Settings module (CRM branding & company configuration)

An admin Settings page to manage the app's branding and company information,
stored in the database and reused across the app.

- **Schema**: a new `AppSetting` **singleton** table (a unique `singleton`
  boolean pinned to true → exactly one row, every write an upsert, no duplicates).
  Holds branding, company info, office address, social links and business copy.
  Logo/favicon are stored on disk like other media and streamed, never a static
  path.
- **API**: reading is PUBLIC (`GET /api/settings`, `/logo`, `/favicon`) so the
  login screen and favicon can brand themselves before auth; writing is gated by
  the new `settings.update` permission (`PATCH /api/settings`, and
  `POST`/`DELETE` for each asset). Uploads are MIME- and size-validated (PNG/JPEG/
  WebP/ICO, ≤ 2 MB; SVG refused — it carries script). New `settings.view` /
  `settings.update` permissions; super admin holds both, agents neither.
- **Page**: `/settings` (guarded by `settings.view`), a tabbed form — Branding,
  Company, Office address, Social media, Business — built from the shared Zod
  schema with reusable form components, logo/favicon upload widgets, Framer Motion
  tab/section transitions, a save toast, and validation that jumps to the tab of
  the first error. A **Settings** item appears in the admin sidebar; agents don't
  see it and are shown Access Denied if they navigate there directly.
- **Global branding**: `BrandingEffects` applies the configured name (page
  title), favicon and primary colour app-wide; the sidebar and login screen show
  the uploaded logo + name + tagline. The same `useSettings` query is the single
  seam for future reuse (email/PDF/print templates).

Verified end-to-end: public read, admin PATCH + logo upload/stream/delete,
non-image rejected (400), agent write blocked (403). Typecheck, build, lint and
125 tests all green.

### Fixed — the REAL cause of the cross-user theme leak: logout orphaned the theme observer

The earlier fix (per-user cache, logout reset) wasn't enough — the theme still
showed the previous user until a refresh. The actual root cause was in `useLogout`:
it called `queryClient.clear()`, which drops cached data but **orphans long-lived
observers**. The `ThemeProvider`'s `useMe` would freeze on the previous user and
keep applying their theme; only a full refresh (which remounts everything) fixed
it — exactly the reported symptom.

- **Fix:** `useLogout` now calls `queryClient.resetQueries()` instead of
  `clear()`. Both empty the cache (so a new user never sees the previous user's
  cached clients), but `resetQueries()` keeps observers **subscribed**, so `/me`
  re-resolves to the next user and the theme follows them with no refresh.
- **Provider simplified.** The applied theme is now derived purely from the
  `['me']` query (`serverTheme ?? resolveBootTheme()`) with no local mirror of
  server state that could drift — removing the fragile during-render state that
  the previous attempt relied on.
- **Regression test** (`theme-flow.test.tsx`) drives the REAL `useLogin`/
  `useLogout` hooks through Admin(light) → logout → Agent(dark) → logout → Admin,
  four times, asserting the theme is always the current user's. This is the only
  setup that reproduces the observer-orphaning; the isolated provider tests
  didn't (they used `resetQueries`, which sidesteps the bug).

### Fixed — theme no longer leaks the previous user's preference across logins

On the same browser, logging in as a second user (or back as the first) could
briefly show the previous user's theme until a refresh. Three root causes, all
fixed:

- **Global localStorage key.** The cache was a single `estate-theme` value shared
  by everyone on the device. It's now **keyed per user** (`{ [userId]: theme }`)
  plus an `estate-last-user` pointer that is **cleared on logout**, so the boot
  script resolves a logged-out browser to the system theme, never the last user's.
- **Stale fallback during the login transition.** The provider fell back to that
  global cache while `/me` was refetching. It now derives the applied theme from
  the current user's DB preference (the `['me']` query) and, when there's no
  authenticated user, falls back to the neutral **system** theme — reset the
  instant a session ends (during render, before paint).
- **Post-paint application.** The theme was applied in a `useEffect` (after the
  first frame). It's now a `useLayoutEffect`, and `RequireAuth` already blocks the
  protected app until `/me` resolves — so the dashboard's first frame is already
  the correct user's theme.

Verified with a test that repeats Admin(light) → Agent(dark) → logout → Admin
several times and asserts the theme is always the current user's, with the
active-user pointer cleared on each logout. 122 tests, lint and build green.

### Changed — theme preference is now per-user and database-backed

The theme was device-local (localStorage). It now follows the **user** across
sessions and devices, with the database as the source of truth.

- **Schema**: a new `UserPreference` table (1:1 with `User`, created lazily) with
  a nullable `theme`. Separate from `User` because a display choice is the user's
  own concern, not part of their auth identity — and it's built to grow
  (language, timezone, dateFormat, currency, sidebar state, … each become one
  more nullable column, no new table). NULL `theme` means "never chosen".
- **API**: `/me` now returns `preferences`; a self-service
  `PATCH /api/me/preferences` (authenticated, no permission gate) upserts. Every
  handler keys off the caller's own `userId`, so a user can only read/write their
  own preference and an admin can't reach another user's — theme is unrelated to
  permissions. Invalid values are rejected (field-keyed 400).
- **Client**: `ThemeProvider` now derives the applied theme from the `['me']`
  query (server state stays in Query, not a store). Toggling optimistically
  patches the cache and persists via the mutation; `localStorage` is kept purely
  as a pre-paint cache so the boot script still avoids FOUC, then the DB value
  reconciles it. First login with no saved theme seeds the DB default from the
  OS `prefers-color-scheme`.
- Verified end-to-end: Admin → dark and Agent → light persist independently and
  restore after logout/login; typecheck, build, lint, 122 tests (incl. new
  DB-backed theme tests + route-manifest coverage of `/api/me`).

### Added — global dark / light theme switcher

The token layer was built dark-aware from day one; this ships it.

- **ThemeProvider** (`app/theme-provider.tsx`) centralizes theme state and
  toggles `.dark` on `<html>`, which the semantic token layer keys off — no
  duplicated theme logic, and every existing component adapts for free.
- **Persistence**: the choice is saved to `localStorage` (`estate-theme`). With
  no saved choice we follow the OS `prefers-color-scheme` **live**; once the user
  picks, we stop tracking it. A boot script in `index.html` applies the resolved
  theme before first paint, so there's no flash of the wrong palette.
- **Header toggle** (`ThemeToggle`): a Sun/Moon button in the top bar, visible to
  every signed-in user (admin and agent), with a Framer Motion icon swap and a
  brief cross-fade between palettes — both gated on `prefers-reduced-motion`.
- **Contrast**: added semantic `text-brand/danger/success/warning` and
  `surface-*-soft` / `border-danger-soft` tokens that remap lighter on dark
  surfaces, and refactored ~45 hardcoded `-700` text / `-100` tint usages onto
  them. Light mode is pixel-identical; dark-mode text pairs verified ≥ 4.5:1
  (muted lifted to clear AA while staying a step below secondary). `color-scheme`
  now follows the theme so native controls and scrollbars match.

Verified: typecheck, build, lint, 119 tests (incl. new theme-toggle tests) green.

### Added — split media galleries (image lightbox + video gallery) & multiple video links

The detail page never rendered the external video link — a pasted YouTube URL was
stored and silently invisible. Fixed, and the media area is now split into two
purpose-built galleries.

- **Schema**: `Property.videoUrl` (single) → `videoUrls String[]` (multiple).
  Migration backfills any existing single link into the array before dropping the
  old column, so no data is lost. Replaced wholesale on write, like amenities.
- **Image Gallery**: a responsive, lazy-loaded grid that opens a **full-screen
  lightbox** — previous/next, keyboard (arrows + Esc), zoom, an `n / total`
  counter, and a close button. Built on Radix Dialog (focus trap, scroll lock,
  Esc) with Framer Motion transitions.
- **Video Gallery** (`VideoGallery`): shows uploaded video **files** and external
  **links** together, and renders nothing when there are none (no empty
  placeholder). YouTube uses a thumbnail + play **facade** — the iframe mounts
  only on click, so several embeds don't slow the page. Vimeo and direct-file
  URLs are supported too (`parseVideoUrl` helper, unit-tested).
- **Forms**: a `VideoLinkEditor` (add / edit-in-place / remove, with a live
  preview) replaces the single video input on both the Add and Edit forms;
  uploaded image/video files continue through the media picker/gallery. Invalid
  URLs are caught inline and re-validated server-side (field-keyed 400).
- `PropertyGallery` now composes the two galleries and gained section headings
  (Images / Property videos / Documents); it's shared by the detail page and the
  edit form, so both stay identical.

Verified: create/update/clear `videoUrls` round-trip, invalid URL rejected,
uploaded videos still stream (range requests), typecheck, build, 116 tests
(incl. 11 new parser tests) and lint all green.

### Added — full property editing + extended Add form

A property can now be **edited in full**, and the Add form gained everything the
Edit form has — the two are literally the **same component** (`PropertyForm`,
`mode="create" | "edit"`), so they can never drift. Edit auto-populates from the
property's DTO; the admin changes only what they need.

- **Every field is editable** across Overview, Pricing, Amenities, Internal
  notes, Location and Media. Reused the existing `FormField`/`Input`/`Select`
  primitives and the shared Zod schema, so client and server validate identically
  and server field-errors map back onto the form.
- **Amenities** — a grouped chip picker (`AmenityPicker`) backed by a new
  `GET /api/amenities` catalog endpoint (guarded by `property.create` OR
  `property.update`). Add/remove on both forms; the update replaces the set
  wholesale in one transaction.
- **Internal notes** — a dedicated textarea, shown only to holders of
  `property.internalNotes.view`. Hidden from agents, and the write path strips
  the field for anyone who can't read it (a hidden field is not a writable one).
- **Google Maps link** — a **separate** `googleMapUrl` column and input, distinct
  from lat/lng, stored verbatim for future map previews. The detail page prefers
  it over the coordinate-derived link. Empty string normalises to `NULL`.
- **Media** — images **and** video, multiple, with previews for both, remove, and
  client-side type/size validation mirroring the server (images/PDF 10 MB, video
  100 MB). Live gallery on Edit (immediate upload/delete, range-served playback);
  a staged local picker on Add that uploads once the property exists — a failed
  upload no longer strands the created property behind a form error.
- **Edit actions** — a pencil action on every property row (gated by
  `property.update`) and an Edit button on the detail page; a new
  `/properties/:id/edit` route guarded by `property.update`, with the same
  403/404 strict-RBAC distinction the detail page draws.

Verified end-to-end: create-with-all-fields, edit round-trip (title, maps link,
internal notes, coordinates, amenity replacement all persisted), typecheck,
build, 105 tests and lint all green.

### Changed — role-based sidebar + Access Denied on admin routes

The sidebar config already tagged each item with the permission it needs, but
the render ignored it — every item showed for everyone. Now it **filters the
declarative config against the user's effective permissions**, and drops any
group left empty. No `if (role === 'admin')` anywhere: a role is a set of
permissions, so adding a role or a page is a config change, not a code change.

- An **agent** (holds `property.list` + `client.list`) sees exactly
  **Dashboard, Properties, Clients**. Requirements, Agents, Activity log and
  Roles & access disappear (their whole "Admin" group collapses).
- An **admin** sees every item.
- **Admin routes render an Access Denied (403) page** instead of the old silent
  `/404` redirect — `RequirePermission` now shows `ForbiddenPage` in place, so
  an agent typing `/settings/roles` (or any admin URL) is told plainly they're
  restricted, with a link back to the dashboard.
- Guarded the create routes too (`/properties/new` → `property.create`,
  `/clients/new` → `client.create`), so an agent can't reach a form whose
  submit would 403 anyway.

The UI is convenience; enforcement is the guard + the API. Verified: an agent
hitting `/api/agents`, `/api/activity-logs`, `/api/rbac/*`, bulk-assign, or
create-property/client directly gets **403** every time, sidebar or not.

### Changed — STRICT property RBAC: agents see only what's assigned to them

Reverses the shared-pool change from the previous entry. Requirement: an agent
must see **only** properties explicitly assigned to them by an admin, and never
another agent's — enforced at the backend across every surface.

`scopeForProperty(agent)` is now exactly `{ deletedAt: null, assignedAgentId:
self }` — one exclusive gate, no OR, no browse pool, no client-shortlist
widening. It flows through list, search, filters, detail, dashboard counts and
media; write services scope-check with the same predicate.

- **Unassigned properties are admin-only** until assigned (`assignedAgentId`
  null never matches an agent).
- **Reassignment** moves a property between agents' scopes on the next request.
- **Access Denied**: opening another agent's property by direct id returns
  **403 "Access denied: this property is not assigned to you"**; a nonexistent
  id returns 404. The property detail page renders the two distinctly.
- The client shortlist is filtered too — an agent viewing their client sees only
  the shortlisted properties that are also assigned to them.

Verified against the running backend, all seven requirements:

| # | Requirement | Result |
|---|---|---|
| 1 | Agent sees only assigned | Rohan: PROP-1/2/5; Aisha: PROP-3/4/6 |
| 2 | Never sees others' | cross-access absent from list, search, filters |
| 3 | Enforced in search + filters | search "BKC" → nothing for Rohan; city filter scoped |
| 4 | Admin unrestricted | sees all 6, opens any |
| 5 | Reassignment moves scope | assign PROP-1 to Aisha → hers next request, gone from Rohan |
| 6 | Unassigned is admin-only | cleared PROP-1 → invisible to Rohan, visible to admin |
| 7 | Access Denied by URL | 403 "Access denied…" on another agent's id; 404 on nonexistent |

Model & scalability: assignment is the single indexed FK `Property.assignedAgentId`.
Co-assignment (multiple agents per property), if ever needed, is a `PropertyAgent`
join-table migration touching only the scope resolver — see docs/RBAC.md.

### Changed — agents browse the shared inventory (not only assigned)

Previously an agent could see only properties assigned to them or to one of
their clients — a per-agent-exclusive model. For a brokerage that's the wrong
default: an agent needs to browse available stock to match it to clients.

`scopeForProperty` for an agent is now the **shared-pool model** — three OR
clauses:
1. everything that is not off-market (`visibility != PRIVATE`) — the browsable pool
2. anything assigned to them (including off-market they handle)
3. anything assigned to one of their clients (the Open Client → View Properties flow)

Assignment now means *who is responsible*, not *who may look*. **Off-market
(PRIVATE) listings stay restricted** to the agent/clients handling them.

Nothing about field redaction changes: verified that an agent browsing another
agent's INTERNAL listing sees the **price** (needed to match clients) but the
owner's **internal notes stay redacted**. Verified end to end: Rohan's list went
from 4 → 6 (now includes Aisha's INTERNAL listings); an unrelated PRIVATE listing
is invisible to him (absent from the list, 404 on detail); the redaction holds.

### Fixed — Super Admin can now assign an agent to a property

The property↔agent relationship (`assignedAgentId`) and the `property.assignAgent`
permission both existed, but **nothing in the UI ever set it** — the property
pages only *displayed* the agent name. Now:

- **Property detail** has an "Assigned agent" selector (gated by
  `property.assignAgent`; a plain read-out for everyone else). Choosing an agent
  — or clearing it — calls a new `POST /api/properties/:id/assign-agent`.
- **The create form** offers the same selector, so a property can be assigned at
  creation.
- A **dedicated endpoint with its own permission**, separate from
  `property.update`: a manager can reassign inventory without being able to edit
  prices. Reassigning also **changes who can see the property** (scope keys off
  `assignedAgentId`), so it's a real authorization action — verified: an agent
  couldn't see a BKC property, was assigned it, and it appeared in their scoped
  list.
- The suspended-agent guard applies (assigning an inactive agent → 400), and an
  agent without the permission is 403.
- `/agents/assignable` is now guarded by the **union** of the assignment
  permissions (`requireAnyPermission`) so it serves both the client- and
  property-assignment flows, not just the client one.

**Seed hardening** (this test-induced drift bit twice): reseed now restores each
demo user's email, password, name and status, and clears any per-agent
permission overrides. A changed password or a stray override no longer survives
`npm run db:seed` — the demo logins always work after a reseed.

### Added — self-service profile page

Every authenticated user — Super Admin and Agent alike — now has a **Your
profile** page (`/profile`, linked from the top-bar user menu) to manage their
own details and password.

- **Edit own** name, email (uniqueness-checked → 409 on a clash), and mobile.
  Agents can also edit their own specialization, experience, and address;
  commission is shown **read-only** (it's an admin-set financial field, not
  self-editable).
- **Change own password** — verifies the current password, then **signs the user
  out of every *other* device while keeping the current one**. Changing a
  password shouldn't eject the person who changed it, but a leaked session
  elsewhere must die. (`revokeOtherSessions` — a new variant that keeps the
  acting session.)

This also **fills a Phase 2 gap**: the `changePasswordSchema` existed but no
change-password endpoint was ever built — only login/refresh/logout/me were
wired. That endpoint now exists (self-service).

Security shape: the routes are `publicRoute` (authenticated, no permission gate)
and operate **only on the actor's own id** — never a target from the request
body. That's the same "you may act on yourself" footing as `/auth/me`.

Verified: agent and admin both load the right profile (admin has no agent
block); self-edits persist and `/me` reflects a changed name so the top bar
updates; a password change kept the current session (200) and revoked the other
(401); a wrong current password is rejected; a `commissionRate` sent by an agent
is ignored.

### Added — editable agent profiles + agent codes

- Super Admin can now **edit an agent's details** — name, email, mobile number,
  specialization, experience, commission, address — via an "Edit" dialog on the
  Agents page (gated by `agent.update`).
- **Email is now editable** (the `updateAgent` service previously dropped it
  silently — email lives on `User`, and it was being spread into the profile
  update). Changing it re-checks uniqueness against active accounts: a clash
  returns 409, and the agent can immediately sign in with the new address.
- **Every agent has a human-readable profile code — `AGT-00001`** — matching the
  `PROP-`/`CLI-` pattern, from a new `agent_code_seq`. Shown on the Agents page.
  Migration backfilled the two existing agents (AGT-00001, AGT-00002).
- The Agents page now shows the **ID and mobile** columns (mobile as a `tel:`
  link).

The `agent_code` migration also cleared a cosmetic drift that had lingered since
Phase 1: the property/client code defaults were set via raw SQL in `init`, and
the schema's `dbgenerated` normalises slightly differently, so every
`migrate diff` re-emitted them. Folded the no-op reconciliation in. Verified:
`migrate status` is clean, codes generate for new agents (AGT-00003…), and edits
persist.

### Added — per-agent access editing

Super Admin can now grant or restrict individual permissions for a specific
agent. This is the "per-agent overrides: UI later" item the plan deferred — the
schema (`UserPermission` ALLOW/DENY) and resolver already supported it.

- `GET/PUT /api/agents/:id/permissions` (guarded by `agent.permissions.update`).
- "Access" action on each agent row opens a matrix dialog: every permission is a
  checkbox showing the agent's *effective* state, with a Granted/Denied badge
  where it overrides the role default.
- The client sends only the **diffs** — permissions where the desired state
  differs from what the Agent role grants. Toggling back to the role default
  removes the override, so the stored set stays minimal and future role changes
  still flow through un-overridden permissions.
- **Takes effect on the agent's next request**, no re-login — the same
  permissions-loaded-per-request property that makes deactivation instant.

Verified against the running stack: granting `client.budget.view` made budgets
appear in the agent's very next response; a DENY on a role-granted permission
(`client.email.view`) redacted it (deny beats the role grant); an unknown key is
rejected (`VALIDATION_FAILED`) rather than silently stored; an agent without
`agent.permissions.update` is 403 on both GET and PUT.

### Added — Phases 6–8: activity log, global search, roles matrix

- **Activity log page** (`/activity`, admin-only). The data has accumulated
  since Phase 2 — every mutation wrote a row; this surfaces it. Safe to render
  in full because sensitive fields are logged by name, never value.
- **Global search** in the top bar: debounced, scoped, across properties +
  clients, with phone normalization ("9876543210" matches "+91 98765 43210").
  A results popover; scope runs on the query so it can't leak what the lists
  wouldn't.
- **Read-only roles matrix** (`/settings/roles`): roles × the 43-permission
  catalog, grouped by resource. Makes the "catalog is code, grants are data"
  split visible. Editing deferred (schema/resolver already support it).

**Security fix caught by end-to-end verification.** The first search
implementation spread `scopeForProperty(actor)` and then added its own
top-level `OR` for the search terms. `scopeForProperty` for an agent *contains*
an `OR` (the "assigned to me OR to my client" clause), so the second `OR` key
**silently overwrote the scope's** — an agent's search returned every property,
including other agents' inventory. Every unit test passed; only diffing search
results against the scoped list exposed it. Fixed by composing scope and search
with `AND` (as the list endpoints already do), and pinned with a regression test
that reproduces the clobber. Verified: agent search now equals the agent's
scoped list exactly, and returns nothing for another agent's property.

### Added — Phase 5: the requirement → match → assign flow (core feature)

The screen the product is built around. `RequirementMatchPage` at `/requirements`.

- **Two structurally separate forms.** The requirement is a real `<form>`; the
  search filters are controls *outside* it, as siblings. That's the fix for the
  spec's trap — nest the search inside the requirement form and Enter in a filter
  submits the wrong thing. As siblings, Enter in a filter does nothing.
- **Search prefills from the requirement** (`requirementToFilters`: budget → price
  band, city, beds, type). "Match from requirement" re-syncs on demand rather
  than fighting the admin every keystroke.
- **Two modes, one screen.** New client → atomic `POST /clients` carrying
  `{ client, requirement, propertyIds }`. Existing client (`?clientId=`) →
  requirement prefilled, `POST /clients/:id/properties` bulk-assign.
- Entry from the client detail page ("Find matches"), gated by
  `client.assignProperty`.

Assignment backend (`assignment-service.ts`), one shared transaction helper for
both paths so the rules can't drift:

- **One ActivityLog row per assignment**, never a batched "assigned 5". The
  question an admin asks is *which* properties and *when* — a count can't answer.
- **Idempotent**: re-ticking an already-assigned property is a genuine no-op
  (no write, no log). A previously-removed assignment is **revived** (its row
  reused), not duplicated — so the log rows referencing it stay valid.
- Property ids validated against the actor's scope before the transaction opens.

Verified against the running stack:

| Check | Result |
|---|---|
| Atomic create (client + requirement + 2 properties) | 2 assignments, **2 log rows** — one per property |
| Re-assign same 2 + 1 new | response `assigned: 1`; only the new one logged |
| Remove then re-add | same row revived, **not** duplicated (3 rows, not 4) |
| Agent bulk-assign | 403 (no `client.assignProperty`) |
| Existing-client assign | 2 → 3 active assignments |

### Added — Phase 4: clients & agents write paths

Clients:
- `POST /api/clients` — **atomic**: client + first requirement in one
  transaction (the shape Phase 5's matching screen posts). `PATCH /:id`,
  `POST /:id/interactions`, `POST /:id/requirements`, `POST /:id/assign-agent`.
- Client detail page: interactions timeline + "log interaction" form (type +
  note + follow-up in one action), shared-properties list, redacted contact card.
- The **`lastContactAt`-in-transaction** pattern: logging an interaction writes
  the interaction AND advances `lastContactAt`/`followUpStatus`/`nextFollowUp`
  in one transaction. `lastContactAt` only moves forward (a backdated note can't
  clobber a newer contact). Verified live: one call updated all three atomically.

Agents (admin-only surface):
- `GET /api/agents`, `POST /` (creates User + AgentProfile + agent role in one
  tx, argon2 temp password), `PATCH /:id`, `POST /:id/status`, `GET /assignable`.
- Agents list with activate/deactivate; create dialog (Radix `Dialog` primitive).
- **Commission redaction**: `commissionRate` gated by `agent.commission.view`.
- **Deactivation revokes sessions in the same transaction** — verified through
  the admin endpoint: a live agent session went 200 → 401 on the next request.

Bug caught before shipping: I first gated interaction bodies behind
`client.internalNotes.view`. But agents hold `client.interaction.create` and
*not* `internalNotes.view` — so an agent would have logged a call note and never
read it back. Interaction notes are the shared operational timeline; the
admin-only commercial notes live on `Client.notes` (still gated). Two different
kinds of note — a test now asserts an agent sees their own interaction bodies
while `Client.notes` stays redacted.

### Added — Phase 3 (media): authorized upload & streaming

- `POST /api/properties/:id/media` (multer, memory storage), `GET /api/media/:id`
  (authorized stream), `DELETE /api/media/:id`, `POST /api/media/:id/cover`.
- Property detail gallery: upload, cover selection, delete — all gated by
  `<Can permission="property.media.upload">`; images `<img src="/api/media/:id">`.
- Seed now **repairs drift on reseed** — property upserts write real `update`
  payloads instead of `{}`, so a corrupted demo DB is one `npm run db:seed` from
  clean. (Retires the hand-repair I'd been doing after each write test.)

Security controls, each verified against the running stack:

| Control | Result |
|---|---|
| Not `express.static` | files stream through `GET /api/media/:id` only |
| Scope join | agent with `property.media.download` gets **404** on a file whose property is out of scope — no leak |
| Unauthenticated | 401 |
| Permission gate | agent (no `property.media.upload`) → 403 on upload |
| MIME allowlist | `text/plain` rejected; SVG deliberately excluded (script vector) |
| Path traversal | `resolveStorageKey` refuses anything escaping the upload root → 403 |
| Filename | stored as a cuid we generate, never the client's `originalname` |
| Delete | removes DB row *and* file (0 orphans) |

### Added — Phase 3 (write path): properties, activity log, live dashboard

- Property writes: `POST /`, `PATCH /:id`, `POST /:id/status`, `POST /:id/archive`,
  `DELETE /:id`. Each is a transaction carrying its own `ActivityLog` row —
  logging goes in *with* the mutation, not bolted on later.
- **Server refinement layer**: `assignedAgentId` must reference an *active*
  agent; amenities must exist. Cross-table rules that shared Zod cannot express,
  returned field-keyed so they map onto RHF.
- **Activity log service** with the PII guard: sensitive fields (`internalNotes`,
  prices, budgets, phones, commission) are logged by NAME, never value.
- **Live dashboard** — every tile runs through the same scope resolver as the
  lists. Agent headcount and commission are gated (null, not zero). This retires
  the seeded constants that were the one place the demo lied.
- Property create form (RHF + shared `propertyCreateSchema`, price fields shown
  by `watch(listingType)`), plus status/archive actions gated by `<Can>`.
- `useUrlFilters`, `Select` primitive.

Two bugs that **only driving the live endpoint exposed** — both passed every
unit test because the wrong values were syntactically valid:

1. **Systemic default-leak (data corruption).** `propertyBaseSchema.partial()`
   keeps every `.default()`, so a one-field PATCH arrived carrying
   `status`/`visibility`/`parking`/`furnished`/`amenityIds` and silently rewrote
   them to defaults. A `{featured:true}` edit reset a RENTED property to
   AVAILABLE. Fix: no `.default()` in the base — those fields already have
   `@default` in the DB, so create fills them there and PATCH leaves them alone.
   Regression test asserts a parsed update equals exactly what was sent.
2. **Phantom amenities log.** Same root cause, milder: `amenityIds` defaulted to
   `[]`, and `[]` is truthy, so every edit claimed to touch amenities.

### Added — Phase 3 (read path): properties

- `GET /api/properties` — scoped, filtered, sorted, paginated; `GET /:id`;
  `GET /cities` for the filter dropdown.
- Property serializer redacting `salePrice`/`rentPricePerMonth`/deposits behind
  `property.price.view` and `internalNotes` behind `property.internalNotes.view`.
- `PropertiesPage` with URL-driven filters (status, type, sale/rent, beds, city,
  sort) and `PropertyDetailPage`.
- `useUrlFilters` extracted on its third usage — filters live in the URL so a
  filtered view is a shareable link.
- `Select` primitive: a native `<select>`. Radix stays for rich/async cases; a
  dropdown of ten strings gets correct keyboard, screen-reader and mobile
  behaviour free from the platform.

Verified against the running stack:

| Property | Result |
|---|---|
| Agent property scope | sees **4 of 6** — 3 his own, **1 via his client** |
| `internalNotes` | absent for the agent (it holds the negotiating position) |
| Price | visible to the agent, who legitimately holds `property.price.view` |
| Scope miss | 404, identical to a nonexistent id |
| `BOTH` listings | PROP-00002 appears under **both** `?listingType=SALE` and `RENT` |

**Seed fix.** Every seeded client happened to be shown only their own agent's
inventory, so the second clause of `scopeForProperty` — *"or assigned to one of
my clients"*, the spec's own `Open Client → View Assigned Properties` workflow —
was dead code in the demo. It existed and was invisible. The seed now assigns
one of Aisha's properties to one of Rohan's clients, which is what makes the
agent's count 4 rather than 3.

### Added — Phase 2: auth + the RBAC spine

- **Express 5 API** with the error envelope, request logging, and boot-time env
  validation. `/api/health` verified through the Vite proxy.
- **Auth**: argon2 (`@node-rs/argon2`, prebuilt — no node-gyp on this machine),
  `jose` JWTs in httpOnly cookies, refresh rotation with **reuse detection**
  (a replayed revoked token revokes every session for that user and logs it),
  single-flight client refresh so parallel queries can't trigger a
  reuse-detection self-nuke.
- **The three RBAC layers**, each a different problem: `requirePermission`
  (authorization), `scopeFor` (row scoping), `toClientDTO` (field projection).
- **Vertical slice**: `GET /api/clients`, guarded + scoped + redacted.
- **Frontend auth**: typed API client, `useMe`/`usePermissions`, `<Can>`,
  `<Locked>`, `<RequirePermission>`, `<RequireAuth>`, login page, clients page.
- **ESLint guardrail**: `no-restricted-imports` blocks the Prisma client outside
  `src/services/**`. It immediately caught `auth-routes.ts` doing raw user
  lookups — that code now lives in `auth-service.ts`.
- **58 tests**, including the four that matter: permission resolver, redaction
  serializer, scope resolver, route manifest.

Verified end-to-end, not assumed:

| Property | Result |
|---|---|
| Agent scoping | sees 2 of 4 clients |
| Field redaction | `budget` **absent from the JSON**, not null, not CSS-hidden |
| Filter leak (RBAC §7) | agent's `?minBudget` ignored — 2 rows at any value; admin's honoured (3, then 1) |
| Scope miss | **404**, identical to a nonexistent id — no existence disclosure |
| Instant revocation | suspension → 403 on the **next request**, same cookie |
| Logout | session revoked server-side, not just cookie cleared |
| Phone normalisation | `9876543210` matches `+91 98765 43210` |

### Added

- **npm workspaces**: `apps/web`, `apps/api`, `packages/shared`. Exists so the
  Zod schemas and permission catalog can be shared by both sides — the only
  justification, and a sufficient one.
- **Design token system** (Tailwind 4, CSS-first). Two layers: primitives in
  `@theme`, semantics in `:root` + `@theme inline`. oklch throughout. Verified in
  the built CSS that semantic utilities reference runtime vars rather than
  snapshotting.
- **Prisma schema** — 21 tables covering identity/RBAC, property, client,
  assignment, deals, activity logging. Against local PostgreSQL 17.
- **Permission catalog** in `packages/shared` — 43 permissions, typed as a
  literal union so typos are compile errors. Upserted by the seed.
- **Idempotent seed** — 3 roles, 20 amenities, 1 admin + 2 agents, 6 properties,
  4 clients with requirements, 3 assignments, 3 interactions, 1 deal.
- **Tests** — enum parity (shared ↔ Prisma) and permission catalog invariants,
  including a regression guard that the agent role never holds
  budget/commission/internal-notes/export.
- `CLAUDE.md` and `docs/`.
- **PostgreSQL 17** installed locally with a dedicated `crm_app` role
  (`CREATEDB`, for Prisma's shadow database).

### Fixed

- **`.gitignore` did not ignore `.env`** — on a repository with a live GitHub
  remote, immediately before adding `DATABASE_URL` and JWT secrets. Also now
  ignores the generated Prisma client and local uploads.
- **`tsconfig` had no `strict`.** Enabled, plus `noUncheckedIndexedAccess`. Free
  on an empty repo; brutal to retrofit.
- **Mixed column casing.** `@map` had been applied inconsistently, leaving
  `clients.fullName` and `users.passwordHash` camelCase among snake_case
  columns. Caught by a verification query. Since the migration was local-only and
  uncommitted, `init` was regenerated rather than stacking a rename migration.
  There are now zero camelCase columns.
- **Migration would have failed on a fresh database.** Prisma inlines
  `nextval('property_code_seq')` into `CREATE TABLE`, so the hand-written
  `CREATE SEQUENCE` had to be **prepended**, not appended. Appending — the
  obvious move — passes locally and fails for everyone else. Verified against a
  dropped and rebuilt schema.

### Changed — deviations from the original plan

- **Zustand dropped.** Query owns server state, RHF owns forms, the URL owns
  filters, `useState` owns selection. Nothing was left for it, and the
  predictable harm was a stale copy of `permissions`.
- **Radix + TanStack Table added.** Hand-rolling accessible comboboxes is a WCAG
  trap; TanStack's `columnVisibility` maps directly onto field-level permissions.
- **`Deal` table added.** `Property.status = SOLD` records neither when, for how
  much, to whom, nor by whom — 4 of 6 reports were uncomputable without it.
- **`ClientInteraction` added.** Implied by the spec but never named.
- **`salePrice` + `rentPricePerMonth`** instead of one `price`, because
  `listingType` can be `BOTH`.
- **React Router 8**, not 7 — v7 is superseded; data mode is intact.
- **Prisma 7 `datasource.url` removed** → `prisma.config.ts` + `@prisma/adapter-pg`.
- **TS 6 `baseUrl` deprecated** (hard error) → dropped.
- **API typechecks rather than emits** — `rootDir` cannot span a monorepo. Runs
  via `tsx`; a production bundle step is deferred to deploy.

### Notes

- The **DesignMD design skills were never present** on this machine. The design
  system was defined from scratch, on tokens, so DesignMD can be layered in later
  as a values swap rather than a rewrite.
- **The install spike passed cleanly.** React 19 + Vite 8 + TS 6 + ESLint 10 +
  Tailwind 4 + Express 5 on Node 24 installed with zero peer conflicts. The plan
  had called this its biggest schedule risk; it was overstated.
- **Do not run `npm audit fix --force`** — it downgrades Prisma 7 → 6 to patch a
  dev-only `@prisma/dev` transitive that is never loaded.
