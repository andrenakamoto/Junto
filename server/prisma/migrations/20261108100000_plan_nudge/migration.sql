-- Relance des membres qui n'ont pas répondu à un Plan (une fois par jour)
ALTER TABLE "Plan" ADD COLUMN "lastNudgeAt" TIMESTAMP(3);
