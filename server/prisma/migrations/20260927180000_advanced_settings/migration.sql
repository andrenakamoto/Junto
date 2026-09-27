-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "admissionMode" TEXT NOT NULL DEFAULT 'vote',
ADD COLUMN     "deletionMode" TEXT NOT NULL DEFAULT 'vote';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "deletionMode" TEXT NOT NULL DEFAULT 'vote',
ADD COLUMN     "disabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "editMode" TEXT NOT NULL DEFAULT 'creator';

-- AlterTable
ALTER TABLE "PlanChangeLog" ADD COLUMN     "changedById" TEXT;

-- AddForeignKey
ALTER TABLE "PlanChangeLog" ADD CONSTRAINT "PlanChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

