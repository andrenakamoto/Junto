-- CreateTable
CREATE TABLE "MatchPoll" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdById" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "chosenOptionId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchOption" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "url" TEXT,
    "attachmentId" TEXT,
    "createdById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSwipe" (
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "like" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSwipe_pkey" PRIMARY KEY ("optionId","userId")
);

-- CreateIndex
CREATE INDEX "MatchPoll_planId_idx" ON "MatchPoll"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchOption_attachmentId_key" ON "MatchOption"("attachmentId");

-- CreateIndex
CREATE INDEX "MatchOption_matchId_idx" ON "MatchOption"("matchId");

-- CreateIndex
CREATE INDEX "MatchSwipe_matchId_userId_idx" ON "MatchSwipe"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "MatchPoll" ADD CONSTRAINT "MatchPoll_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPoll" ADD CONSTRAINT "MatchPoll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOption" ADD CONSTRAINT "MatchOption_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOption" ADD CONSTRAINT "MatchOption_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOption" ADD CONSTRAINT "MatchOption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSwipe" ADD CONSTRAINT "MatchSwipe_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MatchOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSwipe" ADD CONSTRAINT "MatchSwipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

