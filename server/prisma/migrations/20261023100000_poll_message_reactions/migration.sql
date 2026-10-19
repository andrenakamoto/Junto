-- CreateTable
CREATE TABLE "CirclePollMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CirclePollMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CirclePollMessageReaction_messageId_userId_emoji_key" ON "CirclePollMessageReaction"("messageId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "CirclePollMessageReaction" ADD CONSTRAINT "CirclePollMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CirclePollMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollMessageReaction" ADD CONSTRAINT "CirclePollMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

