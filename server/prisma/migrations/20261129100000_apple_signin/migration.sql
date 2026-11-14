-- Connexion avec Apple
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;
ALTER TABLE "User" ADD COLUMN "appleRefreshToken" TEXT;
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
