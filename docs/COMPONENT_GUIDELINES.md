# Component Guidelines

---

## Where things live

```
components/ui/          primitives — no business logic, no data fetching
components/layout/      AppShell, Sidebar, Topbar
features/<x>/components/  feature-specific, may fetch
features/<x>/pages/     route components
features/<x>/api/       query + mutation hooks
```

**Rule:** a component in `components/ui/` that imports from `features/` is in the
wrong folder. Dependencies point one way — features depend on ui, never the
reverse.

**Promote to `ui/` on the third use, not the first.** Two usages is a
coincidence; three is a pattern. Premature abstraction here costs more than
duplication.

---

## Composition over configuration

When a component grows a `variant` prop that changes *structure* rather than
style, it wants to be two components — or a compound one.

```tsx
// Wrong: the prop list becomes an API nobody can remember
<Card title="..." footer="..." showHeader headerAction={...} dense />

// Right
<Card>
  <Card.Header action={<Button/>}>Title</Card.Header>
  <Card.Body>...</Card.Body>
</Card>
```

Style variants (`size`, `tone`) are fine as props. Structural ones aren't.

---

## Radix for anything with focus management

Dialog, dropdown, combobox, popover, tooltip, select. **Do not hand-roll these.**
You will get focus traps, escape handling, scroll locking, and screen-reader
semantics wrong, and it costs days to discover.

Radix is *accessibility infrastructure*, not a design system — we keep 100% of
the visual control, which is what "no UI library" actually meant.

---

## Permission-aware components

The hook is primary; the component is sugar. All read the same `['me']` query, so
there's one source of truth that auto-invalidates.

```tsx
const { has } = usePermissions()
if (has('client.delete')) { ... }

<Can permission="client.phone.view" fallback={<Locked />}>
  {client.phone}
</Can>

<RequirePermission permission="rbac.role.list">   // route guard
```

`permission` is typed as `PermissionKey`, so **typos are compile errors**.

The `fallback` matters more than it looks: it's the difference between a field
that reads as *deliberately locked* and one that looks *broken*. Pair it with the
`_redacted` array from the API.

> **`<Can>` is UX, not security.** Every gate needs a server counterpart or it
> isn't a gate. A hidden column whose data is in the payload is not hidden.

---

## Data fetching

Never in `components/ui/`. Feature components use hooks from `features/<x>/api/`.

```tsx
// features/properties/api/use-properties.ts
export function useProperties(filters: PropertyFilters) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => api.properties.list(filters),
  })
}
```

Query keys are arrays, ordered general → specific: `['properties', filters]`,
`['properties', id]`. Invalidate `['me']` after any permission mutation and on
any 403.

---

## Forms

RHF + `zodResolver` with the **shared** schema. A `<FormField>` wrapper owns
label, error, and `aria-describedby` wiring so no screen re-invents it.

Server `details` (keyed by field path) map onto RHF via `setError` — same schema,
same paths.

**The Requirement screen has two independent forms on one page.** The property
search must **not** be nested inside the requirement form, or Enter in a filter
field submits the wrong one. They share page-level state; the search prefills
from the requirement via `watch()`.

---

## Tables

TanStack Table, headless. Column defs live next to the feature.

The convergence worth knowing: **`columnVisibility` maps directly onto
`usePermissions()`**. Field-level permissions become hidden columns for free —
that alone justifies the dependency.

- Numbers right-aligned with `tabular-nums`
- Sticky header, 40px rows, no zebra
- **Selection styled distinctly from hover** (brand tint + left accent bar)
- Wide tables scroll in their own container; the body never scrolls horizontally

---

## Styling

- **Semantic tokens only.** `bg-surface-raised`, never `bg-neutral-0`.
- `cn()` (clsx + tailwind-merge) for conditional classes.
- No inline `style` except genuinely dynamic values (a computed ramp swatch).
- No CSS modules, no styled-components. Tailwind is the system.

---

## Accessibility per component

- Icon-only buttons: `aria-label`.
- Loading: `aria-busy`, and announce completion via `role="status"`.
- Never `onClick` on a `<div>`. Use a `<button>`.
- Modals: Radix handles focus; you supply a real title.
- Toggles: `aria-pressed` / `aria-checked`.

---

## Checklist before calling a component done

- [ ] Keyboard-only: reachable, operable, visible focus
- [ ] Works at 375px
- [ ] Loading, empty, and error states exist — empty states say what to do next
- [ ] No `any`
- [ ] Semantic tokens only
- [ ] Permission-gated where it touches restricted data
- [ ] Money is a string, formatted with `Intl`
- [ ] No animation on data-grid rows
