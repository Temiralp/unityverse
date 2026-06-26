CREATE TABLE IF NOT EXISTS "ProductTab" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "systemKey" VARCHAR(32),
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTab_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductTab_productId_systemKey_key"
ON "ProductTab"("productId", "systemKey");

CREATE INDEX IF NOT EXISTS "ProductTab_productId_sortOrder_idx"
ON "ProductTab"("productId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductTab_productId_fkey'
  ) THEN
    ALTER TABLE "ProductTab"
    ADD CONSTRAINT "ProductTab_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProductLearningOutcome" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductLearningOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductLearningOutcome_productId_sortOrder_idx"
ON "ProductLearningOutcome"("productId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductLearningOutcome_productId_fkey'
  ) THEN
    ALTER TABLE "ProductLearningOutcome"
    ADD CONSTRAINT "ProductLearningOutcome_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
