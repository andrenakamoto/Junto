# EvLY / Junto

Application web sociale nommée **Junto** en interne (repo, packages, sous-domaine
API) mais rebrandée **EvLY** côté utilisateur final (titre de page, logo,
textes UI). Slogan : "Events Linked to You". Les deux noms (Junto/EvLY)
coexistent dans le code — ne pas essayer de "corriger" l'un ou l'autre sans
demander.

L'app s'appelait "Estelle" jusqu'au 2026-08-23, date du rebranding vers
"EvLY" (nom de domaine **evly.ch** acheté sur Infomaniak). La migration de
domaine est terminée le 2026-08-23 : DNS, Vercel, CORS et emails (Resend)
pointent tous vers evly.ch, voir section Déploiement pour le détail.
**estelle.fan a été volontairement coupé le 2026-08-23** (CORS backend,
OAuth Google, domaine retiré de Vercel — voir section Déploiement) ; ne
pas le rebrancher sans demander. L'`appId` Capacitor (`com.estelle.app`)
et le dossier Cloudinary (`estelle/`) restent inchangés, non liés au nom
de domaine.

Repo GitHub : https://github.com/andrenakamoto/Junto (branche main)
Toute la communication utilisateur (UI, commits, docs) est en **FRANÇAIS**.

## Concept

EvLY sert aux groupes de proches qui veulent se retrouver facilement.
Trois niveaux d'organisation :
- **Cercle** = le groupe (ex. "Les amis du lundi"), rejoint avec son **code d'accès seul**
  (depuis le 2026-10-03 : le nom est modifiable, il ne sert plus à rejoindre ; /join limité à
  20 tentatives / 15 min), par lien, QR code ou invitation d'un compte existant
  (lien `/rejoindre?code=XXXXXX[&planId=…&plan=…]` ; `JoinPage` affiche le nom actuel via
  GET /circles/by-code/:code — les anciens liens avec `name=` restent valables)
- **Plan** = le salon lié à un événement précis (ex. "Resto vendredi soir ?"),
  avec titre, description, date/heure, lieu
- **Chat** = messagerie temps réel à l'intérieur d'un Plan

Rejoindre un Plan = donner son accord explicite (RSVP : "Je suis in" /
"Peut-être" / "Je passe"), pas d'entrée silencieuse. Les Plans expirent
automatiquement après leur endDate (suppression auto toutes les heures côté
serveur, **en production uniquement** — voir section base de données).

Le fichier `concept.md` à la racine du repo contient le document produit
d'origine (vision v1 + roadmap v2) — le consulter si une feature demandée
touche à la vision produit. La majorité des idées "v2" du concept ont été
implémentées le 2026-08-23 (voir plus bas).

## ⚠️ Base de données — à lire avant toute manipulation Prisma

**Il n'existe pas de base de données de dev séparée.** Le `DATABASE_URL` dans
`server/.env` local pointe directement vers le Postgres Railway du projet
("radiant-spontaneity", service "Postgres", host gondola.proxy.rlwy.net) —
c'est-à-dire probablement la même base que la production. Toute commande
Prisma ou tout démarrage du serveur en local touche potentiellement de
vraies données.

Conséquences pratiques :

1. **Ne jamais lancer `prisma migrate dev` (sans `--create-only`) ni
   `prisma db push` en aveugle contre cette base.** Toujours :
   `npx prisma migrate dev --name <nom> --create-only` (génère la migration
   SANS l'appliquer) → **relire le SQL généré** (doit être additif : ADD
   COLUMN / CREATE TABLE, jamais DROP sans avoir vérifié avec l'utilisateur)
   → `npx prisma migrate deploy` pour appliquer proprement.
2. **Les jobs cron** (suppression des Plans expirés, rappels 24h avant un
   Plan, résumé hebdomadaire) **sont volontairement désactivés en local.**
   Ils ne tournent que si `RAILWAY_ENVIRONMENT_NAME` est présent (vrai
   déploiement Railway, jamais le cas en local) ou si `ENABLE_CRON=true`
   est positionné explicitement. Voir `server/src/index.ts`. Ne pas retirer
   cette protection — elle a été ajoutée après qu'un simple `npm run dev`
   local a failli marquer à tort un vrai rappel comme envoyé.
3. **`RESEND_API_KEY` n'est pas dans le `.env` local** (volontairement — il
   l'est sur Railway). `server/src/lib/mailer.ts` retombe sur une clé
   factice `'dev-placeholder'` pour que le serveur démarre quand même en
   local ; les emails échouent silencieusement en local (401), c'est normal
   et voulu. Le SDK Resend ne lève **pas** d'exception sur une clé invalide,
   il renvoie `{ data: null, error }` — toujours vérifier `result.error`,
   jamais supposer qu'un `await resend.emails.send()` qui ne throw pas a
   réussi.
   Nuance importante : seuls les **jobs cron** (rappels 24h, résumé
   hebdomadaire, suppression des Plans expirés) sont gated derrière
   `RAILWAY_ENVIRONMENT_NAME`/`ENABLE_CRON`. Les emails **déclenchés
   directement par une action utilisateur** (inscription, reset password,
   nouveau Plan créé, invitation par email) s'exécutent toujours,
   local ou prod — comme pour tout le reste, ils échoueront juste
   silencieusement en local faute de vraie clé Resend.
4. Avant de démarrer le serveur en local pour tester (`npm run dev` dans
   `server/`), garder à l'esprit que ça se connecte à la base réelle. C'est
   acceptable pour lire/tester des routes GET, mais réfléchir à deux fois
   avant toute opération qui écrit (créer un compte de test, un Cercle de
   test, etc.) — ça sera visible par de vrais utilisateurs.
5. L'historique de migrations (`server/prisma/migrations/`) a été
   reconstruit le 2026-08-23 (il était cassé depuis le tout premier commit,
   verrouillé sur sqlite alors que le schema est postgresql depuis toujours
   — Railway s'appuyait uniquement sur `prisma db push --accept-data-loss`
   au déploiement, donc ce problème ne s'était jamais exprimé). Il part
   d'une migration baseline (`20260823092506_baseline`) qui reflète le
   schema tel qu'il était avant cette date, marquée "déjà appliquée" sans
   avoir été exécutée. Ne pas supprimer ce dossier.
6. Le déploiement Railway (`server/railway.toml`) exécute
   `npx prisma db push --accept-data-loss && node dist/index.js` au
   démarrage — donc en prod, le schema se synchronise automatiquement
   depuis `schema.prisma` à chaque déploiement, indépendamment du dossier
   migrations. Garder `schema.prisma` et les migrations locales cohérents
   entre eux malgré tout, pour que les deux mécanismes (dev via migrate,
   prod via db push) ne divergent jamais.

## Stack technique

- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS, react-router-dom,
  axios, socket.io-client, lucide-react (icônes)
- **Charte couleur "Corail"** (2026-08-23) : la couleur de marque n'est
  **pas** une classe Tailwind dédiée — `client/tailwind.config.js` redéfinit
  directement l'échelle `indigo` (50→950) avec des tons corail. Toutes les
  classes `bg-indigo-*`/`text-indigo-*`/`border-indigo-*`/`from-indigo-*`
  du codebase en héritent automatiquement ; ne pas s'étonner de voir
  "indigo" dans le nom des classes alors que le rendu est corail — c'est
  volontaire, documenté ici pour éviter la confusion. Les couleurs
  codées en dur en hexadécimal (hors classes Tailwind) ont aussi été
  mises à jour à la main : `client/public/logo-evly.svg` (dégradé du
  logo), la couleur du QR code dans `InviteModal.tsx`, et les boutons
  dans les emails HTML côté serveur (`background:#ea5a2b`). Les couleurs
  sémantiques (emerald/amber/red pour succès/attention/danger) et la
  palette `CIRCLE_COLORS` (8 couleurs au choix pour un Cercle, dupliquée
  côté client et serveur) sont restées inchangées.
- **Thème clair** (2026-09-27) : les colonnes de navigation (Cercles,
  Plans, Tous mes plans, Calendrier) sont passées du sombre (slate-900/800)
  au clair — fond `slate-100`/`slate-50`, cartes blanches `shadow-sm` +
  bordure `slate-200`, liseré de couleur du Cercle à gauche, élément
  sélectionné en corail plein (`bg-indigo-600`, texte blanc). Logo en
  `LogoFull light`. Les pages d'authentification restent sombres.
  Depuis le 2026-09-29 : déconnexion en haut à droite de la barre latérale
  (à côté du logo, plus à côté du menu ☰), boutons « Créer un Cercle » /
  « Rejoindre un Cercle » sous « Mes Cercles » (retirés du menu), et
  « Créer un Plan » en bouton corail plein en bas de la liste des Plans.
- **Écrans peu hauts** : variante Tailwind `short:` (`max-height: 500px`,
  téléphone en paysage, définie dans `tailwind.config.js`). Colonnes et
  fiches (Plan, sondage) y défilent d'un bloc (`short:overflow-y-auto` sur
  la racine, `short:flex-none short:overflow-visible` sur les zones
  défilantes internes), onglets `short:sticky top-0`, saisie du chat et
  pieds de colonne `short:sticky bottom-0`. À appliquer à toute nouvelle
  colonne/fiche avec en-tête fixe.
- **Logo / wordmark** (2026-08-24) : plus d'icône dans l'app — la marque
  est un wordmark typographique pur, "**Ev**LY" avec "Ev" en italique fine
  (police **Fraunces**, `ital,wght@1,300`, blanc sur fond sombre / `#1e293b`
  sur fond clair via la prop `light`) et "LY" en gras (`wght@800`) dans le
  corail de marque `#ea5a2b`. Composant unique `client/src/components/ui/Logo.tsx`
  (`Wordmark`, exporté sous les noms historiques `LogoIcon`/`LogoFull` pour
  ne pas casser les ~9 points d'usage — `size`/`iconSize` contrôlent la
  taille en px, `light` inverse la couleur de "Ev" pour les fonds clairs,
  ex. l'empty state de DashboardPage). Police chargée dans `client/index.html`
  (a remplacé Playfair Display, qui n'est plus utilisée nulle part).
- **Brochure associations** (refaite le 2026-10-05, **associations uniquement** — la partie
  entreprises a été retirée à la demande de l'utilisateur) :
  `client/public/fichiers/evly-associations-entreprises.pdf` (6 pages A4, vouvoiement ; nom de
  fichier conservé pour les liens existants), liée sous « Découvrir EvLY en 1 minute » dans AuthPage via
  **`/brochure`**. Téléchargements comptés (2026-09-29) : `client/vercel.json`
  redirige `/brochure` et l'ancienne adresse `/evly-associations-entreprises.pdf`
  vers `GET /api/stats/go/brochure` (Railway), qui compte +1 dans PageVisit
  (`page = 'brochure'`, mêmes règles que ci-dessous, sans exclusion des
  personnes connectées) puis redirige vers le fichier dans `/fichiers/`
  (`TRACKED_FILES` dans `lib/pageVisits.ts`). Ne pas remettre le PDF à la
  racine de `public/` : la redirection de l'ancienne adresse bouclerait. Sources (HTML → PDF avec
  Playwright, captures réelles de l'app sur une base jetable, club fictif « Les Rayons », club
  cycliste de Carouge) dans **`~/Desktop/EvLY - Brochure associations (sources)/`** sur le Mac de
  l'utilisateur, avec un LISEZMOI pour tout régénérer (`seed-club.js`, `capture.js`, `build.js`).
  Annonce les apps iPhone / Android « prochainement » (p. 1 et FAQ) : à mettre à jour à leur
  publication. La régénérer quand une fonctionnalité mise en avant change.
- **Conditions d'utilisation** : `client/src/components/ui/TermsModal.tsx`
  (version 4 du 2026-10-09, réécrite à la demande de l'utilisateur pour « bien le protéger », 26 articles
  numérotés automatiquement depuis `SECTIONS`) : en plus de la v3, réponses sans compte, **responsabilité des
  organisations** (usage du Service, données de leurs membres au sens de la nLPD), « Signaler » / masquer,
  **rôle d'hébergeur** (aucun contrôle préalable), participation aux événements **à ses propres risques**,
  **Assemblées et votes** (statuts et Code civil font foi, convocation EvLY ≠ forme statutaire, vote secret non
  certifié, PV à relire et signer, nom de famille dans le PV), **Jeux et tirages au sort**, notifications sans
  garantie de réception, **aucune garantie de sauvegarde**, services de tiers, pas d'usage critique, propriété
  intellectuelle et suggestions, limitation de responsabilité **avec la réserve de l'art. 100 CO** (faute
  intentionnelle / grave négligence — sans elle, la clause risquerait d'être annulée), force majeure,
  dispositions finales. `CURRENT_TERMS_VERSION` = 4 : tout le monde les accepte à nouveau. Non relues par un
  juriste.
- **Guide d'utilisation** : `client/src/components/ui/GuideModal.tsx` (menu ☰), refait le 2026-10-09 :
  synthèse « EvLY en bref », sommaire cliquable, puis une fiche dépliable par fonction, rangées par thème
  (`GROUPS` : Les bases, Dans un Plan, Fonctions à activer, Rester informé, Règles et organisation, Garder une
  trace, Ton compte). **Y ajouter une fiche pour toute nouvelle fonction.** La version acceptée est
  `User.acceptedTermsVersion`, comparée à `CURRENT_TERMS_VERSION`
  (`server/src/routes/auth.ts`) : l'incrémenter redemande l'acceptation à
  tout le monde à la prochaine ouverture de l'app — à faire pour toute
  modification substantielle, en même temps que la date affichée dans la
  modale.
- **Politique de confidentialité** (nLPD, publiée le 2026-09-28) :
  `client/src/pages/PrivacyPage.tsx`, route publique `/confidentialite`,
  liée depuis AuthPage (pied de page), TermsModal et le menu de la barre
  latérale. Tableau des prestataires (`processors`) avec pays et garantie
  de transfert (DPF ou clauses contractuelles). **La mettre à jour** (et
  sa constante `VERSION`) à chaque nouveau prestataire, nouvelle donnée
  collectée ou changement de région d'hébergement (Railway est en `sfo`,
  États-Unis ; journaux conservés 7 jours en abonnement Hobby).
- **Fiche promo publique** : `client/public/decouvrir.html` (servie telle
  quelle par Vercel sur `evly.ch/decouvrir.html`, liée depuis AuthPage
  « Découvrir EvLY en 1 minute »). Page HTML autonome, imprimable sur
  une page A4, refaite le 2026-09-28 en version **visuelle** (~100 mots :
  pictos Cercle → Plan → Chat, « avant/après » WhatsApp vs carte de Plan,
  6 tuiles de fonctions, icônes Lucide inlinées en SVG), avec boutons
  « Créer mon compte » en haut et en bas (masqués à l'impression), qui
  pointent vers `/auth?mode=inscription` (AuthPage ouvre alors l'onglet
  inscription). L'ancienne version texte
  (comparatif en 10 lignes) est dans l'historique git. **Plus de capture de
  l'app** depuis le 2026-10-01, à la demande de l'utilisateur (« garder la
  surprise ») : la section « Dans l'app » et `decouvrir-app.jpg` ont été
  retirées ; seule la carte de Plan dessinée de « La même soirée » donne un
  aperçu. Ne pas en remettre sans demander. Imprimée, elle tient sur
  **une page A4** (`@media print` resserre la marge du haut et les titres
  de section). Pas d'ombres
  portées (`box-shadow`) dans la fiche : les lecteurs PDF les rendent en
  rectangles gris. La tenir à jour quand une fonctionnalité
  importante est ajoutée.
  **Compteur de visites** (2026-09-29) : un petit script en bas de
  `decouvrir.html` fait `navigator.sendBeacon` vers `POST
  /api/stats/visit?page=decouvrir` (`routes/stats.ts`, public, URL de l'API
  Railway codée en dur dans la page ; rien n'est envoyé hors evly.ch, sauf
  vers localhost:3999 en local ; ignoré si `estelle_token` est présent, donc
  pour les personnes connectées). Le serveur n'enregistre qu'un +1 dans
  **PageVisit** (page + jour à l'heure suisse + total) : ni cookie, ni IP,
  ni identifiant ; robots écartés par user-agent (y compris HeadlessChrome,
  donc Playwright ne compte pas sans `userAgent` forcé) ; `visitLimiter`
  (10/h par connexion, en mémoire). Affiché dans AdminPage
  (`components/admin/PageVisitsPanel.tsx`, GET /admin/page-visits?page=…,
  30 jours, un panneau pour la fiche et un pour la brochure).
  La politique de confidentialité le mentionne : le garder « anonyme » —
  toute donnée par visiteur supplémentaire imposerait de la réécrire.
  `client/public/logo-evly.svg` (l'ancienne icône badge) ne sert plus
  qu'au favicon — remplacé par un simple monogramme "EV" sur le dégradé
  corail, lisible à 16px.
- **Backend** : Node.js + Express + TypeScript, ts-node-dev en dev
- **Base de données** : PostgreSQL via Prisma ORM (migrations dans
  `server/prisma/migrations` — voir section base de données ci-dessus)
- **Temps réel** : Socket.io (chat, présence, réactions)
- **Tests** : Vitest côté serveur (`npm test` dans `server/`), limité pour
  l'instant aux fonctions pures (pas d'intégration DB, voir section tests)
- **Auth** : JWT + bcrypt, connexion par pseudo OU email (**insensible à la casse** : emails
  enregistrés en minuscules, pseudo cherché en `mode: 'insensitive'`, unicité via `isPseudoTaken`
  dans `lib/pseudo.ts` ; idem pour l'invitation à un Cercle et les @mentions), + Google Sign-In
  (google-auth-library côté serveur, qui vérifie un ID token). Côté client :
  **sur le web, Google Identity Services** (`GoogleWebButton.tsx`, script
  `accounts.google.com/gsi/client?hl=fr`, bouton officiel rendu par Google) ;
  **uniquement en natif**, @codetrix-studio/capacitor-google-auth. Ne pas
  réutiliser ce plugin sur le web : il s'appuie sur `gapi.auth2`, abandonné
  par Google, et la connexion Google du site était cassée pour cette raison
  (corrigé le 2026-09-27). Les origines `https://www.evly.ch` et
  `https://evly.ch` sont autorisées pour le client OAuth ; `localhost` ne
  l'est pas (le bouton s'affiche en local mais Google refuse la connexion). Rate limiting sur les routes sensibles (express-rate-limit).
- **Fichiers joints** : Cloudinary (upload, download via proxy backend + token
  JWT temporaire pour contourner les limitations mobile/Cloudinary). Depuis le
  2026-09-27 (conformité nLPD) : **l'URL Cloudinary ne sort jamais du serveur**
  (ni dans GET /plans/:id, ni à l'upload). Le client affiche via
  `GET /api/attachments/:id/view?t=<mediaToken>[&w=<largeur>]` (proxy, `w` =
  miniature via transformation Cloudinary) ; `mediaToken` (JWT 12 h,
  `lib/mediaToken.ts`) est fourni par GET/PUT /plans/:id aux seuls
  utilisateurs qui voient le Plan. **Toute suppression de Plan ou de Cercle
  doit appeler `purgePlanFiles`/`purgeCircleFiles` (`lib/cloudinary.ts`)
  AVANT la suppression en base** — sinon les fichiers restent en ligne
  indéfiniment (c'était le cas avant cette date : des fichiers orphelins de
  Plans déjà supprimés existent donc chez Cloudinary). Les identifiants
  Cloudinary de `server/.env` pointent vers un compte **désactivé**
  (« cloud_name is disabled ») : les vrais sont sur Railway, impossible de
  tester Cloudinary en local.
- **Chiffrement des messages** (2026-09-28) : `Message.content` et
  `CirclePollMessage.content` sont chiffrés en base (AES-256-GCM,
  `server/src/lib/messageCrypto.ts`, format `enc1:<base64>`), clé
  `MESSAGE_ENCRYPTION_KEY` (32 octets base64) **sur Railway uniquement**.
  **Toute nouvelle écriture d'un message passe par `encryptMessage`, toute
  lecture renvoyée au client par `withPlainContent`.** Au démarrage,
  `encryptLegacyMessages` (`lib/messageBackfill.ts`) chiffre ce qui est
  encore en clair. Pas de bout en bout : le serveur déchiffre. En local
  (pas de clé), les nouveaux messages sont écrits en clair et les messages
  chiffrés s'affichent « [Message illisible] » — le serveur de prod les
  rechiffre à son prochain démarrage. Perdre ou changer la clé rend les
  messages existants illisibles (pas de rotation prévue). Les emails de
  mention ne contiennent plus le texte du message.
- **Emails** : Resend (vérification email, reset password, rappels de Plan,
  résumé hebdomadaire)
- **SMS** : Twilio (optionnel, invitations)
- **Apps Android / iOS** (2026-10-01) : Capacitor 8, identifiant **`ch.evly.app`**
  (définitif une fois publié ; remplace `com.estelle.app`, jamais publié — anciens
  dossiers sauvegardés dans `~/Desktop/EvLY - Sauvegarde projets mobiles (avant
  ch.evly.app)/`). L'app web (`dist`) est embarquée et appelle l'API de prod
  (`.env.production`) ; CORS autorise déjà `https://localhost` (Android) et
  `capacitor://localhost` (iOS). Points clés :
  - **Le CLI Capacitor 8 exige Node ≥ 22** (le Mac a Node 20) : lancer
    `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync|run …`
    depuis `client/` (sans changer le Node du système).
  - **Gradle : utiliser le JDK d'Android Studio** (`JAVA_HOME="/Applications/
    Android Studio.app/Contents/jbr/Contents/Home"`), le Java du système (26)
    est trop récent. `./gradlew assembleDebug` (APK de test) /
    `bundleRelease` (AAB signé pour le Play Store).
  - **Signature Android** : clé `~/Documents/estelle-keystore.jks`, mots de
    passe dans `client/android/keystore.properties` (ignoré par git, ne jamais
    le commiter) ; `app/build.gradle` ne signe que si ce fichier existe.
  - **Icônes / écran de démarrage** : sources dans `client/assets/`
    (`icon-only.png`, `icon-foreground.png`, `icon-background.png`,
    `splash*.png`, rendues en Fraunces), générées avec
    `npx -y -p node@22 -p @capacitor/assets@3 capacitor-assets generate
    --iconBackgroundColor '#ea5a2b' --splashBackgroundColor '#0f172a' …`.
    Après génération, **repasser `mipmap-anydpi-v26/ic_launcher*.xml` sans
    inset sur le fond** (l'outil ajoute 16,7 % → anneau pâle autour de
    l'icône) — inset de 8 % sur le premier plan seulement. L'outil réécrit
    aussi `client/icons/` et `public/manifest.webmanifest` (PWA, non branchée).
  - **Encoche / barres système** : `viewport-fit=cover` + marges sur `#root`
    (`index.css`) via `--sa-top|right|bottom|left` = `var(--safe-area-inset-*,
    env(safe-area-inset-*))` — **sur Android, Capacitor fournit les vraies
    valeurs dans `--safe-area-inset-*` et `env()` vaut 0** (constaté sur un
    Galaxy Z Fold6, WebView 154). Tableau de bord en `.app-screen` (100dvh
    moins les marges). Dans les apps, `components/NativeChrome.tsx` peint
    **toujours en bleu nuit** les bandes derrière la barre d'état et les
    boutons de navigation, avec icônes claires (`SystemBars`, Capacitor 8) :
    Android remet son style d'icônes par défaut après l'écran de démarrage,
    impossible de garder des icônes sombres de façon fiable. Sur le site, la
    couleur des marges suit la page. WebView < 140 : marges natives (fond de
    fenêtre `evly_night`). Bouton retour Android : `NativeChrome` émet
    `evly-back`, DashboardPage remonte Plan → Plans → Cercles (ou ferme le
    Plan sur écran large), sinon page précédente ou arrière-plan.
  - **Liens vers le site** (fiche Découvrir, brochure, confidentialité) :
    `lib/siteUrl.ts` → URL absolue www.evly.ch dans les apps (ouverte dans le
    navigateur du téléphone), relative sur le web.
  - **Connexion Google dans les apps** : `@capgo/capacitor-social-login`
    (remplace `@codetrix-studio/capacitor-google-auth`, abandonné, prévu pour
    Capacitor 6). Bouton **masqué dans les apps** tant que `VITE_GOOGLE_NATIVE`
    ≠ `1` : il faut d'abord un client OAuth iOS (`VITE_GOOGLE_IOS_CLIENT_ID`,
    + schéma d'URL inversé dans Info.plist) et l'empreinte SHA-1 Android
    (clé d'upload et clé de signature Play) dans la console Google Cloud.
    Apple exigera alors aussi « Sign in with Apple » (règle 4.8).
  - **Notifications push** (2026-10-01) : Firebase Cloud Messaging, projet
    Firebase **`evly-23d40`** (« EvLY »), clé APNs `.p8` (Key ID `3C84P5R6S4`)
    importée dans Firebase. Fichiers de config **non commités** :
    `android/app/google-services.json` et `ios/App/App/GoogleService-Info.plist`
    (à re-télécharger depuis la console Firebase si besoin). Serveur :
    `lib/push.ts` — **toute notification passe par `notifyUser(io, userId, n)`**
    (événement socket `notification` + push), jamais `io.to('user:…').emit
    ('notification')` directement. Texte construit par `pushContent` (testé) :
    **jamais le contenu d'un message**, seulement qui / où ; `data.url` = lien
    interne (`/dashboard?planId=…`, `?circleId=…&pollId=…`, `?circleId=…`),
    regroupement par Plan/sondage (tag Android, `apns-collapse-id`). Clé du
    compte de service dans `FIREBASE_SERVICE_ACCOUNT_B64` (JSON en base64, sur
    Railway uniquement : en local, rien n'est envoyé). Table **PushToken**
    (jeton unique, rattaché au dernier compte connecté sur l'appareil) ; routes
    POST/DELETE `/api/push/token` ; jetons expirés supprimés à l'envoi. Client :
    `lib/push.ts` appelle le plugin natif via `registerPlugin` (la version web de
    `@capacitor-firebase/messaging` importerait le SDK Firebase dans le site) ;
    autorisation demandée à la connexion (`AuthContext`), jeton retiré à la
    déconnexion, toucher une notification navigue vers `data.url`
    (`NativeChrome`). App ouverte : pas de bannière système
    (`presentationOptions: []`), la notification s'affiche dans l'app. Android :
    petite icône `drawable/ic_stat_evly`, couleur `evly_coral`. iOS :
    `App.entitlements` (`aps-environment`), mode d'arrière-plan
    `remote-notification`, relais APNs dans `AppDelegate.swift`.
  - **Publication sur les stores** (préparée le 2026-10-02) : version
    **1.0.0** (Android `versionName` / `versionCode` 1 ; iOS `MARKETING_VERSION`
    / `CURRENT_PROJECT_VERSION` 1) — incrémenter le code de build à chaque envoi.
    **2026-10-04 : version 1.0.2** sur les deux plateformes (Android `versionCode` 3, AAB
    `evly-1.0.2-(3).aab` dans le dossier de publication ; iOS build 3 envoyé à App Store Connect,
    à soumettre après la validation de la 1.0.0 — build 2, en cours d'examen à cette date).
    iOS **build 4** (même jour) = build 3 + liens d'application.
    **Version 1.0.3** (2026-10-04, soir) : Android `versionCode` 4 (`evly-1.0.3-(4).aab`), iOS
    build 5 envoyé — Plan express, démo, page de connexion allégée, « Qui apporte quoi ? »
    (quantité, modifier, retirer), informations importantes, suggestions.
    **Version 1.0.4** (2026-10-05) : Android `versionCode` 5 (`evly-1.0.4-(5).aab`), iOS build 6
    envoyé — Plans récurrents, planning des bénévoles, étiquette de suppression du Plan.
    **Version 1.0.5** (même jour) : Android 6, iOS build 7 — fiche du Plan en cartes sur téléphone.
    **Version 1.0.6** (2026-10-05, soir) : Android `versionCode` 7 (`evly-1.0.6-(7).aab`), iOS build 8
    envoyé — barre d'actions, mode silencieux, fenêtre des membres, récapitulatif PDF.
    **Version 1.0.7** (2026-10-05, nuit) : Android `versionCode` 8 (`evly-1.0.7-(8).aab`), iOS build 9
    envoyé — corrections de sécurité (invitations, dépendances).
    **Version 1.0.8** (2026-10-07) : Android `versionCode` 9 (`evly-1.0.8-(9).aab`), iOS build 10 envoyé —
    Père Noël secret, Killer, équipes et tournoi, cagnotte, messages vocaux (autorisation micro), calendrier,
    story, appareil photo dans le chat (la 1.0.0 est en ligne sur l'App Store depuis le 2026-10-06).
    **Version 1.0.9** (2026-10-08) : Android `versionCode` 10 (`evly-1.0.9-(10).aab`), iOS build 11 envoyé — le
    mot piège, listes triées par activité, suppression de ses photos (corbeille sur téléphone, visionneuse du
    chat), phrase pour rejoindre un Plan.
    **Version 1.0.10** (2026-10-09) : Android `versionCode` 11 (`evly-1.0.10-(11).aab`), iOS build 12 envoyé — liste
    d'attente, fonctions rangées par catégorie, votants visibles, clavier du chat, match de groupe, « Qui s'y colle ? ».
    Signature iPhone : passer l'**empreinte** du certificat à `codesign`
    (`security find-identity -v -p codesigning`), le nom avec « é » est mal lu par le shell.
    Envoi iPhone : construire l'archive dans un dossier temporaire ; une archive copiée par le Finder
    reçoit des attributs étendus qui font échouer `codesign --verify`.
    iPhone uniquement (`TARGETED_DEVICE_FAMILY = 1`), `ITSAppUsesNonExemptEncryption`
    = NON et textes d'autorisation caméra / photos / micro dans `Info.plist`
    (sans eux, le sélecteur de fichiers de la WebView plante sur iPhone).
    Première version **sans connexion Google** (donc sans « Sign in with
    Apple »). Compte Google Play **personnel récent** : test fermé obligatoire
    (12 testeurs, 14 jours) avant la production. Page publique exigée par
    Google : `/supprimer-mon-compte` (`DeleteAccountInfoPage`). Normes de sécurité des enfants (déclaration Google obligatoire pour les applis « Réseaux sociaux ») : `/securite-enfants` (`ChildSafetyPage`, contact info@evly.ch). Compte de
    démonstration pour les vérificateurs : `server/scripts/demoAccount.ts`
    (écrit en **production**, `--confirm` obligatoire ; à relancer avant chaque
    soumission, les Plans expirent ; ne nettoie pas les éventuelles photos
    Cloudinary envoyées par un vérificateur). Textes des fiches, captures,
    icône, bannière, AAB et identifiants de démo : dossier
    `~/Desktop/EvLY - Publication stores/` sur le Mac de l'utilisateur.
    **Envoi iPhone (équipe Apple `LDRKKV8GR7`)** — validé le 2026-10-02 (build 1
    envoyé) : aucun iPhone n'est enregistré dans le compte, donc la signature
    automatique (« développement ») échoue à l'archive, et la signature
    manuelle refuse le profil App Store géré par Xcode. Procédure :
    1. `xcodebuild -project App.xcodeproj -scheme App -configuration Release
       -destination 'generic/platform=iOS' -archivePath … CODE_SIGNING_ALLOWED=NO archive` ;
    2. copier le profil « iOS Team Store Provisioning Profile: ch.evly.app »
       (`~/Library/Developer/Xcode/UserData/Provisioning Profiles/`) en
       `App.app/embedded.mobileprovision` ;
    3. `codesign --force --timestamp --generate-entitlement-der --sign "Apple
       Distribution: André Martins (LDRKKV8GR7)"` sur chaque `Frameworks/*.framework`,
       puis sur `App.app` avec `--entitlements` (application-identifier
       `LDRKKV8GR7.ch.evly.app`, team-identifier, **`aps-environment` =
       production**, `com.apple.developer.associated-domains` = [`applinks:www.evly.ch`],
       `get-task-allow` false, `beta-reports-active` true) ;
    4. `xcodebuild -exportArchive -allowProvisioningUpdates` avec `method
       app-store-connect`, `signingStyle automatic`, `destination upload`.
    Une signature locale « - » (ad hoc) est refusée à l'envoi ; une archive
    non signée exportée telle quelle perd `aps-environment` (plus de push).
    Le certificat « Apple Distribution » est dans le trousseau du Mac (créé
    dans Xcode → Réglages → Comptes → Gérer les certificats).
  - **Liens d'application** (2026-10-03) : les liens `https://www.evly.ch` vers
    `/rejoindre`, `/invitation`, `/dashboard`, `/verify-email`, `/reset-password`,
    `/confirmer-email` ouvrent l'app si elle est installée. Android : intent-filter
    `autoVerify` dans `AndroidManifest.xml` + `client/public/.well-known/assetlinks.json`
    (empreintes SHA-256 : **clé de signature Google Play** — lue sur l'APK installé
    depuis le Play Store avec `apksigner verify --print-certs`, signataire V3.0 —,
    clé d'envoi `~/Documents/estelle-keystore.jks` et clé de debug ; toute nouvelle
    clé doit y être ajoutée). iPhone : `.well-known/apple-app-site-association`
    (appID `LDRKKV8GR7.ch.evly.app`), « Associated Domains » activé sur l'identifiant
    `ch.evly.app` chez Apple (2026-10-04) et `com.apple.developer.associated-domains`
    (`applinks:www.evly.ch`) dans `App.entitlements` **et dans les droits de la signature
    manuelle** (étape 3 de l'envoi iPhone) — à partir du build 4 de la 1.0.2. `evly.ch` sans www
    redirige (308) : vérification impossible, seuls les liens www sont déclarés.
    Côté app : `NativeChrome` (`appUrlOpen` + `getLaunchUrl`) navigue vers le
    chemin du lien. Revérifier sur un téléphone : `adb shell pm verify-app-links
    --re-verify ch.evly.app`, puis `pm get-app-links ch.evly.app`.
  - Tester : simulateur iOS (`… capacitor run ios --target <id>`), émulateur
    Android `EvLY_Pixel` (Android 16, créé le 2026-10-01 ; outils
    `~/Library/Android/sdk/cmdline-tools/latest`).

## Structure du repo (monorepo, deux dossiers, pas de workspace tool)

```
Junto/
├── concept.md
├── package.json             # orchestration "npm run dev" via concurrently
├── railway.toml
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/            # AuthPage, DashboardPage, AdminPage, JoinPage,
│   │   │                      SetupPage, VerifyEmailPage, ResetPasswordPage,
│   │   │                      ForgotPasswordPage, PendingPage, ResendVerificationPage
│   │   ├── components/
│   │   │   ├── circles/      # CircleSidebar, Create/Join/DeleteCircleModal,
│   │   │   │                  InviteModal (QR code + lien direct vers un Plan)
│   │   │   ├── plans/        # PlanList, PlanCard, PlanDetail, Create/Edit/DeletePlanModal,
│   │   │   │                  InfosTab (+ galerie photo), VotesTab (sondages
│   │   │   │                  anonymes), MembresTab (présence), DepensesTab
│   │   │   │                  (partage de frais), HistoriqueTab, AllPlansView,
│   │   │   │                  CalendarView (calendrier mensuel partagé)
│   │   │   ├── chat/          # ChatInput (mentions @pseudo), ChatMessage
│   │   │   │                  (réactions emoji, fils de réponse)
│   │   │   └── ui/           # Avatar (badge présence), Button, Input, Modal,
│   │   │                      Logo, NotificationToast, ChangePasswordModal,
│   │   │                      NotificationSettingsModal (opt-out résumé hebdo),
│   │   │                      TermsModal, EmailMigrationBanner
│   │   ├── contexts/AuthContext.tsx
│   │   ├── services/api.ts   # client axios centralisé
│   │   ├── lib/socket.ts
│   │   ├── hooks/useUnread.ts
│   │   └── types/index.ts
│   ├── capacitor.config.ts
│   └── vercel.json
├── server/
│   ├── src/
│   │   ├── index.ts          # entrypoint express + socket.io + cron (gated, voir plus haut)
│   │   ├── routes/           # auth, circles, plans (+ /expenses, /ical,
│   │   │                      /messages/:id/replies), admin, invitations, attachments
│   │   ├── middleware/       # auth.ts (requireAuth/JWT), admin.ts, rateLimit.ts
│   │   ├── socket/handlers.ts # chat, réactions, fils, présence (rooms circle:*)
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── mailer.ts     # client Resend mutualisé
│   │   │   ├── reminders.ts  # cron rappels Plan + résumé hebdo + suppression
│   │   │   │                  des Plans expirés (avec email résumé dépenses)
│   │   │   ├── expenses.ts   # calcul des soldes + simplification des dettes (testé)
│   │   │   └── ical.ts       # génération .ics (testé)
│   │   └── (fichiers *.test.ts à côté du code testé, ex. lib/expenses.test.ts)
│   ├── prisma/schema.prisma
│   ├── tsconfig.json         # exclut *.test.ts du build (dist/)
│   ├── vitest.config.ts      # restreint la découverte de tests à src/
│   └── railway.toml
```

## Modèle de données (Prisma — `server/prisma/schema.prisma`)

- **User** : pseudo (unique), firstName?/lastName? (2026-09-27 : prénom
  obligatoire à l'inscription par email — contrôlé par l'API, pas par la base —,
  nom facultatif, pré-remplis depuis Google ; les comptes plus anciens sans
  prénom voient `ProfileNameBanner` ; depuis le 2026-10-04, les autres membres ne voient que
  **le prénom + @pseudo** (`displayName` dans `lib/names.ts`) : le **nom de famille n'est
  plus envoyé** par l'API aux autres membres (selects des membres de Plan / Cercle,
  invitations, liste des personnes masquées) — seuls la personne (/auth/me, « Mon profil »)
  et le panneau admin (`fullName`) le voient ; le chat et les mentions restent au pseudo),
  password?, email? (unique), emailVerified,
  googleId?, tokens de vérif/reset, status ("approved" par défaut), isAdmin,
  acceptedTermsVersion, weeklyDigestEnabled (défaut true), lastDigestSentAt,
  pendingEmail/pendingEmailToken/pendingEmailExpires (2026-09-29, changement
  d'email : `lib/emailChange.ts`. POST /auth/change-email exige le mot de
  passe — sauf compte Google sans mot de passe —, envoie un lien
  `/confirmer-email?token=…` (24 h) à la nouvelle adresse ; l'ancienne reste
  active jusqu'à POST /auth/confirm-email-change, qui prévient l'ancienne
  adresse. Renvoyer/annuler : POST /change-email/resend, DELETE
  /change-email. Secours admin : PUT /admin/users/:id/email (même lien,
  jamais d'attribution directe). /auth/add-email est désormais refusé pour
  un compte dont l'email est déjà vérifié — il permettait de remplacer
  l'adresse sans mot de passe),
  lastActiveAt (2026-09-29, indexé : dernière utilisation de l'app, mise à
  jour par `touchUser` — `lib/activity.ts` — dans `requireAuth` et à la
  connexion socket, **au plus 1×/h par personne** via une Map en mémoire,
  en arrière-plan ; sert au total « Membres actifs (7j) » du panneau admin,
  mentionné dans la politique de confidentialité). « Messages (7j) » lit
  un compteur quotidien anonyme (`PageVisit`, `page = 'messages'`,
  `countMessageSent`) : avant, il comptait les messages encore en base et
  baissait à chaque suppression de Plan.
- **Circle** : name (**modifiable** depuis le 2026-10-03 par le créateur et les organisateurs,
  60 caractères max, membres notifiés `circle_renamed`), code (unique), description? (affichée sous le nom en
  tête de la liste des Plans, modifiable par le créateur et les
  organisateurs dans `CircleSettingsModal` via PUT /:id/settings), color?
  (palette fixe de 8 couleurs, `CIRCLE_COLORS` côté client), creatorId
- **CircleMember** : userId+circleId (clé composite), role — `admin` (le
  créateur ; `Circle.creatorId` fait foi), `organizer` (**Organisateur**,
  nommé/retiré par le créateur seul via PUT /:id/members/:userId/role),
  `member`. Un organisateur a les mêmes droits que le créateur **sur le
  Cercle** (paramètres, couleur, admissions en mode `creator`, création
  réservée) mais ne nomme personne, ne change pas la règle de suppression,
  ne supprime pas le Cercle et n'a **aucun droit sur les Plans des autres**.
  Contrôle centralisé : `isCircleManager` (`server/src/lib/circleRoles.ts`,
  miroir client dans `client/src/lib/settings.ts`). Quand le créateur part
  (départ ou suppression de compte), `nextCircleCreator` choisit
  l'organisateur le plus ancien, sinon le membre le plus ancien.
  **Fenêtre « Membres »** (2026-10-05, `components/circles/CircleMembersSheet.tsx`) : feuille qui
  monte du bas sur téléphone (poignée à glisser, toucher à côté, bouton retour Android via
  `evly-back-plan`), fenêtre centrée sur grand écran. Membres groupés (créateur, organisateurs,
  membres), triés par prénom, présence en ligne, recherche dès 10 membres, bouton « Inviter » ;
  le créateur y nomme / retire les organisateurs. Ouverte par « N membres » sur la pastille du
  Cercle et par l'icône 👥 de l'en-tête de `PlanList` (sur grand écran, les icônes de cet en-tête
  passent sur une 2e ligne sous le nom du Cercle). Remplace l'ancienne liste dépliante.
- **CircleInvitation** (2026-10-03) : inviter un **compte EvLY existant** dans
  un Cercle par pseudo ou email exact (`InviteModal`, section « Déjà sur EvLY ? »,
  POST /circles/:id/invitations, réservé aux membres). La personne reçoit une
  notification `circle_invite` (app + push + email selon ses réglages, lien
  `/dashboard?invitations=1` qui ouvre la cloche) et accepte ou refuse dans
  `NotificationCenter` (GET /circles/invitations/mine, POST
  /invitations/:id/accept, DELETE /invitations/:id). **Mêmes règles qu'avec le
  code** : Cercle `open` → entrée directe ; `creator` → directe si l'invitation
  vient d'un gestionnaire, sinon demande d'adhésion ; `vote` → demande avec la
  voix de la personne qui invite déjà comptée (entrée directe si elle suffit
  au seuil). `notifyJoinRequest` (circles.ts) est partagé avec /join.
  Liens d'invitation : `publicOrigin()` (`lib/siteUrl.ts`) — **jamais
  `window.location.origin`**, qui vaut `https://localhost` dans les apps (le lien
  WhatsApp restait du texte).
- **CircleChangeLog** (2026-10-03) : historique des modifications d'un Cercle (nom,
  description, paramètres avancés ; auteur `changedById`, SetNull), écrit par PUT
  /:id/settings, lu par GET /:id/history (membres) dans `CircleSettingsModal`.
- **CircleDeleteVote** : vote collectif pour supprimer un Cercle
- **CircleJoinRequest** / **CircleJoinVote** : demande pour rejoindre un
  Cercle (créée à la place d'un accès direct) + votes des membres actuels ;
  seuil d'acceptation = ceil(nombre de membres / 2), même formule que
  CircleDeleteVote/PlanDeleteVote. Aucun refus unilatéral possible (pas
  même par le créateur) — seul le vote à la majorité fait foi, une demande
  reste en attente indéfiniment tant que le seuil n'est pas atteint.
  (Comportement par défaut — voir « Paramètres avancés » ci-dessous.)
  Affichage (2026-09-29) : `components/circles/JoinRequestList.tsx`
  (vote, ou accepter/refuser selon `admissionMode`) sert à la fois dans la
  pastille du Cercle (bouton ambre avec le nombre de demandes) et dans un
  bloc ambre en tête de `PlanList`, au-dessus des sondages, affiché
  seulement s'il y a des demandes.
- **Paramètres avancés** (2026-09-27, pour associations/entreprises) —
  constantes et validation dans `server/src/lib/settings.ts`, libellés
  côté client dans `client/src/lib/settings.ts`, champs UI dans
  `components/ui/AdvancedSettings.tsx`. Modifiables par le **créateur
  seul**, visibles par tous (icône réglages : `CircleSettingsModal`,
  `PlanSettingsModal`).
  - `Circle.admissionMode` : `vote` (défaut, majorité) / `creator` (le
    créateur accepte via la route de vote, et peut **refuser** via DELETE
    /:id/join-requests/:requestId — refus interdit en mode vote) / `open`
    (/join ajoute directement le membre, réponse `{pending:false, circle}`).
    Passer en `open` accepte toutes les demandes en attente.
  - `Circle.planCreationMode` / `Circle.pollCreationMode` (séparés depuis
    le 2026-09-28) : `all` (défaut) ou `creator` (créateur + organisateurs)
    — `canCreatePlans` / `canCreatePolls` dans `circles.ts`. La migration a
    recopié `creator` dans `pollCreationMode` pour les Cercles qui
    réservaient déjà les Plans (avant, un seul réglage couvrait les deux).
    Conversion d'un sondage en Plan : son créateur s'il peut créer des
    Plans, ou **n'importe quel gestionnaire du Cercle** (créateur ou
    organisateur), pour débloquer un sondage lancé par un membre quand les
    Plans sont réservés. Voter reste ouvert à tous.
  - `Circle.deletionMode` / `Plan.deletionMode` : `vote` (défaut) ou
    `creator` (vote-delete supprime immédiatement si c'est le créateur, 403
    sinon ; passer en `creator` efface les votes en cours).
  - **Liste des fonctions** (`FeaturesField`, refaite le 2026-10-09) : rangée par catégorie selon
    `FEATURE_GROUPS` (`client/src/lib/settings.ts`) — Échanger (chat, sondages, photos), Organiser (trajets,
    dépenses, bénévoles), Fêter et offrir (cagnotte, Père Noël secret) et Jouer (Killer, mot piège, équipes),
    ces deux dernières **repliées** tant qu'aucune de leurs fonctions n'est cochée ; une ligne d'explication
    sous chaque fonction. **Toute nouvelle fonction s'ajoute dans `FEATURE_GROUPS`.**
  - `Plan.disabledFeatures` (String[]) : `chat`, `trajets`, `votes`,
    `depenses`, `fichiers`. Infos et Membres toujours actifs. Masquer ne
    supprime aucune donnée ; le serveur bloque les **écritures** (socket
    send-message, rides via `getMembership`, polls, expenses,
    reimbursements, upload), les lectures restent possibles.
  - `Plan.editMode` : `creator` (défaut) ou `all` — en `all`, tout membre
    du Plan **hors invité externe** peut modifier via PUT /plans/:id les
    **dates et le lieu uniquement** ; le serveur ignore les autres champs
    (titre, description, limite, exclusions, paramètres) venant d'un
    non-créateur. Le lieu est modifiable depuis le 2026-09-27 (il ne
    l'était par personne avant). `PlanChangeLog.changedById` (SetNull à la
    suppression du compte) trace l'auteur de chaque modification.
  - `Plan.importantInfoMode` (2026-10-04) : `creator` (défaut, créateur du Plan seul) ou
    `all` (tous les membres du Plan) — qui peut modifier **`Plan.importantInfo`**
    (« Informations importantes », 500 caractères max, `parseImportantInfo` dans
    `lib/settings.ts`). **Indépendant d'`editMode`** (dates et lieu). Saisie possible à la
    création (`CreatePlanModal`), puis modification directe dans l'onglet Infos
    (`ImportantInfoCard`, encadré ambre juste après la description) via PUT
    `/plans/:id/important-info` : historique (`PlanChangeLog`, champ `importantInfo`),
    notification `plan_activity` `important_info_updated`, pastille Infos. Reprise dans
    l'email de rappel de la veille (texte échappé).
- **CirclePoll** / **CirclePollOption** / **CirclePollVote** : sondage pour
  caler une date *avant* de créer un Plan (contrairement à Poll qui
  appartient à un Plan déjà créé). Vote **multiple** — chaque membre coche
  toutes les dates qui lui conviennent, pas de choix exclusif comme pour
  Poll. Depuis le 2026-09-28, un sondage converti en Plan est **supprimé**
  (son chat est recopié dans le Plan avant) ; `resolvedAt`/`createdPlanId`
  ne servent plus qu'aux anciens sondages convertis, purgés par le job.
  **Échéance** (`lib/pollExpiry.ts`, calculée, renvoyée en `expiresAt`) :
  lendemain de la dernière date proposée, 30 jours max après la création.
  Un sondage expiré est traité comme inexistant (404 via `getVisiblePoll`,
  absent de la liste) puis supprimé par le job horaire `deleteExpiredPolls`
  (`lib/pollCleanup.ts`, gated comme les autres crons). La veille de
  l'échéance, `sendPollReminders` envoie un rappel au créateur
  (`CirclePoll.reminderSentAt` anti-doublon, lien
  `/dashboard?circleId=…&pollId=…`). Une date passée ne se vote plus et
  ne peut plus être convertie (serveur + UI). `createPlanInCircle()`/`notifyNewPlan()`
  dans `circles.ts` sont mutualisés entre la création normale d'un Plan et
  cette conversion, pour ne pas dupliquer la notif temps réel + email.
  Depuis le 2026-09-27, le sondage s'ouvre dans le panneau de droite
  (`components/circles/PollDetail.tsx`, exclusif avec le Plan ouvert —
  `selectedPollId` dans DashboardPage) avec :
  - **CirclePollExclusion** : sondage surprise, même principe que
    PlanExclusion (`getVisiblePoll` dans `circles.ts` → 404 pour un exclu,
    absent de la liste, des notifications, des emails et du chat).
    La conversion pré-coche les mêmes exclus dans le Plan surprise.
  - **CirclePollDecline** : « Pas intéressé(e) », exclusif avec les votes
    (l'un efface l'autre). Votants, pas intéressés et « pas encore
    répondu » sont visibles de tous les membres qui voient le sondage.
  - **CirclePollMessage** : chat simple (sans réactions ni fils), en REST
    (POST /polls/:pollId/messages) + événement `poll-message` et
    notification `poll_message` envoyés aux rooms `user:*` de l'audience
    (pas de room de sondage à rejoindre). Recopiés dans `Message` du Plan
    (dates d'origine conservées) lors de la conversion.
- **Ordre d'affichage** (refait le 2026-10-08, à la demande de l'utilisateur) : **Cercles et Plans d'un
  Cercle par dernière activité** (le plus récemment modifié en tête) ; **« Tous mes plans » par date**
  (le plus proche d'abord, en une seule liste — plus de regroupement par Cercle, le nom du Cercle est
  sur chaque carte). Activité d'un Plan = sa création ou la dernière activité d'une rubrique
  (`PlanActivity` : chat, infos, réponses, trajets, votes, dépenses, bénévoles — `planLastActivity`).
  Activité d'un Cercle = la plus récente parmi : l'arrivée de la personne dans le Cercle
  (`CircleMember.joinedAt`), ses Plans visibles, ses sondages de dates (création, messages). GET
  /circles et GET /circles/:id/plans renvoient `lastActivityAt` et sont déjà triés ; GET /plans reste
  par date (`comparePlans`). Règles dans `server/src/lib/planOrder.ts` (testées) et leur miroir
  `client/src/lib/order.ts` (`sortCirclesByActivity`, `sortPlansByActivity` dans DashboardPage ; sans
  `lastActivityAt`, juste créé, en tête). Un message dans un chat émet `circle-updated` vers le Cercle
  **au plus une fois par minute et par Plan** (`chatListRefresh` dans `socket/handlers.ts`) pour que
  les listes se réordonnent. Démo : `touchActivity` dans `lib/demo.ts`. Les jeux (Père Noël, Killer,
  équipes, cagnotte) ne comptent pas comme activité (pas de section).
- **Plan** : title, description, eventDate?, endDate (obligatoire, auto-
  archivage), location?, maxParticipants? (limite optionnelle ; depuis le 2026-10-09 **une place = « Je suis
  in » ou « Peut-être »**, un « Je passe » libère la sienne — `occupiedCount` / `hasFreeSpot` dans
  `lib/waitlist.ts`, miroir client `lib/places.ts`), deletionMode, disabledFeatures (voir Paramètres
  avancés), reminderSentAt? (anti-doublon rappel email), archived,
  circleId, creatorId
- **Liste d'attente** (2026-10-09, `lib/waitlist.ts`, table **PlanWaitlist** planId+userId+createdAt,
  migration `20261009120000_plan_waitlist`) : Plan complet → les membres du Cercle s'inscrivent en attente
  (POST/DELETE `/plans/:id/waitlist`, réponse `position`). `promoteFromWaitlist(io, planId)` remplit les places
  libres dans l'ordre (« Je suis in », `markAllSeen`, notification `waitlist` « Une place s'est libérée, tu es
  dedans ! » app + push + email, exemptée du mode silencieux, `notifyMembershipChange`). **À appeler après tout
  ce qui libère une place** : « Je passe » (PUT rsvp), PUT /plans/:id (limite augmentée, exclusions), départ du
  Cercle, réponse sans compte retirée ou passée à « Je passe ». `hasFreeSpot` : place libre **et personne
  d'autre en attente avant** (rejoindre, revenir de « Je passe », lien invité, réponse sans compte, poste de
  bénévole) ; sinon 409 `{ full: true }`. Invités externes et réponses sans compte : pas de liste d'attente
  (« complet »). Client : encadré ambre dans `PlanDetail` (non-membre ou « Je passe » sur un Plan complet),
  « En attente n°X » sur `PlanCard`, section « Liste d'attente » dans `MembresTab`. Pas dans la démo.
- **Plans récurrents** (2026-10-05, `lib/recurrence.ts`, testé) : `Plan.recurrence` = `weekly` /
  `biweekly` / `monthly` (null = ne se répète pas), `recurrenceUntil?` (« Jusqu'au », facultatif),
  `seriesId` (id du premier Plan de la série), `nextOccurrenceId` (id du suivant, `pending` pendant
  sa création, `ended` quand la série s'arrête). Choisi par le créateur (`RecurrenceField` dans
  Create/EditPlanModal), date de l'événement obligatoire. Le job horaire `spawnRecurringPlans`
  (avant `deleteExpiredPlans`, gated comme les autres crons) crée le Plan suivant **dès que la date
  du Plan est passée** : mêmes titre, description, lieu, durée, réglages, exclusions et « qui
  apporte quoi » (sans « Je prends ça »), **réponses remises à zéro** (seul le créateur y est),
  notification « Nouveau Plan » comme une création normale (`createPlanInCircle`). Heure gardée à
  l'heure suisse (changements d'heure), mensuel le même jour (31 → dernier jour du mois), dates déjà
  passées sautées. Réservation atomique (`updateMany` sur `nextOccurrenceId: null`) : jamais deux
  suivants. La série s'arrête après « Jusqu'au » ou si le créateur a quitté le Cercle
  (`recurrence` remis à null). Menu du Plan (créateur) : « Annuler cette fois » (POST
  /plans/:id/skip : crée le suivant puis supprime celui-ci) et « Arrêter la répétition » (PUT
  /plans/:id/recurrence `{recurrence: null}`). Étiquette « 🔁 Chaque lundi » (`recurrenceLabel`,
  `client/src/lib/recurrence.ts`) dans la fiche, icône sur la carte. Pas géré dans la démo.
- **Planning des bénévoles** (2026-10-05, `lib/volunteers.ts` testé, `routes/volunteers.ts` monté
  dans le routeur des Plans, onglet `VolunteersTab.tsx`) : fonction **à activer** — nouvelle liste
  `Plan.enabledFeatures` (`OPTIONAL_FEATURES` = `benevoles`, vide par défaut, y compris sur les
  anciens Plans ; case « Bénévoles (planning) » dans `FeaturesField`), l'inverse de
  `disabledFeatures`. **VolunteerShift** (poste : nom, nombre de personnes, horaire facultatif,
  remarque) créé / modifié / supprimé par le **créateur du Plan et les gestionnaires du Cercle**
  (`canManageShifts`) ; **VolunteerSignup** (planId dupliqué). S'inscrire (POST
  /plans/shifts/:id/signup) **vaut « Je suis in »** (rejoint le Plan si besoin, limite de
  participants respectée) ; « Absent(e) », exclusion et départ du Cercle retirent des postes. Le
  créateur du Plan est prévenu des inscriptions / désinscriptions (`plan_activity` ciblée), un
  gestionnaire peut retirer quelqu'un (la personne est prévenue), supprimer un poste prévient ses
  inscrits. Résumé « Il manque X personnes », filtre « Mes postes », avertissement de chevauchement
  (`shiftsOverlap`, miroir client). Section `benevoles` des pastilles « nouveau ». Rappel de la
  veille : « Tes postes de bénévole » dans l'email. **Rappel une heure avant la prise de poste** (2026-10-08,
  `sendShiftReminders`, toutes les 5 min, gated comme les crons) : notification `shift_reminder` (app + push,
  passe même en mode silencieux) à chaque inscrit, sauf inscription du dernier quart d'heure ;
  `VolunteerShift.reminderSentAt` anti-doublon, remis à zéro si l'horaire change ; texte avec le vrai délai
  (`shiftReminderText`). Plans récurrents : postes recopiés décalés, sans
  inscrits (`copyShifts`). Pas dans la démo.
- **Père Noël secret** (2026-10-07, `lib/secretSanta.ts` testé, `routes/secretSanta.ts` monté dans le
  routeur des Plans, onglet `SecretSantaTab.tsx`) : 2e fonction **à activer** (`enabledFeatures`
  « pere_noel », case « Père Noël secret »). **La date du Plan = jour de l'échange des cadeaux**,
  obligatoire, et la fin du Plan vient après (`santaDateError`, création et PUT /plans/:id). Tables
  **SecretSanta** (budget, drawnAt, revealedAt, weekReminderSentAt), **SecretSantaWish** (liste
  d'envies), **SecretSantaExclusion** (paires à ne pas tirer), **SecretSantaPair** (giver → receiver,
  giftReady), **SecretSantaMessage** (messagerie anonyme d'une paire, chiffrée, `fromGiver`).
  Participants = « Je suis in » **avec un compte** (pas les réponses sans compte). Liste d'envies
  facultative mais **réponse attendue** : envies notées ou « Je n'ai pas d'envie particulière »
  (`SecretSantaWish.noWish`) ; statut `wish` / `none` / `pending` montré aux participants, et le tirage
  prévient s'il reste des réponses en attente. Les deux conversations anonymes sont visuellement
  opposées (rouge 🎁 « La personne que TU gâtes » / vert 🎅 « La personne qui TE gâte »).
  Création / modification : encadré `SantaDatesNote` (date = échange, fin après l'échange). Tirage (POST
  /santa/draw) **lancé par l'organisateur** (créateur du Plan ou gestionnaire du Cercle,
  `canManageSanta`), une seule fois (réservation atomique) : un seul grand cercle si possible, sinon
  toute attribution sans soi-même, exclusions respectées (`drawPairs`). **Règle d'or : GET /santa ne
  renvoie que la paire de la personne, jamais l'identité de son Père Noël** avant la révélation ; les
  notifications d'un message du Père Noël n'ont ni `from` ni `actorId`. Désistement après le tirage
  (« Je passe », exclusion, départ du Cercle) : `removeFromSanta` referme la chaîne ; arrivées :
  « Les ajouter au tirage » (`addToSanta`). « Refaire le tirage » efface paires et messages.
  **Révélation** (POST /santa/reveal) par l'organisateur, **seulement à partir de la date du Plan**
  (donc entre l'échange et la suppression). Rappels : une semaine avant (`sendSantaReminders`, cadeaux
  pas prêts) et dans l'email de la veille (« N'oublie pas le cadeau de … »). Notifications
  `santa_draw|santa_message|santa_reveal|santa_reminder` → onglet `pere_noel` (`?tab=pere_noel`).
  Temps réel : rechargement seulement, pas de pastille « nouveau » (tout y est privé). Pas encore
  dans les apps (version 1.0.7) ; présent dans la démo.
- **Killer, Équipes, Cagnotte** (2026-10-07, 3 nouvelles fonctions **à activer**, `OPTIONAL_FEATURES`
  `killer` / `equipes` / `cagnotte`, onglets `KillerTab` / `TeamsTab` / `GiftPotTab`, routes montées dans
  le routeur des Plans, migration `20261007200000_killer_teams_gift_pot`). Organisateur = créateur du Plan
  ou gestionnaire du Cercle (comme le Père Noël secret). Notifications `killer` / `teams` / `pot` →
  `?tab=killer|equipes|cagnotte`. Temps réel : rechargement seulement (`realtime.ts`). Départs (« Je
  passe », exclusion, départ du Cercle) : **`removeFromPlanGames` / `removeFromGamesInCircle`
  (`lib/planGames.ts`)** retirent de tous les jeux (Père Noël, Killer, équipes) — à compléter pour tout
  nouveau jeu. Pas dans le récapitulatif PDF. Dans la démo : « Week-end au chalet 🏔️ » (Killer en
  cours, Les copains), « Tournoi de pétanque 🥇 » (championnat à moitié joué, Jeunesse de Montvert) et la
  cagnotte de l'« Anniversaire surprise de Tom » (`killerConfirm`, `recomputeStandings` dans `lib/demo.ts`).
  - **Killer** (`lib/killer.ts` testé, `routes/killer.ts`) : **KillerGame** (objets, lieux — listes par
    défaut modifiables avant le début, visibles par l'organisateur seul), **KillerPlayer** (mission en
    cours : `targetId`, `object`, `place` ; `claimedAt`, `kills`, `eliminatedAt`, `eliminatedById`).
    Joueurs = « Je suis in » avec un compte, 3 minimum. Une seule chaîne (`drawPairs`). Le tueur dit
    « J'ai eu ma cible » → la cible confirme (le tueur hérite de sa mission, `applyKill`) ou conteste.
    Départ / retrait par l'organisateur : `withdrawPlayer` (le chasseur reprend la mission). Arrivées :
    `insertPlayer`. `repairChain` répare à la lecture une chaîne cassée (compte supprimé). **Règle
    d'or : GET ne renvoie que la mission de la personne** ; nombre d'éliminations et « qui a eu qui »
    seulement à la fin (la victime apprend son tueur en confirmant). Mission cachée par défaut à l'écran.
  - **Équipes** (`lib/teams.ts` testé, `routes/teams.ts`) : **TeamDraw** (nombre d'équipes 2–8,
    `balanced`, `format` `league` / `knockout`), **TeamLevel** (1–3, organisateur seul), **Team** (nom,
    couleur — `TEAM_COLORS`), **TeamMember** (une équipe par personne et par Plan), **TeamMatch**. Joueurs =
    « Je suis in » **y compris les réponses sans compte**. Tirage « en serpent » (tailles égales à un
    près, équilibré par niveau). Championnat : `leagueSchedule` (cercle), `leagueStandings` (3/1/0, diff,
    buts). Élimination directe : exemptés au 1er tour, tour suivant créé quand le tour est complet,
    égalité → l'organisateur désigne le qualifié ; changer un qualifié recrée les tours suivants. Scores
    saisis par l'organisateur.
  - **Cagnotte** (`lib/giftPot.ts` testé, `routes/giftPot.ts`) : **GiftPot** (pour qui, objectif, montant
    proposé, devise CHF/EUR, « comment payer » en texte libre, idée choisie, clôture, dernière relance),
    **GiftPledge** (montant, « J'ai payé », « Reçu » par l'organisateur), **GiftIdea** + **GiftIdeaVote**.
    Participer : tout membre du Plan avec un compte, quelle que soit sa réponse. **Montant de chacun
    visible par l'organisateur seul** ; les autres voient le total et qui participe. Pas d'argent qui
    transite par EvLY. Relance (sans participation / pas encore payé) au plus toutes les 12 h. Une
    participation reçue ne se retire plus. Rappel dans les réglages : cacher le Plan à la personne fêtée.
- **Le mot piège** (2026-10-08, `lib/wordGame.ts` testé, `routes/wordGame.ts` sur `/:id/words…`, onglet
  `WordTrapTab.tsx`, migration `20261008120000_word_trap`) : fonction **à activer** (`mot_piege`). Chacun doit
  faire dire secrètement un mot à sa cible ; « … l'a dit ! » → la cible confirme ou conteste (elle voit alors
  qui et le mot). **Démasquer** : la cible accuse un joueur ; juste → +1 point pour elle et nouvelle mission
  pour le piégeur ; faux → plus d'accusation pendant 30 min (`accuseBlockedUntil`). Deux modes au choix de
  l'organisateur : **`points` (défaut)** — personne n'est éliminé, chaque mot réussi = 1 point + nouvelle
  mission (autre cible, autre mot), fin à l'heure choisie (`endsAt`, vérifiée chaque minute par
  `endDueWordGames` dans `index.ts` et à la lecture) ou par l'organisateur ; **`elimination`** — la cible
  piégée sort, le piégeur reprend sa cible avec un nouveau mot, le dernier en jeu gagne. Tables
  **WordGame** (mode, niveaux `facile|moyen|difficile` de `DEFAULT_WORDS`, mots perso de l'organisateur,
  `usedWords` : jamais deux fois le même mot), **WordPlayer** (mission en cours, points), **WordMission**
  (historique : `open|success|unmasked|cancelled`, révélé à la fin). **Classement public en direct** ;
  missions secrètes jusqu'à la fin (règle d'or comme le Killer). Notifications `words` → `?tab=mot_piege`.
  Départs : `removeFromWordGame` dans `lib/planGames.ts`. Démo : partie en cours dans « Week-end au chalet »
  (`wordConfirm`, « Démasquer » réussit une fois sur deux).
- **PlanMember** : userId+planId, rsvp ("in" par défaut), seen (Json,
  2026-10-01 : date de dernière consultation de chaque onglet).
- **Pastilles « nouveau »** (2026-10-01, `lib/planActivity.ts`) :
  **PlanActivity** (planId+section → date de dernière activité ; sections
  `chat`, `infos`, `trajets`, `membres`, `votes`, `depenses`). Mise à jour
  par `touchPlanSection` : dans `broadcastWrites` (`lib/realtime.ts`, le
  champ `section` du WriteTarget, déduit de la route), dans le handler
  socket `send-message` et dans les routes du covoiturage. L'auteur est
  marqué « vu » pour l'onglet touché ; un nouveau participant (join, lien
  invité) est marqué « vu » partout (`markAllSeen`). GET /plans, GET
  /plans/:id et GET /circles/:id/plans renvoient `unseen` (onglets non vus
  par la personne). POST /plans/:id/seen {section} efface — **exclu de la
  diffusion temps réel** (sinon boucle de rechargements). Client :
  pastille orange sur l'onglet (`PlanDetail`, l'onglet affiché est marqué
  vu automatiquement, y compris après un rechargement en direct) et sur la
  carte (`PlanCard`, `unseen` non vide ou notification). Une écriture avec
  section rafraîchit aussi la liste du Cercle (`circleWide`).
  Cercles (2026-10-01) : GET /circles renvoie `hasUnseen` (un de mes Plans
  à venir du Cercle a un onglet non vu) ; `DashboardPage` combine ce
  drapeau, les notifications reçues (`useUnread`) et, pour le Cercle ouvert,
  les cartes de ses Plans (`circlesWithNews`) ; `handlePlanUpdated` remet
  le drapeau à jour dès qu'un onglet est marqué vu.
  **Cloche des notifications** (2026-10-02) : en bas de la barre latérale
  (`CircleSidebar`, nombre = Cercles avec du nouveau), ouvre
  `components/ui/NotificationCenter.tsx` : Plans avec onglets non vus (GET
  /plans, `unseen` — couvre ce qui s'est passé app fermée), demandes
  d'adhésion en attente, et « À voir » = notifications reçues dans l'app
  (`localStorage` `evly_notif_history_<userId>`, 30 dernières, 7 jours,
  DashboardPage), retirées dès que le Plan / sondage / Cercle concerné est
  ouvert (`dismissHistory`). Toucher une notification l'efface **de la cloche seulement**
  (2026-10-03, demande explicite de l'utilisateur) : les pastilles des onglets et des cartes
  restent jusqu'à ce que l'onglet soit consulté. Les Plans avec du nouveau sont chargés par
  DashboardPage (`bellPlans`, GET /plans qui renvoie aussi `unseenAt`, date de la dernière
  activité non vue — `unseenDetails` dans `lib/planActivity.ts`) ; l'effacement est une date
  par Plan sur l'appareil (`evly_bell_dismissed_<userId>`), l'entrée revient si `unseenAt` est
  plus récent. Toucher un Plan l'ouvre sur son premier onglet non vu (prop `openTab` de
  `PlanDetail`) ; « Tout effacer » vide la cloche (invitations et demandes d'adhésion restent,
  elles attendent une réponse). Le nombre sur la cloche compte ses entrées (Plans, « À voir »
  regroupés par Plan / sondage, invitations).
  Bouton retour Android : ferme le panneau. Apps :
  à l'ouverture et à chaque retour, les notifications EvLY du volet du
  téléphone sont effacées (`clearDeliveredNotifications`), **sans** être
  importées dans la cloche (essayé : doublons avec la copie reçue par socket).
- **PlanDeleteVote**, **PlanChangeLog**
- **Message** : content, authorId, planId, parentId? (fils de réponse,
  self-relation "MessageReplies", cascade), editedAt?, deletedAt?
  (2026-10-01) : l'auteur modifie ou supprime son message **pendant 15
  minutes** (`lib/messageEdit.ts`, miroir client
  `components/chat/MessageEditing.tsx`). Chat des Plans : événements socket
  `edit-message` / `delete-message` → `message-updated` dans `plan:{id}` ;
  une mention ajoutée en modifiant notifie dans l'app (pas d'email).
  Chat des sondages : PUT/DELETE /circles/polls/messages/:id →
  `poll-message-updated` vers l'audience. Suppression : `content` vidé en
  base (plus aucun texte conservé), le message reste affiché « Message
  supprimé » ; `withPlainContent` renvoie un contenu vide pour un message
  supprimé. Mêmes colonnes sur **CirclePollMessage**, recopiées à la
  conversion en Plan.
  **Photos dans le chat** (2026-10-03) : `Message.attachmentId` (unique,
  SetNull). Le client envoie la photo par POST
  `/attachments/plans/:id?via=chat` (images seulement, chat **et** fichiers
  actifs ; pas de notification `plan_activity` « fichier », le message suffit),
  puis `send-message` avec `attachmentId` (texte facultatif = légende ; le
  serveur vérifie même Plan, même auteur, image, pas déjà publiée). La photo
  est un fichier du Plan comme un autre (visible dans Infos) ; supprimer le
  message supprime la photo (Cloudinary compris), supprimer la photo dans
  Infos laisse le message affiché « Photo retirée ». Depuis le 2026-10-08, **la personne qui a mis une photo
  (ou un fichier) peut la supprimer à tout moment** (en plus du créateur du Plan) : corbeille visible sur écran
  tactile dans Infos (avant : au survol seulement), et « Supprimer la photo » dans la visionneuse du chat
  (au-delà des 15 minutes de modification du message) ; le serveur émet alors `message-updated`. Includes partagés dans
  `lib/messageInclude.ts`. Chat des sondages : pas de photos.
  **Messages vocaux** (2026-10-07) : bouton micro à la place d'« Envoyer » quand la saisie est
  vide (`ChatInput`, `MediaRecorder`, 2 min max, corbeille pour annuler). Même chemin qu'une photo :
  POST `?via=chat` accepte `audio/*`, stocké chez Cloudinary en **`resource_type: 'video'`**, puis
  `send-message` avec `attachmentId` (le serveur accepte image ou audio « video »). Durée dans le nom
  du fichier (`vocal-23s.webm`, `voiceSeconds` dans `lib/media.ts`, pas de colonne). Lecture
  (`VoiceMessage.tsx`) : `/view?format=mp3` = converti en MP3 par Cloudinary (un WebM enregistré sur
  Android ne se lit pas sur iPhone), chargé en mémoire au premier appui (Safari ne lit pas un son
  servi sans Range). Pas de « Modifier » (seulement supprimer, fichier compris), absents de l'onglet
  Infos (`isVoiceNote`), aperçu des notifications « 🎤 Message vocal ». Apps : `RECORD_AUDIO` +
  `MODIFY_AUDIO_SETTINGS` dans `AndroidManifest.xml`, texte `NSMicrophoneUsageDescription` iOS.
  Pas dans la démo (envoi refusé comme les photos).
  **Calendrier** (même date) : `components/ui/DateTimeField.tsx` remplace tous les champs natifs
  `datetime-local` / `date` (listes défilantes sur téléphone, sans jour de la semaine) ; même format
  de valeur (« AAAA-MM-JJTHH:MM »). Le chat propose aussi « Prendre une photo » / « Choisir dans la
  galerie » sur écran tactile (le sélecteur Android n'ouvrait que la galerie).
- **MessageReaction** : messageId+userId+emoji (unique), pour les réactions
  emoji temps réel. Barre de réactions : survol sur ordinateur ; sur écran tactile (`hover: none`),
  un appui sur le message l'ouvre et l'appui suivant, n'importe où, la ferme (`ChatMessage`).
  Liens web (`https://`, `www.`) cliquables dans les deux chats (`renderContent`, exporté de
  `ChatMessage` et utilisé par `PollDetail`).
- **Poll** / **PollOption** / **PollVote** : sondages ; `Poll.anonymous`
  (bool) — si vrai, l'API anonymise les userId des votes des autres membres
  dans la réponse (voir `anonymizePoll`/`anonymizePlanPolls` dans
  `plans.ts`), la UI ne s'appuyait déjà que sur les comptes donc c'est
  surtout une protection côté API contre l'inspection réseau
- **Match de groupe** (2026-10-09, `lib/matchPoll.ts` testé, `routes/matchPoll.ts` monté dans le routeur des
  Plans, `components/plans/MatchSection.tsx`, migration `20261009180000_match_polls`) : dans l'onglet Votes, **à
  côté** du sondage classique (« 🗳️ Sondage » / « 💘 Match »), soumis à la fonction `votes`. Tables **MatchPoll**
  (question, anonyme, échéance facultative, `chosenOptionId`, `closedAt`), **MatchOption** (proposition, précision,
  lien, **photo facultative** = fichier du Plan envoyé par `POST /attachments/plans/:id?via=match`, nommé `match-…`,
  **masqué de l'onglet Infos et du ZIP de photos**, supprimé avec la proposition / le match ; `matchedAt`),
  **MatchSwipe** (oui / non). Joueurs = « Je suis in » / « Peut-être » avec un compte. Cartes plein écran
  (`SwipeDeck` : glisser ou boutons ✖️ / 💚, flèches du clavier, annuler), ordre mélangé propre à chacun
  (`deckOrder`). **Personne ne voit les réponses des autres avant d'avoir fini ses cartes** (ou échéance passée,
  match clos) ; **match = oui de tous les joueurs** (`isUnanimous`), visible de tous et notifié une seule fois.
  **Tout participant peut ajouter des propositions** (15 max). Le **créateur du Plan** « Choisit » (après avoir
  joué) : lieu du Plan et / ou informations importantes mis à jour (historique `PlanChangeLog`), match clos,
  participants prévenus. Rappel la veille de l'échéance (`sendMatchReminders`, horaire). Notifications `match` →
  `?tab=votes`. Démo : « On regarde quel film après l'apéro ? » (apéro au bord du lac ; vue complète de Tom dans
  `DEMO_FULL /plans/:id/matches`, `findDemoMatch` / `revealDemoMatch`).
- **Qui s'y colle ?** (2026-10-09, roue de la décision, `lib/wheel.ts` testé, `routes/wheel.ts` monté dans le
  routeur des Plans, `components/plans/WheelSection.tsx`, migration `20261010100000_wheels`) : 3e choix de l'onglet
  Votes, soumis à la fonction `votes`. Tables **Wheel** (question, `excludedUserIds` = personnes **retirées
  volontairement**, `noRepeat` « pas deux fois la même personne ») et **WheelSpin** (gagnant + copie des
  candidats, retirés et déjà tombés au moment du tirage). Sur la roue : « Je suis in » et « Peut-être », **réponses
  sans compte comprises**. **Tout participant** crée, retire / remet des personnes (PUT) et lance ; suppression par
  son créateur ou le créateur du Plan. **Le serveur tire le résultat** (`crypto.randomInt`) et fixe une heure de
  départ commune (`startAt` = maintenant + 3 s, rotation 5 s, 409 pendant qu'elle tourne) ; événement socket
  `wheel-spin` dans `plan:{id}` → `WheelSpinHost` (PlanDetail, quel que soit l'onglet) ouvre la roue plein écran,
  synchronisée avec `serverNow` : tous les téléphones s'arrêtent au même instant sur le même nom. Pendant la
  rotation, la carte cache le résultat (« La roue tourne… / Regarder »). **Le résultat affiche les noms des
  personnes retirées volontairement** (et des déjà tombées) ; « Revoir », tirages précédents. Notification `wheel`
  (→ `?tab=votes`) à l'arrêt de la roue, seulement aux comptes qui ne regardent pas le Plan. Démo : « Qui fait la
  vaisselle ? » (soirée raclette, Léa retirée, un tirage fait ; `findDemoWheel` / `refreshDemoWheel`).
- **Assemblée** (2026-10-09, `lib/assembly.ts` testé, `routes/assembly.ts` monté dans le routeur des Plans, PV
  `lib/assemblyPv.ts`, onglet `AssemblyTab.tsx`, migration `20261011100000_assembly`) : fonction **à activer**
  (`assemblee`, catégorie Organiser). La date du Plan = celle de l'assemblée. Organisateur = créateur du Plan ou
  gestionnaire du Cercle (`canManageAssembly`) ; **secrétaire** facultatif (notes du PV, téléchargement du PV).
  Tables **Assembly** (réglages : `nonVoterIds` = membres décochés des votants, procurations autorisées + maximum par
  personne, quorum `none|count|percent`, `codeCheckIn` + `checkInCode` à 4 chiffres, `hybrid`, `noticeDays`,
  `convokedAt|openedAt|closedAt`), **AssemblyItem** (point de l'ordre du jour `info|vote|election`, documents =
  `attachmentIds` envoyés par `POST /attachments/plans/:id?via=assemblee` — possible sans « Photos et fichiers » —,
  notes, `secret`, majorité `simple|absolute|two_thirds`, `seats`, statut `pending|open|closed|tacit`,
  `eligibleVotes` figé à l'ouverture), **AssemblyCandidate**, **AssemblyVoter** (qui a voté et pour qui ; le choix
  seulement à main levée), **AssemblyBallot** (bulletin, id uuid, **sans personne ni date** : vote secret),
  **AssemblyProxy**, **AssemblyAttendance** (`remote`). Personnes référencées par id, sans relation. **Votants =
  membres du Cercle (comptes normaux) moins `nonVoterIds`** ; invités externes et réponses sans compte voient
  l'ordre du jour, rien du Cercle. **Seules les personnes pointées présentes votent** (organisateur qui coche, code
  de la salle, ou « à distance » si hybride) ; une procuration vaut tant que la personne qui l'a donnée n'est pas
  présente et que celle qui la porte l'est (`votingRights`), et se donne / retire seulement avant l'ouverture.
  Quorum = présents votants + procurations valables. Un seul vote ouvert à la fois ; résultat visible à la
  clôture ; « Annuler » efface les voix ; « sans scrutin » (acclamation / élection tacite) ; égalité à une élection
  → l'organisateur départage (`/elect`). Convocation : app + push + email (canal respecté, **même Cercle en
  silence** : pas de bulle), 1 / 10 min. Notifications `assembly` et **`assembly_vote` (ouverture d'un vote,
  exemptée du mode silencieux)** → `?tab=assemblee`. **PV** (GET /:id/assembly/pv, organisateur et secrétaire,
  « projet » tant que l'assemblée n'est pas close) : **prénom et nom** des présents, procurations, excusés,
  quorum, chaque point avec notes, résultats (noms à main levée), élus, signatures ; **envoyé par email au créateur
  du Plan seul** à la clôture. Politique de confidentialité mise à jour (9 octobre 2026). Démo : « Assemblée générale
  2026 » (Jeunesse de Montvert, ouverte, comptes adoptés, vote de la cotisation en cours : Alex vote pour lui et
  pour Chloé, puis peut clore le vote — `findDemoAssemblyItem`).
- **BringItem** : liste "qui apporte quoi" — **partie intégrante de l'onglet Dépenses**
  depuis le 2026-10-04 (`BringItemsSection.tsx`, en tête de `DepensesTab`) : désactiver les
  Dépenses la masque aussi et le serveur refuse ajout et « Je prends ça » ; pastille et
  notifications sur l'onglet Dépenses. Depuis le 2026-10-05 : **quantité facultative** en texte
  libre (`BringItem.quantity`, 30 caractères, « 3 kg »), **modifier** (crayon, PUT
  /plans/items/:itemId : texte et quantité, « Je prends ça » conservé) et **retirer** (corbeille,
  DELETE /plans/items/:itemId) — par son auteur (`BringItem.createdById`, renseigné depuis cette
  date) ou le créateur du Plan ; les anciens éléments sans auteur, le créateur seul
- **Attachment** : fichiers Cloudinary liés à un Plan (url, publicId,
  resourceType, mimeType, size) — les images sont affichées en galerie
  séparée dans InfosTab, les autres types en liste de fichiers
- **Devises des dépenses** (2026-09-29) : `Expense.currency` et
  `Reimbursement.currency` = `CHF` (défaut) ou `EUR`, choisie à chaque
  saisie (le formulaire propose la devise de la dernière dépense du Plan,
  `defaultCurrency` dans GET /:id/expenses). **Aucune conversion** : les
  comptes sont tenus séparément par devise (`computeByCurrency` dans
  `lib/expenses.ts`) — un solde par devise et par membre (`balances[].amounts`),
  des virements suggérés avec leur `currency`, un remboursement enregistré
  dans la devise du virement. L'email de résumé de fin de Plan affiche
  chaque montant dans sa devise (`formatAmount`, format `fr-CH`). La
  migration a mis `EUR` sur toutes les dépenses et remboursements
  existants (tout s'affichait en € avant cette date). Le bouton
  « Ajouter une dépense » est un bouton corail pleine largeur en haut de
  l'onglet.
- **Expense** : description, amount, paidById, planId — réparti à parts
  égales entre les membres listés dans `splitWith` (**ExpenseShare**,
  sélectionnés à la création, pas forcément tous les membres du Plan).
  Les dépenses créées avant cette fonctionnalité (2026-08-23) ont
  `splitWith` vide : `computeBalances` retombe alors sur tous les membres
  du Plan pour rester rétrocompatible.
  **Toute requête qui calcule des soldes doit charger `splitWith`** : le
  champ est obligatoire dans la signature de `computeBalances` /
  `computeByCurrency` depuis le 2026-10-01, après un bug où l'email de
  résumé de fin de Plan (`reminders.ts`) ne le chargeait pas et partageait
  chaque dépense entre tous les membres.
- **ExpenseShare** : userId+expenseId (clé composite), les participants
  d'une dépense précise
- **Reimbursement** : amount, fromUserId, toUserId, planId — enregistre un
  remboursement réel qui vient compenser les soldes calculés
- **Ride** / **RidePassenger** / **RideRequest** (covoiturage, 2026-09-27,
  trajet **aller** uniquement — le retour se précise dans `note`) : un
  conducteur propose un trajet (departure texte libre, departureAt?, seats
  1-8, note?), unique par (planId, driverId). `RidePassenger.planId` est
  volontairement dupliqué pour que la base garantisse un seul trajet par
  passager et par Plan (unique planId+userId). `RideRequest` = « Je cherche
  une place » (fromLocation), une par membre et par Plan. Un conducteur
  n'est jamais passager ni demandeur (nettoyé à la création du trajet) ;
  monter dans un trajet supprime sa demande et bascule depuis un éventuel
  autre trajet. Passer « Absent(e) » (`plans.ts` PUT /:id/rsvp) appelle
  `removeUserFromRides` (`lib/rides.ts`) : trajet supprimé si conducteur,
  place libérée si passager, demande retirée. UI : `CarpoolSection.tsx`
  dans l'onglet **Trajets** du Plan. Pour garder 6 onglets (la barre
  déborde déjà sur mobile), l'onglet Historique a été retiré : l'historique
  des modifications s'ouvre maintenant dans une modale depuis les actions
  du Plan (icône sur desktop, menu ⋮ sur mobile).
- **Fiche d'un Plan sur téléphone** (2026-10-05, `PlanDetail`, `useIsPhone` < 768 px) : plus
  d'onglets. **Page principale** = en-tête du Plan + une carte par rubrique (Chat en premier sur
  toute la largeur, point orange « nouveau » seulement, pas de résumé — choix de l'utilisateur) ;
  toucher une carte ouvre la rubrique en plein écran avec un en-tête compact « ← titre du Plan /
  rubrique ». Retour à la page principale : flèche, bouton retour Android (DashboardPage émet
  d'abord `evly-back-plan`, que PlanDetail annule s'il ferme une rubrique) ou glissement depuis le
  bord gauche. Un Plan s'ouvre toujours sur sa page principale, sauf rubrique demandée (`openTab` :
  cloche, notification de message ou de mention → chat, push `?planId=…&tab=chat`). Rien n'est
  marqué « vu » sur la page principale (`activeTab` null). Grand écran : onglets inchangés.
  **Barre d'actions** (même date) fixée en bas de la page principale uniquement (pas dans une
  rubrique), nettement séparée des cartes (fond blanc, trait et ombre vers le haut, boutons
  corail) : Inviter · Photos (seulement si le Plan a des photos, ZIP via `lib/planPhotos.ts`,
  partagé avec InfosTab) · Agenda (.ics) · Story. Sur téléphone, ces trois entrées ne sont plus
  dans le menu ⋮ (toujours là sur tablette, où la barre n'existe pas).
- **Invités externes et Plans surprise** (2026-09-27) — règles d'accès
  centralisées dans `server/src/lib/planAccess.ts` (`getPlanAccess`,
  `visiblePlansWhere`, `guestIdsAmong`, `validateExclusions`) : **toute
  nouvelle route qui touche un Plan doit passer par `getPlanAccess`**
  plutôt que de vérifier l'appartenance au Cercle à la main.
  - **Invité externe** = `PlanMember` sans `CircleMember`. Il arrive via un
    lien `/invitation?token=…` (**PlanGuestLink** : un jeton réutilisable
    par Plan, table séparée pour que le jeton ne remonte jamais avec les
    champs du Plan ; régénérable par le créateur). Il voit tout le Plan
    mais rien du Cercle : ni nom (`circle: null` + `isGuest` dans GET
    /plans, groupe « Invitations » côté client), ni code, ni autres Plans,
    ni membres du Cercle. Pas de présence en ligne pour lui (les rooms de
    présence sont par Cercle). Il n'a aucun Cercle : le client ne doit pas
    supposer qu'un utilisateur a au moins un Cercle (cf. `circlesLoaded`
    dans DashboardPage).
  - **Plan surprise** = lignes **PlanExclusion** (membres du Cercle exclus,
    jamais le créateur). Pour un exclu, le Plan n'existe pas : 404 sur le
    détail et le lien d'invitation, et absent des listes, du compteur et de
    l'aperçu de la barre latérale, de la notif/email « Nouveau Plan » et du
    résumé hebdomadaire. Exclure après coup quelqu'un qui avait rejoint le
    Plan l'en retire (et de son covoiturage).
  - Parcours d'invitation : `GuestInvitePage` mémorise le jeton dans
    `localStorage` (`lib/pendingInvite.ts`) avant d'envoyer vers la
    connexion, pour y ramener l'utilisateur même après une inscription avec
    validation d'email. `AuthPage` respecte maintenant `?redirect=` (chemin
    interne uniquement) — ce qui répare aussi le retour après connexion des
    invitations aux Cercles (`/rejoindre`).
  - **Réponse sans compte** (2026-10-02, `lib/lightGuest.ts`) : sur
    `/invitation?token=…`, une personne non connectée voit le Plan (titre,
    date, lieu, description, nombre de participants ; les prénoms seulement
    après avoir répondu) et répond avec son **prénom** (in / peut-être / je
    passe) via les routes publiques **`/api/invite`** (`routes/invite.ts`).
    C'est un vrai `User` avec **`isLight = true`** (pseudo généré
    `prenom.invite` — le point est interdit dans les pseudos choisis), membre
    du Plan comme un invité externe : il compte dans les participants et
    déclenche les notifications d'arrivée/désistement. Son jeton (JWT
    `light: true`, gardé côté client dans `evly_light_token`, `lib/lightGuest.ts`)
    est **refusé par `requireAuth` et par le socket** : il ne peut rien faire
    d'autre que répondre. `/auth/login`, `/auth/google` reçoivent `lightToken` et
    transfèrent ses réponses au compte (`absorbLightUser`, parts de dépenses et
    remboursements compris) ; `/auth/register` avec `lightToken` transforme le
    même User en compte normal (`isLight` passe à false à la validation de
    l'email). « Retirer ma réponse » (DELETE) efface tout ; le cron horaire
    `deleteOrphanLightUsers` supprime les invités sans plus aucun Plan. Exclus de
    la liste des comptes de l'admin, comptés à part (`lightGuests`).
  - **Aperçu des liens d'invitation** (2026-10-02, `routes/share.ts`) :
    `client/vercel.json` renvoie `/invitation` vers `GET /api/share/invitation`
    (Railway), qui sert l'`index.html` du site (relu au plus 1×/min) avec les
    balises `og:*` du Plan et `noindex` ; `/apercu/<jeton>.png` → image
    1200×630 dessinée en SVG puis PNG (`lib/shareImage.ts`, `@resvg/resvg-js`,
    polices dans `server/assets/fonts`). **Ni lieu ni description dans
    l'aperçu** (gardé en cache par les messageries). Secours si le site est
    injoignable : redirection vers `/invitation-plan` (même page, sans
    aperçu). Balises génériques + `public/og-evly.png` dans `index.html`
    pour les autres liens evly.ch.

**Récapitulatif PDF d'un Plan** (2026-10-05, `lib/planRecap.ts`, pdfkit + polices Inter / Fraunces de
`server/assets/fonts`) : titre, Cercle, dates, lieu, organisateur, description, informations
importantes, participants par réponse (prénom + @pseudo, jamais nom de famille ni email), planning
des bénévoles (inscrits, places manquantes) et, s'il y a du contenu, « qui apporte quoi », dépenses
(soldes, virements) et votes. **Réservé au créateur du Plan et aux gestionnaires du Cercle**
(`canDownloadRecap` ; GET /plans/:id renvoie `canRecap`). GET /plans/:id/recap (PDF) ; client
`lib/planRecap.ts` (`saveFile` : téléchargement sur le site, menu de partage dans les apps). Boutons :
« Récap » de la barre d'actions (téléphone), icône de l'en-tête (grand écran), menu ⋮ (tablette),
lien dans la bulle ⏳. Option de compte **`User.recapEmailEnabled`** (désactivée par défaut,
« Récapitulatif avant suppression » dans `NotificationSettingsModal`) : `deleteExpiredPlans` appelle
`sendRecapBeforeDeletion` avant de supprimer (PDF en pièce jointe Resend), sans tenir compte du
canal de notification ni du mode silencieux (choix explicite). Mentionné dans la politique de
confidentialité. **pdfkit : écrire sous la marge du bas ajoute une page** (pied de page : marge
remise à 0 le temps de l'écrire).

Suppression des Plans expirés (`lib/reminders.ts` `deleteExpiredPlans`,
appelée par le cron dans `index.ts`) : si un Plan expiré a des dépenses,
un email de résumé (dépenses + virements suggérés pour équilibrer les
comptes) est envoyé à tous les membres avant suppression — sinon cette
info disparaîtrait avec le Plan (cascade sur Expense/Reimbursement).

## API (`server/src/routes`)

- **auth.ts** : /needs-setup, /setup, /register, /verify-email,
  /resend-verification, /login, /google, /forgot-password, /reset-password,
  /me, /change-password, /add-email, /profile (PUT prénom/nom),
  /delete-account (POST, mot de passe requis ou « SUPPRIMER » pour un compte
  Google ; refusé pour le dernier admin, sinon /setup redeviendrait ouvert),
  /accept-terms,
  /notification-settings (PUT, toggle weeklyDigestEnabled).
  Rate limité : login/register/google (loginLimiter/registerLimiter),
  resend-verification/forgot-password (emailActionLimiter).
- **circles.ts** : CRUD cercles (+ color à la création), /join (crée une
  CircleJoinRequest, n'ajoute plus directement le membre — voir modèle de
  données), /:id/join-requests/:requestId/vote (POST, toggle, accepte le
  membre au seuil — pas de route de refus, voir modèle de données),
  /:id/plans (list+create, avec maxParticipants),
  /:id/vote-delete, /:id/color (PUT, créateur uniquement), /:id/settings
  (PUT, créateur uniquement — paramètres avancés), DELETE
  /:id/join-requests/:requestId (refus, mode `creator` uniquement), /:id/leave
  (POST — un membre quitte de lui-même ; si c'est le créateur et qu'il
  reste d'autres membres, le rôle de créateur passe au membre le plus
  ancien ; si le créateur était seul, le Cercle est supprimé), /:id/polls
  (GET liste + POST créer un sondage de dates), /polls/options/:optionId/vote
  (POST, toggle, vote multiple), /polls/:pollId (DELETE, créateur du
  sondage uniquement), /polls/:pollId/convert (POST, créateur du sondage
  uniquement — transforme l'option gagnante en Plan et clôt le sondage)
- **plans.ts** : CRUD plans (+ maxParticipants), /:id/join (vérifie la
  capacité), /:id/rsvp, /:id/messages (top-level uniquement, parentId:null),
  /messages/:messageId/replies (fil), /:id/polls (+anonymous,
  /polls/:id/vote), /:id/items (+claim), /:id/vote-delete,
  /:id/expenses (GET liste+soldes, POST créer), /expenses/:id (DELETE),
  /:id/reimbursements (POST), /:id/ical (GET, export .ics),
  /:id/guest-link (POST, tout membre du Plan) + /:id/guest-link/reset
  (POST, créateur), /guest-invite/:token (GET aperçu) +
  /guest-invite/:token/accept (POST). PUT /:id accepte `excludedUserIds`
  (Plan surprise) ; le vote de sondage et le claim « qui apporte quoi »
  exigent désormais d'être membre du Plan (failles corrigées le 2026-09-27).
- **admin.ts** : /users, /users/:id/approve|reject, /users/:id/reset-password
  (envoie un lien de réinitialisation par email via `lib/passwordReset.ts`,
  partagé avec /forgot-password — ne fixe plus le mot de passe à « 123 »),
  DELETE /users/:id, /stats. La suppression d'un compte (par l'admin comme
  par l'utilisateur) passe par `lib/accountDeletion.ts` : Cercles et Plans
  créés **transférés** au membre le plus ancien (membre du Cercle préféré à
  un invité), supprimés seulement s'il n'y avait personne d'autre ; le reste
  part en cascade. Circle.creator/Plan.creator n'ont pas de onDelete : ne
  pas appeler `prisma.user.delete` directement.
- **rides.ts** (monté sur `/api/rides`) : GET/POST /plan/:planId (liste
  trajets+demandes / proposer), POST|DELETE /plan/:planId/request,
  PUT|DELETE /:rideId (conducteur uniquement, la suppression prévient les
  passagers), POST|DELETE /:rideId/join. Réservé aux membres du Plan, et
  aux non-absents pour les actions.
- **attachments.ts** : upload (100 Mo cumulés max par Plan), /:id/download-token,
  /:id/download (proxy), DELETE, /plans/:planId/photos-token +
  /plans/:planId/photos/download (ZIP de toutes les photos du Plan, généré à
  la volée avec `archiver` — bouton "Télécharger toutes les photos" dans
  InfosTab, pour récupérer les souvenirs avant la suppression automatique).
  `archiver` est épinglé en v7 : la v8 est ESM-only, incompatible avec le
  build CommonJS du serveur.
- **invitations.ts** : /status (twilioEnabled), /sms (Twilio), /email (Resend
  — toujours disponible, pas de flag "enabled" côté client contrairement au SMS)

La création d'un Plan (`circles.ts` POST /:id/plans) envoie, en plus de la
notification temps réel existante, un email à chaque membre du Cercle
(hors créateur) ayant un email vérifié.

`plans.ts` POST /:id/join envoie un email au créateur du Plan, mais
uniquement quand le Plan passe de 1 à 2 membres (créateur + premier
arrivant) — pas à chaque membre suivant, pour éviter le bruit.
Depuis le 2026-10-01, **chaque** arrivée (POST /:id/join, acceptation d'un
lien invité) et chaque désistement ou retour (PUT /:id/rsvp vers ou depuis
`out` ; rien entre `in` et `maybe`) notifie tous les autres participants du
Plan, hors ceux qui ont répondu « Je passe » (type `plan_member`, dans l'app
+ push, `lib/planNotifications.ts`).
**Activité dans un Plan** (2026-10-02) : chaque modification notifie aussi les
participants (type `plan_activity`, **push + app uniquement, jamais d'email**),
hors auteur, hors « Je passe » et hors personnes qui regardent le Plan (room
`plan:{id}`) : infos modifiées (PUT /:id), « qui apporte quoi » (ajout,
claim), sondage créé, dépense ajoutée/supprimée, remboursement, fichier ou
photo ajouté, covoiturage (trajet proposé/modifié/annulé, place cherchée —
monter/descendre reste une notification ciblée au conducteur). Déclenché par
`broadcastWrites` via le champ `activity` du WriteTarget (`lib/realtime.ts`) :
une nouvelle route d'écriture doit y déclarer son activité ; covoiturage via
`notifyRideActivity` dans `routes/rides.ts`. Pas de notification pour les
votes, réactions, « vu », demandes de suppression.
**Canal des notifications** (2026-10-02) : `User.notificationChannel` =
`push` / `both` (défaut) / `email`, choisi dans `NotificationSettingsModal`
(PUT /auth/notification-settings, GET /api/push/devices pour le nombre de
téléphones). `lib/notificationPrefs.ts` (`wantsEmail`/`wantsPush`) : **tout
email de notification doit filtrer avec `wantsEmail`** (nouveau Plan,
mention, demande/acceptation d'adhésion, sondage, premier arrivant, rappel
24 h, rappel de sondage) ; `sendPush` ignore les comptes `email`. Toujours
envoyés : emails de compte (validation, mot de passe, changement d'adresse,
suppression), résumé des dépenses de fin de Plan, invitations ; le résumé
hebdomadaire garde son propre réglage. Les rappels (veille du Plan, fin de
sondage) partent aussi en push. Chaque email de notification se termine par
`notificationFooter()` (`lib/mailer.ts`, variante `'digest'` pour le résumé
hebdomadaire) : comment les désactiver + lien `/dashboard?reglages=notifications`,
qui ouvre la fenêtre Notifications (`CircleSidebar`). Depuis le 2026-10-05, le texte dit **où**
précisément : menu ☰ en bas de la liste des Cercles (à côté du pseudo) → « Notifications », et
la cloche 🔔 du mode silencieux ; variante `'simple'` sans la cloche (mentions, que le silence ne
coupe pas ; invitation et admission dans un Cercle).

**Mode silencieux** (2026-10-05, `lib/mutes.ts`, `routes/mutes.ts` sur `/api/mutes`) : table
**NotificationMute** (userId + planId **ou** circleId, sans durée). Un Plan en silence, ou tout son
Cercle : **ni bulle dans l'app, ni push, ni email** — les points orange et la cloche (Plans avec du
nouveau) restent. Filtrage central dans `notifyUser` (`isMuted`, sauf `MUTE_EXEMPT_TYPES` :
**mentions**, invitation, admission, suggestions) et sur chaque email lié à un Plan / Cercle
(`withoutMuted` : nouveau Plan, sondage, demande d'adhésion, premier arrivant, rappel de sondage).
Rappel de la veille : gardé pour ceux qui ont répondu « Je suis in », coupé pour les « Peut-être ».
**Toute nouvelle notification ou email lié à un Plan / Cercle doit passer par ces filtres.** Client :
`contexts/MuteContext.tsx` (chargé par DashboardPage), cloche `MuteToggle` sur la **carte du Plan à
côté de la réponse** et à côté du titre de la fiche, cloche du Cercle dans l'en-tête de `PlanList`,
🔕 sur la pastille du Cercle, liste « En silence » (réactiver) dans `NotificationSettingsModal`.

**Signaler / masquer** (2026-10-02, exigence Apple 1.2 et Google pour le contenu
des utilisateurs, `lib/moderation.ts`, `routes/moderation.ts`) : « Signaler »
sur le message d'un autre membre (chat des Plans et des sondages,
`ReportMessageModal`) → **MessageReport** (copie chiffrée du texte, motif),
email d’alerte sans contenu à info@evly.ch (`REPORTS_EMAIL`), traitement dans AdminPage
(`ReportsPanel` : supprimer le message pour tous ou classer ; la copie est
effacée dans les deux cas). « Masquer » (**UserBlock**, case du signalement,
annulable dans « Mon profil ») : messages cachés côté client
(`user.blockedUserIds` de /auth/me) et **aucune notification de cette
personne** — `notifyUser` ignore les notifications dont l'`actorId` est masqué
par le destinataire (renseigner `actorId` pour toute nouvelle notification
déclenchée par quelqu'un ; covoiturage volontairement exclu).

**Proposer une amélioration** (2026-10-04, `lib/suggestions.ts`, `routes/suggestions.ts`) : menu ☰
→ `SuggestionModal` (type idée / problème / autre, 1 000 caractères, **pas de capture d'écran** —
choix de l'utilisateur ; appareil et version de l'app ajoutés automatiquement), table
**Suggestion** (cascade à la suppression du compte), 5 par personne sur 24 h, email à info@evly.ch
(avec le texte). La personne suit ses suggestions dans la même fenêtre (GET /suggestions/mine,
statut + réponse). Admin : `SuggestionsPanel` (GET/PUT /admin/suggestions) — statut
new / review / planned / done / declined + réponse ; passer en `planned` ou `done` notifie la
personne (`suggestion_update`, push + app, lien `/dashboard?suggestions=1` qui rouvre la fenêtre
via `CircleSidebar`). Mentionné dans la politique de confidentialité.

**Plan express — « Organiser une sortie »** (2026-10-05, `lib/express.ts`, `routes/express.ts`,
page publique **`/organiser`** = `OrganizePage`) : un Plan en 30 secondes **sans compte**, puis un
lien d'invitation (`/invitation?token=…`, réponses sans compte comme d'habitude). Entrées : bouton
sur la page de connexion (`AuthPage`), boutons « Organiser une sortie » de `decouvrir.html`, adresse
`/organiser` pour les publicités. Le Plan va dans le **Cercle personnel « Mes Plans »** de
l'organisateur (`Circle.isPersonal`, un par personne, `getOrCreatePersonalCircle`, admission
`creator`), date de fin = date de la sortie + 24 h. Sans compte, l'organisateur est un **invité
léger** (`isLight`, même jeton `evly_light_token`) : il ne peut que créer ses sorties (POST
/api/express, 3 par jour et par connexion, `skipFailedRequests`) et en suivre les réponses
(GET /api/express/mine, rafraîchi toutes les 15 s). Avec un compte (jeton normal), POST /api/express
range le Plan dans son « Mes Plans ». Inscription avec le jeton : même compte (comme les réponses
sans compte). **Connexion à un compte existant : `absorbLightUser` transfère aussi ses Plans
(creatorId) et son Cercle personnel** (fusionné dans le « Mes Plans » du compte s'il existe).
Nettoyage : `deleteOrphanLightUsers` et « Retirer ma réponse » passent par `deleteUserAccount`
(Circle.creator n'a pas de onDelete). « Cercles créés » (admin) exclut les Cercles personnels.

**Démo sans compte** (2026-10-05, `client/src/lib/demo.ts`, route **`/demo`**) : lien « Essayer la
démo » sous le bouton Plan express de `AuthPage` et dans la note de `decouvrir.html`. Tout tourne
**dans le navigateur**, rien n'est envoyé au serveur ni écrit en base : drapeau `evly_demo` en
`sessionStorage` ; `services/api.ts` passe alors par `demoAdapter` (faux serveur), `lib/socket.ts`
renvoie `demoSocket` (faux temps réel : messages, réactions, modification), `AuthContext` ouvre la
session fictive d'Alex, `lib/media.ts` sert les photos de `public/demo/photos/`, `registerPush` ne fait
rien. Données = vraies réponses du serveur enregistrées une fois sur une base jetable avec des
personnes fictives (`public/demo/data.json`, scripts et mode d'emploi dans
`server/scripts/demo-site/` — **à régénérer si l'API change de forme**), dates décalées au
chargement en jours entiers. Actions simulées en mémoire : réponse, « vu », informations
importantes, modification d'un Plan créé par Alex, « qui apporte quoi », sondages (Plan et dates),
dépenses (soldes recalculés comme `lib/expenses.ts`), remboursements, covoiturage, chat du sondage,
création d'un Cercle et d'un Plan, **planning des bénévoles** du loto (s'inscrire, gérer les postes :
Alex est organisateur du Cercle), **mode silencieux** (2026-10-05) et **Père Noël secret** (2026-10-07,
« Noël entre copains 🎄 » dans Les copains, tirage déjà fait : liste d'envies, cadeau prêt, messages
anonymes avec une réponse simulée quelques secondes plus tard ; tirage, ajout et révélation renvoient
le 403 de la démo), **Killer** (« J'ai eu ma cible » : la cible confirme 3 s plus tard, nouvelle
mission), **tournoi** (scores du championnat, classement recalculé) et **cagnotte** (participation, « J'ai
payé », idées, votes, réglages d'Alex) (2026-10-07). « Foot de la semaine » montre
un Plan récurrent (titre sans jour de la semaine : les dates sont décalées au chargement). Le reste renvoie un 403 « Dans la démo, cette action n'est pas
disponible… ». Bandeau `DemoBanner` (Créer mon compte / Quitter) en haut du tableau de bord ;
déconnexion = quitter la démo. Compteur `funnel_demo` (« Démo ouverte »).

**Parcours d'inscription** (2026-10-05, `lib/funnel.ts`) : totaux anonymes par jour dans
**PageVisit** (pages `funnel_*`, comme le compteur de la page Découvrir). Clics comptés par le site
(`countStep` dans `client/src/lib/funnel.ts` → POST /api/stats/visit, pages autorisées
`CLIENT_FUNNEL_PAGES`) : « Créer mon compte » et « Organiser une sortie » (`data-step` dans
`decouvrir.html`, bouton de `AuthPage`), lien de Plan express partagé. Comptés par le serveur
(`countFunnel`) : Plan express créé, inscription envoyée, email validé, premier Plan d'un compte.
Panneau admin `FunnelPanel` (GET /admin/funnel, 7 / 30 jours / total). Mentionné dans la politique
de confidentialité (version du 5 octobre 2026).

Chat + réactions + fils + présence gérés via socket.io
(`server/src/socket/handlers.ts`), pas via route REST. Événements clés :
`join-plan`/`leave-plan`, `send-message` (accepte parentId), `message`,
`toggle-reaction`, `reactions-updated`, `presence` / `presence-snapshot`
(rooms `circle:{id}` rejointes à la connexion selon les Cercles de
l'utilisateur), `notification` (types: new_message, mention — les autres
types de notification (new_plan, new_circle_poll, join_request,
join_accepted) sont émis directement depuis les routes REST concernées
dans `circles.ts`, pas depuis `handlers.ts` ; le type `ride` vient de
`lib/rides.ts`, `plan_member`/`plan_activity` de `lib/planNotifications.ts` ; toutes passent par
`notifyUser` de `lib/push.ts`). Le covoiturage émet aussi `rides-updated` dans la room
`plan:{id}` à chaque changement, pour que `CarpoolSection` se recharge.

**Rafraîchissement temps réel générique** (2026-09-27) : `lib/realtime.ts`
monte un middleware `broadcastWrites` sur les routeurs plans, circles et
attachments. Après **toute écriture réussie** (non-GET, statut < 400), il
émet `plan-updated {planId}` dans `plan:{id}` et/ou `circle-updated
{circleId}` dans `circle:{id}` ; la cible est résolue **avant** la route
(la ressource peut être supprimée par la requête). Les clients rechargent
eux-mêmes via les GET, donc les règles d'accès (Plan surprise, invités)
restent appliquées — ne jamais mettre de données dans ces événements.
Une nouvelle route d'écriture est couverte automatiquement si son chemin
suit les conventions (`/:id/...`) ; sinon, compléter les résolveurs.
`joinCircleRoom`/`leaveCircleRoom` tiennent les rooms `circle:*` à jour
pour les sockets déjà connectés (création, admission, départ). Côté
client : `hooks/useSocketEvent.ts` ; `DashboardPage` recharge Cercles,
liste de Plans et Plan ouvert (regroupés à 250 ms), aussi au retour sur
l'onglet (max 1×/15 s) et après une reconnexion ; un Plan ouvert qui
renvoie 404/403 se ferme avec la notification `plan_gone`. `PlanDetail`
rejoint à nouveau `plan:{id}` et recharge les messages sur `connect`
(avant, le chat restait muet après une coupure). `UpdateBanner` (monté
dans `main.tsx`) compare le script `/assets/index-*.js` chargé à celui
de la page servie (toutes les 5 min + retour sur l'onglet) et propose
« Recharger » après une mise en prod.

Dans `handlers.ts`, le handler `connection` n'est **pas** async : la
préparation de la présence (requêtes Prisma) tourne dans une promesse à
part (`presenceReady`) et les écouteurs (`join-plan`, `send-message`…)
sont enregistrés immédiatement. Ne pas remettre d'`await` avant eux : un
`join-plan` émis juste après la connexion serait perdu (bug constaté et
corrigé le 2026-09-27 — c'est le cas typique d'un invité qui arrive sur
son Plan juste après avoir accepté l'invitation).

## Sécurité (audit du 2026-10-05)

- **Un seul type de jeton ouvre une session** : `verifySessionToken` (`middleware/auth.ts`, utilisé
  par `requireAuth` et le socket) refuse tout jeton qui a un `purpose`, un `attachmentId`, un
  `planId` ou `light`. Les autres jetons signés avec `JWT_SECRET` (photo `?t=` 12 h, téléchargement,
  invité sans compte) servent uniquement à leur usage. **Tout nouveau jeton à usage précis doit
  porter un `purpose`.** (Avant cette date, l'adresse d'une photo donnait accès au compte 12 h.)
- **Admin vérifié en base** à chaque requête (`middleware/admin.ts`), pas d'après le jeton (7 jours).
- **Invitations par email / SMS** (`routes/invitations.ts`) : le serveur fabrique le lien et le texte
  à partir de `{ circleId | planId, guest }` (forme ancienne `{ circleCode, joinLink }` encore acceptée
  pour les apps installées, dont seuls les identifiants sont repris), expéditeur membre obligatoire,
  20 envois par jour et par compte. Ne jamais remettre un texte ou un lien venant du client dans un
  email.
- **Tout texte d'utilisateur dans le HTML d'un email passe par `escapeHtml`** (`lib/escapeHtml.ts`).
- Fichiers (`/attachments/:id/view`) : affichés « en page » seulement pour les images classiques et les
  PDF (`SAFE_INLINE_TYPES`), le reste en téléchargement ; `nosniff` partout, CSP `sandbox` sur les
  images.
- En-têtes : `helmet` sur l'API (sans CSP globale, CORP cross-origin, sans COOP — voir `index.ts`) ;
  `client/vercel.json` : nosniff, Referrer-Policy, `frame-ancestors 'none'`, X-Frame-Options,
  Permissions-Policy. Une CSP complète du site reste à faire (connexion Google, polices).
- Redirection après connexion (`AuthPage`, `?redirect=`) : chemin interne uniquement, ni `//`, ni `\`.
- Restent (moyen, non exploitables ici) : `uuid` via firebase-admin / @capacitor/cli, et
  `react-router` (redirection par `\`, neutralisée ci-dessus) — mise à jour majeure nécessaire.

## Déploiement

- **Frontend** : Vercel, domaine principal **www.evly.ch** (evly.ch redirige
  dessus en 308) — migration terminée le 2026-08-23 (nom acheté sur
  Infomaniak). **estelle.fan a été coupé** à la demande de l'utilisateur
  (2026-08-23) : retiré de `allowedOrigins` dans `server/src/index.ts`, et
  retiré des Origines JavaScript autorisées du client OAuth Google "Estelle
  Web" (Google Cloud Console → le projet s'appelle encore "Estelle" côté
  Google, pas renommé). Le domaine doit aussi être retiré manuellement du
  projet Vercel (Settings → Domains) si ce n'est pas déjà fait — je n'ai
  pas d'accès CLI pour le confirmer. Ancien domaine junto-appli.vercel.app
  encore autorisé en CORS. Déploiement probablement automatique sur push
  GitHub (non confirmé par CLI — vérifier le dashboard si besoin).
  DNS chez Infomaniak (nameservers ns11/ns12.infomaniak.ch) : `evly.ch` (A
  → 216.198.79.1), `www.evly.ch` (CNAME → Vercel), `resend._domainkey`,
  `rsend`, `send` (CNAME, pour Resend — voir plus bas). Le domaine a aussi
  des enregistrements "Messagerie" auto-générés par Infomaniak (MX,
  `20260823._domainkey`, SPF `include:spf.infomaniak.ch`, SRV imap/pop3,
  autoconfig/autodiscover) : sans rapport avec l'app, ne pas y toucher.
- **Emails (Resend)** : domaine `evly.ch` ajouté et vérifié sur Resend
  (DKIM via `resend._domainkey` + CNAME `rsend`/`send`). `FROM_EMAIL` sur
  Railway mis à jour vers `EvLY <noreply@evly.ch>`. L'ancien domaine
  `estelle.fan` reste vérifié sur Resend en parallèle si besoin de
  rollback.
- **Backend** : Railway, projet "radiant-spontaneity" (workspace
  andrenakamoto), services "Postgres" et "Junto".
  URL : https://junto-production-8ded.up.railway.app (health check /health).
  Déploiement automatique sur push vers `main` (confirmé le 2026-08-23).
  Le CLI Railway est disponible ; pour s'y relier dans une nouvelle session :
  `railway link -p radiant-spontaneity` puis `railway service Junto`. Lire
  des noms de variables est possible
  (`railway variables --kv | grep -oE "^[A-Z_]+="`), lire leurs **valeurs**
  est bloqué par la sécurité de l'agent (normal, ne pas contourner).
- CORS whitelist codée en dur dans `server/src/index.ts` (allowedOrigins).
- Variables d'env clés (jamais commiter les valeurs réelles) : DATABASE_URL,
  JWT_SECRET, CLIENT_URL, APP_URL, VITE_API_URL, VITE_SOCKET_URL,
  VITE_GOOGLE_CLIENT_ID, RESEND_API_KEY, FROM_EMAIL, credentials
  Cloudinary/Twilio/Google OAuth. Toutes déjà configurées sur Railway ;
  `ENABLE_CRON` n'est **pas** nécessaire sur Railway (`RAILWAY_ENVIRONMENT_NAME`
  suffit à activer les crons).

## Chantiers en cours / à ne pas toucher sans demander

- **PWA (version installable du site)** : `client/icons/`,
  `client/public/manifest.webmanifest` — non branchée (manifest pas lié dans
  `index.html`, chemins d'icônes `../icons/...` hors de `public/`). Ne pas
  la brancher sans demander. Anciens fichiers logo `client/public/logo_estelle.png`
  et `client/public/logo.svg` : plus référencés nulle part depuis le
  rebranding, laissés en place au cas où, à supprimer si l'utilisateur confirme.
- **Notifications push des apps** : en place depuis le 2026-10-01 (voir
  « Apps Android / iOS »). Pas de Web Push sur le site (il faudrait brancher
  la PWA ci-dessus).

## Tests

- `cd server && npm test` (Vitest). Couvre uniquement la logique pure sans
  DB pour l'instant : répartition des dépenses + simplification des dettes
  (`lib/expenses.test.ts`), formatage iCal (`lib/ical.test.ts`). Pas de
  tests d'intégration API/DB commités.
- **Tester contre une base jetable (méthode validée le 2026-09-27)** :
  Docker Desktop est installé sur le Mac (éteint par défaut — `open -a
  Docker`). `docker run -d --rm --name evly-test-pg -e POSTGRES_PASSWORD=test
  -e POSTGRES_DB=evly_test -p 55432:5432 postgres:16-alpine`, puis
  **toujours** préfixer les commandes de
  `DATABASE_URL=postgresql://postgres:test@localhost:55432/evly_test` (la
  variable d'env prime sur `server/.env` — vérifier avec `npx prisma
  migrate status` que la datasource affichée est bien `localhost:55432`
  avant toute écriture). `npx prisma migrate deploy` applique tout
  l'historique sur la base vierge. Serveur : même préfixe +
  `JWT_SECRET=test-secret PORT=3999 npx ts-node-dev --transpile-only
  src/index.ts` (tokens de test signés avec ce secret). Client :
  `VITE_API_URL=http://localhost:3999/api VITE_SOCKET_URL=http://localhost:3999
  npx vite` puis Playwright avec `estelle_token` injecté dans
  localStorage. Arrêter le conteneur et quitter Docker ensuite.
- Pas de tests côté client pour l'instant.

## Consignes de travail

- Toujours écrire les textes UI, messages de commit et communications en
  français.
- Respecter le vocabulaire métier : Cercle, Plan, Membre, Créateur (jamais
  traduire ces termes).
- Ne pas committer/pusher sans confirmation explicite. Une fois confirmé,
  préférer plusieurs commits courts et cohérents (un par feature/fix) avec
  suffixe Co-Authored-By, plutôt qu'un seul gros commit.
- Avant toute modification du schema Prisma : voir la section "Base de
  données" ci-dessus, c'est le point le plus sensible du projet.
- Il y a des dossiers générés non commités par défaut : `client/android/`,
  `client/ios/`, `client/dist/`, `node_modules`, `server/dist/` — normal, ne
  pas s'inquiéter s'ils apparaissent modifiés/untracked (voir aussi la
  section "chantiers en cours" pour android/ios/icons spécifiquement).
- **Tenir ce fichier à jour** : à chaque changement structurel notable
  (nouvelle feature majeure, changement de modèle de données, changement de
  process de déploiement, nouvelle contrainte découverte), mettre à jour la
  section concernée ici plutôt que de laisser l'info uniquement dans
  l'historique de conversation.
