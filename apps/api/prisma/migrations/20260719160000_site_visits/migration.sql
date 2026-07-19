-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "remarks" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_visits_scheduled_at_idx" ON "site_visits"("scheduled_at");
CREATE INDEX "site_visits_status_idx" ON "site_visits"("status");
CREATE INDEX "site_visits_agent_id_idx" ON "site_visits"("agent_id");
CREATE INDEX "site_visits_client_id_idx" ON "site_visits"("client_id");
CREATE INDEX "site_visits_property_id_idx" ON "site_visits"("property_id");

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
