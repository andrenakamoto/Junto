-- CreateTable
CREATE TABLE "KillerGame" (
    "planId" TEXT NOT NULL,
    "objects" TEXT[],
    "places" TEXT[],
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillerGame_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "KillerPlayer" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT,
    "object" TEXT,
    "place" TEXT,
    "claimedAt" TIMESTAMP(3),
    "kills" INTEGER NOT NULL DEFAULT 0,
    "eliminatedAt" TIMESTAMP(3),
    "eliminatedById" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillerPlayer_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "TeamDraw" (
    "planId" TEXT NOT NULL,
    "teamCount" INTEGER NOT NULL DEFAULT 2,
    "balanced" BOOLEAN NOT NULL DEFAULT false,
    "drawnAt" TIMESTAMP(3),
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamDraw_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "TeamLevel" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "TeamLevel_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "planId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "TeamMatch" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "homeId" TEXT,
    "awayId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftPot" (
    "planId" TEXT NOT NULL,
    "forWhom" TEXT,
    "target" DOUBLE PRECISION,
    "suggested" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "payInfo" TEXT,
    "chosenIdeaId" TEXT,
    "closedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftPot_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "GiftPledge" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "declaredPaidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftPledge_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "GiftIdea" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "price" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftIdeaVote" (
    "ideaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GiftIdeaVote_pkey" PRIMARY KEY ("ideaId","userId")
);

-- CreateIndex
CREATE INDEX "Team_planId_idx" ON "Team"("planId");

-- CreateIndex
CREATE INDEX "TeamMatch_planId_idx" ON "TeamMatch"("planId");

-- CreateIndex
CREATE INDEX "GiftIdea_planId_idx" ON "GiftIdea"("planId");

-- AddForeignKey
ALTER TABLE "KillerGame" ADD CONSTRAINT "KillerGame_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillerPlayer" ADD CONSTRAINT "KillerPlayer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "KillerGame"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillerPlayer" ADD CONSTRAINT "KillerPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDraw" ADD CONSTRAINT "TeamDraw_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLevel" ADD CONSTRAINT "TeamLevel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeamDraw"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLevel" ADD CONSTRAINT "TeamLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeamDraw"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TeamDraw"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPot" ADD CONSTRAINT "GiftPot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPledge" ADD CONSTRAINT "GiftPledge_planId_fkey" FOREIGN KEY ("planId") REFERENCES "GiftPot"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPledge" ADD CONSTRAINT "GiftPledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_planId_fkey" FOREIGN KEY ("planId") REFERENCES "GiftPot"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdeaVote" ADD CONSTRAINT "GiftIdeaVote_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "GiftIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdeaVote" ADD CONSTRAINT "GiftIdeaVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

