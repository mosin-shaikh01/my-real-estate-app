# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning starts at `0.1.0` when Phase 1 completes.

---

## [Unreleased]

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
