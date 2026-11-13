-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "companionsMax" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "PlanMember" ADD COLUMN     "partySize" INTEGER NOT NULL DEFAULT 1;
