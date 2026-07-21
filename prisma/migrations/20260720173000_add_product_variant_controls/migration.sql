DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ProductVariant'
          AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "ProductVariant"
            ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

DROP INDEX IF EXISTS "ProductVariant_variantProductId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_variantProductId_key"
    ON "ProductVariant"("variantProductId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_one_default_per_parent_key"
    ON "ProductVariant"("parentProductId")
    WHERE "isDefault" = true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ProductVariant_parent_variant_check'
    ) THEN
        ALTER TABLE "ProductVariant"
            ADD CONSTRAINT "ProductVariant_parent_variant_check"
            CHECK ("parentProductId" <> "variantProductId");
    END IF;
END $$;
