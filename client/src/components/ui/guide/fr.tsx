import { L, P, type Group, type GuideText } from './parts';

// Guide d'utilisation en français. À tenir à jour (dans les 4 langues) à chaque nouvelle fonction.
const groups: Group[] = [
  {
    title: 'Les bases',
    topics: [
      {
        id: 'vocabulaire', emoji: '🧭', title: 'Cercle, Plan, Chat', summary: 'Les trois mots à connaître',
        body: <>
          <P>Un <strong>Cercle</strong> est ton groupe : amis, famille, collègues, club, association. Un <strong>Plan</strong> est
            un événement précis dans un Cercle (« Resto vendredi ? », « Loto annuel »). Chaque Plan a son propre{' '}
            <strong>Chat</strong> et ses rubriques : un anniversaire et un apéro ne se mélangent jamais.</P>
          <P>À gauche, tes Cercles, puis <strong>« Tous mes plans »</strong> (par date, le plus proche d'abord) et le{' '}
            <strong>Calendrier</strong>. Cercles et Plans d'un Cercle sont triés par dernière activité.</P>
        </>,
      },
      {
        id: 'cercle', emoji: '👥', title: 'Créer, rejoindre, inviter dans un Cercle', summary: 'Code d’accès, lien, QR code ou invitation',
        body: <>
          <P><strong>« Créer un Cercle »</strong> sous « Mes Cercles » (nom, description, couleur). <strong>« Rejoindre un Cercle »</strong>{' '}
            avec son <strong>code d'accès</strong>, un lien ou un QR code. Si tu as déjà un compte, un membre peut aussi t'inviter
            par pseudo ou email : l'invitation arrive dans la cloche 🔔.</P>
          <P>Selon le Cercle, une demande est acceptée par un <strong>vote à la majorité</strong> des membres (par défaut), par les
            organisateurs, ou tout de suite. En mode vote, personne ne peut refuser seul.</P>
          <P>La liste des membres s'ouvre en touchant « N membres » sur le Cercle ou l'icône 👥 en haut de ses Plans : qui est en
            ligne, rôles, bouton « Inviter ».</P>
        </>,
      },
      {
        id: 'plan', emoji: '📅', title: 'Créer et modifier un Plan', summary: 'Titre, date, lieu, limite, fonctions',
        body: <>
          <P><strong>« Créer un Plan »</strong> en bas de la liste des Plans : titre, description, date, lieu, limite de participants,{' '}
            <strong>informations importantes</strong> (encadré bien visible). La <strong>date de fin est obligatoire</strong> : le
            Plan est supprimé ce jour-là (3 semaines au plus après son début). Les membres du Cercle sont prévenus.</P>
          <P>Le créateur modifie son Plan avec le crayon ; il peut laisser tout le monde changer les dates et le lieu, ou les
            informations importantes. Chaque changement est gardé dans l'<strong>historique</strong>.</P>
          <P>Dans <strong>« Paramètres avancés »</strong>, la liste <strong>« Fonctions du Plan »</strong> est rangée par catégorie
            (Échanger, Organiser, Fêter et offrir, Jouer) : décoche ce dont tu n'as pas besoin, coche les fonctions à activer
            (bénévoles, assemblée, cagnotte, jeux…). Modifiable ensuite avec l'icône réglages du Plan.</P>
        </>,
      },
      {
        id: 'repondre', emoji: '✋', title: 'Répondre et liste d’attente', summary: 'Je suis in · Peut-être · Absent(e)',
        body: <>
          <P>Rejoindre un Plan, c'est donner ton accord : <strong>Je suis in</strong>, <strong>Peut-être</strong> ou{' '}
            <strong>Absent(e)</strong>, visible de tous les participants. Les autres sont prévenus quand quelqu'un arrive ou se
            désiste.</P>
          <P><strong>Liste d'attente</strong> : un Plan avec une limite est complet quand les « Je suis in » et « Peut-être »
            l'atteignent. Inscris-toi en attente : dès qu'une place se libère, tu es inscrit(e) automatiquement, dans l'ordre,
            et prévenu(e). Ta position s'affiche sur la carte (« En attente n°2 »).</P>
        </>,
      },
      {
        id: 'sondage-dates', emoji: '🗓️', title: 'Sondage de dates', summary: 'Trouver la date avant de créer le Plan',
        body: <>
          <P>Dans un Cercle, <strong>« Proposer des dates »</strong> : chacun coche toutes les dates qui lui vont, ou « Pas
            intéressé(e) ». Le sondage a son chat. Quand une date se dégage, <strong>« Créer le Plan »</strong> le transforme en
            Plan (la conversation suit).</P>
          <P>Il se termine le lendemain de la dernière date proposée, 30 jours au plus ; son créateur reçoit un rappel la veille.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Plans récurrents', summary: 'Chaque semaine, toutes les 2 semaines, chaque mois',
        body: <>
          <P>À la création, choisis <strong>« Répéter »</strong> : chaque semaine, toutes les 2 semaines ou chaque mois, avec « Jusqu'au » facultatif. Dès que la date
            est passée, le Plan suivant est créé avec les mêmes infos et réglages, réponses remises à zéro. Menu du Plan :{' '}
            <strong>« Annuler cette fois »</strong> ou <strong>« Arrêter la répétition »</strong>.</P>
        </>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Plan et sondage surprise', summary: 'Cacher un Plan à certains membres',
        body: <P>Coche <strong>« Plan surprise »</strong> et choisis à qui le cacher : pour eux il n'existe pas (ni liste, ni
          notification, ni email). Les autres voient un bandeau qui rappelle pour qui c'est une surprise.</P>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Inviter quelqu’un d’extérieur', summary: 'Un lien vers un seul Plan, avec ou sans compte',
        body: <>
          <P><strong>Inviter</strong> → « Personne extérieure » : un lien à partager (WhatsApp, SMS, QR code). La personne voit{' '}
            <strong>ce Plan seulement</strong>, rien d'autre du Cercle.</P>
          <P>Sans compte, elle peut répondre avec son <strong>prénom</strong> (in, peut-être, je passe). Si elle crée un compte
            ensuite, ses réponses la suivent.</P>
          <P>Hors d'un Cercle, <strong>« Organiser une sortie »</strong> (page de connexion) crée un Plan en 30 secondes, même sans
            compte, rangé dans ton Cercle personnel « Mes Plans ».</P>
        </>,
      },
    ],
  },
  {
    title: 'Dans un Plan',
    topics: [
      {
        id: 'fiche', emoji: '📱', title: 'La fiche du Plan', summary: 'Cartes sur téléphone, onglets sur grand écran',
        body: <>
          <P>Sur téléphone, la fiche montre une <strong>carte par rubrique</strong> (Chat, Infos, Trajets, Membres, Votes,
            Dépenses et fonctions activées). Un point orange signale du nouveau. Retour : flèche, bouton retour ou glisser
            depuis le bord gauche. En bas, la <strong>barre d'actions</strong> : Inviter, Photos, Agenda, Story et Récap.</P>
          <P>Sur ordinateur et tablette, les rubriques sont des onglets.</P>
        </>,
      },
      {
        id: 'chat', emoji: '💬', title: 'Chat', summary: 'Mentions, réactions, photos, messages vocaux',
        body: <>
          <L items={[
            <><strong>@pseudo</strong> pour mentionner quelqu'un (notifié même en mode silencieux).</>,
            <>Réactions emoji et <strong>fils de réponse</strong> ; sur téléphone, touche un message pour réagir.</>,
            <><strong>Photos</strong> (appareil photo ou galerie) et <strong>messages vocaux</strong> (bouton micro, 2 minutes au plus).</>,
            <>Modifier ou supprimer ton message pendant <strong>15 minutes</strong> ; la photo que tu as envoyée se supprime à tout moment.</>,
            <><strong>Signaler</strong> un message à l'équipe EvLY, ou <strong>masquer</strong> une personne (ses messages et notifications disparaissent pour toi).</>,
          ]} />
        </>,
      },
      {
        id: 'infos', emoji: '📋', title: 'Infos, photos et fichiers', summary: 'Informations importantes, galerie, documents',
        body: <P>L'onglet <strong>Infos</strong> regroupe la description, les <strong>informations importantes</strong>, les
          fichiers et la galerie photo. <strong>« Télécharger toutes les photos »</strong> récupère tout d'un coup (ZIP) : pense
          à le faire avant la date de fin. 10 Mo par fichier, 100 Mo par Plan.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Votes : sondage, Match, Qui s’y colle ?', summary: 'Trois façons de décider ensemble',
        body: <>
          <L items={[
            <><strong>Sondage</strong> : une question, un choix. Anonyme ou non ; s'il ne l'est pas, chacun voit qui a voté quoi.</>,
            <><strong>Match</strong> 💘 : chacun dit oui ou non à chaque proposition (cartes à glisser, photo facultative). Les
              réponses des autres restent cachées tant que tu n'as pas fini. « C'est un match » quand tout le monde a dit oui. Le
              créateur du Plan choisit et peut reporter le choix dans le lieu ou les informations importantes.</>,
            <><strong>Qui s'y colle ?</strong> 🎡 : une roue tire au sort une personne du Plan (« Je suis in » et « Peut-être »).
              Décoche celles à retirer : leurs noms s'affichent avec le résultat. La roue tourne en même temps sur tous les
              téléphones qui regardent le Plan. Option « Pas deux fois la même personne ».</>,
          ]} />
        </>,
      },
      {
        id: 'trajets', emoji: '🚗', title: 'Trajets (covoiturage)', summary: 'Proposer, monter, chercher une place',
        body: <P>Un conducteur propose un trajet aller (départ, heure, places, note pour le retour). Les passagers touchent{' '}
          <strong>« Je monte »</strong> ; sans voiture, <strong>« Je cherche une place »</strong>. Passer « Absent(e) » te retire
          de ton trajet.</P>,
      },
      {
        id: 'depenses', emoji: '💶', title: 'Dépenses et « qui apporte quoi »', summary: 'Liste à apporter, frais partagés, CHF ou €',
        body: <>
          <P><strong>Qui apporte quoi</strong> : une liste (avec quantité) où chacun touche « Je prends ça ».</P>
          <P><strong>Dépenses</strong> : qui a payé quoi et pour qui ; EvLY calcule les soldes et propose les virements les plus
            simples. CHF et euros sont comptés séparément, sans conversion. Aucun argent ne passe par EvLY. Si des dépenses
            existent, un résumé est envoyé par email avant la suppression du Plan.</P>
        </>,
      },
    ],
  },
  {
    title: 'Fonctions à activer',
    topics: [
      {
        id: 'benevoles', emoji: '🙋', title: 'Bénévoles', summary: 'Postes à pourvoir, chacun s’inscrit',
        body: <P>Le créateur du Plan et les organisateurs du Cercle créent les postes (horaire, nombre de personnes). S'inscrire
          vaut « Je suis in ». Résumé « Il manque X personnes », filtre « Mes postes », avertissement si deux postes se
          chevauchent. Rappel par notification <strong>une heure avant</strong> la prise de poste.</P>,
      },
      {
        id: 'assemblee', emoji: '🏛️', title: 'Assemblée', summary: 'Ordre du jour, procurations, votes, procès-verbal',
        body: <>
          <P>Pour l'assemblée générale d'une association ou un comité. La date du Plan est celle de l'assemblée ; le créateur du
            Plan et les organisateurs du Cercle l'organisent, avec un ou une secrétaire facultatif.</P>
          <L items={[
            <><strong>Avant</strong> : ordre du jour (information, vote, élection) avec documents, convocation (app, notification,
              email), <strong>procurations</strong> à un autre membre.</>,
            <><strong>Réglages</strong> : membres votants (décoche les membres passifs), quorum, pointage avec le{' '}
              <strong>code de la salle</strong>, assemblée <strong>hybride</strong> (participation à distance).</>,
            <><strong>Pendant</strong> : seules les personnes pointées présentes votent, une fois pour elles et une fois par
              procuration. Quorum en direct, votes au <strong>bulletin secret</strong> ou à main levée, majorité simple, absolue
              ou des deux tiers, élections, décisions par acclamation.</>,
            <><strong>Après</strong> : procès-verbal PDF (présents, procurations, résultats, élus), envoyé au créateur du Plan à
              la clôture. Pense à le conserver : le Plan sera supprimé à sa date de fin.</>,
          ]} />
          <P>Au bulletin secret, personne ne peut savoir qui a voté quoi. Ce sont les statuts de l'association qui font foi.</P>
        </>,
      },
      {
        id: 'cagnotte', emoji: '🐷', title: 'Cagnotte cadeau', summary: 'Un cadeau commun, idées et votes',
        body: <P>Pour qui, objectif, montant proposé, comment payer. Chacun indique sa participation puis « J'ai payé » ;
          l'organisateur coche « Reçu ». Le montant de chacun n'est visible que par l'organisateur. Idées de cadeau avec votes.
          Aucun argent ne passe par EvLY. Pense à cacher le Plan à la personne fêtée (Plan surprise).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Père Noël secret', summary: 'Tirage au sort et cadeaux anonymes',
        body: <P>La date du Plan est celle de l'échange des cadeaux. Chacun note ses envies (ou « pas d'envie particulière »),
          l'organisateur lance le tirage. Tu ne connais que la personne que tu gâtes ; deux conversations anonymes permettent
          de poser des questions. Révélation à partir du jour de l'échange.</P>,
      },
      {
        id: 'killer', emoji: '🎯', title: 'Killer', summary: 'Une cible, un objet, un lieu',
        body: <P>Chaque joueur reçoit en secret une cible, un objet et un lieu : il doit lui faire tenir l'objet à cet endroit, sans éveiller ses soupçons. « J'ai eu ma cible »,
          la cible confirme, et tu hérites de sa mission. Le dernier en jeu gagne. Jouez dans le respect de chacun et en
          toute sécurité.</P>,
      },
      {
        id: 'mot-piege', emoji: '🗣️', title: 'Le mot piège', summary: 'Faire dire un mot secret',
        body: <P>Chacun doit faire dire un mot secret à sa cible sans se faire repérer. La cible confirme, ou démasque le
          piégeur. Mode points (classement en direct, fin à l'heure choisie) ou élimination.</P>,
      },
      {
        id: 'equipes', emoji: '🏆', title: 'Équipes et tournoi', summary: 'Tirage équilibré, championnat ou élimination',
        body: <P>Tirage des équipes (2 à 8, équilibrées par niveau si tu veux), puis championnat ou élimination directe.
          L'organisateur saisit les scores, le classement se calcule tout seul.</P>,
      },
    ],
  },
  {
    title: 'Rester informé',
    topics: [
      {
        id: 'notifications', emoji: '🔔', title: 'Notifications et cloche', summary: 'App, téléphone, email : à toi de choisir',
        body: <>
          <P>Menu ☰ → <strong>« Notifications »</strong> : notifications sur le téléphone, emails, ou les deux ; résumé
            hebdomadaire ; récapitulatif PDF avant la suppression de tes Plans.</P>
          <P>La <strong>cloche</strong> 🔔 en bas de la liste des Cercles regroupe ce que tu n'as pas encore vu, les invitations et
            les demandes d'adhésion. Rappels automatiques : la veille d'un Plan, avant la fin d'un sondage de dates, une heure
            avant un poste de bénévole.</P>
        </>,
      },
      {
        id: 'silence', emoji: '🔕', title: 'Mode silencieux', summary: 'Couper un Plan ou tout un Cercle',
        body: <P>Touche la cloche sur la carte d'un Plan (à côté de ta réponse) ou en haut de la liste des Plans d'un Cercle :
          plus de notification ni d'email pour ce Plan ou ce Cercle. Les points orange restent. Passent quand même : les
          mentions, les rappels de poste, une place libérée en liste d'attente et l'ouverture d'un vote d'assemblée.</P>,
      },
    ],
  },
  {
    title: 'Règles et organisation',
    topics: [
      {
        id: 'roles', emoji: '👑', title: 'Rôles et décisions', summary: 'Créateur, organisateurs, votes à la majorité',
        body: <L items={[
          <><strong>Créateur du Cercle</strong> : gère le Cercle et nomme les <strong>organisateurs</strong> (liste des membres).</>,
          <><strong>Organisateurs</strong> : gèrent le Cercle avec lui (réglages, demandes, Plans réservés) mais ne modifient pas
            les Plans des autres et ne suppriment pas le Cercle.</>,
          <><strong>Créateur d'un Plan</strong> : modifie son Plan et ses réglages.</>,
          <>Par défaut, accepter un membre et supprimer un Cercle ou un Plan se décident <strong>à la majorité</strong>.</>,
        ]} />,
      },
      {
        id: 'parametres', emoji: '⚙️', title: 'Paramètres avancés', summary: 'Pour les associations, clubs, entreprises',
        body: <L items={[
          <>Cercle : admission (vote, organisateurs, libre), création des Plans et des sondages (tous ou organisateurs),
            suppression (vote ou créateur seul).</>,
          <>Plan : fonctions du Plan, qui modifie dates et lieu, qui modifie les informations importantes, suppression.</>,
          <>Visibles par tous (icône réglages) ; un historique garde les changements du Cercle.</>,
        ]} />,
      },
    ],
  },
  {
    title: 'Garder une trace',
    topics: [
      {
        id: 'trace', emoji: '📸', title: 'Story, agenda, récapitulatif', summary: 'Souvenirs et documents à garder',
        body: <L items={[
          <><strong>Story</strong> : une image souvenir (titre, date, lieu, présents) avec la photo de ton choix.</>,
          <><strong>Agenda</strong> : ajoute le Plan à ton calendrier (fichier .ics).</>,
          <><strong>Récap</strong> (créateur du Plan et organisateurs) : un PDF avec infos, participants, bénévoles, dépenses et votes.</>,
          <><strong>Historique</strong> des modifications : menu du Plan.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Suppression automatique', summary: 'Un Plan disparaît à sa date de fin',
        body: <P>À sa date de fin, un Plan est supprimé avec tout son contenu : c'est voulu, EvLY reste léger. Avant : télécharge
          les photos, le récapitulatif ou le procès-verbal. Le temps restant s'affiche dans la fiche (⏳).</P>,
      },
    ],
  },
  {
    title: 'Ton compte',
    topics: [
      {
        id: 'compte', emoji: '👤', title: 'Compte, apps et suggestions', summary: 'Profil, applications, proposer une idée',
        body: <>
          <P>Menu ☰ en bas à gauche : <strong>Mon profil</strong> (prénom, nom, email), mot de passe, notifications,{' '}
            <strong>Proposer une amélioration</strong> (et suivre la réponse), suppression du compte. Les autres membres voient
            ton prénom et ton pseudo, jamais ton nom de famille (sauf dans le procès-verbal d'une assemblée).</P>
          <P><strong>Langue</strong> : EvLY existe en français, allemand, italien et anglais. Change-la dans{' '}
            <strong>Mon profil</strong> ; les emails et notifications suivent ta langue.</P>
          <P>EvLY existe aussi en <strong>application iPhone et Android</strong>, avec notifications sur le téléphone. Tout se
            met à jour en direct ; un bandeau propose de recharger quand une nouvelle version est en ligne.</P>
        </>,
      },
      {
        id: 'limites', emoji: '📏', title: 'Limites à connaître', summary: 'Fichiers, durée, Cercles, pseudo',
        body: <L items={[
          'Fichiers : 10 Mo par fichier, 100 Mo par Plan.',
          'Un Plan dure 3 semaines au plus.',
          '20 Cercles créés au maximum par personne.',
          'Pseudo : lettres sans accent, chiffres et _ (2 à 24 caractères), sans distinction de majuscules.',
        ]} />,
      },
    ],
  },
];

const summary: GuideText['summary'] = [
  { emoji: '👥', text: <>Un <strong>Cercle</strong> pour chaque groupe, un <strong>Plan</strong> pour chaque événement, un chat par Plan.</> },
  { emoji: '✋', text: <>Chacun répond <strong>in / peut-être / absent</strong> ; liste d'attente si c'est complet.</> },
  { emoji: '🗳️', text: <>On décide ensemble : <strong>dates</strong>, sondages, <strong>Match</strong>, roue <strong>Qui s'y colle ?</strong></> },
  { emoji: '🚗', text: <>On s'organise : <strong>trajets</strong>, <strong>qui apporte quoi</strong>, <strong>dépenses</strong>, <strong>bénévoles</strong>.</> },
  { emoji: '🏛️', text: <>Les associations tiennent leur <strong>assemblée</strong> : votes, procurations, procès-verbal.</> },
  { emoji: '🎉', text: <>On s'amuse : <strong>cagnotte</strong>, <strong>Père Noël secret</strong>, <strong>Killer</strong>, <strong>mot piège</strong>, <strong>tournoi</strong>.</> },
  { emoji: '⏳', text: <>Un Plan <strong>disparaît à sa date de fin</strong> : garde photos, récap ou PV avant.</> },
];

const fr: GuideText = {
  title: 'Guide d’utilisation',
  subtitle: 'L’essentiel d’abord, puis chaque fonction en détail',
  briefTitle: 'EvLY en bref',
  tocTitle: 'Sommaire',
  close: 'Fermer',
  summary,
  groups,
};
export default fr;
