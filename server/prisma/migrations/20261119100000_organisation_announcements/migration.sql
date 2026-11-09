-- AlterTable
ALTER TABLE "CircleMessage" ADD COLUMN     "announcementId" TEXT;

-- CreateIndex
CREATE INDEX "CircleMessage_announcementId_idx" ON "CircleMessage"("announcementId");

-- Organisations déjà créées : la direction peut envoyer des annonces
UPDATE "OrganisationRole" SET "permissions" = array_append("permissions", 'send_announcement') WHERE "kind" = 'direction' AND NOT ('send_announcement' = ANY("permissions"));
