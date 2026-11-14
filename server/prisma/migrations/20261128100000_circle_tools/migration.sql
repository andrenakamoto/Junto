-- Outils du menu du Cercle : carnet des fournisseurs et inventaire du matériel (désactivés par défaut)
ALTER TABLE "Circle" ADD COLUMN "suppliersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Circle" ADD COLUMN "equipmentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Cercles d'une Organisation : activés
UPDATE "Circle" SET "suppliersEnabled" = true, "equipmentEnabled" = true WHERE "organisationId" IS NOT NULL;

-- Cercles qui s'en servent déjà : gardés
UPDATE "Circle" c SET "suppliersEnabled" = true
WHERE EXISTS (SELECT 1 FROM "CircleSupplier" s WHERE s."circleId" = c."id")
   OR EXISTS (SELECT 1 FROM "Plan" p WHERE p."circleId" = c."id" AND 'fournisseurs' = ANY(p."enabledFeatures"));
UPDATE "Circle" c SET "equipmentEnabled" = true
WHERE EXISTS (SELECT 1 FROM "EquipmentItem" e WHERE e."circleId" = c."id")
   OR EXISTS (SELECT 1 FROM "Plan" p WHERE p."circleId" = c."id" AND 'materiel' = ANY(p."enabledFeatures"));
