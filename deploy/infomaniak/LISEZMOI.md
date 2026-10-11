# Hébergement d'EvLY chez Infomaniak (Suisse)

Remplace Railway (serveur + base) et Vercel (site). Un VPS Lite Ubuntu 24.04 :
nginx (www.evly.ch, api.evly.ch), Node 22 (service `evly-api`), PostgreSQL local, sauvegarde
quotidienne de la base (`/srv/evly/backups`, 14 jours). Clé d'accès du Mac : `~/.ssh/evly_infomaniak`.

| Fichier | Rôle |
|---|---|
| `provision.sh` | Installation unique du serveur (root), relançable |
| `evly-api.service` | Service systemd du serveur Node (`ENABLE_CRON=true`) |
| `nginx-evly.conf` | Site, API, redirections et en-têtes (ex-`client/vercel.json`) |
| `deploy.sh` | Mise en ligne : `git pull`, `prisma migrate deploy`, builds, redémarrage |
| `backup.sh` | Sauvegarde quotidienne (`pg_dump`) |

Variables : `/etc/evly/database.env` (base locale, créée par provision.sh) et `/etc/evly/app.env`
(reprises de Railway, sans `DATABASE_URL`, `PORT` ni `RAILWAY_*`). Jamais dans le dépôt.

Mettre en ligne depuis le Mac :
`ssh -i ~/.ssh/evly_infomaniak evly@<IP> 'bash /srv/evly/app/deploy/infomaniak/deploy.sh'`
