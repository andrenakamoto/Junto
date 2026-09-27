-- CreateTable
CREATE TABLE "PlanGuestLink" (
    "planId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanGuestLink_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "PlanExclusion" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PlanExclusion_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanGuestLink_token_key" ON "PlanGuestLink"("token");

-- AddForeignKey
ALTER TABLE "PlanGuestLink" ADD CONSTRAINT "PlanGuestLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanExclusion" ADD CONSTRAINT "PlanExclusion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanExclusion" ADD CONSTRAINT "PlanExclusion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

