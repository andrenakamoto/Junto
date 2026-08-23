-- CreateTable
CREATE TABLE "CirclePoll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "circleId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdPlanId" TEXT,

    CONSTRAINT "CirclePoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CirclePollOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "pollId" TEXT NOT NULL,

    CONSTRAINT "CirclePollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CirclePollVote" (
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CirclePollVote_pkey" PRIMARY KEY ("optionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CirclePoll_createdPlanId_key" ON "CirclePoll"("createdPlanId");

-- AddForeignKey
ALTER TABLE "CirclePoll" ADD CONSTRAINT "CirclePoll_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePoll" ADD CONSTRAINT "CirclePoll_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePoll" ADD CONSTRAINT "CirclePoll_createdPlanId_fkey" FOREIGN KEY ("createdPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollOption" ADD CONSTRAINT "CirclePollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CirclePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollVote" ADD CONSTRAINT "CirclePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CirclePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollVote" ADD CONSTRAINT "CirclePollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
