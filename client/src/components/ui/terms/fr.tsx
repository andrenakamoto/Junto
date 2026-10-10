import { Mail, P, PrivacyLink, Rules, type TermsSection, type TermsText } from './parts';

// Conditions d'utilisation en français : version qui fait foi.
// Numérotés automatiquement dans l'ordre
const sections: TermsSection[] = [
  {
    title: 'Présentation du service',
    body: <>
      <P>EvLY (« le Service ») est une application d'organisation d'événements, éditée depuis Genève (« l'Éditeur »).
        Elle permet à des groupes — proches, amis, familles, associations, clubs, équipes ou entreprises — de se
        retrouver au sein de groupes privés (« Cercles ») et de s'organiser autour d'événements (« Plans ») : réponses
        des participants, sondages et votes, conversation, covoiturage, partage de fichiers et de dépenses, planning de
        bénévoles, cagnotte, jeux, tirages au sort et tenue d'assemblées.</P>
      <P>Les présentes conditions s'appliquent à toute utilisation du Service, sur le site evly.ch comme dans les
        applications iPhone et Android, avec ou sans compte. Utiliser le Service vaut acceptation de ces conditions.</P>
    </>,
  },
  {
    title: 'Éligibilité',
    body: <P>L'utilisation d'EvLY est réservée aux personnes âgées d'au moins 16 ans. En créant un compte, tu déclares
      avoir l'âge requis et la capacité juridique d'accepter les présentes conditions. Une organisation ne doit pas
      créer de compte ni inscrire de réponse pour une personne de moins de 16 ans. L'Éditeur peut demander une preuve
      d'âge et suspendre tout compte en cas de doute raisonnable.</P>,
  },
  {
    title: 'Inscription et compte',
    body: <>
      <P>Pour créer un compte, tu indiques un <strong>pseudo</strong>, ton <strong>prénom</strong>, une{' '}
        <strong>adresse email</strong> — que tu confirmes via le lien reçu — et un mot de passe ; ton nom est facultatif.
        Tu peux aussi t'inscrire avec un compte Google. Les informations fournies doivent être exactes : ton pseudo et ton
        prénom sont visibles des membres des Cercles et des Plans que tu rejoins ; ton nom n'est visible que par toi,
        sauf dans le procès-verbal d'une assemblée de ton Cercle (voir « Assemblées et votes »).</P>
      <P>Tu es seul(e) responsable de la confidentialité de tes identifiants et de toutes les actions effectuées depuis
        ton compte. En cas de suspicion d'accès non autorisé, change ton mot de passe et écris sans tarder à <Mail /> ;
        l'Éditeur ne répond pas d'un usage de ton compte survenu avant cette notification. L'Éditeur ne vérifie pas
        l'identité des utilisateurs.</P>
    </>,
  },
  {
    title: 'Cercles, rôles et invités',
    body: <>
      <P>La personne qui crée un Cercle (le « Créateur ») en fixe les règles : admission des nouveaux membres, création
        des Plans et des sondages, suppression du Cercle. Elle peut nommer des <strong>organisateurs</strong>, qui
        partagent la gestion du Cercle. Quand le Créateur quitte le Cercle ou supprime son compte, le Cercle est confié à
        un autre membre (ou supprimé s'il était le seul).</P>
      <P>Un membre peut inviter une personne extérieure à <strong>un seul Plan</strong> au moyen d'un lien : cette
        personne voit ce Plan, mais rien d'autre du Cercle. Un Plan ou un sondage peut aussi être caché à certains membres
        (« Plan surprise »). Tu es responsable des personnes que tu invites et du partage des liens d'invitation.</P>
      <P>Une personne invitée peut répondre à un Plan <strong>sans créer de compte</strong>, avec son seul prénom ; il
        en va de même pour la personne qui organise une sortie sans compte (« Organiser une sortie »). Ces personnes
        acceptent les présentes conditions en utilisant le Service.</P>
    </>,
  },
  {
    title: 'Associations, clubs et entreprises',
    body: <>
      <P>Lorsqu'un Cercle est utilisé par une organisation, la personne qui le crée déclare agir avec son accord.{' '}
        <strong>L'organisation est seule responsable de l'usage qu'elle fait du Service</strong> avec ses membres,
        bénévoles, collaborateurs ou invités : contenu de ses Plans, choix des réglages, décisions prises, communications
        envoyées et respect de ses statuts, de ses règlements et de la loi.</P>
      <P>Pour les données de ses membres qu'elle traite au moyen du Service (inviter des personnes, établir une liste de
        présence ou un procès-verbal, conserver des documents), l'organisation décide des finalités et répond de leur
        licéité, notamment au regard de la loi fédérale sur la protection des données (nLPD) : information de ses
        membres, base légale, conservation des documents qu'elle télécharge.</P>
    </>,
  },
  {
    title: 'Règles de bonne conduite',
    body: <>
      <P>En utilisant EvLY, tu t'engages à :</P>
      <Rules items={[
        'Ne pas publier de contenus haineux, discriminatoires, violents, pornographiques, diffamatoires, illégaux ou trompeurs.',
        "Respecter la vie privée et les droits des autres, notamment en ne partageant des photos ou des informations sur une personne qu'avec son accord.",
        "Ne pas usurper l'identité d'une autre personne ou d'une organisation.",
        'Ne pas utiliser le Service pour du démarchage, de la publicité non sollicitée, du spam, des jeux d’argent ou toute activité frauduleuse.',
        "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles tu n'as pas droit, ni de perturber le fonctionnement du Service (ingénierie inverse, extraction automatisée, surcharge délibérée, contournement des limites).",
      ]} />
      <P>Pour signaler un message, utilise le bouton <strong>« Signaler »</strong> sous ce message ; pour tout autre
        contenu ou comportement, écris à <Mail />. Tu peux aussi <strong>masquer</strong> une personne : tu ne vois plus
        ses messages et ne reçois plus ses notifications.</P>
    </>,
  },
  {
    title: 'Rôle de l’Éditeur et contenus des utilisateurs',
    body: <>
      <P>L'Éditeur fournit un outil technique et <strong>héberge les contenus publiés par les utilisateurs</strong>{' '}
        (messages, Plans, photos, fichiers, votes…) sans les créer, les choisir ni les contrôler à l'avance. Il n'a aucune
        obligation générale de surveiller ces contenus ni de rechercher des activités illicites.</P>
      <P>Tu restes propriétaire des contenus que tu publies, mais tu accordes à l'Éditeur une licence non exclusive,
        gratuite et mondiale pour les héberger, afficher et transmettre dans la mesure nécessaire au fonctionnement du
        Service. Tu es seul(e) responsable de ces contenus et garantis détenir les droits nécessaires pour les partager.</P>
      <P>L'Éditeur peut, sans obligation de le faire et sans préavis, retirer tout contenu, supprimer tout Plan ou Cercle
        ou restreindre tout compte qu'il estime contraire aux présentes conditions ou à la loi, ou sur demande d'une
        autorité.</P>
    </>,
  },
  {
    title: 'Événements organisés via le Service',
    body: <>
      <P>EvLY est un outil de coordination : il facilite l'organisation de rencontres et d'événements réels, mais{' '}
        <strong>l'Éditeur n'est ni organisateur, ni partie prenante, ni garant d'aucun Plan</strong>. Il ne vérifie ni
        les personnes, ni les lieux, ni les activités proposées. Rejoindre un Plan vaut acceptation de sa description par
        le membre, sous sa seule responsabilité.</P>
      <P><strong>Chaque personne participe aux événements à ses propres risques.</strong> L'Éditeur décline toute
        responsabilité concernant le déroulement des événements organisés via EvLY, y compris — sans s'y limiter — les
        accidents, blessures, dommages matériels, consommation d'alcool, activités sportives ou physiques, comportements
        d'un participant envers un autre, annulations, désistements ou litiges entre participants. Ces situations relèvent
        exclusivement des participants concernés, ou de l'organisation qui a mis en place l'événement.</P>
    </>,
  },
  {
    title: 'Covoiturage',
    body: <P>La fonction de covoiturage permet seulement aux participants d'un Plan de se mettre en relation.{' '}
      <strong>L'Éditeur n'est pas transporteur</strong> et n'intervient pas dans les trajets : chaque conducteur reste
      seul responsable de son véhicule, de son permis, de son assurance, du respect du code de la route et des conditions
      convenues avec ses passagers, qui voyagent à leurs propres risques.</P>,
  },
  {
    title: 'Partage des dépenses et cagnotte',
    body: <P>Le partage des dépenses et la cagnotte permettent de tenir un registre indicatif de qui a payé quoi, en
      francs suisses ou en euros, chaque devise faisant l'objet de comptes séparés, sans conversion.{' '}
      <strong>EvLY ne traite, ne détient ni ne transfère aucun fonds</strong> : les calculs affichés sont purement
      informatifs et les paiements s'effectuent en dehors du Service, sous la seule responsabilité des personnes
      concernées. L'Éditeur ne répond pas des erreurs de saisie ou de calcul, des désaccords ou des défauts de paiement.</P>,
  },
  {
    title: 'Assemblées et votes',
    body: <>
      <P>La fonction « Assemblée » aide une organisation à préparer et tenir une assemblée : ordre du jour, convocation,
        présences, procurations, votes, élections et procès-verbal. <strong>Elle ne remplace ni les statuts de
        l'organisation, ni la loi</strong> (notamment les articles 60 et suivants du Code civil suisse). Il appartient à
        l'organisation et aux personnes qui organisent l'assemblée de régler le Service conformément à leurs statuts —
        forme et délai de la convocation, droit de vote, procurations, quorum, majorités — et de veiller à la validité
        des décisions.</P>
      <P>Une convocation envoyée par EvLY (notification, email) <strong>ne garantit pas le respect de la forme prévue par
        les statuts</strong> (par exemple un envoi postal) ni sa bonne réception par chaque membre.</P>
      <P>Le vote au bulletin secret enregistre séparément le fait d'avoir voté et le bulletin, sans lien entre les deux.
        Il s'agit d'un outil pratique, <strong>pas d'un système de vote électronique certifié</strong>. Le procès-verbal
        est généré automatiquement : il doit être relu, complété si nécessaire, signé et conservé par l'organisation ; il
        mentionne le prénom et le nom des personnes présentes, représentées et candidates.{' '}
        <strong>L'Éditeur ne répond ni de la validité des convocations, des votes, des élections et des décisions, ni
        des litiges qui en découleraient.</strong></P>
    </>,
  },
  {
    title: 'Jeux et tirages au sort',
    body: <>
      <P>Les jeux proposés (Killer, mot piège, Père Noël secret, tournoi…) se déroulent dans la vie réelle,{' '}
        <strong>sous la seule responsabilité des participants</strong>, qui s'engagent à :</P>
      <Rules items={[
        'jouer dans le respect de chacun, de sa vie privée et de son consentement ;',
        'ne jamais mettre quiconque en danger, ni utiliser d’objet dangereux ;',
        'respecter la loi, les lieux privés, le travail des autres et la sécurité routière (jamais en conduisant) ;',
        'ne pas en faire un jeu d’argent ni de pari.',
      ]} />
      <P>Les tirages au sort (roue « Qui s'y colle ? », tirage des équipes ou du Père Noël secret) sont effectués de façon
        aléatoire par le Service. Leur résultat n'engage que les participants qui ont choisi d'y recourir ; l'Éditeur ne
        répond pas de leurs conséquences.</P>
    </>,
  },
  {
    title: 'Notifications, emails et rappels',
    body: <P>Les notifications, emails, rappels et convocations sont envoyés sans garantie de délai ni de réception : ils
      peuvent être retardés, filtrés comme indésirables, bloqués par les réglages du téléphone ou de la messagerie, ou
      ne pas partir en cas d'incident. <strong>Ne t'y fie pas seul(e) pour une échéance importante.</strong> L'Éditeur
      ne répond pas des conséquences d'une notification non reçue, reçue en retard ou envoyée par erreur.</P>,
  },
  {
    title: 'Conservation et perte de données',
    body: <P>EvLY n'est pas un outil d'archivage. Les Plans sont <strong>supprimés automatiquement et définitivement à
      leur date de fin</strong>, avec leur conversation, leurs photos, leurs fichiers, leurs votes et leurs dépenses ;
      les sondages de dates le sont à leur échéance (30 jours au plus). Il t'appartient de télécharger à temps ce que tu
      souhaites conserver (photos, récapitulatif, procès-verbal, documents). L'Éditeur ne garantit pas la sauvegarde des
      données et <strong>ne répond pas de leur perte</strong>, qu'elle résulte de cette suppression automatique, d'une
      action d'un utilisateur ou d'un incident technique.</P>,
  },
  {
    title: 'Données personnelles',
    body: <>
      <P>EvLY traite les données nécessaires au fonctionnement du Service : celles de ton compte (pseudo, prénom, nom
        facultatif, email, mot de passe chiffré ou compte Google), ce que tu publies et quelques données techniques. Elles
        ne sont ni vendues, ni utilisées à des fins publicitaires ; les messages sont chiffrés dans la base de données.
        Certains prestataires techniques (hébergement, envoi d'emails, stockage de fichiers, notifications) y ont accès
        dans la stricte mesure nécessaire à leur prestation.</P>
      <P>Le détail de ces traitements, tes droits et les durées de conservation figurent dans la{' '}
        <PrivacyLink>politique de confidentialité</PrivacyLink>, qui fait foi. Tu peux supprimer ton compte et tes données à tout moment depuis le menu (« Supprimer mon
        compte »). Les Cercles et Plans que tu as créés sont alors confiés à d'autres membres, et les contenus partagés
        restent dans les Plans jusqu'à leur suppression. Certaines données peuvent être conservées au-delà en cas
        d'obligation légale ou d'intérêt légitime (ex. lutte contre la fraude).</P>
    </>,
  },
  {
    title: 'Services de tiers',
    body: <P>Le Service s'appuie sur des services de tiers (hébergement, stockage de fichiers, envoi d'emails,
      notifications, connexion Google, boutiques d'applications d'Apple et de Google). Leur utilisation est soumise à
      leurs propres conditions. L'Éditeur ne répond pas de leur indisponibilité, de leurs erreurs ni de leurs
      décisions.</P>,
  },
  {
    title: 'Disponibilité et évolution du Service',
    body: <>
      <P>L'Éditeur s'efforce d'assurer la disponibilité du Service mais ne garantit aucune continuité, exactitude ou
        absence d'erreur. Le Service peut être modifié, suspendu, limité ou définitivement arrêté à tout moment, en tout
        ou partie, avec ou sans préavis, sans que la responsabilité de l'Éditeur puisse être engagée à ce titre.</P>
      <P><strong>EvLY n'est pas conçu pour un usage critique</strong> : ne l'utilise pas pour une urgence, la sécurité
        de personnes, un besoin médical, ni comme seul moyen d'accomplir une formalité légale ou contractuelle.</P>
    </>,
  },
  {
    title: 'Propriété intellectuelle et suggestions',
    body: <P>Le Service, son nom, son logo, ses textes, son code et son apparence appartiennent à l'Éditeur ; toute
      reproduction ou réutilisation sans autorisation est interdite. Les idées et suggestions que tu envoies (« Proposer
      une amélioration ») peuvent être utilisées librement par l'Éditeur, sans contrepartie.</P>,
  },
  {
    title: 'Évolution tarifaire',
    body: <P>EvLY est actuellement proposé gratuitement. <strong>L'Éditeur se réserve le droit d'introduire, à l'avenir,
      des fonctionnalités payantes, des abonnements ou tout autre modèle tarifaire</strong>, pour tout ou partie du
      Service, notamment pour les associations et les entreprises. Les utilisateurs existants seront informés dans un
      délai raisonnable avant l'entrée en vigueur de toute tarification affectant des fonctionnalités qu'ils utilisent
      déjà. La gratuité actuelle ne constitue pas un engagement à titre définitif.</P>,
  },
  {
    title: 'Limitation de responsabilité',
    body: <>
      <P>EvLY est fourni « en l'état » et « selon disponibilité », gratuitement, sans garantie d'aucune sorte, explicite
        ou implicite, notamment d'adéquation à un usage particulier.</P>
      <P><strong>Dans toute la mesure permise par la loi, toute responsabilité de l'Éditeur est exclue</strong>, en
        particulier pour les dommages indirects ou consécutifs, le manque à gagner, la perte de données, les contenus
        publiés par des utilisateurs ou des tiers, les événements organisés via le Service et les décisions prises à
        l'aide du Service. Demeure réservée la responsabilité pour un dommage causé intentionnellement ou par négligence
        grave, ainsi que toute autre responsabilité qui ne peut être exclue en vertu d'une disposition légale impérative
        (art. 100 du Code des obligations). La responsabilité pour les auxiliaires et prestataires de l'Éditeur est
        exclue dans la même mesure.</P>
      <P>Dans la mesure où une responsabilité de l'Éditeur serait néanmoins retenue, elle est limitée au montant
        effectivement payé par l'utilisateur pour l'accès au Service au cours des douze derniers mois.</P>
    </>,
  },
  {
    title: 'Indemnisation',
    body: <P>Tu acceptes de garantir et d'indemniser l'Éditeur contre toute réclamation, perte, responsabilité ou
      dépense (y compris les frais de défense raisonnables) résultant de ton utilisation du Service, des contenus que tu
      publies, des événements, jeux ou assemblées que tu organises, ou de ta violation des présentes conditions ou de la
      loi. Une organisation qui utilise le Service prend le même engagement pour l'usage qu'en font ses membres et
      organisateurs.</P>,
  },
  {
    title: 'Force majeure',
    body: <P>L'Éditeur ne répond pas d'un manquement dû à un événement échappant à son contrôle raisonnable : panne d'un
      prestataire ou d'un réseau, attaque informatique, catastrophe, décision d'une autorité, grève, épidémie, ou
      événement comparable.</P>,
  },
  {
    title: 'Suspension et résiliation',
    body: <P>L'Éditeur peut suspendre ou supprimer un compte, un Cercle ou un Plan, à sa seule discrétion et sans
      préavis, en cas de violation des présentes conditions, de comportement préjudiciable au Service ou à ses membres,
      ou pour toute autre raison légitime. Tu peux à tout moment cesser d'utiliser le Service et supprimer ton compte.</P>,
  },
  {
    title: 'Droit applicable et for',
    body: <P>Les présentes conditions sont régies par le droit suisse. Tout litige relatif à leur interprétation ou à leur
      exécution relève de la compétence exclusive des tribunaux de Genève, sous réserve des dispositions légales
      impératives applicables aux consommateurs.</P>,
  },
  {
    title: 'Dispositions finales',
    body: <P>Si une clause des présentes conditions devait être jugée invalide ou inapplicable, elle serait remplacée par
      une clause valable aussi proche que possible de son but, et les autres clauses resteraient pleinement en vigueur.
      Le fait pour l'Éditeur de ne pas se prévaloir d'une clause ne vaut pas renonciation. Les présentes conditions et la
      politique de confidentialité constituent l'intégralité de l'accord entre toi et l'Éditeur ; la version française
      fait foi.</P>,
  },
  {
    title: 'Modification des conditions',
    body: <P>Ces conditions peuvent être mises à jour. En cas de modification substantielle, tu seras invité(e) à les
      relire et à les accepter lors de ta prochaine ouverture de l'application. La poursuite de l'utilisation du Service
      après acceptation de la nouvelle version vaut consentement. Pour toute question : <Mail />.</P>,
  },
];

const fr: TermsText = {
  title: 'Conditions d’utilisation',
  version: 'Version 4 — 9 octobre 2026',
  news: 'Nouveau : assemblées, jeux, cagnotte, notifications et responsabilité.',
  sections,
  confirm: 'En cliquant sur « J’accepte les conditions », tu confirmes avoir lu et accepté l’intégralité des présentes conditions d’utilisation.',
  scroll: 'Fais défiler pour lire les conditions avant d’accepter.',
  accept: 'J’accepte les conditions',
  accepting: 'Enregistrement…',
  close: 'Fermer',
};
export default fr;
