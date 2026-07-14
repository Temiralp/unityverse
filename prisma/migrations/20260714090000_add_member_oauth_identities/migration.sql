CREATE TABLE "MemberOAuthIdentity" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "providerSubject" VARCHAR(255) NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemberOAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberOAuthIdentity_provider_providerSubject_key"
  ON "MemberOAuthIdentity"("provider", "providerSubject");

CREATE INDEX "MemberOAuthIdentity_memberId_idx"
  ON "MemberOAuthIdentity"("memberId");

ALTER TABLE "MemberOAuthIdentity"
  ADD CONSTRAINT "MemberOAuthIdentity_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
