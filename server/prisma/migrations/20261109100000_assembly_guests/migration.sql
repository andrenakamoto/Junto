-- Assemblée : participants sans EvLY ajoutés à la main par l'organisateur
CREATE TABLE "AssemblyGuest" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "isVoter" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssemblyGuest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssemblyGuest_assemblyId_idx" ON "AssemblyGuest"("assemblyId");
ALTER TABLE "AssemblyGuest" ADD CONSTRAINT "AssemblyGuest_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;
