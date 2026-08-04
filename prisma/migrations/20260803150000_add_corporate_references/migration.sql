CREATE TABLE "CorporateReference" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logoPath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorporateReference_name_key"
ON "CorporateReference"("name");

CREATE INDEX "CorporateReference_isActive_sortOrder_idx"
ON "CorporateReference"("isActive", "sortOrder");

INSERT INTO "CorporateReference" ("name", "logoPath", "sortOrder", "isActive", "updatedAt")
VALUES
    ('Türkiye İş Bankası', '/uploads/corporate-references/is-bankasi.png', 1, true, CURRENT_TIMESTAMP),
    ('Halkbank', '/uploads/corporate-references/halkbank.png', 2, true, CURRENT_TIMESTAMP),
    ('VakıfBank', '/uploads/corporate-references/vakifbank.png', 3, true, CURRENT_TIMESTAMP),
    ('Ziraat Bankası', '/uploads/corporate-references/ziraat-bankasi.png', 4, true, CURRENT_TIMESTAMP),
    ('Vodafone', '/uploads/corporate-references/vodafone.png', 5, true, CURRENT_TIMESTAMP),
    ('Türk Hava Yolları', '/uploads/corporate-references/turk-hava-yollari.png', 6, true, CURRENT_TIMESTAMP),
    ('Eczacıbaşı Holding', '/uploads/corporate-references/eczacibasi-holding.png', 7, true, CURRENT_TIMESTAMP),
    ('İGA İstanbul Havalimanı İşletmesi', '/uploads/corporate-references/iga.png', 8, true, CURRENT_TIMESTAMP),
    ('DCBank', '/uploads/corporate-references/dcbank.png', 9, true, CURRENT_TIMESTAMP),
    ('Samsung', '/uploads/corporate-references/samsung.png', 10, true, CURRENT_TIMESTAMP),
    ('Intel', '/uploads/corporate-references/intel.png', 11, true, CURRENT_TIMESTAMP),
    ('Yıldız Teknik Üniversitesi', '/uploads/corporate-references/yildiz-teknik-universitesi.png', 12, true, CURRENT_TIMESTAMP),
    ('University of California', '/uploads/corporate-references/university-of-california.png', 13, true, CURRENT_TIMESTAMP),
    ('Ege Üniversitesi', '/uploads/corporate-references/ege-universitesi.png', 14, true, CURRENT_TIMESTAMP),
    ('BTM - Bilgiyi Ticarileştirme Merkezi', '/uploads/corporate-references/btm.png', 15, true, CURRENT_TIMESTAMP),
    ('Migros', '/uploads/corporate-references/migros.png', 16, true, CURRENT_TIMESTAMP);
