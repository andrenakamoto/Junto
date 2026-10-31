import type { AssemblyHelpText } from './types';

// Aide de l'onglet Assemblée (AssemblyHelp) : de la création des points à la clôture. Tenir les 4 langues à jour
// à chaque changement de l'assemblée.
const fr: AssemblyHelpText = {
  title: 'Gérer une assemblée',
  intro: 'Toutes les étapes, de la préparation au procès-verbal. Touche une étape pour la déplier.',
  forOrganizers: 'Pour l’organisation',
  forMembers: 'Pour les membres',
  steps: [
    {
      id: 'reglages', emoji: '⚙️', title: '1. Régler l’assemblée',
      body: <>
        <p>La <b>date du Plan</b> est celle de l’assemblée. Le créateur du Plan et les organisateurs du Cercle l’organisent ;
          ils voient le bouton <b>Réglages</b> :</p>
        <ul>
          <li><b>Membres votants</b> : tous les membres du Cercle votent ; décoche les membres passifs ou sans droit de vote.</li>
          <li><b>Quorum</b> : aucun, un nombre de voix ou un pourcentage des votants. Il se calcule en direct pendant la séance.</li>
          <li><b>Procurations</b> : autorisées ou non, et combien une même personne peut en porter.</li>
          <li><b>Assemblée hybride</b> : les membres peuvent aussi participer et voter à distance.</li>
          <li><b>Délai de convocation</b> : EvLY te prévient si la convocation part trop tard.</li>
          <li><b>Secrétaire</b> (facultatif) : écrit les notes du procès-verbal et peut le télécharger.</li>
        </ul>
      </>,
    },
    {
      id: 'points', emoji: '📝', title: '2. Préparer l’ordre du jour',
      body: <>
        <p><b>Ajouter un point</b>, puis choisis son type :</p>
        <ul>
          <li><b>Information</b> : rapport, présentation, divers. Pas de vote.</li>
          <li><b>Vote</b> : au <b>bulletin secret</b> (personne ne sait qui a voté quoi) ou à <b>main levée</b> (les noms
            figurent au PV). Majorité <b>simple</b> (plus de oui que de non), <b>absolue</b> (plus de la moitié des voix,
            abstentions comprises) ou des <b>deux tiers</b>.</li>
          <li><b>Élection</b> : nombre de sièges, puis les <b>candidats</b> (à ajouter dans la carte du point, avant l’ouverture
            du vote).</li>
        </ul>
        <p>La description se met en forme (gras, listes) ; joins les documents (comptes, rapport en PDF). Les flèches ↑ ↓
          changent l’ordre. Le type d’un point ne change plus une fois son vote ouvert.</p>
      </>,
    },
    {
      id: 'convoquer', emoji: '📣', title: '3. Envoyer la convocation',
      body: <>
        <p><b>Envoyer la convocation</b> la transmet à <b>tous les membres du Cercle</b> : notification dans l’app et email avec
          la date, le lieu et l’ordre du jour, quel que soit leur réglage de notifications. Tu en reçois une copie.</p>
        <p>Tu peux la renvoyer si l’ordre du jour change (au plus une fois toutes les 10 minutes). La convocation
          EvLY ne remplace pas la forme prévue par tes statuts.</p>
      </>,
    },
    {
      id: 'procurations', emoji: '🤝', title: '4. Les procurations',
      body: <>
        <p>Avant l’ouverture, un membre qui ne peut pas venir donne sa procuration à un autre membre votant, dans « Ma
          participation ». Ce dernier votera deux fois : pour lui et pour la personne représentée.</p>
        <ul>
          <li>Une procuration ne vaut que si la personne qui la porte est <b>pointée présente</b>.</li>
          <li>Si la personne qui l’a donnée vient finalement et se pointe, sa procuration <b>tombe</b> : elle vote elle-même.</li>
          <li>L’organisation voit toutes les procurations dans « Présences et procurations » et peut en refuser une.</li>
          <li>Une fois l’assemblée ouverte, plus aucune procuration ne se donne ni ne se retire.</li>
        </ul>
      </>,
    },
    {
      id: 'ouvrir', emoji: '🔔', title: '5. Ouvrir l’assemblée',
      body: <>
        <p>Le jour même, <b>Ouvrir l’assemblée</b> : les membres reçoivent « L’assemblée est ouverte : pointe ta présence ».</p>
        <p>Un <b>code de la salle</b> à 4 chiffres apparaît sous le quorum. <b>Afficher le code en grand</b> le projette avec un
          <b> QR code</b> et le nombre de présents, mis à jour en direct.</p>
      </>,
    },
    {
      id: 'presences', emoji: '📍', title: '6. Pointer les présences',
      body: <>
        <p>Seules les personnes <b>pointées présentes</b> votent. Deux façons, utilisables en même temps :</p>
        <ul>
          <li><b>Avec un téléphone</b> : chacun tape le code de la salle dans la carte « Pointe ta présence », ou scanne le QR
            code projeté (l’app s’ouvre et le pointe toute seule).</li>
          <li><b>Sans téléphone</b> : l’organisation coche la personne dans « Présences et procurations ». Les personnes pas encore
            pointées sont en premier ; une recherche apparaît dès 10 membres.</li>
          <li><b>À distance</b> (assemblée hybride) : la personne touche « Je participe à distance ».</li>
        </ul>
        <p>Le quorum (présents + procurations valables) se met à jour à chaque pointage.</p>
      </>,
    },
    {
      id: 'seance', emoji: '🖥️', title: '7. Dérouler l’ordre du jour',
      body: <>
        <p>L’icône <b>⤢</b> d’un point l’affiche <b>seul, en grand</b> : idéal à projeter, personne n’est distrait par les points
          suivants. « Précédent » / « Point suivant » (ou les flèches du clavier) passent d’un point à l’autre. Chacun peut aussi
          l’utiliser sur son téléphone.</p>
        <p><b>Notes pour le procès-verbal</b> : l’organisation ou le ou la secrétaire résument ce qui a été dit et décidé, point
          par point (mise en forme possible). Elles figurent au PV.</p>
      </>,
    },
    {
      id: 'voter', emoji: '🗳️', title: '8. Faire voter',
      body: <>
        <ul>
          <li><b>Ouvrir le vote</b> sur le point : un seul vote à la fois. Les votants reçoivent une notification (même en mode
            silencieux) et un bandeau « Vote en cours — Aller au vote » s’affiche en haut de l’onglet.</li>
          <li>Chacun vote dans la carte du point, <b>une fois pour lui et une fois par procuration</b>. Le compteur « x / y ont
            voté » avance en direct.</li>
          <li><b>Clore le vote</b> affiche le résultat (adopté / rejeté, ou les élus). <b>Annuler</b> efface les voix et remet le
            point à voter, en cas d’erreur.</li>
          <li><b>Sans scrutin</b> : « Adopté par acclamation », « Rejeté sans scrutin » ou « Élection tacite » (autant de
            candidats que de sièges) enregistrent la décision sans vote.</li>
          <li><b>Égalité</b> à une élection : l’organisation désigne qui est élu parmi les ex æquo.</li>
        </ul>
      </>,
    },
    {
      id: 'sans-telephone', emoji: '📵', title: '9. Voter sans téléphone',
      body: <>
        <p>Une personne présente sans téléphone (ou sans batterie) peut quand même voter, de deux façons :</p>
        <ul>
          <li><b>Sur l’appareil de l’organisation</b> : pendant le vote, dans « Sans téléphone », choisis la personne puis
            « Faire voter quelqu’un sur cet appareil ». L’écran ne montre que son bulletin ; elle vote elle-même (pour elle et
            ses procurations), voit « Vote enregistré » et te rend l’appareil. <b>Le bulletin reste secret</b> : détourne les
            yeux. Une tablette posée dans la salle peut servir d’isoloir.</li>
          <li><b>Sur papier</b> : dans la liste de présence, touche <b>📄 Papier</b> à côté de son nom <b>avant d’ouvrir le
            vote</b> (le bouton est bloqué pendant un vote, pour qu’une voix ne compte jamais deux fois). Ses voix ne se votent
            plus dans l’app. Pendant le vote, saisis le décompte dans « Bulletins papier » (oui / non / abstention, ou bulletins
            et voix par candidat) <b>avant de clore</b>. Le résultat et le PV indiquent « dont N bulletins papier ».</li>
        </ul>
        <p>Pour beaucoup de membres sans smartphone, le papier est plus rapide ; pour une ou deux personnes, l’appareil de
          l’organisation suffit.</p>
      </>,
    },
    {
      id: 'clore', emoji: '✅', title: '10. Clore l’assemblée et le procès-verbal',
      body: <>
        <ul>
          <li>Clos d’abord le vote en cours, puis <b>Clore l’assemblée</b>. Les présents sont prévenus.</li>
          <li>Le <b>procès-verbal</b> (PDF) reprend les présents (prénom et nom), les procurations, le quorum, chaque point avec
            ses notes, les résultats et les élus, avec des lignes de signature. Avant la clôture, c’est un <b>projet</b>.</li>
          <li>À la clôture, le PV est envoyé par email au créateur du Plan. <b>Rouvrir</b> reste possible en cas d’oubli.</li>
          <li>Garde le PV : le Plan est supprimé <b>24 h après sa date de fin</b>. Fais-le relire et signer ; ce sont les statuts
            de l’association qui font foi.</li>
        </ul>
      </>,
    },
  ],
  members: {
    id: 'membres', emoji: '🙋', title: 'Ce que font les membres',
    body: <>
      <ul>
        <li><b>Avant</b> : lire l’ordre du jour et les documents, donner sa procuration s’ils ne peuvent pas venir.</li>
        <li><b>Sur place</b> : se pointer avec le code de la salle ou le QR code, puis voter dans la carte du point quand le
          vote s’ouvre (le bandeau « Aller au vote » y mène).</li>
        <li><b>Sans téléphone</b> : se signaler à l’organisation, qui les pointe et les fait voter sur son appareil ou sur
          papier.</li>
      </ul>
    </>,
  },
};

export default fr;
