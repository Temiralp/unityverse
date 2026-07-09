-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" SERIAL NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "identifierHash" VARCHAR(64) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitEntry_expiresAt_idx" ON "RateLimitEntry"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEntry_scope_identifierHash_key" ON "RateLimitEntry"("scope", "identifierHash");
