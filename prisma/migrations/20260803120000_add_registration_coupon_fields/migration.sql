ALTER TABLE "EducationRegistration"
ADD COLUMN IF NOT EXISTS "couponId" INTEGER,
ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
ADD COLUMN IF NOT EXISTS "couponDiscount" DECIMAL(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EducationRegistration_couponId_fkey'
  ) THEN
    ALTER TABLE "EducationRegistration"
    ADD CONSTRAINT "EducationRegistration_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "EducationRegistration_couponId_idx"
ON "EducationRegistration"("couponId");
