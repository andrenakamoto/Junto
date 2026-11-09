import type { Dict } from '../fr';

// Organisationen (components/organisations)
const org: Dict['org'] = {
  words: { units: "Einheiten", teams: "Teams", auto: "Automatische Gruppen" },
  menu: { create: "Organisation erstellen", createHint: "Ein Verein mit mehreren Gruppen" },
  block: { expand: "Aufklappen", collapse: "Zuklappen", manage: "Organisation verwalten", count_one: "{{count}} Kreis", count_other: "{{count}} Kreise" },
  models: {
    youth: { name: "Jugend", hint: "Pfadi, Jugendbewegung", direction: "Leitung", responsible: "Gruppenleiter", members: "Elternteil|Jugendliche", units: "Sekretariat|Finanzen|Seelsorge|Material|Kommunikation", teams: "Grün|Orange|Blau|Rot|Dunkelgrün", responsibleGroup: "Gruppenleiter", directionGroup: "Leitung" },
    sport: { name: "Sportverein", hint: "Teams, Trainer, Eltern", direction: "Vorstand", responsible: "Trainer", members: "Elternteil|Spieler", units: "Finanzen|Festwirtschaft|Turniere", teams: "U9|U11|Senioren", responsibleGroup: "Trainer", directionGroup: "Vorstand" },
    choir: { name: "Chor oder Musik", hint: "Stimmen, Vorstand", direction: "Vorstand", responsible: "Stimmführer", members: "Chormitglied", units: "Konzerte|Finanzen", teams: "Sopran|Alt|Tenor|Bass", responsibleGroup: "Stimmführer", directionGroup: "Vorstand" },
    committee: { name: "Verein mit Vorstand", hint: "Ein Vorstand und seine Mitglieder", direction: "Vorstand", responsible: "Verantwortliche", members: "Mitglied", units: "Finanzen|Anlässe|Kommunikation", teams: "Mitglieder", responsibleGroup: "Verantwortliche", directionGroup: "Vorstand" },
    blank: { name: "Leer", hint: "Alles selbst schreiben", direction: "Leitung", responsible: "Verantwortliche", members: "Mitglied", units: "", teams: "", responsibleGroup: "Verantwortliche", directionGroup: "Leitung" },
  },
  create: {
    title: "Organisation erstellen", stepOf: "Schritt {{step}} von {{total}}",
    nameLabel: "Name der Organisation", namePlaceholder: "z. B. Pfadi Carouge", chooseModel: "Welche Vorlage passt am besten?", modelNote: "Im nächsten Schritt kannst du alles ändern.",
    rolesTitle: "Die Rollen", directionLabel: "Rolle der Leitung", responsibleLabel: "Rolle der Teamverantwortlichen", memberRolesLabel: "Rollen der Mitglieder",
    addRole: "Rolle hinzufügen", unitsHelp: "Die Arbeitsgruppen der Leitung.", teamsHelp: "Die Mitgliedergruppen und die Rolle beim Eintritt.", labelOf: "Wie nennt ihr sie?",
    addUnit: "Hinzufügen", addTeam: "Hinzufügen", newItem: "Name", remove: "Entfernen",
    autoTitle: "Automatische Gruppen", autoHelp: "Normale Kreise, deren Liste EvLY führt: Wer ernannt wird, kommt von selbst hinein und geht wieder, wenn die Rolle endet.",
    autoResponsibles: "Ein Kreis für alle Verantwortlichen", autoDirection: "Ein Kreis für die ganze Leitung", groupName: "Name des Kreises", alsoUnits: "Zusätzlich mit den Mitgliedern von:",
    summary_one: "EvLY erstellt {{count}} Kreis. Du bist Mitglied, in den Teams stummgeschaltet.", summary_other: "EvLY erstellt {{count}} Kreise. Du bist Mitglied, in den Teams stummgeschaltet.",
    back: "Zurück", next: "Weiter", submit: "Organisation erstellen", creating: "Wird erstellt…",
    needName: "Gib den Namen der Organisation an", needRoles: "Gib den Namen der Rollen an", needMemberRole: "Gib mindestens eine Mitgliederrolle an", needCircle: "Füge mindestens eine Einheit oder ein Team hinzu",
  },
  manage: {
    title: "Organisation", tabCircles: "Kreise", tabRights: "Rechte", tabPeople: "Personen",
    members_one: "{{count}} Mitglied", members_other: "{{count}} Mitglieder", integrate: "Beitreten", integrated: "Mitglied", code: "Code", copyCode: "Code kopieren", copied: "Kopiert",
    showMembers: "Mitglieder anzeigen", hideMembers: "Mitglieder ausblenden", role: "Rolle", noMember: "Noch niemand.", integratedTag: "Leitung",
    integrateNote: "Du kommst im diskreten Modus: Der Kreis bleibt stumm, ausser jemand erwähnt dich.",
    fixedOrder: "Immer dieselbe Reihenfolge", fixedOrderHint: "Die Kreise bleiben für alle Mitglieder in dieser Reihenfolge, unabhängig von der gewählten Sortierung.", moveUp: "Nach oben", moveDown: "Nach unten",
    rightsHelp: "Was jede Rolle darf. Die anderen Mitglieder sehen diese Tabelle nicht.", rightsAction: "Aktion",
    direction: "Leitung", admin: "Administration", peopleHelp: "Personen der Leitung können laut Rechtetabelle allen Kreisen beitreten.", makeDirection: "Zur Leitung hinzufügen", removeDirection: "Aus der Leitung entfernen",
    actions: {
      create_plan: "Einen Plan erstellen", create_poll: "Eine Terminumfrage erstellen", write_plan_chat: "Im Chat eines Plans schreiben", add_files: "Fotos und Dateien hinzufügen",
      send_announcement: "Ankündigung senden",
      manage_shifts: "Einsätze im Einsatzplan verwalten", invite_guests: "Externe Personen einladen", see_money: "Beträge der Lieferanten sehen", manage_members: "Mitglieder und Rollen verwalten", integrate_all: "Allen Kreisen beitreten",
    },
  },
  discussion: { title: "Wer schreibt in der Diskussion?", help: "Verantwortliche und Leitung schreiben immer." },
  audience: {"title": "Für wen?", "all": "Ganze Organisation", "roles": "In diesen Teams", "rolesHint": "Keine Rolle gewählt: alle.", "count_one": "{{count}} Person erhält diesen Plan", "count_other": "{{count}} Personen erhalten diesen Plan", "pollCount_one": "{{count}} Person erhält diese Umfrage", "pollCount_other": "{{count}} Personen erhalten diese Umfrage", "none": "Wähle mindestens einen Kreis", "multiNote": "Die Teilnehmerliste ist der Organisation vorbehalten (änderbar unter Regeln)."},
  chat: { ttl: "Nachrichten bleiben 3 Monate, Fotos 1 Monat.", photoExpired: "Foto abgelaufen", older: "Frühere Nachrichten" },
  announce: {"title": "Ankündigung senden", "banner": "Ankündigung", "intro": "Sie erscheint in der Diskussion jedes gewählten Kreises und bleibt 3 Monate sichtbar.", "message": "Deine Nachricht", "placeholder": "z. B. Das Lokal ist am Samstag geschlossen.", "forWho": "In welchen Kreisen?", "all": "Ganze Organisation", "count_one": "{{count}} Person erhält diese Ankündigung", "count_other": "{{count}} Personen erhalten diese Ankündigung", "empty": "Schreib deine Nachricht", "none": "Wähle mindestens einen Kreis", "send": "Ankündigung senden", "sending": "Wird gesendet…", "sent_one": "Ankündigung in {{count}} Kreis gesendet.", "sent_other": "Ankündigung in {{count}} Kreise gesendet.", "skipped": "Nicht gesendet an: {{names}} (Diskussion deaktiviert).", "recent": "Meine letzten Ankündigungen", "in": "In: {{names}}", "edit": "Bearbeiten", "save": "Speichern", "remove": "Überall löschen", "confirmRemove": "Löschen bestätigen"},
  plan: { readOnlyChat: "Mit deiner Rolle kannst du in diesem Chat nicht schreiben." },
};
export default org;
