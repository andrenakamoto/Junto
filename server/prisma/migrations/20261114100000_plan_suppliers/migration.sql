-- CreateTable
CREATE TABLE "CircleSupplier" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircleSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSupplier" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "steps" JSONB NOT NULL DEFAULT '{}',
    "responsibleId" TEXT,
    "groupId" TEXT,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "quoteAmount" DOUBLE PRECISION,
    "depositAmount" DOUBLE PRECISION,
    "depositDue" TEXT,
    "depositPaidAt" TIMESTAMP(3),
    "balanceAmount" DOUBLE PRECISION,
    "balanceDue" TEXT,
    "balancePaidAt" TIMESTAMP(3),
    "depositReminderSentAt" TIMESTAMP(3),
    "balanceReminderSentAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSupplierComment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSupplierComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierUse" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "planId" TEXT,
    "entryId" TEXT,
    "planTitle" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "total" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleSupplier_circleId_idx" ON "CircleSupplier"("circleId");

-- CreateIndex
CREATE INDEX "PlanSupplier_planId_idx" ON "PlanSupplier"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSupplier_planId_supplierId_key" ON "PlanSupplier"("planId", "supplierId");

-- CreateIndex
CREATE INDEX "PlanSupplierComment_entryId_idx" ON "PlanSupplierComment"("entryId");

-- CreateIndex
CREATE INDEX "SupplierDocument_entryId_idx" ON "SupplierDocument"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUse_entryId_key" ON "SupplierUse"("entryId");

-- CreateIndex
CREATE INDEX "SupplierUse_supplierId_idx" ON "SupplierUse"("supplierId");

-- AddForeignKey
ALTER TABLE "CircleSupplier" ADD CONSTRAINT "CircleSupplier_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSupplier" ADD CONSTRAINT "PlanSupplier_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSupplier" ADD CONSTRAINT "PlanSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CircleSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSupplier" ADD CONSTRAINT "PlanSupplier_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PlanTaskGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSupplierComment" ADD CONSTRAINT "PlanSupplierComment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PlanSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSupplierComment" ADD CONSTRAINT "PlanSupplierComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PlanSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUse" ADD CONSTRAINT "SupplierUse_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CircleSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUse" ADD CONSTRAINT "SupplierUse_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
