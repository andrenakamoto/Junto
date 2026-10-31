-- Assemblée : présents qui votent sur papier, et bulletins papier saisis par l'organisateur
ALTER TABLE "AssemblyAttendance" ADD COLUMN "paper" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssemblyBallot" ADD COLUMN "paper" BOOLEAN NOT NULL DEFAULT false;
