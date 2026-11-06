-- Fournisseurs : « Mis de côté » garde l'étape (remplace l'état « dropped ») et historique réel des changements
ALTER TABLE "PlanSupplier" ADD COLUMN "onHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanSupplier" ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';

-- Anciens « abandonnés » : mis de côté, repartent de « À contacter » (l'étape d'avant n'était pas gardée)
UPDATE "PlanSupplier" SET "onHold" = true, "status" = 'todo' WHERE "status" = 'dropped';
UPDATE "SupplierUse" SET "status" = 'on_hold' WHERE "status" = 'dropped';
