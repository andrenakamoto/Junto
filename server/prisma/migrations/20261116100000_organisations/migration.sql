-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "orgAutoCircleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgAutoDirection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orgAutoRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgDefaultRoleId" TEXT,
ADD COLUMN     "orgDiscussionRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgExtraPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgKind" TEXT,
ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "CircleMember" ADD COLUMN     "orgIntegrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orgRoleId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canCreateOrganisation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT,
    "unitLabel" TEXT,
    "teamLabel" TEXT,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationRole" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "OrganisationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMember" (
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isDirection" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganisationMember_pkey" PRIMARY KEY ("organisationId","userId")
);

-- CreateIndex
CREATE INDEX "OrganisationRole_organisationId_idx" ON "OrganisationRole"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationMember_userId_idx" ON "OrganisationMember"("userId");

-- CreateIndex
CREATE INDEX "Circle_organisationId_idx" ON "Circle"("organisationId");

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationRole" ADD CONSTRAINT "OrganisationRole_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMember" ADD CONSTRAINT "OrganisationMember_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMember" ADD CONSTRAINT "OrganisationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_orgRoleId_fkey" FOREIGN KEY ("orgRoleId") REFERENCES "OrganisationRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
