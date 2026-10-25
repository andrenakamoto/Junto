-- Position des idées de sorties (recherche par lieu et rayon dans Découvrir)
ALTER TABLE "DiscoverPlace" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "DiscoverPlace" ADD COLUMN "longitude" DOUBLE PRECISION;
