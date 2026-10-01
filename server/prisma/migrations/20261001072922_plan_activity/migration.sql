-- AlterTable
ALTER TABLE "PlanMember" ADD COLUMN     "seen" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PlanActivity" (
    "planId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanActivity_pkey" PRIMARY KEY ("planId","section")
);

-- AddForeignKey
ALTER TABLE "PlanActivity" ADD CONSTRAINT "PlanActivity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

