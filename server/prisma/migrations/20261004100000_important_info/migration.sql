-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "importantInfo" TEXT,
ADD COLUMN     "importantInfoMode" TEXT NOT NULL DEFAULT 'creator';

