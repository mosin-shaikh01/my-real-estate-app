import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 moved connection config out of schema.prisma: `datasource.url` is
// rejected by the validator. Migrate reads the URL from here; the runtime
// client gets it from a driver adapter (src/lib/prisma.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
