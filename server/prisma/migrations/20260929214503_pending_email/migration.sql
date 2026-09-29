-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "pendingEmailExpires" TIMESTAMP(3),
ADD COLUMN     "pendingEmailToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmailToken_key" ON "User"("pendingEmailToken");

