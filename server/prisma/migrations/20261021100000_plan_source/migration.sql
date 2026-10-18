-- « Y aller avec un Cercle » (Mode annonce) : réglage du Plan et lien vers l’événement d’origine. Additive.
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "allowCirclePlans" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourcePlanId" TEXT,
ADD COLUMN     "sourceTitle" TEXT;

-- CreateIndex
CREATE INDEX "Plan_sourcePlanId_idx" ON "Plan"("sourcePlanId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_sourcePlanId_fkey" FOREIGN KEY ("sourcePlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

