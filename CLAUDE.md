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
- **Thème clair** (2026-09-27) : les colonnes de navigation (Cercles,
  Plans, Tous mes plans, Calendrier) sont passées du sombre (slate-900/800)
  au clair — fond `slate-100`/`slate-50`, cartes blanches `shadow-sm` +
  bordure `slate-200`, liseré de couleur du Cercle à gauche, élément
  sélectionné en corail plein (`bg-indigo-600`, texte blanc). Logo en
  `LogoFull light`. Les pages d'authentification restent sombres.
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
- **Fiche promo publique** : `client/public/decouvrir.html` (servie telle
  quelle par Vercel sur `evly.ch/decouvrir.html`, liée depuis AuthPage
  « Découvrir EvLY en 1 minute »). Page HTML autonome, copie de la
  fiche promo (comparatif WhatsApp/EvLY), avec bouton « Créer mon compte »
  masqué à l'impression. La tenir à jour quand une fonctionnalité
  importante est ajoutée.
  `client/public/logo-evly.svg` (l'ancienne icône badge) ne sert plus
  qu'au favicon — remplacé par un simple monogramme "EV" sur le dégradé
  corail, lisible à 16px.
- **Backend** : Node.js + Express + TypeScript, ts-node-dev en dev
- **Base de données** : PostgreSQL via Prisma ORM (migrations dans
  `server/prisma/migrations` — voir section base de données ci-dessus)
- **Temps réel** : Socket.io (chat, présence, réactions)
- **Tests** : Vitest côté serveur (`npm test` dans `server/`), limité pour
  l'instant aux fonctions pures (pas d'intégration DB, voir section tests)
- **Auth** : JWT + bcrypt, connexion par pseudo OU email, + Google Sign-In
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

- **User** : pseudo (unique), firstName?/lastName? (2026-09-27 : prénom
  obligatoire à l'inscription par email — contrôlé par l'API, pas par la base —,
  nom facultatif, pré-remplis depuis Google ; les comptes plus anciens sans
  prénom voient `ProfileNameBanner` ; affichés « Prénom Nom » + @pseudo dans
  les listes de membres, le chat et les mentions restent au pseudo),
  password?, email? (unique), emailVerified,
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
  (Comportement par défaut — voir « Paramètres avancés » ci-dessous.)
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
  - `Circle.deletionMode` / `Plan.deletionMode` : `vote` (défaut) ou
    `creator` (vote-delete supprime immédiatement si c'est le créateur, 403
    sinon ; passer en `creator` efface les votes en cours).
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
- **CirclePoll** / **CirclePollOption** / **CirclePollVote** : sondage pour
  caler une date *avant* de créer un Plan (contrairement à Poll qui
  appartient à un Plan déjà créé). Vote **multiple** — chaque membre coche
  toutes les dates qui lui conviennent, pas de choix exclusif comme pour
  Poll. `resolvedAt`/`createdPlanId` marquent le sondage comme converti
  (une fois transformé en Plan via le créateur du sondage, il disparaît de
  la liste des sondages actifs). `createPlanInCircle()`/`notifyNewPlan()`
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
- **Plan** : title, description, eventDate?, endDate (obligatoire, auto-
  archivage), location?, maxParticipants? (limite optionnelle, bloque le
  join si atteinte), deletionMode, disabledFeatures (voir Paramètres
  avancés), reminderSentAt? (anti-doublon rappel email), archived,
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

Chat + réactions + fils + présence gérés via socket.io
(`server/src/socket/handlers.ts`), pas via route REST. Événements clés :
`join-plan`/`leave-plan`, `send-message` (accepte parentId), `message`,
`toggle-reaction`, `reactions-updated`, `presence` / `presence-snapshot`
(rooms `circle:{id}` rejointes à la connexion selon les Cercles de
l'utilisateur), `notification` (types: new_message, mention — les autres
types de notification (new_plan, new_circle_poll, join_request,
join_accepted) sont émis directement depuis les routes REST concernées
dans `circles.ts`, pas depuis `handlers.ts` ; le type `ride` vient de
`lib/rides.ts`). Le covoiturage émet aussi `rides-updated` dans la room
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
