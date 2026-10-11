# Hébergement d'EvLY chez Infomaniak (Suisse)

Remplace Railway (serveur + base) et Vercel (site). Un VPS Lite Ubuntu 24.04 :
nginx (www.evly.ch, api.evly.ch), Node 22 (service `evly-api`), PostgreSQL 18 local, fichiers des Plans dans
`/srv/evly/files`, emails par le SMTP Infomaniak (noreply@evly.ch), sauvegarde quotidienne de la base
(`/srv/evly/backups`, 14 jours) copiée avec les fichiers sur Swiss Backup (bucket `evly-sauvegardes`). Clé d'accès du Mac : `~/.ssh/evly_infomaniak`.

| Fichier | Rôle |
|---|---|
| `provision.sh` | Installation unique du serveur (root), relançable |
| `evly-api.service` | Service systemd du serveur Node (`ENABLE_CRON=true`) |
| `nginx-evly.conf` | Site, API, redirections et en-têtes (ex-`client/vercel.json`) |
| `deploy.sh` | Mise en ligne : `git pull`, `prisma migrate deploy`, builds, redémarrage |
| `backup.sh` | Sauvegarde quotidienne (`pg_dump`, 3 h 15) |
| `offsite.sh` | Copie vers Swiss Backup (S3, 3 h 45) : base 30 jours + fichiers ; accès dans `/etc/evly/backup.env` |

Variables : `/etc/evly/database.env` (base locale, créée par provision.sh) et `/etc/evly/app.env`
(reprises de Railway, sans `DATABASE_URL`, `PORT` ni `RAILWAY_*`). Jamais dans le dépôt.

Mettre en ligne depuis le Mac :
`ssh -i ~/.ssh/evly_infomaniak evly@<IP> 'bash /srv/evly/app/deploy/infomaniak/deploy.sh'`
