-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT;

-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "photoKey" TEXT;

-- CreateTable
CREATE TABLE "PhotoReport" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "reason" TEXT,
    "reporterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "PhotoReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoReport_resolvedAt_idx" ON "PhotoReport"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoReport_reporterId_kind_targetId_photoKey_key" ON "PhotoReport"("reporterId", "kind", "targetId", "photoKey");

-- AddForeignKey
ALTER TABLE "PhotoReport" ADD CONSTRAINT "PhotoReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
