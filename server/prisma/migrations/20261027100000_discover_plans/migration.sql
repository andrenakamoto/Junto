-- AlterTable
ALTER TABLE "DiscoverEvent" ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canPublishDiscover" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverEvent_planId_key" ON "DiscoverEvent"("planId");

-- AddForeignKey
ALTER TABLE "DiscoverEvent" ADD CONSTRAINT "DiscoverEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

