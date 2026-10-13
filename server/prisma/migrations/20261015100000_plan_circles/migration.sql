-- CreateTable
CREATE TABLE "PlanCircle" (
    "planId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,

    CONSTRAINT "PlanCircle_pkey" PRIMARY KEY ("planId","circleId")
);

-- CreateIndex
CREATE INDEX "PlanCircle_circleId_idx" ON "PlanCircle"("circleId");

-- AddForeignKey
ALTER TABLE "PlanCircle" ADD CONSTRAINT "PlanCircle_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCircle" ADD CONSTRAINT "PlanCircle_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

