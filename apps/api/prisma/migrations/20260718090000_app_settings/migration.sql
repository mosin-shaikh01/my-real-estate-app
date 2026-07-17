-- Application-wide settings (branding, company info, address, social, business).
-- A SINGLETON: the unique `singleton` boolean pinned to true means the table can
-- hold exactly one row, and every write is an upsert on it.

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "crm_name" VARCHAR(120) NOT NULL DEFAULT 'Estate',
    "tagline" VARCHAR(200),
    "primary_color" VARCHAR(32),
    "secondary_color" VARCHAR(32),
    "logo_storage_key" TEXT,
    "logo_mime_type" VARCHAR(128),
    "favicon_storage_key" TEXT,
    "favicon_mime_type" VARCHAR(128),
    "company_name" VARCHAR(200),
    "owner_name" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(40),
    "mobile" VARCHAR(40),
    "website" VARCHAR(255),
    "gst_number" VARCHAR(64),
    "registration_number" VARCHAR(64),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(120),
    "state" VARCHAR(120),
    "country" VARCHAR(120),
    "pincode" VARCHAR(20),
    "google_map_url" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "youtube_url" TEXT,
    "twitter_url" TEXT,
    "whatsapp_number" VARCHAR(40),
    "business_hours" VARCHAR(255),
    "description" TEXT,
    "about" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_singleton_key" ON "app_settings"("singleton");

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cosmetic: reconcile the code-sequence defaults Prisma re-emits on every diff
-- (harmless no-ops, kept so `migrate diff` reports a clean tree — see CLAUDE.md).
ALTER TABLE "agent_profiles" ALTER COLUMN "code" SET DEFAULT ('AGT-' || lpad(nextval('agent_code_seq')::text, 5, '0'));
ALTER TABLE "clients" ALTER COLUMN "code" SET DEFAULT ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0'));
ALTER TABLE "properties" ALTER COLUMN "code" SET DEFAULT ('PROP-' || lpad(nextval('property_code_seq')::text, 5, '0'));
