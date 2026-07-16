# RBAC

The heart of this system. Read this before touching auth, scoping, or any
field-level permission.

---

## 1. "RBAC" is three problems wearing one word

The failure mode of every homegrown permission system is forcing these into one
table. They are unrelated and need different mechanisms.

| Problem | The question | Mechanism | Lives in |
|---|---|---|---|
| **Authorization** | Can this actor do this action on this resource *type*? | Permission strings + route middleware | `requirePermission()` |
| **Scoping** | *Which rows* can they see? | A `where` predicate. **Not a permission.** | `scopeFor(actor, resource)` |
| **Projection** | *Which columns* can they see? | A serializer at the response boundary | `toClientDTO(entity, perms)` |

An agent seeing only their assigned clients is **scoping**. An agent not seeing
`budget` is **projection**. Being allowed to hit `GET /api/clients` at all is
**authorization**. Conflating them produces a system where every route re-invents
security by hand.

---

## 2. The catalog is code. The assignment is data.

The requirement was *"permissions should be configurable and stored in the
database rather than hard-coded."* Half of that is achievable and half is a
fiction. Being precise about which half is the difference between a real system
and an admin screen that inserts rows nothing reads.

**Achievable — and delivered:** an admin invents "Senior Agent", ticks 12 boxes,
and it works immediately with no deploy. Roles, role→permission mappings, and
per-user overrides are pure data.

**A fiction:** creating a *new permission* from a UI. `client.salary.view` does
nothing, because no code consults it and no column is named `salary`. A
permission only exists because a line of code checks it.

So:

- `packages/shared/src/permissions.ts` owns the canonical list.
- The seed **upserts that manifest** into the DB on every boot. Add a key →
  restart → an admin can assign it.
- `PermissionKey` is a literal union, so `can('client.phone.veiw')` is a
  **compile error**. A DB-only catalog can never give you that.

You get 100% of the value and lose only a promise nobody could have kept.

### Key shape

Structured columns are the model; the derived string is the identity.

```
Permission { resource, action, field?, key @unique }
  "client" + "view" + "phone"  ->  "client.phone.view"
  "client" + "list"            ->  "client.list"
```

String-only fails: you end up parsing strings in code, you can't query "all
permissions on `client`" to render the matrix grouped, and you can't distinguish
`client.view` (a resource gate) from `client.phone.view` (a field projection)
without length heuristics. Columns-only fails: passing a triple to `<Can>` is
miserable. Store both.

---

## 3. Field-level permissions

Ten of them, curated. **Do not build a generic engine** where any field is
permissionable: it forces a metadata-driven serializer, destroys static DTO
types, and 95% of it is never used.

| Permission | Redacts |
|---|---|
| `client.phone.view` | `Client.phone`, `Client.whatsapp` |
| `client.email.view` | `Client.email` |
| `client.budget.view` | `ClientRequirement.budgetMin/Max` |
| `client.internalNotes.view` | `Client.notes` |
| `property.price.view` | `Property.salePrice`, `rentPricePerMonth`, deposits |
| `property.internalNotes.view` | `Property.internalNotes` |
| `agent.commission.view` | `AgentProfile.commissionRate`, `Deal.commission*` |
| `client.followUp.edit` | *(write gate, not projection)* |
| `property.media.upload` | *(write gate)* |
| `property.media.download` | *(write gate)* |

### Where redaction happens: the serializer

Three candidates were considered. The serializer wins:

- **Per-actor Prisma `select`** ❌ — dynamic select collapses result types into
  unions, and business logic frequently needs a field the actor can't *see*
  (compute "does this property match the client's budget?" without showing the
  budget). Filtering at fetch time makes that impossible.
- **Prisma result extension** ❌ — needs an ambient actor via AsyncLocalStorage.
  Magic; breaks in seeds and jobs; admin bypass gets ugly.
- **Serializer at the response boundary** ✅ — `toClientDTO(entity, permSet)`.
  A pure function, unit-testable with zero infrastructure, one choke point,
  explicit at the call site.

### Two rules

**Redact by omission, not `null`.** `null` legitimately means "no phone
recorded". The serializer **deletes the key**; the DTO type is
`{ phone?: string | null }`. The UI must be able to tell *hidden* from *empty*.

**Emit `_redacted: ['phone']`.** Cheap, and it lets the UI render a lock
affordance instead of silently vanishing a column — the difference between
feeling intentional and feeling broken.

---

## 4. Scoping without smearing

Do **not** write `if (isAgent) where.agentId = me` in 40 handlers. Do **not** use
a global Prisma query extension either — that's Rails' `default_scope`, and the
footguns are known: `findUnique` can't take an injected predicate, scoped-out
rows become 404s you can't override, and admin bypass turns ugly.

One resolver:

```ts
scopeFor(actor, 'client') -> Prisma.ClientWhereInput
  actor.has('client.list.all')
    ? { deletedAt: null }
    : { deletedAt: null, assignedAgentId: actor.userId }
```

Note what that does: **"sees everything" is itself a permission**
(`client.list.all`), so scope stays data-driven without a policy engine. There
are exactly two shapes. Forty lines.

**No CASL, no OPA.** `@casl/prisma` works, but it brings a DSL, its own type
gymnastics, and a mental model — to express `{} | { assignedAgentId }`. Wrong
trade at this size.

### Agent property scope

An agent sees properties assigned **to them** *or* **to their clients**. The
spec's own workflow (*Open Client → View Assigned Properties*) requires the
second clause.

### The guard against forgetting

You cannot avoid one *declaration* per route, and you shouldn't try — an
unguarded route should be a **build failure**, not a silent default. What you
avoid is one *implementation* per route.

1. All Prisma access behind `apps/api/src/services/**`.
2. An ESLint `no-restricted-imports` rule forbidding `prisma` outside that path.
3. A **route-manifest test** walking the Express router: every route has a
   permission guard or an explicit public allowlist entry.

---

## 5. Sessions, not stateless tokens

Permissions are **not in the JWT**. Two spec requirements force a DB read per
request anyway:

- deactivating an agent must lock them out **now**, not in ≤15 minutes
- permission changes must take effect live

Since the session row must be validated every request, loading
user + roles + permissions in that same indexed query is **free**.

**Say the quiet part:** this means the JWT is not stateless, and an opaque random
token would work identically. JWT isn't buying anything here. That's fine — but
never let anyone design around statelessness we don't have. No Redis cache; there
is one admin and N agents.

The access token carries only `sub` and `sid`.

---

## 6. Overrides

```
effective = (rolePermissions ∪ ALLOWs) \ DENYs      -- deny wins
```

`UserPermission.effect` supports both **now**; the v1 UI exposes grants only. The
complexity of DENY lives in explaining precedence to an admin, not in the model
— five lines in the resolver. Retrofitting the column later is a migration plus a
resolver rewrite; having it now is free.

---

## 7. The leak most designs miss

Field permissions and search interact badly.

An agent without `client.budget.view` who can **sort by budget** or filter
`?minBudget=5000000` infers the values from result ordering and set membership.
Redaction is then decorative.

**Sortable and filterable field allowlists must be permission-filtered.** This is
a security control, not a convenience, and it is near-impossible to retrofit —
bake it into query parsing from day one.

---

## 8. Client/server alignment

- **Permission keys**: one const in `packages/shared`, imported by both. Drift is
  impossible by construction.
- **DTO shapes**: shared owns the Zod DTOs. The server returns
  `z.infer<typeof clientDTO>`; the client types queries with the same schema.
  `safeParse` responses **in dev only** — catch drift the day it happens without
  paying CPU in production.
- **The frontend knows what to hide** because `GET /auth/me` returns the
  effective permission keys, and `<Can permission="client.phone.view">` reads it.

> **`<Can>` is UX. The server serializer is security. Never the reverse.**
> A hidden column whose data sits in the JSON payload is not hidden.

---

## 9. The payoff

Seed a `public` role (already done) whose scope predicate is
`{ visibility: PUBLIC }` and whose permissions exclude
`property.internalNotes.view`.

The future public listing site authenticates as `actor = null → publicRole` and
reuses **the same middleware, the same scope resolver, the same serializer** —
zero new authorization code. The `visibility` and `featured` columns are already
the seam.

Doing RBAC properly is what makes the public site additive, and it's also what
collapses the admin and agent UIs into one route tree. **It pays for itself
twice.** Building it after the property module means paying for it twice instead.
