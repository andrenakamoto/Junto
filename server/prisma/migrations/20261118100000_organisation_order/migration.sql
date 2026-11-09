-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "orgPosition" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "fixedOrder" BOOLEAN NOT NULL DEFAULT true;
