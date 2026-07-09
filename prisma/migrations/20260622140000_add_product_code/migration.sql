ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_code_key"
ON "Product"("code");
