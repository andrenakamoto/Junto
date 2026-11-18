-- « Se déconnecter de tous les appareils » (lib/sessions.ts)
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
