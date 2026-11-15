-- Fournisseurs : devis, montants et documents visibles par les organisateurs seulement (défaut) ou par tous les participants du Plan
ALTER TABLE "Plan" ADD COLUMN "supplierVisibility" TEXT NOT NULL DEFAULT 'managers';
