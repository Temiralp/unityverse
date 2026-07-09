CREATE TABLE IF NOT EXISTS "MemberCourseInterest" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberCourseInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MemberCourseInterest_memberId_productId_key" ON "MemberCourseInterest"("memberId", "productId");
CREATE INDEX IF NOT EXISTS "MemberCourseInterest_memberId_idx" ON "MemberCourseInterest"("memberId");
CREATE INDEX IF NOT EXISTS "MemberCourseInterest_productId_idx" ON "MemberCourseInterest"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MemberCourseInterest_memberId_fkey'
  ) THEN
    ALTER TABLE "MemberCourseInterest"
    ADD CONSTRAINT "MemberCourseInterest_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MemberCourseInterest_productId_fkey'
  ) THEN
    ALTER TABLE "MemberCourseInterest"
    ADD CONSTRAINT "MemberCourseInterest_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
