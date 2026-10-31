import { L, P, type Group, type GuideText } from './parts';

// Guide d'utilisation en français. À tenir à jour (dans les 4 langues) à chaque nouvelle fonction.
const groups: Group[] = [
  {
    title: 'Les bases',
    topics: [
      {
        id: 'discussion', emoji: '💬', title: 'Discussion du Cercle', summary: 'Parler entre deux sorties, sans tout mélanger',
        body: <>
          <P>Chaque Cercle peut avoir sa <strong>Discussion</strong> : la carte « 💬 Discussion » en haut de la liste des Plans. On y parle de
            tout ce qui n'est pas encore une sortie (« Quelqu'un dispo samedi ? »). Les messages <strong>disparaissent au bout de 7 jours</strong> :
            ce qui compte va dans un Plan.</P>
          <P><strong>Faire un Plan</strong> sous un message ouvre « Créer un Plan » avec ce message en titre. Réactions, photos et mentions
            @pseudo comme dans le chat d'un Plan.</P>
          <P>Le créateur et les organisateurs choisissent dans les réglages du Cercle : <strong>Ouverte</strong> (tout le monde écrit),{' '}
            <strong>Annonces</strong> (eux seuls écrivent, les autres réagissent) ou <strong>Désactivée</strong>. Notifications : un point
            orange et un push à chaque message (tu peux les limiter aux messages qui te mentionnent dans Notifications).</P>
        </>,
      },
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
          <P>Selon le Cercle, une demande est acceptée par les <strong>organisateurs</strong> (par défaut), par un vote à la
            majorité des membres, ou tout de suite. En mode vote, personne ne peut refuser seul.</P>
          <P>La liste des membres s'ouvre en touchant « N membres » sur le Cercle ou le bouton <strong>« Membres »</strong> en haut de ses Plans (les autres actions du Cercle sont dans le menu ⋯) : qui est en
            ligne, rôles, bouton « Inviter ».</P>
        </>,
      },
      {
        id: 'contacts', emoji: '📇', title: 'Mes contacts', summary: 'Toutes les personnes de tes Cercles, au même endroit',
        body: <>
          <P>Le bouton <strong>« Contacts »</strong> (à côté de « Tous mes plans » et « Calendrier ») réunit toutes les personnes
            avec qui tu partages un Cercle, avec leurs Cercles en commun. Recherche par prénom ou pseudo ; toucher un Cercle l'ouvre.</P>
          <P>Toucher une personne ouvre sa <strong>fiche</strong> : Cercles et Plans à venir en commun, <strong>« Faire un Plan »</strong>{' '}
            dans un Cercle en commun, et <strong>« Inviter »</strong> dans un de tes autres Cercles. La même fiche s'ouvre en touchant
            un avatar (membres, chat).</P>
          <P>Dans « Inviter » d'un Cercle, <strong>« Parmi mes contacts »</strong> propose les membres de tes autres Cercles : coche-les
            et invite-les d'un coup. Tu ne vois que des personnes que tu vois déjà dans tes Cercles (prénom et pseudo) ; celles
            que tu as masquées n'apparaissent pas.</P>
        </>,
      },
      {
        id: 'decouvrir', emoji: '🧭', title: 'Découvrir', summary: 'Les sorties près de chez toi, et y aller à plusieurs',
        body: <>
          <P>Le bouton <strong>« Découvrir »</strong> (à côté de « Contacts ») montre les événements des 14 prochains jours et des
            <strong> idées de sorties</strong> (escape games, bowling, musées…) partout en <strong>Suisse</strong>.
            Choisis le lieu (une ville, un village ou « Autour de moi ») et le rayon (10, 25 ou 50 km), filtre par jour ou par catégorie, ou cherche un mot (« salsa », « concert »…).</P>
          <P>Sur un événement, <strong>« Y aller avec un Cercle »</strong> ouvre un Plan déjà rempli (titre, date, lieu, lien) dans le
            Cercle de ton choix ; <strong>« Plus d'infos »</strong> ouvre le site de l'organisateur ou de l'agenda d'où vient l'annonce.</P>
          <P>Les annonces viennent d'agendas publics (par exemple celui de la Ville de Genève) et de l'équipe EvLY.
            <strong> Elles peuvent contenir des erreurs</strong> : vérifie toujours sur le site de l'organisateur, et utilise
            « Signaler une erreur » si quelque chose ne va pas. Découvrir est aussi visible sans compte, sur evly.ch/sorties.</P>
          <P><strong>« Poster un événement public »</strong> arrive prochainement pour les organisateurs : laisse tes coordonnées pour être prévenu. Les comptes déjà autorisés par EvLY publient un Plan en <strong>Mode annonce</strong> avec <strong>« Publier dans Découvrir »</strong> (menu ⋮ ou icône 🧭 du Plan) : l'annonce suit le Plan, et chacun peut <strong>« S'inscrire »</strong> par son lien d'invitation.</P>
        </>,
      },
      {
        id: 'dispo', emoji: '🟢', title: '« Je suis dispo »', summary: 'Dire qu’on est libre, et en faire un Plan',
        body: <>
          <P>Dans un Cercle, <strong>« Je suis dispo »</strong> (le bouton vert, à côté de « Discussion ») : <strong>maintenant</strong> (pendant 3 heures) ou{' '}
            <strong>ce soir</strong>, avec si tu veux une activité (🍻 Apéro, 🍕 Manger, 🎬 Ciné…) et un petit mot. Tu peux le dire dans
            plusieurs Cercles à la fois. Les membres sont prévenus, et la carte du Cercle affiche « 🟢 3 dispo ».</P>
          <P>Dès que <strong>assez de personnes sont dispo</strong> (3 par défaut), <strong>« Lancer un Plan »</strong> propose un Plan
            tout prêt (« Apéro ce soir 🍻 », heure proposée) ; les dispos s'effacent ensuite. Tout disparaît aussi tout seul à la fin du
            moment choisi.</P>
          <P>Dans la fenêtre, <strong>« Plan proposé dès »</strong> reprend le nombre du Cercle ; tu peux le changer pour ta dispo (par exemple « dès 2 » si un tête-à-tête te suffit).</P>
          <P>La fonction est <strong>désactivée par défaut</strong> : le créateur et les organisateurs l’activent ou la coupent et choisissent le nombre de personnes dans les paramètres
            du Cercle. Pour ne plus être prévenu : Notifications → « Dispo de mes Cercles ».</P>
        </>,
      },
      {
        id: 'plan', emoji: '📅', title: 'Créer et modifier un Plan', summary: 'Titre, date, lieu, limite, fonctions',
        body: <>
          <P><strong>« Créer un Plan »</strong> en bas de la liste des Plans : titre, description, date, lieu, limite de participants,{' '}
            <strong>informations importantes</strong> (encadré bien visible). La <strong>date de fin est obligatoire</strong> : le
            Plan passe alors en lecture seule, puis il est supprimé 24 h plus tard (3 semaines au plus après son début). Les membres du Cercle sont prévenus.</P>
          <P>Le créateur modifie son Plan avec le crayon ; il peut laisser tout le monde changer les dates et le lieu, ou les
            informations importantes. Chaque changement est gardé dans l'<strong>historique</strong>.</P>
          <P>Dans <strong>« Paramètres avancés »</strong>, la liste <strong>« Fonctions du Plan »</strong> est rangée par catégorie
            (Échanger, Organiser, Fêter et offrir, Jouer) : décoche ce dont tu n'as pas besoin, coche les fonctions à activer
            (planning, assemblée, cagnotte, jeux…). Modifiable ensuite avec l'icône réglages du Plan.</P>
        </>,
      },
      {
        id: 'types', emoji: '✨', title: 'Plan standard ou Plan spécifique', summary: 'Des Plans déjà réglés : surprise, Père Noël secret, assemblée…',
        body: <>
          <P>Dans un Cercle, <strong>« Créer »</strong> propose <strong>Plan standard</strong> (une sortie, un événement),
            <strong> Plan spécifique</strong> et <strong>Proposer des dates</strong>. Un Plan spécifique arrive déjà réglé pour son usage :</P>
          <P>🎂 <strong>Surprise</strong> (tu choisis pour qui : le Plan lui est caché, cagnotte activée) · 🎅 <strong>Père Noël secret</strong>
            (du 24 au 31 décembre ; une fois les cadeaux échangés, la révélation termine le Plan le soir même) · 🗳️ <strong>Assemblée</strong>
            (créateur et organisateurs du Cercle) · 📋 <strong>Organisation à plusieurs</strong> (planning des tâches) · 📣 <strong>Annonce</strong>
            (Mode annonce) · 🔁 <strong>Cours</strong> (chaque semaine, 1 h 30) · 🎲 <strong>Soirée jeux</strong> (tu choisis les jeux) ·
            🧳 <strong>Week-end ou voyage</strong> (sur plusieurs jours).</P>
          <P>Tout reste modifiable : dans « Plus d'options » avant de créer, puis dans « Modifier ».</P>
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
          <P>Dans un Cercle, <strong>« Créer » › « Proposer des dates »</strong> : chacun coche toutes les dates qui lui vont, ou « Pas
            disponible ». Le sondage a son chat. Quand une date se dégage, <strong>« Créer le Plan »</strong> le transforme en
            Plan (la conversation suit). Son créateur peut <strong>ajouter des dates</strong> en cours de route : ceux qui ont
            déjà répondu sont prévenus.</P>
          <P>Il se termine le lendemain de la dernière date proposée, 30 jours au plus ; son créateur reçoit un rappel la veille.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Plans récurrents', summary: 'Chaque semaine, toutes les 2 semaines, chaque mois',
        body: <>
          <P>À la création, choisis <strong>« Répéter »</strong> : chaque semaine, toutes les 2 semaines ou chaque mois, avec « Jusqu'au » facultatif. Dès que la date
            est passée, le Plan suivant est créé avec les mêmes infos et réglages, réponses remises à zéro. Sondages, matchs et roues sont repris sans les votes : chacun revote. Menu du Plan :{' '}
            <strong>« Annuler cette fois »</strong> ou <strong>« Arrêter la répétition »</strong>.</P>
        </>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Qui voit ce Plan (surprise, réservé)', summary: 'Cacher un Plan à certaines personnes, ou le réserver à quelques-unes',
        body: <P>Dans <strong>Plus d'options › Participants › Qui voit ce Plan ?</strong> : <strong>« Cacher à… »</strong> (pour
          ces personnes, le Plan n'existe pas : ni liste, ni notification, ni email) ou <strong>« Réservé à… »</strong> (seules
          les personnes choisies le voient, par exemple le comité d'une association ; celles qui rejoignent le Cercle plus tard
          ne le voient pas non plus). Pour un anniversaire, coche <strong>« C'est une surprise »</strong> : les autres voient un
          bandeau « Chut, ne dis rien ! ». Même chose pour les sondages de dates.</P>,
      },
      {
        id: 'plusieurs-cercles', emoji: '🔗', title: 'Plan pour plusieurs Cercles', summary: 'Un même Plan pour plusieurs groupes',
        body: <P>Si tu es créateur ou organisateur de plusieurs Cercles (une école, un club avec plusieurs groupes), coche
          <strong> « Plan pour plusieurs Cercles »</strong> dans « Participants » à la création : le Plan apparaît dans chaque Cercle
          choisi, avec un seul chat et une seule liste de participants. Les Cercles ne se changent plus ensuite. Avant de
          rejoindre, chacun est prévenu que des personnes d'autres Cercles verront son prénom et son pseudo.</P>,
      },
      {
        id: 'annonce', emoji: '📣', title: 'Mode annonce', summary: 'Informer et savoir qui vient (spectacle, cours…)',
        body: <P>À la création, dans <strong>Fonctions › Organiser</strong>, coche <strong>« Mode annonce »</strong> : toutes les fonctions sont décochées et la liste des
          participants est réservée au créateur et aux organisateurs. Les participants voient les infos, l'affiche et les
          documents, et répondent ; ils ne voient que leur propre réponse (et les places restantes si le Plan est limité). Le
          créateur et les organisateurs ajoutent l'affiche (photos en grand en haut des infos) et les documents ; les participants
          n'en ajoutent pas (règle « Qui ajoute des photos et fichiers », dans Règles, valable pour tout Plan).</P>,
      },
      {
        id: 'allerAvec', emoji: '🎟️', title: 'Y aller avec un Cercle', summary: 'Aller à un événement avec ses amis',
        body: <>
          <P>Dans un Plan en Mode annonce (un gala, une soirée…), le bouton <strong>« Y aller avec un Cercle »</strong> crée un Plan
            dans un de tes Cercles, déjà rempli avec le titre, les dates et le lieu. Tes amis s'y organisent : qui vient, chat,
            trajets.</P>
          <P>Le Plan des amis montre une carte <strong>« Événement »</strong> avec le bouton « S'inscrire à l'événement » : chacun
            s'inscrit lui-même, les places de l'organisateur sont respectées. Répondre dans le Plan des amis n'inscrit pas à
            l'événement. L'organisateur peut couper cette possibilité dans les Règles du Plan.</P>
        </>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Inviter quelqu’un d’extérieur', summary: 'Un lien vers un seul Plan, avec ou sans compte',
        body: <>
          <P>Dans un Plan, <strong>Inviter</strong> → « Lien du Plan » : un lien à partager (WhatsApp, SMS, QR code). La personne voit{' '}
            <strong>ce Plan seulement</strong>, rien d'autre du Cercle. La règle <strong>« Qui invite des personnes extérieures »</strong>
            (Règles du Plan) dit qui peut le partager : tous les participants, le créateur et les organisateurs, ou personne. Dans un
            Cercle, <strong>Inviter</strong> propose le code et le lien du Cercle, selon sa règle d'admission.</P>
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
        id: 'en-bref', emoji: '✨', title: 'En bref', summary: 'Ta synthèse du Plan en un coup d’œil',
        body: <>
          <P>Le bouton <strong>En bref</strong> (sur la carte du Plan, et en tête de la fiche) résume le Plan <strong>pour
            toi</strong> : date, lieu, qui vient, informations importantes, ton trajet, ce que tu apportes, ce que tu dois ou ce
            qu’on te doit, ta cagnotte, tes postes du planning et ce qui attend ta réponse. Touche une ligne pour ouvrir la
            rubrique.</P>
          <P><strong>Copier le résumé</strong> copie un texte à envoyer à quelqu’un (date, lieu, qui vient, places libres, ce
            qui manque), avec un lien pour répondre, même sans compte. Rien de personnel n’y figure. Réservé aux réponses
            « Je suis in » et « Peut-être ».</P>
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
          à le faire avant la date de fin. 10 Mo par fichier, 100 Mo par Plan. La description (500 caractères) et les informations
          importantes (5 000 caractères) se mettent en forme avec les boutons au-dessus du champ : <strong>gras</strong>,
          <em>italique</em>, <u>souligné</u>, listes à puces ou numérotées.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Votes : sondage, Match, Qui s’y colle ?', summary: 'Trois façons de décider ensemble',
        body: <>
          <L items={[
            <><strong>Sondage</strong> : une question, un choix. Anonyme ou non ; s'il ne l'est pas, chacun voit qui a voté quoi.</>,
            <><strong>Match</strong> ❤️ : chacun dit oui ou non à chaque proposition (cartes à glisser, photo facultative). Les
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
        id: 'transports', emoji: '🚌', title: 'En transports publics', summary: 'Horaires, voyager ensemble, dernier retour',
        body: <P>Dans la rubrique Trajets, indique d'où tu pars et où tu vas : une adresse, un lieu ou un arrêt
          (départ à mémoriser si tu veux). Personne d'autre ne voit ton adresse. EvLY affiche les correspondances pour arriver à l'heure (bus, trams et trains de toute la Suisse) et le
          <strong> dernier retour</strong> de la nuit. <strong>« Je propose ce trajet »</strong> invite les autres à voyager avec toi ;
          rappel 30 minutes avant le départ.</P>,
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
        id: 'taches', emoji: '✅', title: 'Tâches', summary: 'Les actions à mener avant l’événement, et ce qui doit être fait avant',
        body: <P>Pour préparer une fête ou un événement en équipe. Range les tâches par <strong>lot</strong> (Lieu, Traiteur, Animation… ou
          « Commencer avec des lots types »), confie chacune à un ou plusieurs <strong>responsables</strong> et fixe une <strong>échéance</strong> :
          ils reçoivent un rappel deux jours avant. Dans « Commencer après », indique les tâches qui doivent être terminées avant :
          tant qu'elles ne le sont pas, la tâche est <strong>bloquée</strong> 🔒, et quand la dernière se termine, ses responsables sont
          prévenus qu'ils peuvent commencer. La vue <strong>« Par état »</strong> montre ce qui est en cours, prêt, bloqué ou terminé ;
          « Mes tâches » et « En retard » filtrent la liste. Coche le rond d'une tâche pour la terminer, touche-la pour la commenter, la
          prendre (« Je m'en occupe ») ou la modifier. Tout le monde ajoute et fait avancer les tâches ; les supprimer : la personne qui
          les a créées et les organisateurs. Pour les postes du jour même, utilise plutôt le Planning.</P>,
      },
      {
        id: 'deroule', emoji: '🎬', title: 'Déroulé', summary: 'Le programme de la soirée, minute par minute',
        body: <P>Ajoute les moments dans l'ordre (accueil, discours, repas…) avec leur <strong>durée</strong> : chacun commence à la fin
          du précédent, le premier au début du Plan, et les heures se recalculent toutes seules. Un moment peut aussi commencer à une
          <strong> heure fixe</strong>. Pour chacun : lieu ou salle, responsables (prévenus <strong>10 minutes avant</strong>), matériel et
          technique, remarques ; les bénévoles du Planning prévus à ce moment s'affichent aussi. Le soir même, le moment en cours est
          mis en évidence avec le suivant, et <strong>« +15 min »</strong> décale toute la suite quand on prend du retard. « Copier le
          programme » donne les heures et les titres, à coller dans le Plan qui annonce la soirée aux invités ; « Feuille de route » crée
          un PDF complet à imprimer pour l'équipe et les prestataires.</P>,
      },
      {
        id: 'idees', emoji: '💡', title: 'Idées', summary: 'Le brainstorming en séance, l’app projetée sur un écran',
        body: <P>Pour chercher des idées tous ensemble : projette EvLY, une personne tape au clavier, tout le monde regarde et discute.
          <strong> « Projeter en plein écran »</strong> affiche les thèmes en colonnes, en gros caractères, avec un <strong>minuteur</strong> :
          choisis le thème en bas, tape l'idée, Entrée. Glisse une idée d'un thème à l'autre à la souris. Touche une idée pour noter les
          <strong> votes à main levée</strong> (+1 / −1), la marquer ⭐ Retenue, ❓ À creuser ou ✖ Écartée, lui donner une couleur, la
          <strong> fusionner</strong> avec une idée proche ou, si les Tâches sont activées, la <strong>transformer en tâche</strong> (lot et
          responsables). Double-clic pour corriger le texte. Après la séance, le tableau reste dans le Plan, chacun le relit sur son
          téléphone, et « Copier le compte rendu » donne les idées retenues et à creuser, par thème.</P>,
      },
      {
        id: 'benevoles', emoji: '🙋', title: 'Planning', summary: 'Postes et horaires, chacun s’inscrit',
        body: <P>Le créateur du Plan et les organisateurs du Cercle créent les postes (horaire, nombre de personnes). S'inscrire
          vaut « Je suis in ». Résumé « Il manque X personnes », filtre « Mes postes », avertissement si deux postes se
          chevauchent. Rappel par notification <strong>une heure avant</strong> la prise de poste. Avec <strong>0 personne</strong>, la ligne s’affiche simplement au programme (ouverture
          des portes, repas…), sans inscription. Sur place, les inscrits du poste (et les organisateurs) peuvent le
          <strong> commenter</strong> (« il manque une rallonge ») : la personne qui a créé le poste est prévenue. Ils le
          déclarent aussi <strong>« Tâche terminée »</strong>, ce qui la prévient également. L'icône 📅 d'un poste l'<strong>ajoute à ton agenda</strong> (téléphone ou compte calendrier), avec son horaire, le lieu du Plan et un lien vers le planning.</P>,
      },
      {
        id: 'assemblee', emoji: '🏛️', title: 'Assemblée', summary: 'Ordre du jour, procurations, votes, procès-verbal',
        body: <>
          <P>Pour l'assemblée générale d'une association ou un comité. La date du Plan est celle de l'assemblée ; le créateur du
            Plan et les organisateurs du Cercle l'organisent, avec un ou une secrétaire facultatif.</P>
          <L items={[
            <><strong>Avant</strong> : ordre du jour (information, vote, élection) avec documents, convocation (app, notification,
              email), <strong>procurations</strong> à un autre membre.</>,
            <><strong>Réglages</strong> : membres votants (décoche les membres passifs), quorum, assemblée <strong>hybride</strong> (participation à distance).</>,
            <><strong>Pointage</strong> : à l'ouverture, « Afficher le code en grand » projette le code de la salle et un QR code.
              Chacun se pointe avec son téléphone en tapant le code ou en scannant le QR code ; l'organisateur coche celles et ceux qui n'ont pas leur téléphone dans la liste de
              présence (pas encore pointés en premier, recherche). <strong>Sans téléphone</strong>, une personne vote sur l'appareil de
              l'organisateur (« Faire voter quelqu'un sur cet appareil », son bulletin reste secret) ou sur papier (bouton « Papier »
              dans la liste, l'organisateur saisit le décompte avant de clore le vote).</>,
            <><strong>Pendant</strong> : seules les personnes pointées présentes votent, une fois pour elles et une fois par
              procuration. Quorum en direct, votes au <strong>bulletin secret</strong> ou à main levée, majorité simple, absolue
              ou des deux tiers, élections, décisions par acclamation.</>,
            <><strong>Après</strong> : procès-verbal PDF (présents, procurations, résultats, élus), envoyé au créateur du Plan à
              la clôture. Pense à le conserver : le Plan sera supprimé 24 h après sa date de fin.</>,
          ]} />
          <P>Au bulletin secret, personne ne peut savoir qui a voté quoi. Ce sont les statuts de l'association qui font foi.</P>
        </>,
      },
      {
        id: 'cagnotte', emoji: '🐷', title: 'Cagnotte cadeau', summary: 'Un cadeau commun, idées et votes',
        body: <P>Pour qui, objectif, montant proposé, comment payer. Chacun indique sa participation puis « J'ai payé » ;
          l'organisateur coche « Reçu ». Le montant de chacun n'est visible que par l'organisateur. Idées de cadeau avec votes.
          Aucun argent ne passe par EvLY. Pense à cacher le Plan à la personne fêtée (« Cacher à… », « C'est une surprise »).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Père Noël secret', summary: 'Tirage au sort et cadeaux anonymes',
        body: <P>La date du Plan est celle de l'échange des cadeaux. Chacun note ses envies (ou « pas d'envie particulière »),
          l'organisateur lance le tirage. Tu ne connais que la personne que tu gâtes ; deux conversations anonymes permettent
          de poser des questions. Révélation à partir du jour de l'échange.</P>,
      },
      {
        id: 'quiz', emoji: '🧠', title: 'Quiz', summary: 'Questions en direct, bonus de rapidité',
        body: <P>Une personne prépare des questions à choix multiple (2 à 4 réponses, photo facultative) et anime sans jouer. Au lancement, chaque question s’affiche en même temps sur tous les téléphones : plus on répond vite, plus on gagne de points (1 000 au maximum). Quand tout le monde a répondu ou que le temps est écoulé : bonne réponse et classement. L’animatrice ou l’animateur passe à la question suivante. Option <strong>écran de salle</strong> : un lien à ouvrir sur une télévision ou un projecteur.</P>,
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
            avant un poste du planning.</P>
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
          <>Le créateur d'un Plan et les organisateurs peuvent <strong>retirer quelqu'un d'un Plan</strong> (rubrique Membres) ;
            le créateur et les organisateurs peuvent <strong>retirer quelqu'un du Cercle</strong> (fenêtre Membres).</>,
          <>Par défaut, les <strong>organisateurs</strong> acceptent les nouveaux membres et seul le <strong>créateur</strong> supprime un Cercle ou un Plan ; un vote à la majorité peut être choisi à la place.</>,
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
          <><strong>Récap</strong> (créateur du Plan et organisateurs) : un PDF avec infos, participants, liste d'attente, planning, dépenses, votes, résultats de l'assemblée et des jeux terminés, cagnotte (pas le chat).</>,
          <><strong>Historique</strong> des modifications : menu du Plan.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Suppression automatique', summary: 'Un Plan disparaît 24 h après sa fin',
        body: <P>À sa date de fin, un Plan passe <strong>« Terminé »</strong> : il reste visible <strong>24 heures en lecture seule</strong>, puis il est
          supprimé avec tout son contenu (c'est voulu, EvLY reste léger). Pendant ces 24 h : télécharge les photos, le récapitulatif ou
          le procès-verbal ; ceux qui avaient répondu « Je suis in » sont prévenus 4 h avant la suppression. L'évènement déborde ?
          Repousse la date de fin dans « Modifier ». Le temps restant s'affiche dans la fiche (⏳).</P>,
      },
    ],
  },
  {
    title: 'Ton compte',
    topics: [
      {
        id: 'photos', emoji: '🖼️', title: 'Photos de profil et de Cercle', summary: 'Ta tête, et celle de ton groupe',
        body: <>
          <P><strong>Photo de profil</strong> : menu ☰ → <strong>Mon profil</strong> → « Ajouter une photo ». Cadre-la en la faisant
            glisser, zoome à deux doigts. Elle remplace tes initiales partout : chat, membres, votes… Seules les personnes avec qui tu
            partages un Cercle ou un Plan la voient.</P>
          <P><strong>Photo du Cercle</strong> : le créateur et les organisateurs l'ajoutent dans les réglages du Cercle (⚙︎). Elle
            s'affiche en bandeau en haut de la carte du Cercle et de la liste de ses Plans.</P>
          <P>Touche l'avatar de quelqu'un pour voir sa photo en grand. Une photo choquante ? <strong>Signaler la photo</strong>{' '}
            (dans sa fiche, ou dans les réglages du Cercle) : l'équipe d'EvLY la vérifie et peut la retirer. Les photos sont gardées en
            Suisse, sans leur position GPS.</P>
        </>,
      },
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
  { emoji: '🚗', text: <>On s'organise : <strong>trajets</strong>, <strong>qui apporte quoi</strong>, <strong>dépenses</strong>, <strong>planning</strong>.</> },
  { emoji: '🏛️', text: <>Les associations tiennent leur <strong>assemblée</strong> : votes, procurations, procès-verbal.</> },
  { emoji: '🎉', text: <>On s'amuse : <strong>quiz</strong>, <strong>cagnotte</strong>, <strong>Père Noël secret</strong>, <strong>Killer</strong>, <strong>mot piège</strong>, <strong>tournoi</strong>.</> },
  { emoji: '⏳', text: <>Un Plan <strong>disparaît 24 h après sa fin</strong> (lecture seule entre-temps) : garde photos, récap ou PV.</> },
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
