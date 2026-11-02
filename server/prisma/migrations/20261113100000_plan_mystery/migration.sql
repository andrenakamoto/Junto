-- Plan mystère : vrai titre et vrai lieu cachés, indices, paris
CREATE TABLE "PlanMystery" (
    "planId" TEXT NOT NULL,
    "realTitle" TEXT NOT NULL,
    "realLocation" TEXT NOT NULL,
    "publicTitle" TEXT,
    "publicLocation" TEXT,
    "revealAt" TIMESTAMP(3) NOT NULL,
    "revealedAt" TIMESTAMP(3),
    "accompliceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanMystery_pkey" PRIMARY KEY ("planId")
);
CREATE TABLE "PlanMysteryClue" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "revealAt" TIMESTAMP(3) NOT NULL,
    "revealedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlanMysteryClue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlanMysteryGuess" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanMysteryGuess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanMystery_revealAt_idx" ON "PlanMystery"("revealAt");
CREATE INDEX "PlanMysteryClue_planId_idx" ON "PlanMysteryClue"("planId");
CREATE INDEX "PlanMysteryClue_revealAt_idx" ON "PlanMysteryClue"("revealAt");
CREATE UNIQUE INDEX "PlanMysteryGuess_planId_userId_key" ON "PlanMysteryGuess"("planId", "userId");
ALTER TABLE "PlanMystery" ADD CONSTRAINT "PlanMystery_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMysteryClue" ADD CONSTRAINT "PlanMysteryClue_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMysteryGuess" ADD CONSTRAINT "PlanMysteryGuess_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanMysteryGuess" ADD CONSTRAINT "PlanMysteryGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
