# Database

PostgreSQL 17 local, Prisma 7. Read this before changing the schema.

---

## Setup

```
host      localhost:5432
database  real_estate_crm
role      crm_app          -- has CREATEDB; Prisma migrate needs it for the shadow DB
```

Postgres was installed locally rather than SQLite because **dev must match
production**. SQLite has no enums, no arrays, no JSONB, no real full-text — the
schema would have been dumbed down and then reworked at migration time. That
meets "easy setup" and fails "future migration".

**Windows gotcha:** special characters in the password must be URL-encoded inside
`DATABASE_URL` (`@` → `%40`). The generated password is alphanumeric to sidestep
this entirely.

---

## Prisma 7 changes that will surprise you

- **`datasource.url` no longer exists.** The validator rejects it. Connection
  config lives in `prisma.config.ts` (for Migrate) and comes from a driver
  adapter — `new PrismaPg({ connectionString })` — at runtime.
- **Query compiler is WASM.** No native engine download. This is why npm 11
  blocking Prisma's postinstall is harmless.
- **`migrate diff` flags changed** — `--to-config-datasource`, not
  `--to-schema-datasource`.
- **Don't `npm audit fix --force`.** It downgrades Prisma 7 → 6 to patch a
  dev-only `@prisma/dev` → `@hono/node-server` transitive we never load.
- If a command hangs on *"Timed out trying to acquire a postgres advisory
  lock"*, a killed migration left a backend open. Find it in `pg_locks` and
  `pg_terminate_backend` it.

---

## Conventions

- **PKs are `cuid(2)`.** Never `Int` — a sequential ID in a URL leaks your client
  count to every agent who can read a browser address bar.
- **Human-facing IDs are `code`** (`PROP-00123`, `CLI-00045`), from a Postgres
  sequence. Nobody searches by `clx7f9a2b0000`, and the spec requires search by
  property/client ID.
- **Columns are `snake_case`.** Every Prisma field whose column would be
  camelCase needs `@map`. There are currently **zero** camelCase columns —
  verify with:
  ```sql
  SELECT table_name || '.' || column_name FROM information_schema.columns
  WHERE table_schema='public' AND column_name ~ '[A-Z]';
  ```
- **Soft delete is `deletedAt`.** No global filter middleware — `scopeFor()` adds
  `deletedAt: null` explicitly.
- **`status` / `archivedAt` / `deletedAt` are three orthogonal concepts.** Never
  overload. "Active property" = `status = AVAILABLE AND archived_at IS NULL AND deleted_at IS NULL`.

---

## Money

**`Decimal @db.Decimal(14,2)`. Never `Float`. Never Int-paise.**

- `Float` rounds in binary — visible on lakh-scale values.
- Int-paise overflows: 2³¹ ≈ ₹21 lakh, and Indian property prices blow straight
  past that in a single field. Decimal(14,2) reaches ₹999 crore.
- **Prisma `Decimal` does not JSON-serialize.** DTOs carry money as a **string**,
  formatted at the UI with `Intl.NumberFormat('en-IN')` for lakh/crore grouping.

`number` is banned for money everywhere: DB, DTO, and in your head.

---

## Hand-written migration SQL

Some things Prisma cannot express live in raw SQL inside `migration.sql`.
**If you regenerate a migration, re-apply both blocks.**

### 1. Code sequences — must be PREPENDED

```sql
CREATE SEQUENCE "property_code_seq" START 1;
CREATE SEQUENCE "client_code_seq" START 1;
```

The schema declares
`@default(dbgenerated("('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'))"))`,
which Prisma **inlines into `CREATE TABLE`**. If the sequences are created
afterwards, the migration passes on a database that already has them and fails on
a fresh one — the worst class of bug, because it works on your machine.

`dbgenerated()` is also what stops Prisma demanding `code` on every `create()`:
without it, Prisma doesn't know the database supplies a default.

### 2. Partial unique index — appended

```sql
CREATE UNIQUE INDEX "users_email_active_key"
  ON "users"("email") WHERE "deleted_at" IS NULL;
```

Soft delete plus a plain `@unique` on email would permanently block a deleted
user's address from being reused. The partial index is the constraint we actually
want, and Prisma has no syntax for it — hence the bare `@@index` on `User.email`
plus this.

---

## Modelling decisions, and what they're protecting against

| Decision | Instead of | Why |
|---|---|---|
| `User` ≠ `AgentProfile` (1:1) | one `Agent` table | RBAC gets **one** subject type. `Client` is not a User at all — it never logs in. |
| `Deal` table | `Property.status = SOLD` | SOLD records neither when, for how much, to whom, nor by whom. **4 of 6 reports were uncomputable without this.** |
| `ClientInteraction` | nothing | The spec implies it (notes, meetings, `lastContact`) but never names it. |
| `salePrice` + `rentPricePerMonth` | one `price` | `listingType` can be `BOTH`, and one price is meaningless when a listing is both — different numbers, different units. |
| `budgetMin/Max` on `ClientRequirement` | `Client.budget` | Budget is a range, and a copy on Client drifts the first time a requirement is edited. |
| `Amenity` table + joins | free text | **Canonicalization**, not query power. Free text gives "Swimming Pool"/"swimming pool"/"Pool" and the match filter returns zero rows forever. Two joins: properties *have*, requirements *want*. |
| one `PropertyMedia` + type enum | 3 tables | Identical columns with ordering/cover logic triplicated — and floor plans are a 4th thing that's also an image. |
| `assignedAgentId` FK | join table | The field list says *singular*. A join table for 1:N puts an extra join in the hottest scoped query. Co-assignment, if it ever arrives, is a real migration with real requirements. |
| `latitude`/`longitude` (structured) **and** `googleMapUrl` (a pasted share link) | a single derived `googleMap` | Reversed later, on request. The two now coexist by design and answer different needs: lat/lng is the structured, queryable coordinate; `googleMapUrl` is a user-pasted convenience link the admin already has and wants preserved verbatim for map previews. They are **not** two sources of the same truth — lat/lng rounds to the column's 2 decimals (~1 km), which is exactly why a precise pasted link earns its own field. The empty string normalises to `NULL`. |
| `videoUrls String[]` (external links) + `PropertyMedia` VIDEO rows (uploaded files) | a single `videoUrl` string | A property can have several external videos (walkthrough, drone, locality reel), so external links are a text array replaced wholesale on write, like `amenityIds`. Uploaded video **files** stay in `PropertyMedia` (type VIDEO) and stream through the authorized route; the array is only for embeds we don't host. The migration backfills the old single `video_url` into the array before dropping it. |
| `builtYear` | `propertyAge` | Age is wrong next year. |
| `commissionRate` snapshot on `Deal` | join to `AgentProfile` | Rates change; historical reports must not retroactively mutate. |
| `lastContactAt` denormalized | computed | Deliberate — so the client list can sort/filter without an aggregate join. Written in the **same transaction** as the interaction. Labelled in the schema so nobody "fixes" it. |
| `PropertyAssignment.status` | bare join row | Without it the client-conversion report is uncomputable. Soft-remove (`removedAt`), or the activity log references rows that vanished. |
| `phoneNormalized` | search on `phone` | "9876543210" would never match "+91 98765 43210". |

### Enums vs lookup tables

`PropertyType` is stable taxonomy → enum. **`ClientSource` is not** — admins will
want "Facebook Campaign Q3" — so it's a free string. Postgres takes `ADD VALUE`
cleanly; removing or reordering is migration surgery.

### ActivityLog

Polymorphic **by necessity**: `entityType`/`entityId` are strings with no FK, so
logs correctly survive deletion of what they describe. Don't try to make it
polymorphic-with-FKs.

> **PII trap:** logging before/after values of a Client puts `phone` and `budget`
> into a second table the redactor doesn't cover. For sensitive fields, log the
> field **names** that changed, not the values.

### Indexes

Start honest. **No single composite serves** budget × city × bedrooms × type ×
status — that's a permutation explosion; Postgres will bitmap-AND separate
indexes. Don't over-index speculatively; measure.

`ActivityLog` grows fastest. Partitioning is out of scope — saying so out loud so
nobody assumes otherwise.

---

## Seeding

`npm run db:seed` is **idempotent** — upserts throughout, safe to re-run.

It upserts the permission catalog from `packages/shared` on every run. That's the
mechanism behind *"add a key, restart, admin can assign it"*.

Seeded: 43 permissions, 3 roles, 20 amenities, 1 admin + 2 agents, 6 properties,
4 clients with active requirements, 3 assignments, 3 interactions, 1 deal.

Note the seed omits `code` on create — proving the hand-written sequence default
actually works.

Logins: `admin@demo.local` / `agent@demo.local` / `agent2@demo.local`,
all `Passw0rd!`.
