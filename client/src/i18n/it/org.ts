import type { Dict } from '../fr';

// Organizzazioni (components/organisations)
const org: Dict['org'] = {
  words: { units: "Unità", teams: "Squadre", auto: "Gruppi automatici" },
  menu: { create: "Crea un’Organizzazione", createHint: "Un’associazione con più gruppi" },
  block: { expand: "Espandi", collapse: "Comprimi", manage: "Gestisci l’Organizzazione", count_one: "{{count}} Cerchio", count_other: "{{count}} Cerchi" },
  models: {
    youth: { name: "Gioventù", hint: "Scout, movimento giovanile", direction: "Dirigente", responsible: "Capo", members: "Genitore|Giovane", units: "Segreteria|Tesoreria|Spirituale|Materiale|Comunicazione", teams: "Verde|Arancione|Blu|Rosso|Verde scuro", responsibleGroup: "Capi", directionGroup: "Dirigenti" },
    sport: { name: "Società sportiva", hint: "Squadre, allenatori, genitori", direction: "Comitato", responsible: "Allenatore", members: "Genitore|Giocatore", units: "Finanze|Buvette|Tornei", teams: "U9|U11|Senior", responsibleGroup: "Allenatori", directionGroup: "Comitato" },
    choir: { name: "Coro o musica", hint: "Sezioni, comitato", direction: "Comitato", responsible: "Capo sezione", members: "Corista", units: "Concerti|Tesoreria", teams: "Soprani|Contralti|Tenori|Bassi", responsibleGroup: "Capi sezione", directionGroup: "Comitato" },
    committee: { name: "Associazione con comitato", hint: "Un comitato e i suoi membri", direction: "Comitato", responsible: "Responsabile", members: "Membro", units: "Tesoreria|Eventi|Comunicazione", teams: "Membri", responsibleGroup: "Responsabili", directionGroup: "Comitato" },
    blank: { name: "Vuoto", hint: "Scrivere tutto da sé", direction: "Direzione", responsible: "Responsabile", members: "Membro", units: "", teams: "", responsibleGroup: "Responsabili", directionGroup: "Direzione" },
  },
  create: {
    title: "Crea un’Organizzazione", stepOf: "Passo {{step}} di {{total}}",
    nameLabel: "Nome dell’Organizzazione", namePlaceholder: "Es. Scout di Carouge", chooseModel: "Quale modello vi somiglia di più?", modelNote: "Al passo successivo puoi modificare tutto.",
    rolesTitle: "I ruoli", directionLabel: "Ruolo della direzione", responsibleLabel: "Ruolo dei responsabili di squadra", memberRolesLabel: "Ruoli dei membri",
    addRole: "Aggiungi un ruolo", unitsHelp: "I gruppi di lavoro della direzione.", teamsHelp: "I gruppi di membri, con il ruolo dato all’ingresso.", labelOf: "Come li chiamate?",
    addUnit: "Aggiungi", addTeam: "Aggiungi", newItem: "Nome", remove: "Rimuovi",
    autoTitle: "Gruppi automatici", autoHelp: "Cerchi normali di cui EvLY tiene l’elenco: chi viene nominato entra da solo ed esce quando non ha più quel ruolo.",
    autoResponsibles: "Un Cerchio per tutti i responsabili", autoDirection: "Un Cerchio per tutta la direzione", groupName: "Nome del Cerchio", alsoUnits: "Con anche i membri di:",
    summary_one: "EvLY creerà {{count}} Cerchio. Ne sarai membro, in silenzio nelle squadre.", summary_other: "EvLY creerà {{count}} Cerchi. Ne sarai membro, in silenzio nelle squadre.",
    back: "Indietro", next: "Continua", submit: "Crea l’Organizzazione", creating: "Creazione…",
    needName: "Indica il nome dell’Organizzazione", needRoles: "Indica il nome dei ruoli", needMemberRole: "Indica almeno un ruolo di membro", needCircle: "Aggiungi almeno un’unità o una squadra",
  },
  manage: {
    title: "Organizzazione", tabCircles: "Cerchi", tabRights: "Diritti", tabPeople: "Persone",
    members_one: "{{count}} membro", members_other: "{{count}} membri", integrate: "Entra", integrated: "Membro", code: "Codice", copyCode: "Copia il codice", copied: "Copiato",
    showMembers: "Mostra i membri", hideMembers: "Nascondi i membri", role: "Ruolo", noMember: "Ancora nessuno.", integratedTag: "Direzione",
    integrateNote: "Entri in modalità discreta: il Cerchio resta in silenzio, a meno che qualcuno ti menzioni.",
    fixedOrder: "Mantieni sempre lo stesso ordine", fixedOrderHint: "I Cerchi restano in quest’ordine per tutti i membri, qualunque sia l’ordinamento scelto.", moveUp: "Sposta su", moveDown: "Sposta giù",
    rightsHelp: "Che cosa può fare ogni ruolo. Gli altri membri non vedono questa tabella.", rightsAction: "Azione",
    direction: "Direzione", admin: "Amministrazione", peopleHelp: "Le persone della direzione possono entrare in tutti i Cerchi secondo la tabella dei diritti.", makeDirection: "Aggiungi alla direzione", removeDirection: "Togli dalla direzione",
    actions: {
      create_plan: "Creare un Plan", create_poll: "Creare un sondaggio di date", write_plan_chat: "Scrivere nella chat di un Plan", add_files: "Aggiungere foto e file",
      manage_shifts: "Gestire i posti dei Turni", invite_guests: "Invitare persone esterne", see_money: "Vedere gli importi dei fornitori", manage_members: "Gestire membri e ruoli", integrate_all: "Entrare in tutti i Cerchi",
    },
  },
  discussion: { title: "Chi scrive nella Discussione?", help: "I responsabili e la direzione scrivono sempre." },
  audience: {"title": "Per chi?", "all": "Tutta l’organizzazione", "roles": "In queste squadre", "rolesHint": "Nessun ruolo scelto: tutti.", "count_one": "{{count}} persona riceverà questo Plan", "count_other": "{{count}} persone riceveranno questo Plan", "pollCount_one": "{{count}} persona riceverà questo sondaggio", "pollCount_other": "{{count}} persone riceveranno questo sondaggio", "none": "Scegli almeno un Cerchio", "multiNote": "L’elenco dei partecipanti sarà riservato all’organizzazione (modificabile in Regole)."},
  plan: { readOnlyChat: "Il tuo ruolo non permette di scrivere in questa chat." },
};
export default org;
