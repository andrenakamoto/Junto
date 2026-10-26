-- Découvrir : recherche par canton (code ISO calculé d'après la position)
ALTER TABLE "DiscoverEvent" ADD COLUMN "canton" TEXT;
ALTER TABLE "DiscoverPlace" ADD COLUMN "canton" TEXT;
CREATE INDEX "DiscoverEvent_canton_state_startAt_idx" ON "DiscoverEvent"("canton", "state", "startAt");
CREATE INDEX "DiscoverPlace_canton_state_idx" ON "DiscoverPlace"("canton", "state");
