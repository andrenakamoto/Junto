// Plan mystère (components/plans/MysteryTab.tsx)
const mystery = {
  "setup": {
    "title": "Prépare le mystère",
    "intro": "Les invités voient le titre « {{title}} » et le lieu « {{place}} ». Le vrai titre et le vrai lieu ci-dessous restent secrets jusqu’au dévoilement.",
    "realTitle": "Vrai titre (secret)",
    "realPlace": "Vrai lieu (secret)",
    "revealAt": "Dévoilement final",
    "revealHint": "Le vrai titre et le vrai lieu apparaissent pour tous à cette heure, au plus tard au début du Plan.",
    "clues": "Indices",
    "cluesHint": "Chaque indice se dévoile tout seul à son heure, avec une notification.",
    "addClue": "Ajouter un indice",
    "clueText": "Ex. : Prévoyez des chaussures confortables 👟",
    "clueAt": "Dévoilé le",
    "starter": "Commencer avec des indices types",
    "accomplices": "Complices",
    "accomplicesHint": "Ils voient tout et t’aident à garder le secret ; ils ne parient pas.",
    "noParticipants": "Aucun autre participant pour l’instant.",
    "save": "Enregistrer",
    "saved": "Enregistré",
    "cancel": "Renoncer au mystère",
    "cancelConfirm": "Renoncer au mystère ? Les indices et les paris seront effacés ; le titre et le lieu actuels restent.",
    "required": "Indique le vrai titre et le vrai lieu.",
    "clueRequired": "Écris chaque indice, ou retire ceux qui sont vides."
  },
  "starterList": [
    "Prévoyez des chaussures confortables 👟",
    "Ce sera à l’intérieur… ou pas 😏",
    "Quartier : …"
  ],
  "insider": {
    "organizer": "Tu organises ce mystère 🤫",
    "accomplice": "Tu es dans la confidence 🤫",
    "secret": "Destination secrète",
    "planned": "Indices prévus",
    "revealed": "Dévoilé",
    "at": "le {{date}}",
    "revealNow": "Dévoiler maintenant",
    "revealAll": "Tout dévoiler maintenant",
    "revealAllConfirm": "Dévoiler le vrai titre et le vrai lieu à tout le monde maintenant ?",
    "guesses": "Paris des invités",
    "noGuess": "Personne n’a encore parié.",
    "edit": "Modifier"
  },
  "guest": {
    "teaser": "Où allez-vous ? Mystère…",
    "revealIn": "Dévoilement dans",
    "nextClue": "Prochain indice dans",
    "clues": "Indices",
    "noClue": "Pas encore d’indice. Patience…",
    "bet": "Ton pari",
    "betPlaceholder": "Je pense qu’on va…",
    "betSave": "Parier",
    "betSaved": "Pari enregistré",
    "betRemove": "Retirer",
    "betHint": "Tout le monde découvrira les paris au dévoilement.",
    "notReady": "L’organisation prépare le mystère… Reviens bientôt !",
    "joinToBet": "Réponds « Je suis in » pour parier.",
    "count_one": "{{count}} pari",
    "count_other": "{{count}} paris"
  },
  "reveal": {
    "title": "Vous allez à…",
    "ok": "Génial !",
    "guesses": "Les paris",
    "none": "Personne n’avait parié.",
    "by": "@{{pseudo}}"
  },
  "units": {
    "d": "j",
    "h": "h",
    "m": "min"
  }
};
export default mystery;
