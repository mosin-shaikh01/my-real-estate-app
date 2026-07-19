-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEW', 'RESALE');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('OWNER', 'FARMER', 'BUILDER', 'BROKER', 'OTHER');

-- CreateEnum
CREATE TYPE "AreaUnit" AS ENUM ('SQFT', 'SQM', 'SQYD', 'ACRE', 'GUNTHA', 'HECTARE');

-- AlterEnum: new statuses. Safe on PostgreSQL 12+ — the new values are not
-- referenced anywhere in this migration.
ALTER TYPE "PropertyStatus" ADD VALUE 'RESERVED';
ALTER TYPE "PropertyStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "PropertyStatus" ADD VALUE 'CANCELLED';

-- AlterTable: property detail fields (condition, seller role, pricing, area
-- breakdown + unit, landmark). All nullable — additive, never rewriting a row.
ALTER TABLE "properties" ADD COLUMN     "area_unit" "AreaUnit",
ADD COLUMN     "built_up_area" DECIMAL(12,2),
ADD COLUMN     "carpet_area" DECIMAL(12,2),
ADD COLUMN     "condition" "PropertyCondition",
ADD COLUMN     "government_value" DECIMAL(14,2),
ADD COLUMN     "landmark" VARCHAR(160),
ADD COLUMN     "plot_area" DECIMAL(12,2),
ADD COLUMN     "price_per_sqft" DECIMAL(14,2),
ADD COLUMN     "seller_type" "SellerType";
