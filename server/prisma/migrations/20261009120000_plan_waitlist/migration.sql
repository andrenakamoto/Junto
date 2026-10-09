-- CreateTable
CREATE TABLE "PlanWaitlist" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanWaitlist_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateIndex
CREATE INDEX "PlanWaitlist_planId_createdAt_idx" ON "PlanWaitlist"("planId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanWaitlist" ADD CONSTRAINT "PlanWaitlist_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWaitlist" ADD CONSTRAINT "PlanWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

