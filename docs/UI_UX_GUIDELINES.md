# UI / UX Guidelines

The target is a CRM that feels like Linear or the Stripe dashboard: dense,
fast, quiet. Not a marketing site.

> **Note on provenance.** The DesignMD design skills referenced during planning
> were never present on this machine (`~/.claude/skills/` doesn't exist). This
> system was defined from scratch. It's built on tokens, so layering DesignMD in
> later is a values swap, not a rewrite.

---

## The one-line principle

**A CRM is 90% grey.** Almost everything that reads as "premium" here is the
neutral ramp, the spacing rhythm, and the typography — not colour. Spend effort
there.

---

## Tokens

Two layers, in `apps/web/src/styles/tokens.css`.

```
1. PRIMITIVES  @theme          raw ramps. Never referenced by components.
2. SEMANTICS   :root + @theme inline    what components actually use.
```

**Never use a primitive at a call site.** `bg-neutral-100` is wrong;
`bg-surface-hover` is right. The primitive is the paint; the semantic is what the
paint is *for*. Only semantics can be remapped for dark mode.

### The `@theme inline` trap

`@theme` **snapshots** values at build time. A semantic token that must remap at
runtime (light → dark) has to live in `:root` as a plain custom property and be
exposed via **`@theme inline`**:

```css
:root { --surface: var(--color-neutral-0); }
.dark { --surface: var(--color-neutral-950); }

@theme inline { --color-surface: var(--surface); }   /* inline is load-bearing */
```

Without `inline`, the generated utility bakes in the light value and dark mode
silently no-ops. Verify in the built CSS — you want
`.bg-surface{background-color:var(--surface)}`, not a literal colour.

### Colour is oklch

Perceptually uniform, so a ramp stepped by lightness actually *looks* evenly
spaced. Hex ramps don't — they bunch and skew.

---

## Colour system

| Role | Choice | Why |
|---|---|---|
| Neutral | 12-step, slightly cool (hue 257) | The workhorse. Most of the "premium" read. |
| Brand | Deep indigo (hue 275) | Avoids generic-SaaS-blue (hue ~250) and realtor-red. Institutional, calm. |
| Accent | Warm brass (hue ~76) | **Sparingly** — featured badges, empty states. On every screen it means nothing. |

### Status colours

| Status | Colour |
|---|---|
| Available | emerald |
| Under offer | amber |
| Rented | blue |
| **Sold** | **neutral slate** |
| Archived | muted |

**Sold is not red, and this is not a nitpick.** Red means danger/destructive. Sold
is a *terminal success* — it must not shout for attention on a list where the
*available* rows are the actionable ones. Reserve red exclusively for destructive
actions. This one decision separates CRMs that look considered from ones that
look like a traffic light.

**Never colour-only.** Every status is a dot **plus** a text label. WCAG 1.4.1,
and also just legible.

---

## Type

**Base 14px** for app chrome and tables. Not 16. This is the honest CRM call —
16px is a reading-page default and wastes vertical space in a data grid.

| Token | px | Use |
|---|---|---|
| `text-2xs` | 11 | micro labels, table meta |
| `text-xs` | 12 | captions |
| `text-sm` | 13 | table cells |
| `text-base` | 14 | body, default |
| `text-md` | 16 | emphasis |
| `text-lg` | 20 | section heads |
| `text-xl` | 24 | page titles |
| `text-2xl` | 30 | display |

Ratio ~1.2 at small sizes, looser at display. Inter/Geist, **self-hosted** via
`@fontsource` — the Google Fonts CDN is a privacy dependency and breaks offline.

### `tabular-nums` — non-negotiable

Every money and numeric column gets `font-variant-numeric: tabular-nums` (the
`.tabular` class or `[data-numeric]`). One declaration. **Misaligned digits in a
price column are the single clearest tell of an amateur data table.**

Money is a **string** in DTOs, formatted with `Intl.NumberFormat('en-IN')` for
lakh/crore grouping. Never a JS `number`.

---

## Density & tables

- Row height **40px** (`--spacing-row`). 32/48 tokens exist; **the toggle is not
  built in v1**.
- **No zebra striping.** Hairline borders (`border-b border-border-subtle`).
  Zebra is dated and fights hover + selection — and row selection is a core
  feature here.
- **Selection must be visually distinct from hover.** Brand tint + a left accent
  bar vs. a neutral wash. **The bulk-assign table lives or dies on this** — an
  admin ticking 8 of 40 rows must see instantly which are ticked.
- Text left, **numbers right**, actions right-pinned. Sticky header.
- Wide tables scroll inside their own `overflow-x:auto`. **The body never scrolls
  horizontally.**

---

## Elevation

**Mostly flat**: borders and surface steps. Shadows only for true overlays
(dropdown, modal, popover). Shadows everywhere reads 2016 Bootstrap; hairlines
read premium.

Use the **semantic** token (`shadow-e1`), never raw `shadow-md` at a call site.
Reason: in dark mode shadows stop reading and must become borders + lighter
surfaces. That substitution is exactly what breaks retrofitted dark mode, and
semantic elevation is what makes it a one-line change.

---

## Motion

Framer Motion (`motion`) for **overlays only** — modal/drawer `AnimatePresence`,
toast stack. CSS transitions for hover/press.

**Never animate table rows on filter change.** A data-dense CRM's whole job is
feeling fast, and animation is the most common way to make software feel slow.

- Durations: 120ms (micro) / 180ms (default) / 240ms (overlay)
- Ease-out entering, ease-in exiting
- `prefers-reduced-motion` is honored globally — a real a11y requirement

---

## Accessibility — WCAG 2.1 AA

Treat as requirement, not aspiration. This is an internal tool people use all day.

- Semantic HTML first. Radix for anything with focus management (dialog,
  combobox, dropdown) — hand-rolling those is days of work and you *will* get
  focus traps and screen readers wrong.
- Visible focus ring on every interactive element (global `:focus-visible`).
- Contrast ≥ 4.5:1 text, ≥ 3:1 UI/graphical.
- **Keyboard-complete.** Every flow works without a mouse.
- Real `<label>`s; errors tied via `aria-describedby`; `aria-invalid` on failure.
- Announce async results (toast with `role="status"`).
- Icon-only buttons need `aria-label`.
- Target: Lighthouse a11y ≥ 95 and **zero** axe violations.

---

## Responsive

Mobile-first. 375 / 768 / 1024 / 1440.

A CRM is desktop-primary — be honest about that rather than pretending a 40-column
table works on a phone. Mobile gets: card views instead of wide tables, a drawer
sidebar, and full functionality for the flows an agent actually needs on the road
(view assigned clients, log a call, update follow-up).

---

## Dark mode

**Architecture yes, ship no.**

The token layer supports it and elevation is already semantic. Shipping it means
re-reviewing 40 screens, every badge, every shadow, twice — and this is an office
CRM used in daylight. With the tokens correct, adding it later is a day. Without
them it's a week. Pay the day later.

---

## Writing

- Sentence case for headings and buttons. Not Title Case.
- Buttons are verbs: "Assign properties", not "Submit".
- Empty states say what to do next, never just "No data".
- Errors say what happened and what to do — never "Something went wrong".
- Indian conventions: ₹ with lakh/crore grouping, DD MMM YYYY dates.
