-- AlterTable
ALTER TABLE "User" ADD COLUMN     "circleChatPush" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "chatMode" TEXT NOT NULL DEFAULT 'off';

-- AlterTable
ALTER TABLE "CircleMember" ADD COLUMN     "chatSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CircleMessage" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CircleMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMessageReaction" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "CircleMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleMessage_circleId_createdAt_idx" ON "CircleMessage"("circleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CircleMessageReaction_messageId_userId_emoji_key" ON "CircleMessageReaction"("messageId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessageReaction" ADD CONSTRAINT "CircleMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessageReaction" ADD CONSTRAINT "CircleMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CircleMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
