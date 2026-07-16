# Project Overview

## What this is

A **Real Estate CRM & Property Management System** — internal software for a
brokerage, not a listing website.

Admins manage inventory, agents and clients. Agents see only what they're
assigned, and only the fields they're permitted. Clients are records, not users;
they never log in.

The core feature is the **Property Requirement flow**: an admin captures what a
client wants, searches matching inventory on the same screen, ticks rows, and
assigns properties to that client.

## Why it exists

A brokerage's real problem isn't a website. It's that inventory, client
requirements, and who-said-what-to-whom live in spreadsheets, WhatsApp threads
and individual agents' heads. When an agent leaves, their pipeline leaves with
them. This makes the brokerage — not the agent — the system of record, while
still letting each agent see only their own book.

## Status

Local prototype for **client demonstration**. It must look and behave like
production. Deployment and a public listing site follow client approval.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 6 (strict), Tailwind 4, React Router 8 |
| Data/state | TanStack Query, React Hook Form + Zod, TanStack Table |
| UI | Radix primitives (accessibility infrastructure), Framer Motion for overlays |
| Backend | Express 5, Prisma 7, PostgreSQL 17 |
| Auth | JWT in httpOnly cookies, argon2, DB-backed sessions |
| Tests | Vitest |

**Two deliberate deviations** from the originally proposed stack:

- **Zustand dropped.** Query owns server state, RHF owns forms, the URL owns
  filters, `useState` owns selection. Nothing was left, and the predictable harm
  was someone caching `permissions` in it where it goes stale.
- **Radix + TanStack Table added.** Hand-rolling an accessible combobox is days
  of work and a WCAG trap. TanStack's `columnVisibility` maps directly onto
  field-level permissions — that convergence alone pays for it.

## The three ideas worth understanding

**1. RBAC is three problems, not one.** Authorization (can you do this action),
scoping (which rows), and projection (which columns) need three different
mechanisms. Collapsing them is how permission systems rot. See [RBAC.md](./RBAC.md).

**2. The catalog is code; the assignment is data.** New *roles* need no deploy —
that's real and delivered. New *permissions* do, because a permission only does
something when code checks it. Being honest about that line is what makes the
rest trustworthy.

**3. Doing RBAC properly pays twice.** It collapses the admin and agent UIs into
one route tree, and it makes the future public listing site a serializer swap
instead of a rewrite. That's why it's built before the property module rather
than retrofitted into every query afterwards.

## Repository

```
apps/web/          the CRM SPA
apps/api/          Express + Prisma
packages/shared/   Zod schemas, permission catalog, enums — imported by BOTH
docs/              you are here
CLAUDE.md          primary context; rules live there
```

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env    # fill in DATABASE_URL + JWT secrets
npm run db:migrate
npm run db:seed
npm run dev                                # web :5173, api :4000
```

Logins: `admin@demo.local` · `agent@demo.local` — password `Passw0rd!`.

Requires local PostgreSQL 17. See [DATABASE.md](./DATABASE.md).
