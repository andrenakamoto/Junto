-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "pollCreationMode" TEXT NOT NULL DEFAULT 'all';


-- Les Cercles qui réservaient déjà la création des Plans (et donc des sondages) la gardent pour les sondages
UPDATE "Circle" SET "pollCreationMode" = 'creator' WHERE "planCreationMode" = 'creator';
