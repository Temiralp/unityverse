DO $$
BEGIN
  CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'PASSIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Member" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "gender" TEXT,
  "passwordHash" TEXT,
  "mailList" BOOLEAN NOT NULL DEFAULT false,
  "smsList" BOOLEAN NOT NULL DEFAULT false,
  "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MemberNote" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "discountType" "DiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Member_email_key" ON "Member"("email");
CREATE INDEX IF NOT EXISTS "Member_status_idx" ON "Member"("status");
CREATE INDEX IF NOT EXISTS "Member_createdAt_idx" ON "Member"("createdAt");

CREATE INDEX IF NOT EXISTS "MemberNote_memberId_idx" ON "MemberNote"("memberId");
CREATE INDEX IF NOT EXISTS "MemberNote_createdAt_idx" ON "MemberNote"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");
CREATE INDEX IF NOT EXISTS "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");

DO $$
BEGIN
  ALTER TABLE "MemberNote"
    ADD CONSTRAINT "MemberNote_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
