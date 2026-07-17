-- Branding visibility: whether the tagline is shown. Kept separate from the
-- value so hiding it never deletes the text. Defaults to true (visible).
ALTER TABLE "app_settings" ADD COLUMN "show_tagline" BOOLEAN NOT NULL DEFAULT true;

-- Cosmetic: reconcile the code-sequence defaults Prisma re-emits on every diff
-- (harmless no-ops, kept so `migrate diff` reports a clean tree — see CLAUDE.md).
ALTER TABLE "agent_profiles" ALTER COLUMN "code" SET DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));
