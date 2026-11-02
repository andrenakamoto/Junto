import type { Dict } from '../fr';

// Plan mystère (components/plans/MysteryTab.tsx)
const mystery: Dict['mystery'] = {
  "setup": {
    "title": "Set up the mystery",
    "intro": "Guests see the title “{{title}}” and the place “{{place}}”. The real title and place below stay secret until the reveal.",
    "realTitle": "Real title (secret)",
    "realPlace": "Real place (secret)",
    "revealAt": "Final reveal",
    "revealHint": "The real title and place appear for everyone at this time, at the latest when the Plan starts.",
    "clues": "Clues",
    "cluesHint": "Each clue is revealed on its own at its time, with a notification.",
    "addClue": "Add a clue",
    "clueText": "E.g. Wear comfortable shoes 👟",
    "clueAt": "Revealed on",
    "starter": "Start with sample clues",
    "accomplices": "Accomplices",
    "accomplicesHint": "They see everything and help you keep the secret; they don’t bet.",
    "noParticipants": "No other participants yet.",
    "save": "Save",
    "saved": "Saved",
    "cancel": "Drop the mystery",
    "cancelConfirm": "Drop the mystery? Clues and bets will be erased; the current title and place stay.",
    "required": "Enter the real title and the real place.",
    "clueRequired": "Write each clue, or remove the empty ones."
  },
  "starterList": [
    "Wear comfortable shoes 👟",
    "It will be indoors… or not 😏",
    "Neighbourhood: …"
  ],
  "insider": {
    "organizer": "You’re organising this mystery 🤫",
    "accomplice": "You’re in on the secret 🤫",
    "secret": "Secret destination",
    "planned": "Planned clues",
    "revealed": "Revealed",
    "at": "on {{date}}",
    "revealNow": "Reveal now",
    "revealAll": "Reveal everything now",
    "revealAllConfirm": "Reveal the real title and place to everyone now?",
    "guesses": "Guests’ bets",
    "noGuess": "Nobody has placed a bet yet.",
    "edit": "Edit"
  },
  "guest": {
    "teaser": "Where are you going? It’s a mystery…",
    "revealIn": "Reveal in",
    "nextClue": "Next clue in",
    "clues": "Clues",
    "noClue": "No clue yet. Patience…",
    "bet": "Your bet",
    "betPlaceholder": "I think we’re going…",
    "betSave": "Bet",
    "betSaved": "Bet saved",
    "betRemove": "Remove",
    "betHint": "Everyone will see the bets at the reveal.",
    "notReady": "The mystery is being prepared… Come back soon!",
    "joinToBet": "Answer “I’m in” to place a bet.",
    "count_one": "{{count}} bet",
    "count_other": "{{count}} bets"
  },
  "reveal": {
    "title": "You’re going to…",
    "ok": "Great!",
    "guesses": "The bets",
    "none": "Nobody had placed a bet.",
    "by": "@{{pseudo}}"
  },
  "units": {
    "d": "d",
    "h": "h",
    "m": "min"
  }
};
export default mystery;
