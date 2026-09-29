-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CHF';

-- AlterTable
ALTER TABLE "Reimbursement" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CHF';


-- Jusqu'ici toutes les dépenses étaient affichées en euros : elles le restent
UPDATE "Expense" SET "currency" = 'EUR';
UPDATE "Reimbursement" SET "currency" = 'EUR';
