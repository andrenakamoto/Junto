-- AlterTable
ALTER TABLE "CirclePoll" ADD COLUMN     "orgRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "orgRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CirclePollCircle" (
    "pollId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,

    CONSTRAINT "CirclePollCircle_pkey" PRIMARY KEY ("pollId","circleId")
);

-- CreateIndex
CREATE INDEX "CirclePollCircle_circleId_idx" ON "CirclePollCircle"("circleId");

-- AddForeignKey
ALTER TABLE "CirclePollCircle" ADD CONSTRAINT "CirclePollCircle_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CirclePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePollCircle" ADD CONSTRAINT "CirclePollCircle_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
