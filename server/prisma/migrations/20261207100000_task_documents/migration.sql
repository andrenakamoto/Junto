-- Documents de la rubrique Tâches (pièces jointes rangées à part, éventuellement par lot)
ALTER TABLE "Attachment" ADD COLUMN "section" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "taskGroupId" TEXT;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskGroupId_fkey" FOREIGN KEY ("taskGroupId") REFERENCES "PlanTaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
