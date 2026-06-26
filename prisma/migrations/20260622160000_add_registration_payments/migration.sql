DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_ISSUED', 'ISSUED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallmentStatus') THEN
    CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE "EducationRegistration"
ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NOT_ISSUED';

CREATE TABLE IF NOT EXISTS "EducationPayment" (
  "id" SERIAL NOT NULL,
  "registrationId" INTEGER NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "method" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EducationPayment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EducationPayment_registrationId_fkey'
  ) THEN
    ALTER TABLE "EducationPayment"
    ADD CONSTRAINT "EducationPayment_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "EducationRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EducationInstallment" (
  "id" SERIAL NOT NULL,
  "registrationId" INTEGER NOT NULL,
  "title" TEXT,
  "amount" DECIMAL(10, 2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EducationInstallment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EducationInstallment_registrationId_fkey'
  ) THEN
    ALTER TABLE "EducationInstallment"
    ADD CONSTRAINT "EducationInstallment_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "EducationRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EducationRegistration_invoiceStatus_idx" ON "EducationRegistration"("invoiceStatus");
CREATE INDEX IF NOT EXISTS "EducationPayment_registrationId_idx" ON "EducationPayment"("registrationId");
CREATE INDEX IF NOT EXISTS "EducationPayment_paidAt_idx" ON "EducationPayment"("paidAt");
CREATE INDEX IF NOT EXISTS "EducationInstallment_registrationId_idx" ON "EducationInstallment"("registrationId");
CREATE INDEX IF NOT EXISTS "EducationInstallment_dueDate_idx" ON "EducationInstallment"("dueDate");
CREATE INDEX IF NOT EXISTS "EducationInstallment_status_idx" ON "EducationInstallment"("status");
