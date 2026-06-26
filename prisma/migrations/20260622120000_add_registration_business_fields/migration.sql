DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');
  END IF;
END
$$;

ALTER TABLE "EducationRegistration"
ADD COLUMN IF NOT EXISTS "advisorNote" TEXT,
ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "paymentNote" TEXT,
ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "EducationRegistration_paymentStatus_idx" ON "EducationRegistration"("paymentStatus");
CREATE INDEX IF NOT EXISTS "EducationRegistration_startsAt_idx" ON "EducationRegistration"("startsAt");
