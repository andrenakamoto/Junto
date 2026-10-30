# Données de la démo du site (/demo)

La démo sans compte (`client/src/lib/demo.ts`) rejoue de vraies réponses du serveur,
enregistrées dans `client/public/demo/data.json` (+ photos dans `client/public/demo/photos/`).
À régénérer quand l'API change de forme (nouveaux champs, nouveaux écrans).

**Toujours sur une base jetable, jamais en production** (voir CLAUDE.md, « Tester contre une
base jetable »). Personnes, Cercles et Plans entièrement fictifs.

1. Base jetable Docker (port 55432) + `npx prisma migrate deploy` avec
   `DATABASE_URL=postgresql://postgres:test@localhost:55432/evly_test`.
2. Serveur de test, depuis `server/` (les photos vont dans `server/storage/`, ignoré par git) :
   `DATABASE_URL=… JWT_SECRET=test-secret PORT=3999 npx ts-node-dev --transpile-only src/index.ts`
3. Images fictives (affiches, programme, plan du site) : `PW=<playwright-core> node scripts/demo-site/affiches.js`
   (déjà fournies ; à relancer seulement si `affiches.html` change).
4. Données fictives : `NODE_PATH=$PWD/node_modules node scripts/demo-site/seed.js`
   (écrit `ids.json` à côté, à ne pas commiter).
5. Enregistrement : `node scripts/demo-site/capture.js ../client/public/demo`
6. Supprimer les anciennes photos de `client/public/demo/photos/` qui ne servent plus.

PDF de l'assemblée (procès-verbal et récapitulatif, dans `client/public/demo/pdf/`) : sur une base fraîchement remplie par
`seed.js`, `NODE_PATH=$PWD/node_modules node scripts/demo-site/pdf.js ../client/public/demo/pdf` (clôt l'assemblée : refaire
`seed.js` avant `capture.js`).

Ensuite : `python3 client/scripts/demo-i18n.py` (traductions ; compléter `ROWS` pour tout nouveau texte — la liste des
textes manquants s'obtient en comparant les chaînes de `data.json` aux clés de `i18n.json`).

Les dates sont décalées au chargement de la démo (en jours entiers) pour rester à venir.
