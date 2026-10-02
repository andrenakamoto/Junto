-- CreateTable
CREATE TABLE "CircleChangeLog" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,

    CONSTRAINT "CircleChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleChangeLog_circleId_idx" ON "CircleChangeLog"("circleId");

-- AddForeignKey
ALTER TABLE "CircleChangeLog" ADD CONSTRAINT "CircleChangeLog_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleChangeLog" ADD CONSTRAINT "CircleChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

