CREATE TYPE "IdentityDocumentType" AS ENUM ('TC_ID', 'PASSPORT');

ALTER TABLE "EducationRegistration"
  ADD COLUMN "identityDocumentType" "IdentityDocumentType",
  ADD COLUMN "identityDocumentNumberEncrypted" TEXT,
  ADD COLUMN "identityDocumentCountryCode" VARCHAR(2),
  ADD COLUMN "birthDateEncrypted" TEXT,
  ADD COLUMN "addressEncrypted" TEXT;

-- Existing registrations intentionally remain nullable. New website enrollments
-- are required and validated by the application before payment can start.
