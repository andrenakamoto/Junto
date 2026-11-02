import type { Dict } from '../fr';

// Plan mystère (components/plans/MysteryTab.tsx)
const mystery: Dict['mystery'] = {
  "setup": {
    "title": "Prepara il mistero",
    "intro": "Gli invitati vedono il titolo «{{title}}» e il luogo «{{place}}». Il vero titolo e il vero luogo qui sotto restano segreti fino alla rivelazione.",
    "realTitle": "Vero titolo (segreto)",
    "realPlace": "Vero luogo (segreto)",
    "revealAt": "Rivelazione finale",
    "revealHint": "Il vero titolo e il vero luogo appaiono per tutti a quest’ora, al più tardi all’inizio del Plan.",
    "clues": "Indizi",
    "cluesHint": "Ogni indizio si svela da solo alla sua ora, con una notifica.",
    "addClue": "Aggiungi un indizio",
    "clueText": "Es.: Portate scarpe comode 👟",
    "clueAt": "Svelato il",
    "starter": "Inizia con indizi di esempio",
    "accomplices": "Complici",
    "accomplicesHint": "Vedono tutto e ti aiutano a mantenere il segreto; non scommettono.",
    "noParticipants": "Ancora nessun altro partecipante.",
    "save": "Salva",
    "saved": "Salvato",
    "cancel": "Rinuncia al mistero",
    "cancelConfirm": "Rinunciare al mistero? Indizi e scommesse saranno cancellati; il titolo e il luogo attuali restano.",
    "required": "Indica il vero titolo e il vero luogo.",
    "clueRequired": "Scrivi ogni indizio o togli quelli vuoti."
  },
  "starterList": [
    "Portate scarpe comode 👟",
    "Sarà al chiuso… o forse no 😏",
    "Quartiere: …"
  ],
  "insider": {
    "organizer": "Organizzi questo mistero 🤫",
    "accomplice": "Sei nel segreto 🤫",
    "secret": "Destinazione segreta",
    "planned": "Indizi previsti",
    "revealed": "Svelato",
    "at": "il {{date}}",
    "revealNow": "Svela ora",
    "revealAll": "Svela tutto ora",
    "revealAllConfirm": "Svelare ora a tutti il vero titolo e il vero luogo?",
    "guesses": "Scommesse degli invitati",
    "noGuess": "Nessuno ha ancora scommesso.",
    "edit": "Modifica"
  },
  "guest": {
    "teaser": "Dove andate? Mistero…",
    "revealIn": "Rivelazione tra",
    "nextClue": "Prossimo indizio tra",
    "clues": "Indizi",
    "noClue": "Ancora nessun indizio. Pazienza…",
    "bet": "La tua scommessa",
    "betPlaceholder": "Secondo me andiamo…",
    "betSave": "Scommetti",
    "betSaved": "Scommessa salvata",
    "betRemove": "Togli",
    "betHint": "Tutti scopriranno le scommesse alla rivelazione.",
    "notReady": "Il mistero è in preparazione… Torna presto!",
    "joinToBet": "Rispondi «Ci sono» per scommettere.",
    "count_one": "{{count}} scommessa",
    "count_other": "{{count}} scommesse"
  },
  "reveal": {
    "title": "Andate a…",
    "ok": "Fantastico!",
    "guesses": "Le scommesse",
    "none": "Nessuno aveva scommesso.",
    "by": "@{{pseudo}}"
  },
  "units": {
    "d": "g",
    "h": "h",
    "m": "min"
  }
};
export default mystery;
