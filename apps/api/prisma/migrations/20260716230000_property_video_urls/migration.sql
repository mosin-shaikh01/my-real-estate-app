-- Property external video links: single `video_url` -> multi `video_urls`.
--
-- Hand-written (not a straight `migrate diff` dump) for ONE reason: the diff
-- drops the old column and adds the new one, which would silently discard any
-- link already stored. We add the array first, copy the existing value into it,
-- then drop the old column.

-- 1. New array column. Shape matches what Prisma generates for `String[]`
--    (TEXT[], no NOT NULL, no default) so a later `migrate diff` sees no drift.
ALTER TABLE "properties" ADD COLUMN "video_urls" TEXT[];

-- 2. Preserve any existing single link as a one-element array.
UPDATE "properties"
   SET "video_urls" = ARRAY["video_url"]
 WHERE "video_url" IS NOT NULL AND "video_url" <> '';

-- 3. Every other row gets an empty array, so the column is uniformly non-null
--    in practice (Prisma always writes an array; this covers pre-existing rows).
UPDATE "properties" SET "video_urls" = '{}' WHERE "video_urls" IS NULL;

-- 4. Drop the superseded single-link column.
ALTER TABLE "properties" DROP COLUMN "video_url";

-- Cosmetic: reconcile the code-sequence defaults Prisma inlines into CREATE
-- TABLE. These are re-emitted on every diff and are harmless no-ops here; kept
-- so `migrate diff` reports a clean tree afterwards (see CLAUDE.md).
ALTER TABLE "agent_profiles" ALTER COLUMN "code" SET DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));
