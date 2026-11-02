-- Capsule temporelle : souvenirs scellés jusqu'à une date choisie
CREATE TABLE "TimeCapsule" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "openAt" TIMESTAMP(3) NOT NULL,
    "depositUntil" TIMESTAMP(3) NOT NULL,
    "audienceIds" TEXT[],
    "createdById" TEXT,
    "sealedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "depositReminderSentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeCapsule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CapsuleDeposit" (
    "id" TEXT NOT NULL,
    "capsuleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "fileKey" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapsuleDeposit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimeCapsule_planId_key" ON "TimeCapsule"("planId");
CREATE INDEX "TimeCapsule_circleId_idx" ON "TimeCapsule"("circleId");
CREATE INDEX "TimeCapsule_openAt_idx" ON "TimeCapsule"("openAt");
CREATE INDEX "CapsuleDeposit_capsuleId_idx" ON "CapsuleDeposit"("capsuleId");
ALTER TABLE "TimeCapsule" ADD CONSTRAINT "TimeCapsule_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeCapsule" ADD CONSTRAINT "TimeCapsule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CapsuleDeposit" ADD CONSTRAINT "CapsuleDeposit_capsuleId_fkey" FOREIGN KEY ("capsuleId") REFERENCES "TimeCapsule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapsuleDeposit" ADD CONSTRAINT "CapsuleDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
