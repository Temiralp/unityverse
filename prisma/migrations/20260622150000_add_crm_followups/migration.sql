ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "advisorId" INTEGER,
ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

ALTER TABLE "EducationRegistration"
ADD COLUMN IF NOT EXISTS "advisorId" INTEGER,
ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_advisorId_fkey'
  ) THEN
    ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EducationRegistration_advisorId_fkey'
  ) THEN
    ALTER TABLE "EducationRegistration"
    ADD CONSTRAINT "EducationRegistration_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LeadStatusHistory" (
  "id" SERIAL NOT NULL,
  "leadId" INTEGER NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus" NOT NULL,
  "authorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadStatusHistory_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadStatusHistory"
    ADD CONSTRAINT "LeadStatusHistory_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EducationRegistrationStatusHistory" (
  "id" SERIAL NOT NULL,
  "registrationId" INTEGER NOT NULL,
  "fromStatus" "EducationRegistrationStatus",
  "toStatus" "EducationRegistrationStatus" NOT NULL,
  "fromPaymentStatus" "PaymentStatus",
  "toPaymentStatus" "PaymentStatus",
  "authorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EducationRegistrationStatusHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EducationRegistrationStatusHistory_registrationId_fkey'
  ) THEN
    ALTER TABLE "EducationRegistrationStatusHistory"
    ADD CONSTRAINT "EducationRegistrationStatusHistory_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "EducationRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Lead_advisorId_idx" ON "Lead"("advisorId");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_idx" ON "LeadStatusHistory"("leadId");
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_createdAt_idx" ON "LeadStatusHistory"("createdAt");

CREATE INDEX IF NOT EXISTS "EducationRegistration_advisorId_idx" ON "EducationRegistration"("advisorId");
CREATE INDEX IF NOT EXISTS "EducationRegistration_nextFollowUpAt_idx" ON "EducationRegistration"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "EducationRegistrationStatusHistory_registrationId_idx" ON "EducationRegistrationStatusHistory"("registrationId");
CREATE INDEX IF NOT EXISTS "EducationRegistrationStatusHistory_createdAt_idx" ON "EducationRegistrationStatusHistory"("createdAt");
