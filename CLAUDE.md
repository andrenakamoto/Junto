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
estelle.fan reste actif en parallèle (pas coupé). L'`appId` Capacitor
(`com.estelle.app`) et le dossier
Cloudinary (`estelle/`) restent inchangés, non liés au nom de domaine.

Repo GitHub : https://github.com/andrenakamoto/Junto (branche main)
Toute la communication utilisateur (UI, commits, docs) est en **FRANÇAIS**.

## Concept

EvLY sert aux groupes de proches qui veulent se retrouver facilement.
Trois niveaux d'organisation :
- **Cercle** = le groupe (ex. "Les amis du lundi"), rejoint via nom + code d'accès
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
- **Backend** : Node.js + Express + TypeScript, ts-node-dev en dev
- **Base de données** : PostgreSQL via Prisma ORM (migrations dans
  `server/prisma/migrations` — voir section base de données ci-dessus)
- **Temps réel** : Socket.io (chat, présence, réactions)
- **Tests** : Vitest côté serveur (`npm test` dans `server/`), limité pour
  l'instant aux fonctions pures (pas d'intégration DB, voir section tests)
- **Auth** : JWT + bcrypt, connexion par pseudo OU email, + Google Sign-In
  (google-auth-library côté serveur, @codetrix-studio/capacitor-google-auth
  côté mobile). Rate limiting sur les routes sensibles (express-rate-limit).
- **Fichiers joints** : Cloudinary (upload, download via proxy backend + token
  JWT temporaire pour contourner les limitations mobile/Cloudinary)
- **Emails** : Resend (vérification email, reset password, rappels de Plan,
  résumé hebdomadaire)
- **SMS** : Twilio (optionnel, invitations)
- **Mobile** : Capacitor (dossiers `client/android` et `client/ios` générés,
  PWA avec manifest.webmanifest) — **chantier inachevé, voir section dédiée**

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

- **User** : pseudo (unique), password?, email? (unique), emailVerified,
  googleId?, tokens de vérif/reset, status ("approved" par défaut), isAdmin,
  acceptedTermsVersion, weeklyDigestEnabled (défaut true), lastDigestSentAt
- **Circle** : name, code (unique), description?, color? (palette fixe de
  8 couleurs, `CIRCLE_COLORS` côté client), creatorId
- **CircleMember** : userId+circleId (clé composite), role
- **CircleDeleteVote** : vote collectif pour supprimer un Cercle
- **CircleJoinRequest** / **CircleJoinVote** : demande pour rejoindre un
  Cercle (créée à la place d'un accès direct) + votes des membres actuels ;
  seuil d'acceptation = ceil(nombre de membres / 2), même formule que
  CircleDeleteVote/PlanDeleteVote. Aucun refus unilatéral possible (pas
  même par le créateur) — seul le vote à la majorité fait foi, une demande
  reste en attente indéfiniment tant que le seuil n'est pas atteint.
- **Plan** : title, description, eventDate?, endDate (obligatoire, auto-
  archivage), location?, maxParticipants? (limite optionnelle, bloque le
  join si atteinte), reminderSentAt? (anti-doublon rappel email), archived,
  circleId, creatorId
- **PlanMember** : userId+planId, rsvp ("in" par défaut)
- **PlanDeleteVote**, **PlanChangeLog**
- **Message** : content, authorId, planId, parentId? (fils de réponse,
  self-relation "MessageReplies", cascade)
- **MessageReaction** : messageId+userId+emoji (unique), pour les réactions
  emoji temps réel
- **Poll** / **PollOption** / **PollVote** : sondages ; `Poll.anonymous`
  (bool) — si vrai, l'API anonymise les userId des votes des autres membres
  dans la réponse (voir `anonymizePoll`/`anonymizePlanPolls` dans
  `plans.ts`), la UI ne s'appuyait déjà que sur les comptes donc c'est
  surtout une protection côté API contre l'inspection réseau
- **BringItem** : liste "qui apporte quoi"
- **Attachment** : fichiers Cloudinary liés à un Plan (url, publicId,
  resourceType, mimeType, size) — les images sont affichées en galerie
  séparée dans InfosTab, les autres types en liste de fichiers
- **Expense** : description, amount, paidById, planId — réparti à parts
  égales entre les membres listés dans `splitWith` (**ExpenseShare**,
  sélectionnés à la création, pas forcément tous les membres du Plan).
  Les dépenses créées avant cette fonctionnalité (2026-08-23) ont
  `splitWith` vide : `computeBalances` retombe alors sur tous les membres
  du Plan pour rester rétrocompatible.
- **ExpenseShare** : userId+expenseId (clé composite), les participants
  d'une dépense précise
- **Reimbursement** : amount, fromUserId, toUserId, planId — enregistre un
  remboursement réel qui vient compenser les soldes calculés

Suppression des Plans expirés (`lib/reminders.ts` `deleteExpiredPlans`,
appelée par le cron dans `index.ts`) : si un Plan expiré a des dépenses,
un email de résumé (dépenses + virements suggérés pour équilibrer les
comptes) est envoyé à tous les membres avant suppression — sinon cette
info disparaîtrait avec le Plan (cascade sur Expense/Reimbursement).

## API (`server/src/routes`)

- **auth.ts** : /needs-setup, /setup, /register, /verify-email,
  /resend-verification, /login, /google, /forgot-password, /reset-password,
  /me, /change-password, /add-email, /accept-terms,
  /notification-settings (PUT, toggle weeklyDigestEnabled).
  Rate limité : login/register/google (loginLimiter/registerLimiter),
  resend-verification/forgot-password (emailActionLimiter).
- **circles.ts** : CRUD cercles (+ color à la création), /join (crée une
  CircleJoinRequest, n'ajoute plus directement le membre — voir modèle de
  données), /:id/join-requests/:requestId/vote (POST, toggle, accepte le
  membre au seuil — pas de route de refus, voir modèle de données),
  /:id/plans (list+create, avec maxParticipants),
  /:id/vote-delete, /:id/color (PUT, créateur uniquement), /:id/leave
  (POST — un membre quitte de lui-même ; si c'est le créateur et qu'il
  reste d'autres membres, le rôle de créateur passe au membre le plus
  ancien ; si le créateur était seul, le Cercle est supprimé)
- **plans.ts** : CRUD plans (+ maxParticipants), /:id/join (vérifie la
  capacité), /:id/rsvp, /:id/messages (top-level uniquement, parentId:null),
  /messages/:messageId/replies (fil), /:id/polls (+anonymous,
  /polls/:id/vote), /:id/items (+claim), /:id/vote-delete,
  /:id/expenses (GET liste+soldes, POST créer), /expenses/:id (DELETE),
  /:id/reimbursements (POST), /:id/ical (GET, export .ics)
- **admin.ts** : /users, /users/:id/approve|reject|reset-password,
  DELETE /users/:id, /stats
- **attachments.ts** : upload, /:id/download-token, /:id/download (proxy), DELETE
- **invitations.ts** : /status (twilioEnabled), /sms (Twilio), /email (Resend
  — toujours disponible, pas de flag "enabled" côté client contrairement au SMS)

La création d'un Plan (`circles.ts` POST /:id/plans) envoie, en plus de la
notification temps réel existante, un email à chaque membre du Cercle
(hors créateur) ayant un email vérifié.

`plans.ts` POST /:id/join envoie un email au créateur du Plan, mais
uniquement quand le Plan passe de 1 à 2 membres (créateur + premier
arrivant) — pas à chaque membre suivant, pour éviter le bruit.

Chat + réactions + fils + présence gérés via socket.io
(`server/src/socket/handlers.ts`), pas via route REST. Événements clés :
`join-plan`/`leave-plan`, `send-message` (accepte parentId), `message`,
`toggle-reaction`, `reactions-updated`, `presence` / `presence-snapshot`
(rooms `circle:{id}` rejointes à la connexion selon les Cercles de
l'utilisateur), `notification` (types: new_message, mention).

## Déploiement

- **Frontend** : Vercel, domaine principal **www.evly.ch** (evly.ch redirige
  dessus en 308) — migration terminée le 2026-08-23 (nom acheté sur
  Infomaniak). estelle.fan/www.estelle.fan restent actifs et autorisés en
  CORS/Vercel en parallèle (pas de coupure), à retirer plus tard si
  l'utilisateur le souhaite. Ancien domaine junto-appli.vercel.app encore
  autorisé en CORS. Déploiement probablement automatique sur push GitHub
  (non confirmé par CLI — vérifier le dashboard si besoin).
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

- **PWA/mobile inachevé** : `client/android/`, `client/ios/`, `client/icons/`,
  `client/public/manifest.webmanifest` — fichiers non commités de
  l'utilisateur, générés mais pas branchés (manifest pas lié dans
  `index.html`, chemins d'icônes probablement cassés — `../icons/...`
  pointe hors de `public/`). Ne pas "corriger" ni committer sans que
  l'utilisateur le demande explicitement. `capacitor.config.ts` a son
  `appName` mis à jour vers "EvLY" (rebranding du 2026-08-23), mais
  `appId` reste `com.estelle.app` — le changer nécessiterait de
  régénérer `android/`/`ios/` (`npx cap sync`), délibérément pas fait.
  Anciens fichiers logo `client/public/logo_estelle.png` et
  `client/public/logo.svg` : plus référencés nulle part depuis le
  rebranding (le nouveau logo est `client/public/logo-evly.svg`), laissés
  en place au cas où, à supprimer si l'utilisateur confirme.
- **Notifications push** : explicitement mises de côté (session du
  2026-08-23) — nécessite de finir le PWA ci-dessus pour le Web Push
  (faisable sans credentials externes, clés VAPID auto-générables), et un
  projet Firebase + compte Apple Developer pour le push natif Android/iOS
  (credentials à obtenir de l'utilisateur).

## Tests

- `cd server && npm test` (Vitest). Couvre uniquement la logique pure sans
  DB pour l'instant : répartition des dépenses + simplification des dettes
  (`lib/expenses.test.ts`), formatage iCal (`lib/ical.test.ts`). Pas de
  tests d'intégration API/DB — bloqué tant qu'il n'existe pas de base de
  test séparée de la production (voir section base de données).
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
