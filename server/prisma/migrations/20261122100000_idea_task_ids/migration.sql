-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "taskIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Idées déjà transformées : leur tâche passe dans la liste
UPDATE "Idea" SET "taskIds" = ARRAY["taskId"] WHERE "taskId" IS NOT NULL;
