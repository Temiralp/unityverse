ALTER TABLE "ProductVariant"
    ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ProductVariant_parentProductId_isArchived_sortOrder_idx"
    ON "ProductVariant"("parentProductId", "isArchived", "sortOrder");
