#!/usr/bin/env bash
# Copie hors du serveur, chaque nuit après backup.sh (cron 3 h 45) : vers Swiss Backup (S3, Infomaniak, Suisse).
# - base/     : sauvegardes quotidiennes de la base, gardées 30 jours
# - fichiers/ : photos, documents et messages vocaux (miroir : un fichier supprimé avec son Plan l'est aussi
#               ici) ; miniatures et MP3 exclus, le serveur les refait à la demande
# Accès : /etc/evly/backup.env (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY), jamais dans le dépôt.
set -euo pipefail
. /etc/evly/backup.env
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_SB_TYPE=s3 RCLONE_CONFIG_SB_PROVIDER=Other RCLONE_CONFIG_SB_REGION=us-east-1
export RCLONE_CONFIG_SB_ENDPOINT="$S3_ENDPOINT" RCLONE_CONFIG_SB_ACCESS_KEY_ID="$S3_ACCESS_KEY" RCLONE_CONFIG_SB_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
BUCKET=sb:evly-sauvegardes
rclone mkdir "$BUCKET"
rclone copy /srv/evly/backups "$BUCKET/base" --include "*.dump"
rclone delete "$BUCKET/base" --min-age 30d
rclone sync /srv/evly/files "$BUCKET/fichiers" --exclude "*.w[0-9]*" --exclude "*.*.mp3"
echo "Sauvegarde externe terminée : $(date '+%Y-%m-%d %H:%M')"
