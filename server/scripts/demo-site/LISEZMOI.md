# Données de la démo du site (/demo)

La démo sans compte (`client/src/lib/demo.ts`) rejoue de vraies réponses du serveur,
enregistrées dans `client/public/demo/data.json` (+ photos dans `client/public/demo/photos/`).
À régénérer quand l'API change de forme (nouveaux champs, nouveaux écrans).

**Toujours sur une base jetable, jamais en production** (voir CLAUDE.md, « Tester contre une
base jetable »). Personnes, Cercles et Plans entièrement fictifs.

1. Base jetable Docker (port 55432) + `npx prisma migrate deploy` avec
   `DATABASE_URL=postgresql://postgres:test@localhost:55432/evly_test`.
2. Serveur avec photos simulées (Cloudinary est désactivé en local), depuis `server/` :
   `DATABASE_URL=… JWT_SECRET=test-secret PORT=3999 npx ts-node-dev --transpile-only -r ./scripts/demo-site/fake-cloudinary.js src/index.ts`
3. Données fictives : `NODE_PATH=$PWD/node_modules node scripts/demo-site/seed.js`
   (écrit `ids.json` à côté, à ne pas commiter).
4. Enregistrement : `node scripts/demo-site/capture.js ../client/public/demo`
5. Supprimer les anciennes photos de `client/public/demo/photos/` qui ne servent plus.

Les dates sont décalées au chargement de la démo (en jours entiers) pour rester à venir.
