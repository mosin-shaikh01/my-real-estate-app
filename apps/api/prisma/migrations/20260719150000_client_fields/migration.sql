-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('INDIVIDUAL', 'INVESTOR', 'BROKER', 'BUILDER', 'FARMER', 'OTHER');

-- AlterTable: buyer type, important-lead flag, buyer city. Additive/nullable
-- (important_lead defaults false).
ALTER TABLE "clients" ADD COLUMN     "buyer_type" "BuyerType",
ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "important_lead" BOOLEAN NOT NULL DEFAULT false;
