-- CreateIndex
CREATE INDEX "CircleMember_circleId_idx" ON "CircleMember"("circleId");

-- CreateIndex
CREATE INDEX "Message_planId_createdAt_idx" ON "Message"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_parentId_idx" ON "Message"("parentId");

-- CreateIndex
CREATE INDEX "PlanMember_planId_idx" ON "PlanMember"("planId");
