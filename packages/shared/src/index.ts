// @app/shared — the client/server contract.
//
// HARD RULE: this package must NEVER import @prisma/client. It is consumed by
// the browser bundle; importing Prisma drags the runtime into the client.
// Enum parity with the Prisma schema is enforced by a test, not by imports.
// See docs/ARCHITECTURE.md.

export const APP_NAME = 'Real Estate CRM'

export * from './permissions.js'
export * from './enums.js'
export * from './errors.js'
export * from './schemas/auth.js'
export * from './schemas/client.js'
