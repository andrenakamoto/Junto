#!/usr/bin/env bash
# Mise en ligne d'EvLY sur le serveur Infomaniak (remplace le déploiement automatique de Railway et Vercel).
# Depuis le Mac :  ssh -i ~/.ssh/evly_infomaniak evly@<IP> 'bash /srv/evly/app/deploy/infomaniak/deploy.sh'
# Récupère main, construit le serveur et le site, applique les migrations Prisma (jamais « db push »),
# redémarre le service. S'arrête à la première erreur : la version en ligne reste alors celle d'avant.
set -euo pipefail
cd /srv/evly/app
git fetch -q origin main
git reset -q --hard origin/main
echo "== Version $(git log -1 --format='%h %s')"

# Base locale pour les migrations (app.env n'est lu que par le service : valeurs avec espaces et < >)
set -a; . /etc/evly/database.env; set +a

echo '== Serveur'
cd server
npm ci --no-audit --no-fund --loglevel=error
npx prisma migrate deploy
npm run build --silent

echo '== Site'
cd ../client
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent
# Publication atomique du site : nginx sert /srv/evly/site (lien vers la dernière version construite)
STAMP=$(date +%Y%m%d%H%M%S)
mkdir -p /srv/evly/releases
cp -r dist "/srv/evly/releases/$STAMP"
ln -sfn "/srv/evly/releases/$STAMP" /srv/evly/site
ls -1dt /srv/evly/releases/* | tail -n +4 | xargs -r rm -rf

echo '== Redémarrage'
sudo /bin/systemctl restart evly-api
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3001/health >/dev/null && { echo 'En ligne.'; exit 0; }; sleep 1; done
echo 'Le serveur ne répond pas : journalctl -u evly-api -n 80'; exit 1
