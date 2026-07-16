# API

Base: `/api`. Same-origin in dev via the Vite proxy — see
[ARCHITECTURE.md](./ARCHITECTURE.md) for why that matters.

---

## Conventions

### Every route declares a permission

```ts
router.get('/', requirePermission('property.list'), handler)
```

An unguarded route is a **test failure**, not a silent default. The
route-manifest test walks the router and fails the build.

### 403 vs 404 — one rule

- **Scope miss → 404.** Never reveal that another agent's client exists.
- **Permission miss on a visible resource → 403.**

No case-by-case debate.

### Pagination — offset, not cursor

```
GET /api/properties?page=1&pageSize=25
→ { data: [...], meta: { page, pageSize, total, totalPages } }
```

CRM tables need page numbers and "1,234 results". Cursor pagination can't do
either. Cursor is right for infinite feeds; this is not one.

### Filtering & sorting

Flat query params. `-` prefix means descending.

```
GET /api/properties?city=Pune&minSalePrice=5000000&bedrooms=2,3&status=AVAILABLE&sort=-salePrice
```

> **Security, not convenience:** the sortable and filterable field allowlists are
> **permission-filtered**. An agent without `client.budget.view` who can sort by
> budget infers budgets from row order. See [RBAC.md §7](./RBAC.md).

### Errors

```ts
{ error: { code, message, details?, requestId } }
```

`code` ∈ `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`.

Zod issues go in `details` keyed by **field path**, so the client maps them onto
RHF with `setError` — same schema, same paths, no translation layer.

### Money

Always a **string** in both directions. `"72500000.00"`. Never a JS number.

### Redaction

Fields the actor can't see are **absent**, not `null` — `null` means "no value
recorded". `_redacted: ["phone"]` lists what was stripped so the UI can show a
lock rather than a blank.

---

## Endpoints

### Auth
```
POST   /api/auth/login              { email, password }        → sets httpOnly cookies
POST   /api/auth/refresh                                        → rotates; reuse ⇒ revoke all
POST   /api/auth/logout
POST   /api/auth/forgot-password    { email }                   → always 200 (no enumeration)
POST   /api/auth/reset-password     { token, password }         → revokes all sessions
POST   /api/auth/change-password    { current, next }           → revokes all sessions
GET    /api/auth/me                                             → user + roles + permission keys
```

`/auth/me` is what `usePermissions()` and `<Can>` read. Invalidate it after any
permission mutation and on any 403.

### Sessions
```
GET    /api/sessions                → devices
DELETE /api/sessions/:id            → revoke one
```

### Properties
```
GET    /api/properties              property.list      (scoped)
POST   /api/properties              property.create
GET    /api/properties/:id          property.view      (scoped → 404)
PATCH  /api/properties/:id          property.update
DELETE /api/properties/:id          property.delete
POST   /api/properties/:id/archive  property.archive
POST   /api/properties/:id/status   property.status.update
POST   /api/properties/:id/media    property.media.upload
POST   /api/properties/:id/assign-agent   property.assignAgent
```

### Clients
```
GET    /api/clients                 client.list        (scoped)
POST   /api/clients                 client.create      ← ATOMIC (see below)
GET    /api/clients/:id             client.view        (scoped → 404)
PATCH  /api/clients/:id             client.update
POST   /api/clients/:id/requirements
GET    /api/clients/:id/properties  client.view
POST   /api/clients/:id/properties  client.assignProperty   ← bulk assign
POST   /api/clients/:id/interactions client.interaction.create
```

### Agents / RBAC / misc
```
GET    /api/agents                  agent.list
POST   /api/agents                  agent.create
PATCH  /api/agents/:id/status       agent.status.update    → revokes all sessions
PATCH  /api/agents/:id/permissions  agent.permissions.update

GET    /api/rbac/roles              rbac.role.list
PUT    /api/rbac/roles/:id/permissions   rbac.role.update
GET    /api/rbac/permissions        rbac.permission.list

GET    /api/activity-logs           activity.list
GET    /api/search?q=               (properties + clients)
GET    /api/reports/*               report.view
GET    /api/media/:id               property.media.download  ← authorized stream
```

> `GET /api/media/:id` checks permission **and** scope, then streams.
> **Never `express.static`** — that would make every property document
> world-readable by URL and invalidate the entire RBAC design.

---

## Two endpoints worth explaining

### `POST /api/clients` is atomic

```ts
{ client: {...}, requirement: {...}, propertyIds: ["...", "..."] }
```

The Requirement screen captures client + requirement + selected properties
together, and a brand-new client has no `clientId` to assign against until it's
saved. One transaction. Edits use the separate endpoints above.

### `POST /api/clients/:id/properties` — bulk assign

```ts
{ propertyIds: string[] }
```

One transaction, upsert on the `(clientId, propertyId)` unique pair so it's
idempotent.

**One ActivityLog row per assignment** — not a batched row with a count. A count
is unqueryable when someone asks *"which properties did we show this client, and
when?"*, which is exactly what gets asked.

---

## Validation

Shared Zod (`packages/shared`) owns shape/format/coercion. The server **adds a
refinement layer** for what needs the DB:

- uniqueness
- `assignedAgentId` references an *active* agent
- `salePrice` required when `listingType` includes `SALE`

One schema does not do both. Pretending it does is how you get client-only
validation.

---

## Express 5 gotchas

- Async errors propagate natively — no `express-async-errors`.
- path-to-regexp v8: **no bare `*` wildcards, no `:param?`** (it's `{/:param}`).
  This bites on the catch-all 404.
