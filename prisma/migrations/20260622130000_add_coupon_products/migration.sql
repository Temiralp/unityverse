CREATE TABLE IF NOT EXISTS "CouponProduct" (
  "id" SERIAL NOT NULL,
  "couponId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CouponProduct_couponId_productId_key" ON "CouponProduct"("couponId", "productId");
CREATE INDEX IF NOT EXISTS "CouponProduct_couponId_idx" ON "CouponProduct"("couponId");
CREATE INDEX IF NOT EXISTS "CouponProduct_productId_idx" ON "CouponProduct"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CouponProduct_couponId_fkey'
  ) THEN
    ALTER TABLE "CouponProduct"
    ADD CONSTRAINT "CouponProduct_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CouponProduct_productId_fkey'
  ) THEN
    ALTER TABLE "CouponProduct"
    ADD CONSTRAINT "CouponProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
