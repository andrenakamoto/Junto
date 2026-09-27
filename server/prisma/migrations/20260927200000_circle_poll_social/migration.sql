-- CreateTable
CREATE TABLE "CirclePollExclusion" (
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CirclePollExclusion_pkey" PRIMARY KEY ("pollId","userId")
);

-- CreateTable
CREATE TABLE "CirclePollDecline" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CirclePollDecline_pkey" PRIMARY KEY ("pollId","userId")
);

-- CreateTable
CREATE TABLE "CirclePollMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "CirclePollMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CirclePollMessage_pollId_createdAt_idx" ON "CirclePollMessage"("pollId", "createdAt");

-- AddForeignKey
ALTER TABLE "CirclePollExclusion" ADD CONSTRAINT "CirclePollExclusion_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CirclePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollExclusion" ADD CONSTRAINT "CirclePollExclusion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollDecline" ADD CONSTRAINT "CirclePollDecline_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CirclePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollDecline" ADD CONSTRAINT "CirclePollDecline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollMessage" ADD CONSTRAINT "CirclePollMessage_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CirclePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollMessage" ADD CONSTRAINT "CirclePollMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

