-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "circleId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBooking" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "planId" TEXT,
    "planTitle" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenById" TEXT,
    "takenAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnState" TEXT,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "returnNote" TEXT,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentItem_organisationId_idx" ON "EquipmentItem"("organisationId");

-- CreateIndex
CREATE INDEX "EquipmentItem_circleId_idx" ON "EquipmentItem"("circleId");

-- CreateIndex
CREATE INDEX "EquipmentBooking_itemId_idx" ON "EquipmentBooking"("itemId");

-- CreateIndex
CREATE INDEX "EquipmentBooking_planId_idx" ON "EquipmentBooking"("planId");

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La direction des Organisations existantes peut gérer le matériel
UPDATE "OrganisationRole" SET "permissions" = array_append("permissions", 'manage_equipment') WHERE "kind" = 'direction' AND NOT ('manage_equipment' = ANY("permissions"));
