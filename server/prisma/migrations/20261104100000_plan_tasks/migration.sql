-- Tâches de préparation d'un Plan (lots, responsables, échéances, dépendances, commentaires)
-- CreateTable
CREATE TABLE "PlanTaskGroup" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTaskGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "PlanTaskDependency" (
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,

    CONSTRAINT "PlanTaskDependency_pkey" PRIMARY KEY ("taskId","dependsOnId")
);

-- CreateTable
CREATE TABLE "PlanTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanTaskGroup_planId_idx" ON "PlanTaskGroup"("planId");

-- CreateIndex
CREATE INDEX "PlanTask_planId_idx" ON "PlanTask"("planId");

-- CreateIndex
CREATE INDEX "PlanTaskAssignee_planId_userId_idx" ON "PlanTaskAssignee"("planId", "userId");

-- CreateIndex
CREATE INDEX "PlanTaskDependency_dependsOnId_idx" ON "PlanTaskDependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "PlanTaskComment_taskId_idx" ON "PlanTaskComment"("taskId");

-- AddForeignKey
ALTER TABLE "PlanTaskGroup" ADD CONSTRAINT "PlanTaskGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PlanTaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskAssignee" ADD CONSTRAINT "PlanTaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskAssignee" ADD CONSTRAINT "PlanTaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskDependency" ADD CONSTRAINT "PlanTaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskDependency" ADD CONSTRAINT "PlanTaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "PlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskComment" ADD CONSTRAINT "PlanTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTaskComment" ADD CONSTRAINT "PlanTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

