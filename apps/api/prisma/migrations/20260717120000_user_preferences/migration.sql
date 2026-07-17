-- Per-user UI preferences. One row per user (unique user_id), created lazily on
-- the first save. `theme` is nullable: NULL = "never chosen", the signal the
-- client uses to seed from the OS preference and persist a default.

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" VARCHAR(16),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cosmetic: reconcile the code-sequence defaults Prisma inlines into CREATE
-- TABLE and re-emits on every diff. Harmless no-ops, kept so `migrate diff`
-- reports a clean tree afterwards (see CLAUDE.md).
ALTER TABLE "agent_profiles" ALTER COLUMN "code" SET DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));
