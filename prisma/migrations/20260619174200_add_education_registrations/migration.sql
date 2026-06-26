DO $$
BEGIN
  CREATE TYPE "EducationRegistrationStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EducationRegistration" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER,
  "productId" INTEGER,
  "courseTitle" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surname" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'admin',
  "status" "EducationRegistrationStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EducationRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EducationRegistrationNote" (
  "id" SERIAL NOT NULL,
  "registrationId" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EducationRegistrationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EducationRegistration_status_idx" ON "EducationRegistration"("status");
CREATE INDEX IF NOT EXISTS "EducationRegistration_memberId_idx" ON "EducationRegistration"("memberId");
CREATE INDEX IF NOT EXISTS "EducationRegistration_productId_idx" ON "EducationRegistration"("productId");
CREATE INDEX IF NOT EXISTS "EducationRegistration_createdAt_idx" ON "EducationRegistration"("createdAt");

CREATE INDEX IF NOT EXISTS "EducationRegistrationNote_registrationId_idx" ON "EducationRegistrationNote"("registrationId");
CREATE INDEX IF NOT EXISTS "EducationRegistrationNote_createdAt_idx" ON "EducationRegistrationNote"("createdAt");

DO $$
BEGIN
  ALTER TABLE "EducationRegistration"
    ADD CONSTRAINT "EducationRegistration_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EducationRegistration"
    ADD CONSTRAINT "EducationRegistration_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EducationRegistrationNote"
    ADD CONSTRAINT "EducationRegistrationNote_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "EducationRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
