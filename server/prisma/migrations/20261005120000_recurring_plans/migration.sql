-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "nextOccurrenceId" TEXT,
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "recurrenceUntil" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT;

