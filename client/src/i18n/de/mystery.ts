import type { Dict } from '../fr';

// Plan mystère (components/plans/MysteryTab.tsx)
const mystery: Dict['mystery'] = {
  "setup": {
    "title": "Bereite das Geheimnis vor",
    "intro": "Die Gäste sehen den Titel „{{title}}“ und den Ort „{{place}}“. Der echte Titel und der echte Ort unten bleiben bis zur Enthüllung geheim.",
    "realTitle": "Echter Titel (geheim)",
    "realPlace": "Echter Ort (geheim)",
    "revealAt": "Enthüllung",
    "revealHint": "Der echte Titel und der echte Ort erscheinen zu dieser Zeit für alle, spätestens beim Beginn des Plans.",
    "clues": "Hinweise",
    "cluesHint": "Jeder Hinweis wird zu seiner Zeit von selbst enthüllt, mit einer Benachrichtigung.",
    "addClue": "Hinweis hinzufügen",
    "clueText": "z. B. Bequeme Schuhe mitnehmen 👟",
    "clueAt": "Enthüllt am",
    "starter": "Mit Beispiel-Hinweisen beginnen",
    "accomplices": "Komplizen",
    "accomplicesHint": "Sie sehen alles und helfen dir, das Geheimnis zu wahren; sie wetten nicht.",
    "noParticipants": "Noch keine anderen Teilnehmenden.",
    "save": "Speichern",
    "saved": "Gespeichert",
    "cancel": "Auf das Geheimnis verzichten",
    "cancelConfirm": "Auf das Geheimnis verzichten? Hinweise und Wetten werden gelöscht; der aktuelle Titel und Ort bleiben.",
    "required": "Gib den echten Titel und den echten Ort an.",
    "clueRequired": "Schreib jeden Hinweis oder entferne die leeren."
  },
  "starterList": [
    "Bequeme Schuhe mitnehmen 👟",
    "Es wird drinnen sein… oder auch nicht 😏",
    "Quartier: …"
  ],
  "insider": {
    "organizer": "Du organisierst dieses Geheimnis 🤫",
    "accomplice": "Du bist eingeweiht 🤫",
    "secret": "Geheimes Ziel",
    "planned": "Geplante Hinweise",
    "revealed": "Enthüllt",
    "at": "am {{date}}",
    "revealNow": "Jetzt enthüllen",
    "revealAll": "Jetzt alles enthüllen",
    "revealAllConfirm": "Den echten Titel und Ort jetzt allen enthüllen?",
    "guesses": "Wetten der Gäste",
    "noGuess": "Noch hat niemand gewettet.",
    "edit": "Bearbeiten"
  },
  "guest": {
    "teaser": "Wohin geht’s? Geheimnis…",
    "revealIn": "Enthüllung in",
    "nextClue": "Nächster Hinweis in",
    "clues": "Hinweise",
    "noClue": "Noch kein Hinweis. Geduld…",
    "bet": "Deine Wette",
    "betPlaceholder": "Ich glaube, wir gehen…",
    "betSave": "Wetten",
    "betSaved": "Wette gespeichert",
    "betRemove": "Entfernen",
    "betHint": "Alle sehen die Wetten bei der Enthüllung.",
    "notReady": "Das Geheimnis wird noch vorbereitet… Schau bald wieder vorbei!",
    "joinToBet": "Antworte «Ich bin dabei», um zu wetten.",
    "count_one": "{{count}} Wette",
    "count_other": "{{count}} Wetten"
  },
  "reveal": {
    "title": "Ihr geht zu…",
    "ok": "Super!",
    "guesses": "Die Wetten",
    "none": "Niemand hatte gewettet.",
    "by": "@{{pseudo}}"
  },
  "units": {
    "d": "T",
    "h": "Std",
    "m": "Min"
  }
};
export default mystery;
