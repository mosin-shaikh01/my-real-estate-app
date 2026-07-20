-- Reversible archive for clients, mirroring the property model: archived_at is
-- the reversible hide, archived_by_id records who did it (SetNull so deactivating
-- that user never cascade-deletes the client). Both nullable and additive, so
-- existing rows keep NULL — backward-compatible with all current data.

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN "archived_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
