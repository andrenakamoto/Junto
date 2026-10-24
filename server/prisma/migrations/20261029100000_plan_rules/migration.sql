-- Règles d'un Plan (2026-10-24) : qui ajoute des photos et fichiers, qui invite des personnes extérieures ;
-- personnes retirées d'un Plan (exclusion marquée « removed », jamais montrée comme un Plan caché)
ALTER TABLE "Plan" ADD COLUMN "filesMode" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "Plan" ADD COLUMN "guestInviteMode" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "PlanExclusion" ADD COLUMN "removed" BOOLEAN NOT NULL DEFAULT false;
