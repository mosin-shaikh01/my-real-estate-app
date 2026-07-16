# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning starts at `0.1.0` when Phase 1 completes.

---

## [Unreleased]

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
