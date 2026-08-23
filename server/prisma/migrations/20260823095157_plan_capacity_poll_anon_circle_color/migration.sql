-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "maxParticipants" INTEGER;

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "anonymous" BOOLEAN NOT NULL DEFAULT false;
