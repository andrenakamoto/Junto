import type { Dict } from '../fr';

const landing: Dict['landing'] = {
  pageTitle: 'EvLY: organizzate le vostre uscite tra amici, in famiglia o in associazione',
  metaDescription: "Organizziamo meno, ci vediamo di più. EvLY riunisce le risposte, la chat, le spese e i viaggi delle vostre uscite. Gratis, senza pubblicità, ospitata in Svizzera.",
  nav: { discover: 'Uscite', demo: 'Demo', login: 'Accedi', signup: 'Crea un account' },
  hero: {
    kicker: 'Gratis · senza pubblicità · ospitata in Svizzera',
    title: "Organizziamo meno. Ci vediamo di più.",
    text: 'EvLY riunisce tutto ciò che serve per uscire insieme: un Plan chiaro, la risposta di ognuno, la chat, le spese, i viaggi… Per i tuoi amici, la tua famiglia, il tuo club o i tuoi colleghi.',
    cta: 'Crea il mio account gratuito',
    demo: 'Guarda la demo',
    guests: 'I tuoi invitati rispondono anche senza account.',
  },
  mock: {
    title: 'Aperitivo in terrazza 🌅',
    when: 'Sabato · 19:00',
    where: 'Da Julie',
    in: 'Ci sono',
    maybe: 'Forse',
    out: 'Passo',
    count: '{{n}} ci sono · 1 forse',
    bring: 'Tom porta il vino 🍷',
  },
  santa: {
    badge: 'Natale si avvicina 🎄',
    title: 'Il tuo Secret Santa, organizzato in 2 minuti',
    text: 'Il sorteggio, i desideri di ognuno e i messaggi segreti: tutto avviene nell’app EvLY, gratuitamente. Per la famiglia, i colleghi o gli amici.',
    p1: 'Sorteggio automatico, coppie separate',
    p2: 'Liste dei desideri e budget',
    p3: 'Messaggi anonimi con il tuo Babbo Natale segreto',
    p4: 'Promemoria e grande rivelazione',
    cta: 'Organizzare il mio Secret Santa',
    more: 'Come funziona',
    example: 'Guarda un esempio',
  },
  compare: {
    title: 'La stessa serata, due modi di organizzarla',
    beforeTitle: 'Il gruppo di chat',
    before1: 'dov’era già?',
    before2: 'chi viene??',
    before3: 'diciamo alle 19 o alle 20?',
    before4: 'non ci capisco più niente 😩',
    unread: '143 messaggi non letti',
    afterTitle: 'Un Plan EvLY',
    after1: '📅 Sabato 19:00 · Da Julie',
    after2: '✅ 6 ci sono · 1 forse · 1 assente',
    after3: '🍷 Tom porta il vino, Léa il dolce',
    after4: '🚗 2 posti nell’auto di Noah',
  },
  audiences: {
    title: 'Per tutti i tuoi gruppi',
    seeExample: 'Guarda un esempio',
    friends: { tab: 'Tra amici', p1: 'Chi viene, con un tocco: «Ci sono», «Forse», «Passo»', p2: 'Chi porta cosa, e i conti si fanno da soli', p3: 'Giochi per la serata: quiz, Killer, parola trappola' },
    family: { tab: 'Famiglia', p1: 'Il compleanno a sorpresa, nascosto alla persona festeggiata', p2: 'Il Secret Santa di Natale, con i desideri di ognuno', p3: 'Le vacanze: viaggi, spese, foto' },
    work: { tab: 'Colleghi', p1: 'L’aperitivo dopo il lavoro: si vota il posto, tutti vedono chi viene', p2: 'La festa d’addio a sorpresa, con una colletta', p3: 'La festa del team: attività, programma, turni' },
    clubs: { tab: 'Associazioni e club', p1: 'L’assemblea generale: convocazione, presenze, voti, verbale', p2: 'Gli allenamenti di ogni settimana e la lista d’attesa', p3: 'I turni dei volontari e il materiale del club' },
    pros: { tab: 'Professionisti', p1: 'Annunciare una serata, un corso o uno spettacolo con una locandina', p2: 'Le iscrizioni, i posti rimasti e la lista d’attesa', p3: 'I corsi che si ripetono ogni settimana' },
  },
  features: {
    title: 'Tutto nello stesso posto',
    rsvp: { title: 'Chi viene, finalmente chiaro', text: 'Ognuno risponde con un tocco. Anche gli invitati senza account, da un semplice link.' },
    surprise: { title: 'Le sorprese restano sorprese', text: 'Un Plan può essere nascosto alla persona festeggiata: niente secondo gruppo.' },
    money: { title: 'I conti, fatti per voi', text: 'Ognuno annota le sue spese, EvLY dice chi deve quanto a chi.' },
    travel: { title: 'Andarci insieme', text: 'Car pooling e orari dei trasporti pubblici svizzeri, fino all’ultimo ritorno della notte.' },
    games: { title: 'Giochi di gruppo', text: 'Quiz dal vivo, Killer, parola trappola, ruota della decisione, Secret Santa.' },
    discover: { title: 'Idee per uscire', text: 'Gli eventi e i luoghi di tutta la Svizzera, vicino a te.' },
  },
  discover: {
    title: 'Nessuna idea per il fine settimana?',
    text: 'Concerti, mostre, ristoranti, passeggiate… Le uscite di tutta la Svizzera, vicino a te, da proporre ai tuoi amici con un tocco.',
    button: 'Guarda tutte le uscite',
  },
  trust: {
    title: 'Un’app svizzera, fatta per voi, non per la pubblicità',
    free: { title: 'Gratis', text: 'Per te e per tutti i tuoi invitati.' },
    noads: { title: 'Senza pubblicità', text: 'Né nell’app, né altrove.' },
    data: { title: 'I tuoi dati restano tuoi', text: 'Mai venduti, messaggi cifrati.' },
    swiss: { title: 'Ospitata in Svizzera', text: 'Server presso Infomaniak, un’azienda svizzera.' },
  },
  brochures: {
    title: 'Per associazioni e professionisti',
    text: 'Tutte le funzioni per il vostro club, il vostro comitato o la vostra attività, in poche pagine illustrate (in francese).',
    download: 'Scarica l’opuscolo (PDF)',
    assoc: { title: 'Associazioni e club', text: 'Assemblea generale, turni dei volontari, attività del comitato, materiale, sondaggi e iscrizioni.' },
    pro: { title: 'Professionisti', text: 'Bar, sale, scuole, corsi e attività: annunci con locandina, iscrizioni, lista d’attesa, corsi ricorrenti.' },
  },
  faq: {
    title: 'Domande frequenti',
    q1: 'È davvero gratis?',
    a1: 'Sì. EvLY è gratis e senza pubblicità, per te come per i tuoi invitati.',
    q2: 'I miei amici devono creare un account?',
    a2: 'No. Possono rispondere a un Plan da un semplice link, con il loro nome. Un account serve per la chat, le notifiche e tutto il resto.',
    q3: 'Sostituisce WhatsApp?',
    a3: 'Per organizzare le vostre uscite, sì: ogni uscita ha il suo Plan, con chat, risposte e informazioni. Basta informazioni perse in un gruppo che parla di tutto.',
    q4: 'Su quali dispositivi?',
    a4: 'Su iPhone, Android e sul web (evly.ch), in francese, tedesco, italiano e inglese.',
    q5: 'Cosa fate dei miei dati?',
    a5: 'Servono solo a far funzionare l’app: mai venduti, mai usati per la pubblicità. Tutto è ospitato in Svizzera.',
    q6: 'E per un’associazione?',
    a6: 'EvLY gestisce anche le assemblee generali, i turni dei volontari, le attività del comitato e il materiale del club.',
  },
  final: {
    title: 'Il tuo prossimo Plan inizia qui.',
    text: 'Crea il tuo account in un minuto, poi invita i tuoi amici con un semplice link.',
  },
  footer: {
    brochure: 'Opuscolo associazioni (PDF, in francese)',
    brochurePro: 'Professionisti (PDF, in francese)',
    privacy: 'Privacy',
    deleteAccount: 'Eliminare il mio account',
    childSafety: 'Sicurezza dei minori',
    contact: 'Contatto',
    made: 'Creata a Ginevra · ospitata in Svizzera',
  },
  // Effets et navigation du site d'accueil (2026-11-21)
  fx: {
      "chat1": "dov’era già?",
      "chat2": "chi viene??",
      "chat3": "diciamo alle 19 o alle 20?",
      "chat4": "io posso solo domenica",
      "chat5": "qualcuno porta le patatine?",
      "chat6": "aspettate, rileggo tutto",
      "chat7": "è da Julie, no?",
      "chat8": "CI SONO 🙌",
      "chat9": "ah no, alla fine 19:30",
      "chat10": "chi porta il vino?",
      "chat11": "avete visto il mio messaggio?",
      "chat12": "ok ma DOVE??",
      "chat13": "+1",
      "chat14": "facciamo un sondaggio?",
      "chat15": "mi sono perso 40 messaggi 😅",
      "chat16": "non ci capisco più niente 😩",
      "briefKicker": "In breve",
      "briefTitle": "Tutto ciò che ti riguarda, a colpo d’occhio",
      "briefText": "Niente Plan da aprire né chat da rileggere: «In breve» ti dice l’essenziale, solo per te.",
      "briefP1": "Quando, dove e chi viene",
      "briefP2": "Il tuo posto in auto, cosa manca ancora",
      "briefP3": "Quanto devi, e a chi",
      "briefP4": "Un riepilogo da copiare, con un link per rispondere senza account",
      "briefAlt": "Schermata «In breve» di un Plan in EvLY",
      "rotPrefix": "Basta con 300 messaggi per sapere chi viene…",
      "rot1": "sabato",
      "rot2": "al compleanno della nonna",
      "rot3": "all’allenamento",
      "rot4": "all’assemblea",
      "rot5": "al Secret Santa",
      "tapHint": "Tocca a te! Premi «Ci sono»",
      "you": "Tu",
      "welcome": "Benvenuto/a nel Plan 🎉",
      "again": "Ricomincia",
      "storyKicker": "Come funziona",
      "storyTitle": "Dal gruppo che straripa al Plan che regge",
      "s1": {
          "title": "Il gruppo straripa",
          "text": "«Dov’è?», «Chi viene?», «Alle 19 o alle 20?»… Le info si perdono in 143 messaggi."
      },
      "s2": {
          "title": "Crei un Plan",
          "text": "Un titolo, una data, un luogo. In 30 secondi tutti hanno la stessa info nello stesso posto."
      },
      "s3": {
          "title": "Ognuno risponde con un gesto",
          "text": "«Ci sono», «Forse» o «Passo». Finalmente sai chi viene, anche gli ospiti senza account."
      },
      "s4": {
          "title": "Tutto si organizza da solo",
          "text": "Chi porta cosa, i posti in auto, le spese condivise: ogni cosa al suo posto."
      },
      "s5": {
          "title": "E la prossima uscita?",
          "text": "Scopri ti propone eventi e idee per uscire vicino a te. Un gesto, ed è un nuovo Plan."
      },
      "created": "Nuovo Plan",
      "bringTitle": "Chi porta cosa",
      "bring1": "Tom · il vino 🍷",
      "bring2": "Léa · il dolce 🍰",
      "bring3": "Patatine · da prendere",
      "car": "Noah · 2 posti 🚗",
      "expenses": "Spese · 84 CHF, condivise",
      "nearYou": "Vicino a te",
      "idea1": "🎄 Mercatino di Natale",
      "idea2": "⛸️ Pista di pattinaggio",
      "idea3": "🛷 Pista da slittino",
      "goCircle": "Andarci con un Cerchio",
      "drag": "Trascina per confrontare",
      "nav": {
          "hero": "Inizio",
          "story": "Come funziona",
          "compare": "In breve",
          "audiences": "Per chi",
          "features": "Funzioni",
          "discover": "Uscite",
          "trust": "Fiducia",
          "faq": "Domande"
      },
      "big": {
          "free": "{{n}} CHF",
          "noads": "{{n}} pubblicità",
          "data": "{{n}} dati venduti",
          "swiss": "{{n}} % svizzero"
      },
      "plans": {
          "friends": {
              "title": "Aperitivo sul tetto 🌅",
              "when": "Sabato · 19:00"
          },
          "family": {
              "title": "Gli 80 anni della nonna 🎂",
              "when": "Domenica · 12:00"
          },
          "work": {
              "title": "Afterwork di fine mese 🍻",
              "when": "Giovedì · 18:30"
          },
          "clubs": {
              "title": "Assemblea generale 🏛️",
              "when": "Martedì · 20:00"
          },
          "pros": {
              "title": "Serata salsa 💃",
              "when": "Venerdì · 21:00"
          }
      },
      "featured": "Per te"
  },
};
export default landing;
