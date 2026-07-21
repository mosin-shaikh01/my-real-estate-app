-- ===========================================================================
-- HAND-WRITTEN. Not expressible in schema.prisma: this project does not enable
-- Prisma's `postgresqlExtensions` preview feature, so the pg_trgm extension and
-- its GIN trigram indexes live here, the same way users_email_active_key does.
-- IF YOU REGENERATE MIGRATIONS, RE-APPLY THIS BLOCK.
--
-- Why: every list and the global search filter with ILIKE '%term%' (Prisma
-- `contains`). A btree index can't serve an unanchored substring match, so
-- Postgres sequential-scans the table. pg_trgm GIN indexes make those matches
-- index-backed, keeping search fast as properties/clients/owners/agents grow.
-- pg_trgm is a TRUSTED extension (PG13+), so the app role can create it without
-- superuser.
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Properties — the free-text columns the property list + global search hit.
CREATE INDEX IF NOT EXISTS "properties_title_trgm" ON "properties" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "properties_city_trgm" ON "properties" USING gin ("city" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "properties_locality_trgm" ON "properties" USING gin ("locality" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "properties_address_trgm" ON "properties" USING gin ("address" gin_trgm_ops);

-- Clients — name + normalised phone (digits-only substring match).
CREATE INDEX IF NOT EXISTS "clients_full_name_trgm" ON "clients" USING gin ("full_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "clients_phone_normalized_trgm" ON "clients" USING gin ("phone_normalized" gin_trgm_ops);

-- Property owners — name + normalised mobile.
CREATE INDEX IF NOT EXISTS "property_owners_full_name_trgm" ON "property_owners" USING gin ("full_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "property_owners_mobile_normalized_trgm" ON "property_owners" USING gin ("mobile_normalized" gin_trgm_ops);

-- Agents (users) — name, for the agent list search.
CREATE INDEX IF NOT EXISTS "users_full_name_trgm" ON "users" USING gin ("full_name" gin_trgm_ops);
