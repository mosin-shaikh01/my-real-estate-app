// env.ts validates and fails fast — import it first so a missing secret is a
// startup error rather than a 2am surprise on the first token refresh.
import { env } from './lib/env.js'
import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'
import { ensureUploadRoot } from './services/media-service.js'

// Create the upload directory before serving, so the first upload doesn't race
// an mkdir. Fail fast if the path isn't writable.
await ensureUploadRoot()

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: `API listening on http://localhost:${env.PORT}`,
      env: env.NODE_ENV,
    }),
  )
})

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }))
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
