// Test env, set before anything imports src/lib/env.ts (which fails fast and
// calls process.exit on a missing secret -- correct in production, fatal in a
// test runner).
//
// Deliberately NOT loading apps/api/.env: these tests must run on a machine
// that has never been set up, and a suite that silently depends on someone's
// local secrets is a suite that fails only in CI.
//
// `??=` so a real DATABASE_URL still wins when a test genuinely needs the DB.
process.env.NODE_ENV ??= 'test'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test_never_connected'
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-not-used-for-real-32'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-not-used-for-real-32'
