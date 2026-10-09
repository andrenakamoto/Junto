-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "nonVoterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proxiesAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maxProxies" INTEGER NOT NULL DEFAULT 1,
    "quorumMode" TEXT NOT NULL DEFAULT 'none',
    "quorumValue" INTEGER,
    "codeCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "checkInCode" TEXT,
    "hybrid" BOOLEAN NOT NULL DEFAULT false,
    "noticeDays" INTEGER NOT NULL DEFAULT 20,
    "secretaryId" TEXT,
    "convokedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyItem" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "secret" BOOLEAN NOT NULL DEFAULT true,
    "majority" TEXT NOT NULL DEFAULT 'simple',
    "seats" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "eligibleVotes" INTEGER,
    "tacitAdopted" BOOLEAN,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyCandidate" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "elected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssemblyCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyVoter" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onBehalfOfId" TEXT NOT NULL,
    "choice" TEXT,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyVoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyBallot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "choice" TEXT,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AssemblyBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyProxy" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyProxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyAttendance" (
    "assemblyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedById" TEXT,

    CONSTRAINT "AssemblyAttendance_pkey" PRIMARY KEY ("assemblyId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assembly_planId_key" ON "Assembly"("planId");

-- CreateIndex
CREATE INDEX "AssemblyItem_assemblyId_idx" ON "AssemblyItem"("assemblyId");

-- CreateIndex
CREATE INDEX "AssemblyCandidate_itemId_idx" ON "AssemblyCandidate"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyVoter_itemId_onBehalfOfId_key" ON "AssemblyVoter"("itemId", "onBehalfOfId");

-- CreateIndex
CREATE INDEX "AssemblyBallot_itemId_idx" ON "AssemblyBallot"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyProxy_assemblyId_giverId_key" ON "AssemblyProxy"("assemblyId", "giverId");

-- AddForeignKey
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyItem" ADD CONSTRAINT "AssemblyItem_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyCandidate" ADD CONSTRAINT "AssemblyCandidate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssemblyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyVoter" ADD CONSTRAINT "AssemblyVoter_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssemblyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyBallot" ADD CONSTRAINT "AssemblyBallot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssemblyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyProxy" ADD CONSTRAINT "AssemblyProxy_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyAttendance" ADD CONSTRAINT "AssemblyAttendance_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

