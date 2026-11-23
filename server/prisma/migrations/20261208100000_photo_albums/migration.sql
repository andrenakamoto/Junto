-- Album souvenir d'une soirée : tables nouvelles seulement
CREATE TABLE "PhotoAlbum" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "circleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "eventEnd" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "audienceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "noticeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoAlbum_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AlbumPhoto" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorId" TEXT,
    "deviceId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlbumPhoto_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AlbumPhotoLike" (
    "photoId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlbumPhotoLike_pkey" PRIMARY KEY ("photoId","deviceId")
);
CREATE UNIQUE INDEX "PhotoAlbum_planId_key" ON "PhotoAlbum"("planId");
CREATE UNIQUE INDEX "PhotoAlbum_token_key" ON "PhotoAlbum"("token");
CREATE INDEX "PhotoAlbum_expiresAt_idx" ON "PhotoAlbum"("expiresAt");
CREATE UNIQUE INDEX "AlbumPhoto_key_key" ON "AlbumPhoto"("key");
CREATE INDEX "AlbumPhoto_albumId_createdAt_idx" ON "AlbumPhoto"("albumId", "createdAt");
CREATE INDEX "AlbumPhoto_albumId_deviceId_idx" ON "AlbumPhoto"("albumId", "deviceId");
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumPhoto" ADD CONSTRAINT "AlbumPhoto_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumPhotoLike" ADD CONSTRAINT "AlbumPhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "AlbumPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
