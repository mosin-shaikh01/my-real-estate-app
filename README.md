# Real Estate CRM

Internal CRM and property management for a brokerage. Admins manage inventory,
agents and clients; agents see only what they're assigned, and only the fields
they're permitted.

Currently a **local prototype for client demonstration**.

## Quick start

Requires Node 22+ and a local PostgreSQL 17.

```bash
npm install
cp apps/api/.env.example apps/api/.env    # set DATABASE_URL + JWT secrets
npm run db:migrate
npm run db:seed
npm run dev                                # web :5173 · api :4000
```

Demo logins — `admin@demo.local` (Super Admin), `agent@demo.local` (Agent).
Password `Passw0rd!` for both.

## Layout

```
apps/web/          React 19 + Vite 8 SPA
apps/api/          Express 5 + Prisma 7
packages/shared/   Zod schemas, permission catalog, enums — imported by both
docs/              documentation
CLAUDE.md          primary project context and rules
```

## Commands

| | |
|---|---|
| `npm run dev` | web + api together |
| `npm run build` | production build |
| `npm run typecheck` | all workspaces, strict |
| `npm test` | vitest |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | idempotent seed |
| `npm run db:studio` | Prisma Studio |

## Documentation

Start with [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md).

Read [docs/RBAC.md](./docs/RBAC.md) before touching auth, scoping, or
permissions — it's the heart of the system.

[CLAUDE.md](./CLAUDE.md) holds the rules and is the source of truth.
