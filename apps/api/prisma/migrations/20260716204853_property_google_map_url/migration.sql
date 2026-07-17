-- Add a stored Google Maps share link, separate from lat/lng.
ALTER TABLE "properties" ADD COLUMN "google_map_url" TEXT;

-- Cosmetic reconciliation of the code-sequence defaults (set via raw SQL in
-- init; Prisma's dbgenerated normalises slightly differently, so every diff
-- re-emits them). No-ops that clear the recurring drift.
ALTER TABLE "agent_profiles" ALTER COLUMN "code" SET DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));
