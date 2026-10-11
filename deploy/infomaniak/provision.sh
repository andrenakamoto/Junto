#!/usr/bin/env bash
# Installation du serveur EvLY chez Infomaniak (VPS Lite, Ubuntu 24.04), à lancer une seule fois en root :
#   ssh -i ~/.ssh/evly_infomaniak ubuntu@<IP> 'sudo bash -s' < deploy/infomaniak/provision.sh
# Relançable sans risque : chaque étape vérifie si elle est déjà faite.
# Installe : mises à jour automatiques, pare-feu, fail2ban, Node 22, PostgreSQL, nginx, certbot, ffmpeg ;
# crée l'utilisateur « evly », la base « evly » (mot de passe aléatoire, jamais affiché) et clone le dépôt.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REPO=https://github.com/andrenakamoto/Junto.git
# Fichiers du kit : ceux du dépôt cloné, ou SRC=… (copie envoyée avant le premier commit)
SRC=${SRC:-/srv/evly/app/deploy/infomaniak}

echo '== Paquets'
apt-get update -q
apt-get -y -q upgrade
apt-get install -y -q curl git ufw fail2ban unattended-upgrades nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx ffmpeg ca-certificates openssl
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
timedatectl set-timezone Europe/Zurich
dpkg-reconfigure -f noninteractive unattended-upgrades
# Politique de confidentialité : journaux du serveur gardés 7 jours (systemd et nginx)
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nMaxRetentionSec=7day\n' > /etc/systemd/journald.conf.d/evly.conf
systemctl restart systemd-journald
sed -i 's/^\s*rotate [0-9]*/\trotate 7/; s/^\s*weekly/\tdaily/' /etc/logrotate.d/nginx

echo '== Pare-feu (SSH, HTTP, HTTPS seulement)'
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

echo '== Utilisateur evly'
id evly >/dev/null 2>&1 || adduser --system --group --home /srv/evly --shell /bin/bash evly
install -d -o evly -g evly -m 750 /srv/evly /srv/evly/backups /srv/evly/files
# nginx (www-data) lit le site construit dans /srv/evly/site
usermod -aG evly www-data
install -d -o root -g evly -m 750 /etc/evly
# Même clé d'accès que le compte d'administration (celle du Mac) pour les mises en ligne
install -d -o evly -g evly -m 700 /srv/evly/.ssh
install -o evly -g evly -m 600 "$(getent passwd "${SUDO_USER:-ubuntu}" | cut -d: -f6)/.ssh/authorized_keys" /srv/evly/.ssh/authorized_keys

echo '== Base de données'
if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='evly'" | grep -q 1; then
  PW=$(openssl rand -hex 24)
  sudo -u postgres psql -q -c "create role evly login password '$PW'"
  sudo -u postgres createdb -O evly evly
  umask 077
  echo "DATABASE_URL=postgresql://evly:$PW@localhost:5432/evly" > /etc/evly/database.env
  chown root:evly /etc/evly/database.env && chmod 640 /etc/evly/database.env
  unset PW
fi

echo '== Code'
if [ ! -d /srv/evly/app/.git ]; then
  sudo -u evly git clone -q "$REPO" /srv/evly/app
fi

echo '== Service, nginx, sauvegardes'
install -m 644 "$SRC/evly-api.service" /etc/systemd/system/evly-api.service
install -m 644 "$SRC/nginx-evly.conf" /etc/nginx/sites-available/evly.conf
ln -sf /etc/nginx/sites-available/evly.conf /etc/nginx/sites-enabled/evly.conf
rm -f /etc/nginx/sites-enabled/default
install -m 755 "$SRC/backup.sh" /usr/local/bin/evly-backup
install -m 755 "$SRC/offsite.sh" /usr/local/bin/evly-offsite
# Sauvegarde locale à 3 h 15, copie vers Swiss Backup à 3 h 45 (si /etc/evly/backup.env existe)
printf '15 3 * * * evly /usr/local/bin/evly-backup\n45 3 * * * evly [ -f /etc/evly/backup.env ] && /usr/local/bin/evly-offsite >> /srv/evly/backups/offsite.log 2>&1\n' > /etc/cron.d/evly-backup
apt-get install -y -q rclone >/dev/null
# Le compte evly peut redémarrer son service (mise en ligne), rien d'autre
echo 'evly ALL=(root) NOPASSWD: /bin/systemctl restart evly-api, /bin/systemctl reload nginx' > /etc/sudoers.d/evly
chmod 440 /etc/sudoers.d/evly
systemctl daemon-reload
systemctl enable evly-api >/dev/null
nginx -t && systemctl reload nginx

echo
echo 'Terminé. Étapes suivantes : /etc/evly/app.env (variables de Railway), deploy.sh, certificats HTTPS.'
