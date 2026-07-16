# Coding Standards

---

## TypeScript

`strict: true` **and** `noUncheckedIndexedAccess`. Both are on because they were
free on an empty repo and brutal to retrofit. There is no argument for implicit
`any` in a CRM handling PII.

- **No `any`.** Use `unknown` and narrow. If you truly need an escape hatch,
  `@ts-expect-error` with a comment explaining why — it fails loudly when the
  underlying issue is fixed, which `@ts-ignore` doesn't.
- **No TS `enum`** — `erasableSyntaxOnly` bans it. Use `as const` or Zod enums.
- **No non-null `!`** except where you've just proven it in the line above.
- Prefer `type` for unions/objects, `interface` for extensible contracts.
- Infer return types; annotate parameters.
- `import type` for type-only imports (`verbatimModuleSyntax` is on).

`noUncheckedIndexedAccess` means `arr[0]` is `T | undefined`. That's friction,
and it's correct — it's the compiler telling you the array might be empty.

---

## Naming

| Thing | Convention | Example |
|---|---|---|
| DB tables/columns | `snake_case` | `property_assignments.assigned_at` |
| Prisma model/field | `PascalCase`/`camelCase` + `@map` | `PropertyAssignment.assignedAt` |
| Types/components | `PascalCase` | `PropertyCard` |
| Variables/functions | `camelCase` | `scopeFor` |
| Constants | `SCREAMING_SNAKE` | `AGENT_PERMISSIONS` |
| Enum values | `SCREAMING_SNAKE` | `UNDER_OFFER` |
| Booleans | `is`/`has`/`can` prefix | `isArchived`, `canEdit` |
| Hooks | `use` prefix | `usePermissions` |
| Component files | `PascalCase.tsx` | `DataTable.tsx` |
| Other files | `kebab-case.ts` | `use-permissions.ts` |
| Test files | `*.test.ts` | `enum-parity.test.ts` |

Say the domain word. `client`, `property`, `agent`, `assignment`, `requirement`,
`deal`. Not `item`, `data`, `record`, `obj`.

---

## Functions

- Small, single-purpose, honest name.
- **Early return over nesting.**
- Max ~4 params, then take an object.
- Pure where possible — the permission resolver, scope resolver and serializers
  are all pure, which is exactly why they're cheap to test.

```ts
// Nesting
function x(a) { if (a) { if (a.b) { return a.b.c } } return null }

// Early return
function x(a) {
  if (!a?.b) return null
  return a.b.c
}
```

---

## Comments

**Comment the why, never the what.** The code says what.

```ts
// Bad — restates the line
// increment the counter
count++

// Good — states a constraint the code cannot show
// Snapshot the rate at close: agent rates change and historical
// reports must not retroactively mutate.
commissionRate: agent.commissionRate
```

Never write a comment explaining that your change is correct, or where it came
from. That's talking to the reviewer, and it's noise the moment the PR merges.

Match the surrounding density. Don't add a comment because a file looks bare.

---

## Imports

Order: node builtins → external → `@app/shared` → `@/` aliases → relative.
No deep relative chains (`../../../`) — use `@/`.

---

## Error handling

- Throw `AppError` with a code; don't return `null` for failure.
- Catch only where you can act. A `catch` that logs and rethrows is noise.
- Never swallow. `catch {}` is a bug.
- User-facing messages say what happened **and what to do**. Never "Something
  went wrong".

---

## Async

- `async`/`await`, not `.then()` chains.
- `Promise.all` for independent work — don't await in a loop when you don't have
  to.
- **Do await in a loop** when order matters or you'd hammer the DB with N
  parallel writes.
- Every mutation touching two tables is a `$transaction`. The
  interaction + `lastContactAt` write is the canonical example.

---

## Tests

Not coverage-chasing. **Test the surface where a bug is a data breach rather than
a visual glitch.** The highest-ROI tests here are all pure functions with no
fixtures:

1. Permission resolver — `(roles ∪ grants) \ denies`
2. Redaction serializers
3. Scope resolver — agent sees only assigned; admin sees all; 404 on scope miss
4. Route manifest — every route guarded or explicitly allowlisted
5. Enum parity — shared ↔ Prisma

Name tests as behaviour: `it('never grants an agent the sensitive fields')`, not
`it('works')`.

**Never weaken a test to make it pass.** If a test fails, either the code is
wrong or the test's premise is wrong — decide which, and fix that.

---

## What not to do

- Don't add a dependency that duplicates one already installed.
- Don't reach for a library to avoid 20 lines you understand.
- Don't abstract on the second use. Wait for the third.
- Don't put server data in a client store.
- Don't use a primitive colour token at a call site.
- Don't `npm audit fix --force` — it downgraded Prisma 7→6 here to patch a
  dev-only transitive we never load.
- Don't widen a permission or scope to make a feature work.
