// Site d'accueil d'EvLY (page / sur le web, 2026-11-17). Les apps ouvrent toujours directement la connexion.
export default {
  pageTitle: 'EvLY : organisez vos sorties entre amis, en famille ou en association',
  metaDescription: "On organise moins, on se voit plus. EvLY réunit les réponses, le chat, les dépenses et les trajets de vos sorties. Gratuit, sans pub, hébergé en Suisse.",
  nav: { discover: 'Sorties', demo: 'Démo', login: 'Se connecter', signup: 'Créer un compte' },
  hero: {
    kicker: 'Gratuit · sans pub · hébergé en Suisse',
    title: "On organise moins. On se voit plus.",
    text: 'EvLY réunit tout ce qu’il faut pour sortir ensemble : un Plan clair, la réponse de chacun, le chat, les dépenses, les trajets… Pour tes amis, ta famille, ton club ou tes collègues.',
    cta: 'Créer mon compte gratuit',
    demo: 'Voir la démo',
    guests: 'Tes invités répondent même sans compte.',
  },
  mock: {
    title: 'Apéro sur le toit 🌅',
    when: 'Samedi · 19:00',
    where: 'Chez Julie',
    in: 'Je suis in',
    maybe: 'Peut-être',
    out: 'Je passe',
    count: '{{n}} in · 1 peut-être',
    bring: 'Tom apporte le vin 🍷',
  },
  santa: {
    badge: 'Noël approche 🎄',
    title: 'Ton Secret Santa, organisé en 2 minutes',
    text: 'Le tirage au sort, les envies de chacun et les messages secrets : tout se passe dans l’app EvLY, gratuitement. Pour la famille, les collègues ou les amis.',
    p1: 'Tirage au sort automatique, couples séparés',
    p2: 'Listes d’envies et budget',
    p3: 'Messages anonymes avec ton Père Noël secret',
    p4: 'Rappels et grande révélation',
    cta: 'Organiser mon Secret Santa',
    more: 'Comment ça marche',
    example: 'Voir un exemple',
  },
  compare: {
    title: 'La même soirée, deux façons de l’organiser',
    beforeTitle: 'Le groupe de discussion',
    before1: 'c’était où déjà ?',
    before2: 'qui vient ??',
    before3: 'on dit 19h ou 20h ?',
    before4: 'je vois rien passer 😩',
    unread: '143 messages non lus',
    afterTitle: 'Un Plan EvLY',
    after1: '📅 Samedi 19:00 · Chez Julie',
    after2: '✅ 6 in · 1 peut-être · 1 absent',
    after3: '🍷 Tom apporte le vin, Léa le dessert',
    after4: '🚗 2 places dans la voiture de Noah',
  },
  audiences: {
    title: 'Pour tous tes groupes',
    seeExample: 'Voir un exemple',
    friends: { tab: 'Entre amis', p1: 'Qui vient, en un geste : « Je suis in », « Peut-être », « Je passe »', p2: 'Qui apporte quoi, et les comptes faits tout seuls', p3: 'Des jeux pour la soirée : quiz, Killer, mot piège' },
    family: { tab: 'Famille', p1: 'L’anniversaire surprise, caché à la personne fêtée', p2: 'Le Secret Santa de Noël, avec les envies de chacun', p3: 'Les vacances : trajets, dépenses, photos' },
    work: { tab: 'Collègues', p1: 'L’afterwork : on vote pour le lieu, tout le monde voit qui vient', p2: 'Le pot de départ en surprise, avec une cagnotte', p3: 'La fête d’équipe : tâches, déroulé, planning' },
    clubs: { tab: 'Associations et clubs', p1: 'L’assemblée générale : convocation, présences, votes, procès-verbal', p2: 'Les entraînements de chaque semaine et la liste d’attente', p3: 'Le planning des bénévoles et le matériel du club' },
    pros: { tab: 'Professionnels', p1: 'Annoncer une soirée, un cours ou un spectacle avec une affiche', p2: 'Les inscriptions, les places restantes et la liste d’attente', p3: 'Les cours qui se répètent, chaque semaine' },
  },
  features: {
    title: 'Tout au même endroit',
    rsvp: { title: 'Qui vient, enfin clair', text: 'Chacun répond en un geste. Les invités sans compte aussi, depuis un simple lien.' },
    surprise: { title: 'Les surprises restent des surprises', text: 'Un Plan peut être caché à la personne fêtée : pas besoin d’un deuxième groupe.' },
    money: { title: 'Les comptes, faits pour vous', text: 'Chacun note ses dépenses, EvLY dit qui doit combien à qui.' },
    travel: { title: 'Y aller ensemble', text: 'Covoiturage et horaires des transports publics suisses, jusqu’au dernier retour de la nuit.' },
    games: { title: 'Des jeux de groupe', text: 'Quiz en direct, Killer, mot piège, roue de la décision, Secret Santa.' },
    discover: { title: 'Des idées de sorties', text: 'Les événements et les lieux de toute la Suisse, près de chez toi.' },
  },
  discover: {
    title: 'Pas d’idée pour ce week-end ?',
    text: 'Concerts, expositions, restaurants, balades… Les sorties de toute la Suisse, près de chez toi, à proposer à tes amis en un geste.',
    button: 'Voir toutes les sorties',
  },
  trust: {
    title: 'Une app suisse, faite pour vous, pas pour la pub',
    free: { title: 'Gratuit', text: 'Pour toi et pour tous tes invités.' },
    noads: { title: 'Sans pub', text: 'Ni dans l’app, ni ailleurs.' },
    data: { title: 'Tes données restent à toi', text: 'Jamais vendues, messages chiffrés.' },
    swiss: { title: 'Hébergé en Suisse', text: 'Serveurs chez Infomaniak, une entreprise suisse.' },
  },
  brochures: {
    title: 'Pour les associations et les professionnels',
    text: 'Toutes les fonctions pour votre club, votre comité ou votre établissement, en quelques pages illustrées.',
    download: 'Télécharger la brochure (PDF)',
    assoc: { title: 'Associations et clubs', text: 'Assemblée générale, planning des bénévoles, tâches du comité, matériel, sondages et inscriptions.' },
    pro: { title: 'Professionnels', text: 'Bars, salles, écoles, cours et activités : annonces avec affiche, inscriptions, liste d’attente, cours récurrents.' },
  },
  faq: {
    title: 'Questions fréquentes',
    q1: 'Est-ce vraiment gratuit ?',
    a1: 'Oui. EvLY est gratuit et sans publicité, pour toi comme pour tes invités.',
    q2: 'Mes amis doivent-ils créer un compte ?',
    a2: 'Non. Ils peuvent répondre à un Plan depuis un simple lien, avec leur prénom. Un compte sert à profiter du chat, des notifications et de tout le reste.',
    q3: 'Est-ce que ça remplace WhatsApp ?',
    a3: 'Pour organiser vos sorties, oui : chaque sortie a son Plan, avec son chat, ses réponses et ses infos. Fini les infos noyées dans un groupe qui parle de tout.',
    q4: 'Sur quels appareils ?',
    a4: 'Sur iPhone, sur Android et sur le web (evly.ch), en français, allemand, italien et anglais.',
    q5: 'Que faites-vous de mes données ?',
    a5: 'Elles servent seulement à faire fonctionner l’app : jamais vendues, jamais utilisées pour de la pub. Tout est hébergé en Suisse.',
    q6: 'Et pour une association ?',
    a6: 'EvLY gère aussi les assemblées générales, le planning des bénévoles, les tâches du comité et le matériel du club.',
  },
  final: {
    title: 'Ton prochain Plan commence ici.',
    text: 'Crée ton compte en une minute, puis invite tes amis avec un simple lien.',
  },
  footer: {
    brochure: 'Brochure associations (PDF)',
    brochurePro: 'Professionnels (PDF)',
    privacy: 'Confidentialité',
    deleteAccount: 'Supprimer mon compte',
    childSafety: 'Sécurité des enfants',
    contact: 'Contact',
    made: 'Créé à Genève · hébergé en Suisse',
  },
  // Effets et navigation du site d'accueil (2026-11-21)
  fx: {
      "rotPrefix": "Fini les 300 messages pour savoir qui vient…",
      "rot1": "samedi",
      "rot2": "à l’anniversaire de Mamie",
      "rot3": "à l’entraînement",
      "rot4": "à l’AG",
      "rot5": "au Secret Santa",
      "tapHint": "À toi ! Touche « Je suis in »",
      "you": "Toi",
      "welcome": "Bienvenue dans le Plan 🎉",
      "again": "Recommencer",
      "storyKicker": "Comment ça marche",
      "storyTitle": "Un samedi, du bazar au Plan",
      "s1": {
          "title": "Le groupe déborde",
          "text": "« C’est où ? », « Qui vient ? », « 19 h ou 20 h ? »… Les infos se perdent dans 143 messages."
      },
      "s2": {
          "title": "Tu crées un Plan",
          "text": "Un titre, une date, un lieu. En 30 secondes, tout le monde a la même info au même endroit."
      },
      "s3": {
          "title": "Chacun répond en un geste",
          "text": "« Je suis in », « Peut-être » ou « Je passe ». Tu sais enfin qui vient, même tes invités sans compte."
      },
      "s4": {
          "title": "Tout s’organise tout seul",
          "text": "Qui apporte quoi, les places en voiture, les dépenses partagées : chaque chose a sa place."
      },
      "s5": {
          "title": "Et la prochaine sortie ?",
          "text": "Découvrir te propose les événements et les idées de sorties près de chez toi. Un geste, et c’est un nouveau Plan."
      },
      "created": "Nouveau Plan",
      "bringTitle": "Qui apporte quoi",
      "bring1": "Tom · le vin 🍷",
      "bring2": "Léa · le dessert 🍰",
      "bring3": "Les chips · à prendre",
      "car": "Noah · 2 places 🚗",
      "expenses": "Dépenses · 84 CHF, partagées",
      "nearYou": "Près de chez toi",
      "idea1": "🎄 Marché de Noël",
      "idea2": "⛸️ Patinoire",
      "idea3": "🛷 Piste de luge",
      "goCircle": "Y aller avec un Cercle",
      "drag": "Fais glisser pour comparer",
      "nav": {
          "hero": "Accueil",
          "story": "Comment ça marche",
          "compare": "Avant / après",
          "audiences": "Pour qui",
          "features": "Fonctions",
          "discover": "Sorties",
          "trust": "Confiance",
          "faq": "Questions"
      },
      "big": {
          "free": "{{n}} CHF",
          "noads": "{{n}} pub",
          "data": "{{n}} donnée vendue",
          "swiss": "{{n}} % suisse"
      },
      "plans": {
          "friends": {
              "title": "Apéro sur le toit 🌅",
              "when": "Samedi · 19:00"
          },
          "family": {
              "title": "Les 80 ans de Mamie 🎂",
              "when": "Dimanche · 12:00"
          },
          "work": {
              "title": "Afterwork de fin de mois 🍻",
              "when": "Jeudi · 18:30"
          },
          "clubs": {
              "title": "Assemblée générale 🏛️",
              "when": "Mardi · 20:00"
          },
          "pros": {
              "title": "Soirée salsa 💃",
              "when": "Vendredi · 21:00"
          }
      },
      "featured": "Pour toi"
  },
};
