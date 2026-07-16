import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { env, isProd } from './env.js'

// Prisma 7 requires a driver adapter — `datasource.url` no longer exists in
// schema.prisma, so the connection is supplied here at construction time.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({
  adapter,
  log: isProd ? ['error'] : ['warn', 'error'],
})

// NOTE: there is deliberately NO soft-delete middleware and NO global query
// extension injecting `where` clauses. Both are Rails' default_scope, and the
// footguns are well known: findUnique cannot take an injected predicate,
// scoped-out rows become 404s you can't override, and admin bypass turns ugly.
// Scoping is explicit, via scopeFor(actor, resource). See docs/RBAC.md.
