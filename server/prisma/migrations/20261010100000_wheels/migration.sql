-- CreateTable
CREATE TABLE "Wheel" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdById" TEXT,
    "excludedUserIds" TEXT[],
    "noRepeat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wheel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WheelSpin" (
    "id" TEXT NOT NULL,
    "wheelId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "candidateIds" TEXT[],
    "excludedIds" TEXT[],
    "skippedIds" TEXT[],
    "spunById" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelSpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wheel_planId_idx" ON "Wheel"("planId");

-- CreateIndex
CREATE INDEX "WheelSpin_wheelId_idx" ON "WheelSpin"("wheelId");

-- AddForeignKey
ALTER TABLE "Wheel" ADD CONSTRAINT "Wheel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "Wheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

