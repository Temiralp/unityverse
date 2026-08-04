-- A draft duration must not remain selectable through an active variant link.
-- This only disables inconsistent links; it never publishes products or changes URLs.
UPDATE "ProductVariant" AS variant_link
SET
  "isActive" = false,
  "isDefault" = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" AS duration_product
WHERE duration_product."id" = variant_link."variantProductId"
  AND duration_product."status" = 'DRAFT'
  AND variant_link."isArchived" = false
  AND (variant_link."isActive" = true OR variant_link."isDefault" = true);
