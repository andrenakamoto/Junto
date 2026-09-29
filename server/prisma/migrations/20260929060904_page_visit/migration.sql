-- CreateTable
CREATE TABLE "PageVisit" (
    "page" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("page","day")
);

