-- « Cacher à… » / « Réservé à… » et surprise facultative (2026-10-24)
ALTER TABLE "Plan" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'hidden';
ALTER TABLE "Plan" ADD COLUMN "surprise" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CirclePoll" ADD COLUMN "surprise" BOOLEAN NOT NULL DEFAULT true;
