#!/usr/bin/env bash
# Sauvegarde quotidienne de la base EvLY (cron 3 h 15, /etc/cron.d/evly-backup) : 14 derniers jours gardés.
set -euo pipefail
. /etc/evly/database.env
mkdir -p /srv/evly/backups
pg_dump --format=custom --no-owner "$DATABASE_URL" > "/srv/evly/backups/evly-$(date +%Y-%m-%d).dump"
ls -1t /srv/evly/backups/evly-*.dump | tail -n +15 | xargs -r rm -f
