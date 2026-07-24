-- The legacy option markup says 30 hours, but both the course title and SKU
-- identify this exact course as the 24-hour offering.
UPDATE "Product"
SET "duration" = '24 saat',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'zbrush-ile-organik-modelleme-canli-online-ozel-ders-24-saat-1297'
  AND (
    "duration" IS NULL
    OR BTRIM("duration") = ''
    OR LOWER(BTRIM("duration")) = 'eğitim'
    OR LOWER(BTRIM("duration")) = '30 saat'
  );
