-- Administrateurs d'une Organisation : nomination, retrait par vote, historique (lib/orgAdmins.ts)
ALTER TABLE "OrganisationMember" ADD COLUMN "adminSince" TIMESTAMP(3);
UPDATE "OrganisationMember" SET "adminSince" = "createdAt" WHERE "isAdmin" = true;

CREATE TABLE "OrganisationAdminRemoval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganisationAdminRemoval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganisationAdminRemoval_organisationId_targetId_key" ON "OrganisationAdminRemoval"("organisationId", "targetId");
ALTER TABLE "OrganisationAdminRemoval" ADD CONSTRAINT "OrganisationAdminRemoval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganisationAdminRemovalVote" (
    "removalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganisationAdminRemovalVote_pkey" PRIMARY KEY ("removalId", "userId")
);
ALTER TABLE "OrganisationAdminRemovalVote" ADD CONSTRAINT "OrganisationAdminRemovalVote_removalId_fkey" FOREIGN KEY ("removalId") REFERENCES "OrganisationAdminRemoval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganisationAdminLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganisationAdminLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganisationAdminLog_organisationId_createdAt_idx" ON "OrganisationAdminLog"("organisationId", "createdAt");
ALTER TABLE "OrganisationAdminLog" ADD CONSTRAINT "OrganisationAdminLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
