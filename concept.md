# Junto — Concept de l'application

## Vue d'ensemble

**Junto** est une application web sociale pensée pour les groupes de proches qui veulent se retrouver facilement. Elle repose sur trois niveaux : le **Cercle** (le groupe), le **Plan** (l'événement/salon), et le **Chat** à l'intérieur du Plan.

---

## Vocabulaire de l'application

| Terme dans l'app | Signification |
|---|---|
| **Junto** | L'application (= "ensemble" en espagnol/portugais) |
| **Cercle** | Le groupe de personnes (ex. : "Les amis du lundi", "Équipe boulot") |
| **Plan** | Le salon lié à un événement spécifique (ex. : "Qui veut manger ce midi ?") |
| **Membre** | Une personne appartenant à un Cercle |
| **Créateur** | L'admin du Cercle ou du Plan |

---

## Fonctionnalités principales

### 1. Le Cercle (Groupe)

- Créer un Cercle avec un **nom** et un **code d'accès** unique (généré automatiquement ou personnalisé)
- Rejoindre un Cercle en entrant son nom + code
- Chaque Cercle a une **liste de membres** visible par tous
- Le créateur du Cercle est **admin** : il peut expulser des membres, changer le code, supprimer le Cercle
- Un utilisateur peut appartenir à **plusieurs Cercles**
- Option : avatar et courte description du Cercle

---

### 2. Le Plan (Salon d'événement)

- N'importe quel membre peut créer un **Plan** dans un Cercle
- Un Plan a :
  - Un **titre** (ex. : "Resto ce vendredi soir ?")
  - Une **description** (lieu proposé, contexte, ambiance)
  - Une **date/heure** de l'événement (optionnelle)
- Rejoindre un Plan = **signifier son accord** avec la description (pas d'entrée silencieuse)
- Statuts de participation : **Je suis in** / **Peut-être** / **Je passe** (RSVP)
- Le Plan est visible à tous les membres du Cercle mais on ne peut y participer qu'en le rejoignant
- Le Plan peut expirer automatiquement après la date de l'événement (archivage)
- Possibilité de **rendre un Plan privé** (invitation manuelle par le créateur)

---

### 3. Fonctionnalités dans le Plan

#### Chat
- Chat en temps réel entre les membres du Plan
- Réactions emoji sur les messages
- Réponses en fil (thread)
- Mentions (@pseudo)
- Partage d'images/fichiers

#### Infos épinglées
- Section dédiée aux **informations clés** de l'événement :
  - Lieu (texte ou lien Google Maps)
  - Heure de rendez-vous
  - Liste "Qui apporte quoi" (chaque membre peut s'inscrire pour apporter quelque chose)
- Ces infos sont séparées du chat pour rester lisibles

#### Sondage rapide
- Créer un sondage dans le Plan (ex. : "On se retrouve à 12h ou 12h30 ?" / "Sushi ou pizza ?")
- Vote simple, résultats visibles par tous

#### Partage des dépenses
- Après l'événement, enregistrer **qui a payé quoi**
- Calcul automatique de qui doit combien à qui
- Marqué comme "réglé" une fois les comptes faits

#### Galerie post-événement
- Partage de photos après l'événement dans une section dédiée
- Les photos restent archivées même après l'expiration du Plan

---

### 4. Profil utilisateur

- Pseudo + avatar
- Pas d'email obligatoire à l'inscription (option pseudo uniquement pour rester léger)
- Voir ses Cercles et ses Plans actifs depuis le tableau de bord
- Historique des événements passés

---

### 5. Notifications

- Rappel avant le début d'un Plan (configurable : 1h, 1 jour avant)
- Notification quand quelqu'un rejoint un Plan que tu as créé
- Notification de nouveau message dans un Plan actif
- Résumé quotidien (opt-in) des Plans actifs dans tes Cercles

---

## Flux utilisateur type

```
1. Création de compte (pseudo + mot de passe)
2. Créer ou rejoindre un Cercle (nom + code)
3. Voir le tableau de bord du Cercle → liste des Plans actifs
4. Créer un Plan ou rejoindre un Plan existant
5. Interagir dans le Plan (chat, RSVP, sondage, infos)
6. Après l'événement : photos, dépenses, archivage
```

---

## Idées de fonctionnalités futures (v2+)

- **Calendrier partagé** du Cercle : vue mensuelle de tous les Plans
- **Intégration calendrier** (Google Calendar, iCal) pour exporter un Plan
- **Liens d'invitation** temporaires pour rejoindre un Plan sans être dans le Cercle
- **Thèmes visuels** pour les Cercles (couleur, bannière)
- **Mode anonyme** pour les sondages sensibles
- **Application mobile** (PWA ou React Native)
- **Statut de présence** en temps réel (en ligne / absent)

---

## Stack technique envisagée

| Couche | Technologie suggérée |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express (ou Fastify) |
| Base de données | PostgreSQL |
| Temps réel | Socket.io ou WebSockets |
| Auth | JWT + bcrypt |
| Hébergement | Vercel (front) + Railway / Render (back) |

---

## Priorités de développement (MVP)

1. Authentification (inscription / connexion)
2. Création et rejoindre un Cercle (nom + code)
3. Création d'un Plan dans un Cercle
4. RSVP sur un Plan
5. Chat en temps réel dans un Plan
6. Infos épinglées dans un Plan
7. Archivage automatique des Plans expirés

---

*Document créé le 2026-05-28*
