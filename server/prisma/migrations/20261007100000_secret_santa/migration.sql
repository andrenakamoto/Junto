-- CreateTable
CREATE TABLE "SecretSanta" (
    "planId" TEXT NOT NULL,
    "budget" TEXT,
    "drawnAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "weekReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretSanta_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "SecretSantaWish" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "noWish" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretSantaWish_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "SecretSantaExclusion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,

    CONSTRAINT "SecretSantaExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretSantaPair" (
    "planId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "giftReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretSantaPair_pkey" PRIMARY KEY ("planId","giverId")
);

-- CreateTable
CREATE TABLE "SecretSantaMessage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "fromGiver" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretSantaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecretSantaExclusion_planId_userAId_userBId_key" ON "SecretSantaExclusion"("planId", "userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "SecretSantaPair_planId_receiverId_key" ON "SecretSantaPair"("planId", "receiverId");

-- CreateIndex
CREATE INDEX "SecretSantaMessage_planId_giverId_idx" ON "SecretSantaMessage"("planId", "giverId");

-- AddForeignKey
ALTER TABLE "SecretSanta" ADD CONSTRAINT "SecretSanta_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaWish" ADD CONSTRAINT "SecretSantaWish_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SecretSanta"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaWish" ADD CONSTRAINT "SecretSantaWish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaExclusion" ADD CONSTRAINT "SecretSantaExclusion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SecretSanta"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaPair" ADD CONSTRAINT "SecretSantaPair_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SecretSanta"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaPair" ADD CONSTRAINT "SecretSantaPair_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaPair" ADD CONSTRAINT "SecretSantaPair_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretSantaMessage" ADD CONSTRAINT "SecretSantaMessage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SecretSanta"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

