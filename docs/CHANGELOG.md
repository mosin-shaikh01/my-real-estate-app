# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning starts at `0.1.0` when Phase 1 completes.

---

## [Unreleased]

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
