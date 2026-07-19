-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SALE_DEED', 'EXTRACT_7_12', 'NA_ORDER', 'LAYOUT_PLAN', 'TITLE_DOCUMENT', 'TAX_RECEIPT', 'OTHER');

-- AlterTable: which legal document a DOCUMENT-type media row is. Nullable/additive.
ALTER TABLE "property_media" ADD COLUMN     "document_type" "DocumentType";
