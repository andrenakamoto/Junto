-- CreateTable
CREATE TABLE "WordGame" (
    "planId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'points',
    "levels" TEXT[] DEFAULT ARRAY['facile', 'moyen']::TEXT[],
    "customWords" TEXT[],
    "usedWords" TEXT[],
    "endsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordGame_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "WordPlayer" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT,
    "word" TEXT,
    "claimedAt" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 0,
    "eliminatedAt" TIMESTAMP(3),
    "eliminatedById" TEXT,
    "accuseBlockedUntil" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordPlayer_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "WordMission" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "hunterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "WordMission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordMission_planId_idx" ON "WordMission"("planId");

-- AddForeignKey
ALTER TABLE "WordGame" ADD CONSTRAINT "WordGame_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordPlayer" ADD CONSTRAINT "WordPlayer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WordGame"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordPlayer" ADD CONSTRAINT "WordPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordMission" ADD CONSTRAINT "WordMission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WordGame"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

