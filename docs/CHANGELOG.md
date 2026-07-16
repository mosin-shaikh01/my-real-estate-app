# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning starts at `0.1.0` when Phase 1 completes.

---

## [Unreleased]

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
