-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "availabilityEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availabilityThreshold" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availabilityPush" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_circleId_expiresAt_idx" ON "Availability"("circleId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_userId_circleId_key" ON "Availability"("userId", "circleId");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

