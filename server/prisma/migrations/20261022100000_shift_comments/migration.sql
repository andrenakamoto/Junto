-- AlterTable
ALTER TABLE "VolunteerShift" ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "doneById" TEXT;

-- CreateTable
CREATE TABLE "VolunteerShiftComment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerShiftComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerShiftComment_shiftId_idx" ON "VolunteerShiftComment"("shiftId");

-- AddForeignKey
ALTER TABLE "VolunteerShift" ADD CONSTRAINT "VolunteerShift_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShiftComment" ADD CONSTRAINT "VolunteerShiftComment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "VolunteerShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShiftComment" ADD CONSTRAINT "VolunteerShiftComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

