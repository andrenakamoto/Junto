-- Déroulé d'un Plan (moments, durées, heures fixes, responsables)
-- CreateTable
CREATE TABLE "PlanProgramItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "fixedStart" TIMESTAMP(3),
    "place" TEXT,
    "tech" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedStart" TIMESTAMP(3),

    CONSTRAINT "PlanProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanProgramAssignee" (
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "PlanProgramAssignee_pkey" PRIMARY KEY ("itemId","userId")
);

-- CreateIndex
CREATE INDEX "PlanProgramItem_planId_idx" ON "PlanProgramItem"("planId");

-- CreateIndex
CREATE INDEX "PlanProgramAssignee_planId_userId_idx" ON "PlanProgramAssignee"("planId", "userId");

-- AddForeignKey
ALTER TABLE "PlanProgramItem" ADD CONSTRAINT "PlanProgramItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProgramAssignee" ADD CONSTRAINT "PlanProgramAssignee_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlanProgramItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProgramAssignee" ADD CONSTRAINT "PlanProgramAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

