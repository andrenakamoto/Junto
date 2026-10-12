-- CreateTable
CREATE TABLE "TransitChoice" (
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT,
    "toId" TEXT,
    "toName" TEXT,

    CONSTRAINT "TransitChoice_pkey" PRIMARY KEY ("planId","userId")
);

-- CreateTable
CREATE TABLE "TransitHome" (
    "userId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "stopName" TEXT NOT NULL,

    CONSTRAINT "TransitHome_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TransitGroup" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "lines" TEXT NOT NULL,
    "platform" TEXT,
    "note" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransitGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransitGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "TransitGroup_planId_idx" ON "TransitGroup"("planId");

-- CreateIndex
CREATE INDEX "TransitGroup_departureAt_idx" ON "TransitGroup"("departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransitGroupMember_planId_userId_key" ON "TransitGroupMember"("planId", "userId");

-- AddForeignKey
ALTER TABLE "TransitChoice" ADD CONSTRAINT "TransitChoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitChoice" ADD CONSTRAINT "TransitChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitHome" ADD CONSTRAINT "TransitHome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitGroup" ADD CONSTRAINT "TransitGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitGroup" ADD CONSTRAINT "TransitGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitGroupMember" ADD CONSTRAINT "TransitGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TransitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitGroupMember" ADD CONSTRAINT "TransitGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

