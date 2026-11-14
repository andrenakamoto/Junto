import { ProcessorTable, Section, type Processor, type PrivacyText } from './parts';

// Politique de confidentialité en français : version qui fait foi.
const processors: Processor[] = [
  { name: 'Infomaniak', role: "hébergement du serveur, de la base de données (comptes, messages, Plans), du site evly.ch, des photos, messages vocaux et fichiers ; envoi des emails ; sauvegardes (Swiss Backup)", where: "Suisse", safeguard: "aucun transfert à l’étranger" },
  { name: 'Opentransportdata.swiss (OJP)', role: "horaires des transports publics (rubrique Trajets) : seuls les arrêts ou les adresses choisis (coordonnées) et l'heure recherchée sont envoyés, depuis notre serveur, sans ton identité", where: "Suisse (plateforme officielle des transports publics, CFF sur mandat de l'OFT)", safeguard: "aucune donnée personnelle transmise" },
  { name: 'OpenAgenda', role: "agendas publics sous licence ouverte (rubrique Découvrir, par exemple l'agenda de la Ville de Genève) : notre serveur lit les événements, sans rien transmettre te concernant", where: "France", safeguard: "aucune donnée personnelle transmise" },
  { name: 'DATAtourisme', role: "fêtes et manifestations de la France voisine (Ain, Haute-Savoie), sous Licence Ouverte (rubrique Découvrir) : notre serveur lit les événements, sans rien transmettre te concernant", where: "France", safeguard: "aucune donnée personnelle transmise" },
  { name: 'OpenStreetMap (Overpass)', role: "idées de sorties (rubrique Découvrir) : notre serveur lit les lieux publics, sans rien transmettre te concernant", where: "Allemagne", safeguard: "aucune donnée personnelle transmise" },
  { name: 'Google', role: 'connexion avec un compte Google (si tu la choisis), polices de caractères du site et acheminement des notifications des apps (Firebase Cloud Messaging)', where: 'États-Unis', safeguard: 'certifié Swiss-U.S. Data Privacy Framework' },
  { name: 'Apple', role: 'connexion avec un compte Apple dans l\'app iPhone (si tu la choisis) et acheminement des notifications de l\'app iPhone (Apple Push Notification service)', where: 'États-Unis', safeguard: 'certifié Swiss-U.S. Data Privacy Framework' },
];

const fr: PrivacyText = {
  title: 'Politique de confidentialité',
  version: 'Version du 14 novembre 2026',
  body: <>
      <p className="mt-3">
        Cette page explique quelles données EvLY traite, pourquoi, avec qui elles sont partagées et
        quels sont tes droits, conformément à la loi fédérale suisse sur la protection des données
        (LPD).
      </p>
    <Section title="1. Qui est responsable de tes données">
      <p>
        EvLY, Genève (Suisse).
        Pour toute question ou demande concernant tes données : <strong>info@evly.ch</strong>.
      </p>
    </Section>

    <Section title="2. Les données traitées">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Ton compte</strong> : pseudo, prénom, nom (facultatif), adresse email, langue choisie pour l'app, mot de passe
          (conservé uniquement sous forme chiffrée, jamais lisible), ton identifiant Google si tu te
          connectes avec Google et, pendant un changement d'adresse, la nouvelle adresse en attente de
          confirmation (24 h au plus).</li>
        <li><strong>Réponse à une invitation sans compte</strong> : ton prénom et ta réponse (je viens /
          peut-être / je passe), ainsi qu'un identifiant gardé dans ton navigateur pour retrouver ta
          réponse. Effacés à la fin du Plan, ou tout de suite avec « Retirer ma réponse ». Si tu crées
          ensuite un compte ou te connectes, ta réponse y est rattachée.</li>
        <li><strong>Sortie organisée sans compte</strong> (« Organiser une sortie ») : ton prénom, ta
          sortie (titre, date, lieu) et un identifiant gardé dans ton navigateur pour suivre les réponses.
          Effacés avec la sortie, le lendemain de sa date. Si tu crées ensuite un compte ou te connectes,
          tes sorties y sont rattachées.</li>
        <li><strong>Invitations à un Cercle</strong> : si un membre t'invite avec ton pseudo ou ton email,
          l'invitation (qui t'invite, dans quel Cercle) est gardée jusqu'à ce que tu l'acceptes ou la
          refuses.</li>
        <li><strong>Signalements et personnes masquées</strong> : si tu signales un message, une copie
          chiffrée du message, ton motif éventuel et ton pseudo sont transmis à l'administrateur d'EvLY,
          puis la copie est effacée dès que le signalement est traité. La personne signalée ne sait pas
          qui l'a signalée. La liste des personnes que tu masques n'est visible que par toi.</li>
        <li><strong>Suggestions</strong> (« Proposer une amélioration ») : ton message, son type (idée,
          problème, autre), l'appareil et la version de l'app utilisés, et la réponse éventuelle de
          l'équipe. Lus uniquement par l'administrateur d'EvLY, qui les reçoit aussi par email ;
          supprimés avec ton compte.</li>
        <li><strong>Photo de profil et photo de Cercle</strong> (facultatives) : la photo que tu ajoutes à ton profil, ou à un
          Cercle que tu gères. EvLY la recadre et en retire toutes les métadonnées (dont la position GPS) avant de
          l'enregistrer. Une photo remplacée ou retirée est effacée ; ta photo de profil l'est aussi avec ton compte, celle d'un
          Cercle avec le Cercle. Si quelqu'un signale une photo, l'administrateur d'EvLY la voit avec le motif éventuel et
          peut la retirer.</li>
        <li><strong>Discussion des Cercles</strong> (si le Cercle l'a activée) : tes messages, photos et réactions, visibles par les
          membres du Cercle. Ils sont chiffrés en base comme ceux des Plans et <strong>effacés automatiquement au bout de 7 jours</strong>,
          photos comprises. Dans les Cercles d'une <strong>Organisation</strong>, les messages sont gardés <strong>3 mois</strong> et les photos <strong>1 mois</strong>.</li>
        <li><strong>Organisations</strong> (associations à plusieurs niveaux) : les Cercles dont tu fais partie dans l'Organisation et ton rôle dans chacun. L'administration et la direction de l'Organisation voient les membres et leurs rôles, et une personne de la direction peut entrer dans n'importe quel Cercle ; elle apparaît alors dans ses membres et peut lire sa Discussion. Le rôle sert à calculer ce que tu peux faire et ce que tu reçois. La direction et l'administration ont aussi un <strong>cockpit</strong> : les Plans qu'elles voient déjà, les demandes d'adhésion et des <strong>chiffres par équipe</strong> (membres, réponses, activité), sans suivi individuel ; elles peuvent en recevoir un résumé par email chaque lundi. Ces informations sont supprimées quand tu quittes le Cercle, ou avec ton compte.</li>
        <li><strong>« Je suis dispo »</strong> (si le Cercle l'a activé) : le moment choisi (maintenant ou ce soir), les étiquettes
          d'activité et le petit mot facultatif, visibles par les membres des Cercles où tu te déclares dispo. Aucune position n'est
          enregistrée. Ces informations sont <strong>effacées automatiquement</strong> à la fin du moment choisi (3 heures, ou 4 h du
          matin pour « ce soir »).</li>
        <li><strong>Découvrir</strong> : consulter les événements et les idées de sorties ne crée aucune donnée sur toi (ni compte requis,
          ni suivi) ; le lieu choisi (ville ou village) et le rayon sont gardés sur ton appareil. Si tu choisis « <strong>Autour de moi</strong> », ta position approximative (arrondie à environ 1 km) est envoyée à notre serveur seulement pour trouver les sorties proches : elle n'est ni enregistrée ni gardée sur ton appareil. Les localités viennent du répertoire officiel de swisstopo et, pour la France voisine, de la liste officielle des communes (geo.api.gouv.fr), gardés sur notre serveur. Les annonces viennent d'agendas publics, d'OpenStreetMap ou de
          l'équipe EvLY ; notre serveur les récupère sans rien transmettre te concernant. Si tu <strong>signales une erreur</strong>, ton
          message est envoyé par email à l'administrateur d'EvLY. Si tu demandes à être prévenu pour <strong>« Poster un événement
          public »</strong>, ton nom, ton email et les informations facultatives (établissement, ville, message) sont gardés pour te
          recontacter à l'ouverture, puis effacés au plus tard deux ans après, ou avec ton compte.</li>
        <li><strong>Ce que tu publies</strong> : messages et réactions, réponses aux Plans (oui /
          peut-être / non), votes, informations des Plans, photos, messages vocaux et fichiers, trajets de covoiturage, participations
          aux jeux (Père Noël secret, Killer, mot piège, équipes et scores, réponses et points du quiz) et à une cagnotte (montant, paiement signalé),
          dépenses et remboursements.</li>
        <li><strong>Assemblées</strong> (fonction à activer dans un Plan) : ta présence (sur place ou à
          distance), la procuration que tu donnes ou reçois, et tes votes. Au <strong>bulletin secret</strong>,
          EvLY enregistre séparément que tu as voté et le bulletin lui-même, sans lien entre les deux : personne,
          ni l'organisateur ni l'administrateur d'EvLY, ne peut retrouver ce que tu as voté. À main levée, ton
          vote figure dans les résultats et dans le procès-verbal. Le <strong>procès-verbal</strong> (PDF)
          indique le <strong>prénom et le nom</strong> des présents, des personnes représentées et des
          candidats ; il est téléchargé par l'organisateur ou le ou la secrétaire, et envoyé par email au
          créateur du Plan à la clôture de l'assemblée.</li>
        <li><strong>Matériel</strong> (inventaire d'un Cercle ou d'une Organisation, fonction à activer dans un Plan) : les objets et leur rangement ; pour chaque réservation, qui a pris le matériel et quand, et son état au retour (avec une remarque). Gardé avec l'inventaire, même après la fin du Plan, pour savoir qui l'a encore ; ton nom est retiré si tu supprimes ton compte.</li>
        <li><strong>Fournisseurs</strong> (fonction à activer dans un Plan) : les coordonnées des fournisseurs ajoutés par l'équipe (nom, personne de contact, téléphone, email, site, adresse, notes) sont gardées dans le carnet du Cercle tant que le Cercle existe, ou jusqu'à ce qu'un organisateur les supprime du carnet. Le suivi propre à un Plan (état, montants, notes, commentaires chiffrés, documents comme les devis et contrats) est effacé avec le Plan ; seule une ligne d'historique (nom de l'événement, date, état final et total) reste dans le carnet. Les montants et les documents ne sont visibles que par les organisateurs.</li>
        <li><strong>Données techniques</strong> : ton statut en ligne dans tes Cercles, ta session de
          connexion (conservée dans ton navigateur), la date de ta dernière utilisation d'EvLY (à
          l'heure près, pour compter les membres actifs), la date à laquelle tu as consulté chaque
          onglet d'un Plan (pour signaler les nouveautés, effacée avec le Plan) et l'adresse IP enregistrée dans les journaux
          du serveur pour la sécurité.</li>
        <li><strong>Notifications des apps Android et iPhone</strong> : si tu les autorises, l'identifiant
          de notification de ton téléphone, effacé quand tu te déconnectes. Une notification indique
          seulement qui a écrit et dans quel Plan, Cercle ou sondage — jamais le contenu d'un message.
          Tu peux les couper à tout moment dans les réglages de ton téléphone.</li>
        <li><strong>Consultation sans réseau</strong> : pour que tu puisses voir tes Cercles et tes Plans sans connexion, la dernière version de ce que tu as consulté (listes, fiches des Plans, derniers messages des chats, tâches, déroulé, trajets…) et l’affiche de tes Plans des prochains jours sont gardées dans ton appareil, dans l’espace privé de l’app ou du navigateur. Rien n’est envoyé ailleurs. Ces copies sont effacées quand tu te déconnectes, quand tu supprimes ton compte, et au plus tard après 21 jours.</li>
      </ul>
      <p>Nous ne collectons ni date de naissance, ni localisation, ni carnet d'adresses.</p>
    </Section>

    <Section title="3. Pourquoi nous les utilisons">
      <p>
        Uniquement pour faire fonctionner EvLY : te permettre d'organiser des événements avec tes
        Cercles, t'envoyer les emails utiles (validation du compte, nouveaux Plans, rappels, mentions,
        résumé hebdomadaire désactivable), et protéger le service contre les abus.
        <strong> Pas de publicité, pas de revente de données, pas de profilage.</strong>
      </p>
    </Section>

    <Section title="4. Qui voit quoi">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Les autres membres voient ton <strong>pseudo</strong> et ton <strong>prénom</strong>. Ton <strong>nom de famille</strong> est visible par toi et par l'administrateur d'EvLY (pour l'assistance) ; les membres de tes Cercles le voient aussi si tu l'as choisi dans « Mon profil », et, dans une <strong>Organisation</strong>, ses responsables et sa direction le voient pour gérer les membres. Il n'est jamais montré aux invités extérieurs ni dans Découvrir.</li>
        <li>Les membres d'un Cercle voient ses Plans et ses membres ; le contenu d'un Plan (chat,
          photos, dépenses…) est réservé aux personnes qui l'ont rejoint.</li>
        <li>Une personne invitée à un seul Plan ne voit que ce Plan, rien du Cercle.</li>
        <li>Toute personne qui a le <strong>lien d'invitation</strong> d'un Plan voit son titre, sa date,
          son lieu, sa description et le nombre de participants ; les prénoms des participants seulement
          après avoir répondu. L'aperçu du lien dans les messageries (WhatsApp…) montre uniquement le
          titre, la date, le nombre de participants et le prénom de l'organisateur. Le créateur du Plan
          peut renouveler le lien à tout moment, l'ancien cesse alors de fonctionner.</li>
        <li>Un Plan surprise est invisible pour les personnes à qui il est caché.</li>
        <li>Les photos, messages vocaux et fichiers ne sont accessibles que depuis EvLY, par des liens temporaires
          réservés aux membres.</li>
        <li>Ta <strong>photo de profil</strong> est visible par les personnes avec qui tu partages un Cercle ou un Plan, et la
          photo d'un Cercle par ses membres. Pour s'afficher rapidement, ces deux photos ont une adresse fixe, longue et
          impossible à deviner, qui n'est communiquée qu'à ces personnes.</li>
        <li>Les messages (chat des Plans et des sondages) sont <strong>chiffrés dans la base de
          données</strong>, avec une clé conservée séparément : une copie de la base ne permet pas de
          les lire. Les emails de mention indiquent seulement qui t'a mentionné et dans quel Plan,
          sans le contenu du message.</li>
        <li>Ils ne sont en revanche <strong>pas chiffrés de bout en bout</strong> : l'administrateur
          technique d'EvLY peut y avoir accès, uniquement lorsque c'est nécessaire au fonctionnement ou
          à la sécurité du service.</li>
      </ul>
    </Section>

    <Section title="5. Nos prestataires et le transfert à l'étranger">
      <p>EvLY s'appuie sur les prestataires suivants, qui traitent des données pour notre compte :</p>
      <ProcessorTable rows={processors} head={['Prestataire', 'Rôle', 'Pays', 'Garantie']} />
      <p>
        Tes données (compte, messages, Plans, photos, fichiers) sont hébergées en Suisse, chez Infomaniak, et ne quittent pas la Suisse pour leur stockage. Seuls les services listés aux États-Unis interviennent encore : Google et Apple pour acheminer les notifications vers les téléphones (sans le contenu des messages), Google et Apple pour la connexion avec leur compte (si tu la choisis), et Google pour les polices du site. Les États-Unis n’offrent pas en général un niveau de protection équivalent à la Suisse : ces transferts sont encadrés soit par la certification du prestataire au Swiss-U.S. Data Privacy Framework, reconnu par le Conseil fédéral depuis le 15 septembre 2024, soit par les clauses contractuelles types, adaptées au droit suisse, de son contrat de traitement des données.
      </p>
    </Section>

    <Section title="6. Combien de temps nous les gardons">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Plans</strong> : supprimés automatiquement 24 h après leur date de fin (3 semaines au plus
          après leur début), avec tout leur contenu — messages, messages vocaux, photos, fichiers, trajets, dépenses.
          Si des dépenses avaient été enregistrées, un résumé est envoyé par email aux membres juste
          avant. Le créateur du Plan et les organisateurs du Cercle peuvent en garder un{' '}
          <strong>récapitulatif PDF</strong> (infos, participants avec prénom et pseudo, liste d'attente,
          planning, dépenses et remboursements, votes, résultats de l'assemblée et des jeux une fois terminés,
          Père Noël secret après la révélation, cagnotte avec la participation de chacun ; jamais le chat) : en le téléchargeant, ou par email juste avant la suppression s'ils ont
          activé cette option. Le procès-verbal d'une assemblée est envoyé par email au créateur du
          Plan à sa clôture : c'est ensuite à l'association de le conserver.</li>
        <li><strong>Sondages de dates</strong> : supprimés dès qu'ils deviennent un Plan (leur
          conversation est reprise dans le Plan), sinon automatiquement le lendemain de la dernière date
          proposée, et au plus tard 30 jours après leur création, avec leurs votes et leur chat.</li>
        <li><strong>Capsules temporelles</strong> (fonction à activer dans un Plan) : les mots, photos et messages vocaux déposés sont gardés jusqu'à la date d'ouverture choisie par le créateur du Plan (un an au plus après le Plan), même après la suppression du Plan, puis effacés automatiquement 30 jours après l'ouverture. Les textes sont chiffrés, les photos refaites sans leurs métadonnées (position GPS comprise). Avant l'ouverture, chacun ne voit que ses propres dépôts et peut les retirer jusqu'au scellage ; supprimer son compte efface ses dépôts.</li>
        <li><strong>Fournisseurs</strong> : carnet du Cercle gardé tant que le Cercle existe (ou jusqu'à sa suppression du carnet) ; suivi, montants et documents d'un Plan effacés avec le Plan.</li>
        <li><strong>Compte</strong> : conservé jusqu'à ce que tu le supprimes.</li>
        <li><strong>Journaux du serveur</strong> : 7 jours, puis effacés automatiquement.</li>
        <li><strong>Sauvegardes</strong> : une copie de la base de données est faite chaque nuit, gardée 14 jours sur le serveur et 30 jours sur Swiss Backup (Infomaniak, Suisse), avec une copie des photos et fichiers. Elles servent uniquement à restaurer EvLY en cas de panne ; un Plan supprimé peut y subsister jusqu’à 30 jours.</li>
        <li><strong>Visites de la page de présentation et de la brochure, nombre de messages envoyés</strong> : uniquement des totaux par jour,
          qui ne contiennent aucune donnée personnelle.</li>
      </ul>
    </Section>

    <Section title="7. Tes droits">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Accès</strong> : obtenir une copie de tes données, en écrivant à info@evly.ch —
          réponse sous 30 jours.</li>
        <li><strong>Rectification</strong> : modifier ton prénom et ton nom dans « Mon profil ».</li>
        <li><strong>Suppression</strong> : supprimer ton compte à tout moment depuis « Mon profil »
          (« Supprimer mon compte »). Tes données personnelles sont alors effacées ; les Cercles et Plans
          que tu as créés sont confiés à d'autres membres, et les photos que tu y as partagées restent
          visibles pour eux jusqu'à la fin du Plan.</li>
        <li><strong>Notifications</strong> : choisir dans « Notifications » de les recevoir en push, par
          email ou les deux, et désactiver le résumé hebdomadaire.</li>
        <li><strong>Réclamation</strong> : tu peux t'adresser au Préposé fédéral à la protection des
          données et à la transparence (PFPDT, edoeb.admin.ch).</li>
      </ul>
    </Section>

    <Section title="8. Sécurité">
      <p>
        Connexion chiffrée (HTTPS), mots de passe chiffrés, accès aux photos réservé aux membres,
        limitation des tentatives de connexion. En cas de fuite de données présentant un risque élevé
        pour toi, nous informerons le PFPDT et les personnes concernées.
      </p>
    </Section>

    <Section title="9. Cookies et stockage dans le navigateur">
      <p>
        EvLY n'utilise aucun cookie publicitaire ni de mesure d'audience. Ton navigateur conserve
        seulement ta session de connexion et quelques préférences (par exemple la langue). Si tu te connectes avec Google,
        Google peut déposer ses propres cookies.
      </p>
      <p className="mt-2">
        La page de présentation (evly.ch/decouvrir.html) et les brochures PDF (evly.ch/brochure et
        evly.ch/brochure-pro) comptent leurs visites de façon anonyme : seul un total par jour est enregistré, sans cookie,
        sans adresse IP et sans aucun identifiant. Sur la page de présentation, les personnes déjà
        connectées à EvLY ne sont pas comptées. De la même façon, quelques étapes de l'inscription
        (clic sur « Créer mon compte » ou « Organiser une sortie », sortie créée ou partagée,
        inscription, validation de l'email, premier Plan) sont comptées en totaux par jour, sans
        savoir qui les a faites. Quand tu arrives par un lien de campagne (par exemple evly.ch/pere-noel?src=instagram),
        le nom de la source (Instagram, affiche…) est gardé 30 jours sur ton appareil seulement, et si tu crées ton compte,
        une inscription est ajoutée au total de cette source, toujours sans savoir qui tu es.
      </p>
    </Section>

    <Section title="10. Âge minimum">
      <p>EvLY est réservé aux personnes de 16 ans et plus.</p>
    </Section>

    <Section title="11. Modifications">
      <p>
        Cette politique peut évoluer ; la date de version ci-dessus indique la dernière mise à jour.
        En cas de changement important, tu en seras informé(e) dans l'application.
      </p>
    </Section>
  </>,
};
export default fr;
