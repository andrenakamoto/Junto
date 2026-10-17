-- Notifications des discussions de Cercle : activées par défaut (2026-10-17), y compris pour les comptes existants
ALTER TABLE "User" ALTER COLUMN "circleChatPush" SET DEFAULT true;
UPDATE "User" SET "circleChatPush" = true;

-- Canal des notifications : « push » par défaut (2026-10-17), pour tous les comptes restés sur l'ancien défaut « push + email »
-- (« email uniquement », un choix explicite, est gardé). Sans téléphone avec l'app, les emails partent en secours (lib/notificationPrefs.ts).
ALTER TABLE "User" ALTER COLUMN "notificationChannel" SET DEFAULT 'push';
UPDATE "User" SET "notificationChannel" = 'push' WHERE "notificationChannel" = 'both';
