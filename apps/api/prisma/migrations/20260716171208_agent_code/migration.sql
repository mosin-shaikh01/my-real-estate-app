-- ===========================================================================
-- HAND-WRITTEN PROLOGUE. Prisma inlines nextval('agent_code_seq') into the
-- ADD COLUMN below, so the sequence MUST exist first — same pattern as the
-- property/client code sequences in the init migration. A volatile default
-- (nextval) is evaluated per existing row, so the two seeded agents are
-- backfilled with distinct codes (AGT-00001, AGT-00002).
-- ===========================================================================
CREATE SEQUENCE "agent_code_seq" START 1;

-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN     "code" VARCHAR(16) NOT NULL DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));

-- These two are no-ops that reconcile a cosmetic drift: the init migration set
-- these defaults via raw SQL, and Prisma's schema `dbgenerated` normalises to a
-- slightly different string, so every `migrate diff` re-emitted them. Applying
-- once clears that noise.
-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));

-- AlterTable
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_code_key" ON "agent_profiles"("code");
