-- CreateTable
CREATE TABLE "DiscoverSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "region" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "license" TEXT,
    "licenseUrl" TEXT,
    "attribution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "category" TEXT NOT NULL,
    "family" BOOLEAN NOT NULL DEFAULT false,
    "priceText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "multiDay" BOOLEAN NOT NULL DEFAULT false,
    "dateLabel" TEXT,
    "url" TEXT,
    "state" TEXT NOT NULL DEFAULT 'published',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverPlace" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "city" TEXT,
    "website" TEXT NOT NULL,
    "family" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "city" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverSource_key_key" ON "DiscoverSource"("key");

-- CreateIndex
CREATE INDEX "DiscoverEvent_region_state_startAt_idx" ON "DiscoverEvent"("region", "state", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverEvent_sourceId_externalId_key" ON "DiscoverEvent"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "DiscoverPlace_region_state_idx" ON "DiscoverPlace"("region", "state");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverPlace_sourceId_externalId_key" ON "DiscoverPlace"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "ProInterest_createdAt_idx" ON "ProInterest"("createdAt");

-- AddForeignKey
ALTER TABLE "DiscoverEvent" ADD CONSTRAINT "DiscoverEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscoverSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverPlace" ADD CONSTRAINT "DiscoverPlace_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscoverSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProInterest" ADD CONSTRAINT "ProInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

