-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
