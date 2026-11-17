-- Secret Santa en ligne sans compte (2026-11-17)
CREATE TABLE "OnlineSanta" (
    "id" TEXT NOT NULL,
    "adminToken" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "budget" TEXT,
    "exchangeDate" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnlineSanta_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OnlineSantaPerson" (
    "id" TEXT NOT NULL,
    "santaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "receiverId" TEXT,
    "wishes" TEXT,
    "noWish" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    CONSTRAINT "OnlineSantaPerson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnlineSanta_adminToken_key" ON "OnlineSanta"("adminToken");
CREATE UNIQUE INDEX "OnlineSantaPerson_token_key" ON "OnlineSantaPerson"("token");
CREATE INDEX "OnlineSantaPerson_santaId_idx" ON "OnlineSantaPerson"("santaId");
ALTER TABLE "OnlineSantaPerson" ADD CONSTRAINT "OnlineSantaPerson_santaId_fkey" FOREIGN KEY ("santaId") REFERENCES "OnlineSanta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
