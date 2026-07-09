CREATE TABLE IF NOT EXISTS "LeadNote" (
  "id" SERIAL NOT NULL,
  "leadId" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadNote_leadId_idx" ON "LeadNote"("leadId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadNote_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadNote"
    ADD CONSTRAINT "LeadNote_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
