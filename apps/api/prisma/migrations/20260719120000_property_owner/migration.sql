-- Human-readable owner code sequence (OWN-00001). PREPENDED on purpose: Prisma
-- inlines nextval() into the table default but cannot create the sequence itself,
-- so it must exist before the CREATE TABLE below.
CREATE SEQUENCE "owner_code_seq" START 1;

-- AlterTable: new property columns — owner FK + legal identifiers.
ALTER TABLE "properties" ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "property_number" VARCHAR(64),
ADD COLUMN     "survey_number" VARCHAR(64);

-- CreateTable
CREATE TABLE "property_owners" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL DEFAULT ('OWN-' || lpad(nextval('owner_code_seq')::text, 5, '0')),
    "full_name" VARCHAR(160) NOT NULL,
    "mobile" VARCHAR(32) NOT NULL,
    "mobile_normalized" VARCHAR(32) NOT NULL,
    "alt_mobile" VARCHAR(32),
    "email" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(120),
    "pan" VARCHAR(16),
    "aadhaar" VARCHAR(20),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_owners_code_key" ON "property_owners"("code");

-- CreateIndex
CREATE INDEX "property_owners_mobile_normalized_idx" ON "property_owners"("mobile_normalized");

-- CreateIndex
CREATE INDEX "property_owners_full_name_idx" ON "property_owners"("full_name");

-- CreateIndex
CREATE INDEX "property_owners_deleted_at_idx" ON "property_owners"("deleted_at");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "properties_survey_number_idx" ON "properties"("survey_number");

-- CreateIndex
CREATE INDEX "properties_property_number_idx" ON "properties"("property_number");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "property_owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
