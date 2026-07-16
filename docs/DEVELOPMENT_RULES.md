# Development Rules

---

## Environment

Windows 10 · Node 24 · npm 11 · PostgreSQL 17 local · **no Docker**.

```bash
npm install
cp apps/api/.env.example apps/api/.env     # fill DATABASE_URL + JWT secrets
npm run db:migrate
npm run db:seed
npm run dev
```

```bash
npm run dev          # web :5173 + api :4000
npm run build        # web production build
npm run typecheck    # all workspaces, strict
npm test             # vitest
npm run db:migrate   # prisma migrate dev
npm run db:seed      # idempotent — safe to re-run
npm run db:studio    # prisma studio
```

Logins: `admin@demo.local` · `agent@demo.local` · `agent2@demo.local` —
`Passw0rd!`.

---

## Workflow

Build **incrementally**. Never attempt the whole app in one step.

For each feature:
1. Explain the approach
2. Name the dependencies
3. Flag trade-offs
4. Get approval where it matters
5. Implement
6. **Review and optimize before moving on**

### End-of-task review

Review your own work as a senior engineer would review someone else's:

- [ ] Correct, and verified by actually running it — not by assuming
- [ ] Consistent with existing patterns
- [ ] Responsive at 375 / 768 / 1440
- [ ] Keyboard-complete, visible focus, no axe violations
- [ ] No N+1, no unbounded `findMany`
- [ ] Permission-gated on the **server**, not just the UI
- [ ] Docs updated in the same change
- [ ] `CHANGELOG.md` entry

---

## Git

Branch `feat/<area>` from `main`. Conventional commits. **Explain why, not what**
— the diff already says what.

### Never without explicit permission

- push to remote
- merge branches
- force-push
- delete branches
- rewrite history (rebase, amend, `reset --hard`)

Inspecting, reviewing, suggesting, and committing **locally** are fine.

### Also ask first

- `prisma migrate reset` or dropping a schema on a database holding data you
  didn't create
- installing system-level software
- adding a dependency
- committing anything resembling a secret

---

## Secrets

`apps/api/.env` is gitignored. **Verify by inspection, not assumption:**

```bash
git check-ignore -v apps/api/.env      # must print a match
git status --porcelain | grep .env     # must print nothing
```

The generated DB password is alphanumeric on purpose — special characters must be
URL-encoded inside `DATABASE_URL` on Windows, and that trap costs an hour every
time.

Rotate anything that ever touched a commit. There is no "it was only local".

---

## Database changes

1. Edit `schema.prisma`
2. `npx prisma migrate dev --name <what_changed> --create-only`
3. **Read the generated SQL.** Every time.
4. Re-apply the hand-written blocks if you regenerated `init` — the code
   sequences (**prepended**) and the partial unique index. See
   [DATABASE.md](./DATABASE.md).
5. Apply, then `npm run db:seed`
6. Confirm zero camelCase columns:
   ```sql
   SELECT table_name||'.'||column_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name ~ '[A-Z]';
   ```

**Never edit an applied migration.** Write a new one.

### If Prisma hangs on "advisory lock"

A killed migration left a backend open:

```sql
SELECT pg_terminate_backend(pid) FROM pg_locks
WHERE locktype='advisory' AND pid <> pg_backend_pid();
```

---

## Verification

**Run the thing.** A build that compiles is not a feature that works.

Before calling anything done:
- exercise the actual flow in the browser
- for permissions, check the **JSON payload** — a field must be *absent*, not
  merely hidden by CSS
- `npm run typecheck && npm test && npm run build`

Report honestly. If tests fail, say so with the output. If a step was skipped,
say that. "Should work" is not a status.

---

## Toolchain notes

Learned the hard way — don't rediscover them:

- **Prisma 7 removed `datasource.url`** → `prisma.config.ts` + `@prisma/adapter-pg`
- **TS 6 deprecated `baseUrl`** → hard error; paths resolve relative to tsconfig
- **React Router is v8** → data mode intact
- **`rootDir` can't span a monorepo** → API typechecks only, runs via tsx
- **npm 11 blocks install scripts** → harmless; Prisma 7 uses a WASM compiler
- **Don't `npm audit fix --force`** → downgrades Prisma 7→6 for a dev-only
  transitive we never load
