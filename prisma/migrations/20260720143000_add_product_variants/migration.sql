CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "parentProductId" INTEGER NOT NULL,
    "variantProductId" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_parentProductId_variantProductId_key"
    ON "ProductVariant"("parentProductId", "variantProductId");
CREATE INDEX "ProductVariant_parentProductId_sortOrder_idx"
    ON "ProductVariant"("parentProductId", "sortOrder");
CREATE INDEX "ProductVariant_variantProductId_idx"
    ON "ProductVariant"("variantProductId");

ALTER TABLE "ProductVariant"
    ADD CONSTRAINT "ProductVariant_parentProductId_fkey"
    FOREIGN KEY ("parentProductId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariant"
    ADD CONSTRAINT "ProductVariant_variantProductId_fkey"
    FOREIGN KEY ("variantProductId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

WITH variant_mapping("parentSlug", "variantSlug", "label", "sortOrder") AS (
    VALUES
        ('cocuklar-icin-yazilim-uzmanligi-egitimi-canli-online-1587', 'cocuklar-ve-gencler-icin-yazilim-uzmanligi-egitimi-canli-online-8-ay-1589', '8 ay', 0),
        ('grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-1484', 'grafik-tasarim-ve-video-efekt-uzmanligi-canli-online-egitimi-8-ay-1487', '8 ay', 0),
        ('grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-1489', 'grafik-tasarim-ve-video-efekt-uzmanligi-yuz-yuze-egitimi-8-ay-1490', '8 ay', 0),
        ('aranan-programci-olma-kampi-online-kursu-1501', 'aranan-programci-olma-kampi-online-kursu-8-ay-1503', '8 ay', 0),
        ('aranan-programci-olma-kampi-yuz-yuze-kursu-1498', 'aranan-programci-olma-kampi-yuz-yuze-kursu-8-ay-1499', '8 ay', 0),
        ('uiux-tasarim-egitimi-canli-online-egitimi-1514', 'uiux-tasarim-egitimi-canli-online-egitimi-8-ay-1516', '8 ay', 0),
        ('unity-ile-oyun-gelistirme-yuz-yuze-egitimi-1481', 'unity-ile-oyun-gelistirme-yuz-yuze-egitimi-8-ay-1482', '8 ay', 0),
        ('yazilim-test-otomasyonu-canli-online-egitimi-1454', 'yazilim-test-otomasyonu-canli-online-egitimi-8-ay-1456', '8 ay', 0),
        ('yazilim-uzmanligi-yuz-yuze-egitim-1473', 'yazilim-uzmanligi-yuz-yuze-egitim-8-ay-1474', '8 ay', 0)
)
INSERT INTO "ProductVariant" (
    "parentProductId",
    "variantProductId",
    "label",
    "sortOrder",
    "isDefault",
    "updatedAt"
)
SELECT
    parent."id",
    variant."id",
    mapping."label",
    mapping."sortOrder",
    true,
    CURRENT_TIMESTAMP
FROM variant_mapping AS mapping
JOIN "Product" AS parent ON parent."slug" = mapping."parentSlug"
JOIN "Product" AS variant ON variant."slug" = mapping."variantSlug"
ON CONFLICT ("parentProductId", "variantProductId") DO NOTHING;
