-- Records WHO archived a property, alongside the existing archived_at timestamp.
-- SetNull on the FK so deactivating that user later never cascade-deletes the
-- property. Nullable and additive — existing rows keep NULL (archived_at also
-- NULL for them), so this is backward-compatible with all current data.

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "archived_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
