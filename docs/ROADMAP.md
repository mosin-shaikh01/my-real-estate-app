# Roadmap

| Phase | Content | Status |
|---|---|---|
| **0** | De-risk: install spike, `strict`, gitignore `.env`, Postgres | ✅ **done** |
| **1** | Foundation: workspaces, tokens, schema, seed, docs, shell | 🔄 in progress |
| **2** | Auth + RBAC end-to-end | ⬜ |
| **3** | Properties: CRUD, media, search/filter/paginate | ⬜ |
| **4** | Clients + Agents: CRUD, interactions, assignment | ⬜ |
| **5** | Requirement + match + bulk assign — **the core feature** | ⬜ |
| **6** | Activity log + dashboard | ⬜ |
| **7** | Global search | ⬜ |
| **8** | Reports | ⬜ |

---

## Phase 0 — done

The install spike was the point: nobody had assembled React 19 + Vite 8 + TS 6 +
ESLint 10 + Tailwind 4 + Express 5 on Node 24, and a peer conflict found in week
two costs days versus hours on an empty repo.

**It installed with zero peer conflicts.** The risk was overstated. The real
costs came from elsewhere — Prisma 7 removing `datasource.url`, TS 6 deprecating
`baseUrl`, React Router being on v8. All resolved; see
[ARCHITECTURE.md](./ARCHITECTURE.md#toolchain-reality).

Also landed: `.gitignore` now ignores `.env` (it didn't, on a repo with a live
remote), and `strict` is on.

## Phase 1 — foundation

- [x] npm workspaces (`apps/web`, `apps/api`, `packages/shared`) — done as a pure
      rename at one clean commit, which is the cheapest it will ever be
- [x] Tailwind 4 two-layer token system, `@theme inline` verified in built CSS
- [x] Prisma schema — 21 tables, hand-written sequences + partial unique index
- [x] Idempotent seed — 43 permissions, 3 roles, demo inventory
- [x] Enum parity + permission catalog tests
- [x] `CLAUDE.md` + `docs/`
- [ ] App shell, layout, UI primitives

## Phase 2 — auth + RBAC end-to-end

**Deliberately before the property module.** Build properties first and you
retrofit scoping into every query — literally the smear the design exists to
prevent. Prove the pattern on **one** vertical slice, then generalize.

Login → `/auth/me` → permissions → **one** guarded route → **one** scoped list →
**one** redacted field.

Then the four tests that matter: permission resolver, redaction serializer,
scope resolver, route manifest.

**Done when:** an agent's `GET /api/clients` returns only assigned rows, and
`budget` is *absent from the JSON payload* — not hidden by CSS. And deactivating
an agent locks them out on the next request.

## Phase 3 — properties

Biggest data surface. Establishes the table/filter/serializer patterns everything
else copies. Includes the permission-filtered sort/filter allowlist — a security
control that's near-impossible to retrofit.

## Phase 4 — clients + agents

CRUD, interactions, assignment FKs. `lastContactAt` written in the same
transaction as the interaction.

## Phase 5 — requirement + match + bulk assign

The core feature. Can't precede 3–4, but its interaction design was settled
during planning, so this is assembly rather than discovery:

- search prefills from the requirement via `watch()` — the thing that makes it
  feel intelligent instead of like two stacked widgets
- search is a **separate form** (nesting means Enter submits the wrong one)
- creation is **atomic**: `POST /api/clients` with `{ client, requirement, propertyIds }`
- one ActivityLog row **per** assignment

## Phase 6–8

Activity log writes land *with* each mutation in phases 3–5, not bolted on
afterwards. Search is properties + clients only. Reports are computable because
`Deal` exists.

---

## Deferred, with reasons

See [REQUIREMENTS.md](./REQUIREMENTS.md#explicitly-out-of-scope-for-v1). Summary:
notifications, video upload, radius search, calendar UI, outbound messaging,
editable permission matrix, DENY overrides in the UI, dark mode, 5-entity global
search.

## After client approval

1. **Public listing site** — `apps/public-web` (Astro/Next), same API, same
   `packages/shared`, authenticating as the seeded `public` role. Same
   middleware, same scope resolver, same serializer: **zero new authorization
   code.** This is the payoff for doing RBAC properly now.
2. **Production deploy** — static web + Node API + managed Postgres 17 (the
   version was chosen to match). Add the bundle step deferred in Phase 0.
3. **S3 media** — `storageKey` is already relative, so it's a serializer change.
4. `pg_trgm` search when ILIKE hurts · DENY overrides UI · per-agent
   co-assignment if it turns out to be real.
