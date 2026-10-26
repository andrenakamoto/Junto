-- Découvrir : image d'un événement (Eventfrog), copie réduite gardée sur le serveur
ALTER TABLE "DiscoverEvent" ADD COLUMN "imageKey" TEXT;
ALTER TABLE "DiscoverEvent" ADD COLUMN "imageCredit" TEXT;
ALTER TABLE "DiscoverEvent" ADD COLUMN "imageSource" TEXT;
