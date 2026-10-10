import { L, P, type Group, type GuideText } from './parts';

// Guida all'uso in italiano
const groups: Group[] = [
  {
    title: 'Le basi',
    topics: [
      {
        id: 'vocabulaire', emoji: '🧭', title: 'Cerchio, Plan, Chat', summary: 'Le tre parole da conoscere',
        body: <>
          <P>Un <strong>Cerchio</strong> è il tuo gruppo: amici, famiglia, colleghi, club, associazione. Un{' '}
            <strong>Plan</strong> è un evento preciso in un Cerchio («Pizza venerdì?», «Tombola annuale»). Ogni Plan ha la
            sua <strong>Chat</strong> e le sue sezioni: un compleanno e un aperitivo non si mescolano mai.</P>
          <P>A sinistra i tuoi Cerchi, poi <strong>«Tutti i miei plan»</strong> (per data, il più vicino prima) e il{' '}
            <strong>Calendario</strong>. Cerchi e Plan di un Cerchio sono ordinati per ultima attività.</P>
        </>,
      },
      {
        id: 'cercle', emoji: '👥', title: 'Creare, unirsi, invitare in un Cerchio', summary: 'Codice d’accesso, link, codice QR o invito',
        body: <>
          <P><strong>«Crea un Cerchio»</strong> sotto «I miei Cerchi» (nome, descrizione, colore). <strong>«Unisciti a un
            Cerchio»</strong> con il suo <strong>codice d’accesso</strong>, un link o un codice QR. Se hai già un account,
            un membro può anche invitarti con pseudonimo o email: l’invito arriva nella campanella 🔔.</P>
          <P>A seconda del Cerchio, una richiesta è accettata con un <strong>voto a maggioranza</strong> dei membri (per
            impostazione predefinita), dagli organizzatori o subito. In modalità voto nessuno può rifiutare da solo.</P>
          <P>La lista dei membri si apre toccando «N membri» sul Cerchio o l’icona 👥 in cima ai suoi Plan: chi è online,
            ruoli, pulsante «Invita».</P>
        </>,
      },
      {
        id: 'plan', emoji: '📅', title: 'Creare e modificare un Plan', summary: 'Titolo, data, luogo, limite, funzioni',
        body: <>
          <P><strong>«Crea un Plan»</strong> in fondo alla lista dei Plan: titolo, descrizione, data, luogo, limite di
            partecipanti, <strong>informazioni importanti</strong> (riquadro ben visibile). La <strong>data di fine è
            obbligatoria</strong>: quel giorno il Plan viene eliminato (al massimo 3 settimane dopo l’inizio). I membri del
            Cerchio vengono avvisati.</P>
          <P>Il creatore modifica il suo Plan con la matita; può permettere a tutti di cambiare date e luogo, o le
            informazioni importanti. Ogni modifica è conservata nella <strong>cronologia</strong>.</P>
          <P>In <strong>«Impostazioni avanzate»</strong>, la lista <strong>«Funzioni del Plan»</strong> è ordinata per
            categoria (Comunicare, Organizzare, Festeggiare e regalare, Giocare): togli la spunta a ciò che non ti serve e
            spunta le funzioni da attivare (volontari, assemblea, colletta, giochi…). Modificabile in seguito con l’icona
            impostazioni del Plan.</P>
        </>,
      },
      {
        id: 'repondre', emoji: '✋', title: 'Rispondere e lista d’attesa', summary: 'Ci sono · Forse · Assente',
        body: <>
          <P>Unirsi a un Plan significa dare il proprio accordo: <strong>Ci sono</strong>, <strong>Forse</strong> o{' '}
            <strong>Assente</strong>, visibile a tutti i partecipanti. Gli altri sono avvisati quando qualcuno arriva o si
            ritira.</P>
          <P><strong>Lista d’attesa</strong>: un Plan con un limite è completo quando i «Ci sono» e i «Forse» lo
            raggiungono. Iscriviti in attesa: appena si libera un posto, vieni iscritto/a automaticamente, in ordine, e
            avvisato/a. La tua posizione appare sulla scheda («In attesa n°2»).</P>
        </>,
      },
      {
        id: 'sondage-dates', emoji: '🗓️', title: 'Sondaggio date', summary: 'Trovare la data prima di creare il Plan',
        body: <>
          <P>In un Cerchio, <strong>«Proponi delle date»</strong>: ognuno spunta tutte le date che gli vanno bene, oppure
            «Non mi interessa». Il sondaggio ha la sua chat. Quando emerge una data, <strong>«Crea il Plan»</strong> lo
            trasforma in Plan (la conversazione segue).</P>
          <P>Termina il giorno dopo l’ultima data proposta, al massimo dopo 30 giorni; chi l’ha creato riceve un promemoria
            il giorno prima.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Plan ricorrenti', summary: 'Ogni settimana, ogni 2 settimane, ogni mese',
        body: <P>Alla creazione, scegli <strong>«Ripeti»</strong>: ogni settimana, ogni 2 settimane o ogni mese, con «Fino
          al» facoltativo. Appena la data è passata, viene creato il Plan successivo con le stesse info e impostazioni, e le
          risposte azzerate. Menu del Plan: <strong>«Annulla questa volta»</strong> o <strong>«Interrompi la
          ripetizione»</strong>.</P>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Plan e sondaggio a sorpresa', summary: 'Nascondere un Plan ad alcuni membri',
        body: <P>Spunta <strong>«Plan a sorpresa»</strong> e scegli a chi nasconderlo: per loro non esiste (né lista, né
          notifica, né email). Gli altri vedono una fascia che ricorda per chi è la sorpresa.</P>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Invitare qualcuno di esterno', summary: 'Un link verso un solo Plan, con o senza account',
        body: <>
          <P><strong>Invita</strong> → «Persona esterna»: un link da condividere (WhatsApp, SMS, codice QR). La persona vede{' '}
            <strong>solo questo Plan</strong>, nient’altro del Cerchio.</P>
          <P>Senza account può rispondere con il suo <strong>nome</strong> (ci sono, forse, passo). Se poi crea un account,
            le sue risposte la seguono.</P>
          <P>Fuori da un Cerchio, <strong>«Organizza un’uscita»</strong> (pagina di accesso) crea un Plan in 30 secondi,
            anche senza account, nel tuo Cerchio personale «I miei Plan».</P>
        </>,
      },
    ],
  },
  {
    title: 'In un Plan',
    topics: [
      {
        id: 'fiche', emoji: '📱', title: 'La scheda del Plan', summary: 'Riquadri sul telefono, schede su schermo grande',
        body: <>
          <P>Sul telefono la scheda mostra <strong>un riquadro per sezione</strong> (Chat, Info, Passaggi, Membri, Voti,
            Spese e funzioni attivate). Un pallino arancione segnala le novità. Indietro: freccia, tasto indietro o
            scorrere dal bordo sinistro. In basso la <strong>barra delle azioni</strong>: Invita, Foto, Agenda, Story e
            Riepilogo.</P>
          <P>Su computer e tablet le sezioni sono schede.</P>
        </>,
      },
      {
        id: 'chat', emoji: '💬', title: 'Chat', summary: 'Menzioni, reazioni, foto, messaggi vocali',
        body: <>
          <L items={[
            <><strong>@pseudonimo</strong> per menzionare qualcuno (avvisato anche in modalità silenziosa).</>,
            <>Reazioni emoji e <strong>risposte in thread</strong>; sul telefono tocca un messaggio per reagire.</>,
            <><strong>Foto</strong> (fotocamera o galleria) e <strong>messaggi vocali</strong> (tasto microfono, al massimo 2 minuti).</>,
            <>Modificare o eliminare il tuo messaggio per <strong>15 minuti</strong>; la foto che hai inviato si elimina in qualsiasi momento.</>,
            <><strong>Segnalare</strong> un messaggio al team EvLY, o <strong>nascondere</strong> una persona (i suoi messaggi e notifiche spariscono per te).</>,
          ]} />
        </>,
      },
      {
        id: 'infos', emoji: '📋', title: 'Info, foto e file', summary: 'Informazioni importanti, galleria, documenti',
        body: <P>La sezione <strong>Info</strong> raccoglie descrizione, <strong>informazioni importanti</strong>, file e
          galleria fotografica. <strong>«Scarica tutte le foto»</strong> recupera tutto in una volta (ZIP): fallo prima
          della data di fine. 10 MB per file, 100 MB per Plan.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Voti: sondaggio, Match, A chi tocca?', summary: 'Tre modi per decidere insieme',
        body: <>
          <L items={[
            <><strong>Sondaggio</strong>: una domanda, una scelta. Anonimo o no; se non lo è, ognuno vede chi ha votato cosa.</>,
            <><strong>Match</strong> 💘: ognuno dice sì o no a ogni proposta (carte da scorrere, foto facoltativa). Le
              risposte degli altri restano nascoste finché non hai finito. «È un match» quando tutti hanno detto sì. Il
              creatore del Plan sceglie e può riportare la scelta nel luogo o nelle informazioni importanti.</>,
            <><strong>A chi tocca?</strong> 🎡: una ruota estrae a sorte una persona del Plan («Ci sono» e «Forse»). Togli
              la spunta a chi vuoi escludere: i loro nomi appaiono con il risultato. La ruota gira contemporaneamente su
              tutti i telefoni che guardano il Plan. Opzione «Mai due volte la stessa persona».</>,
          ]} />
        </>,
      },
      {
        id: 'trajets', emoji: '🚗', title: 'Passaggi (car pooling)', summary: 'Offrire, salire, cercare un posto',
        body: <P>Un conducente offre un passaggio di andata (partenza, ora, posti, nota per il ritorno). I passeggeri toccano{' '}
          <strong>«Salgo»</strong>; senza auto, <strong>«Cerco un posto»</strong>. Rispondere «Assente» ti toglie dal tuo
          passaggio.</P>,
      },
      {
        id: 'depenses', emoji: '💶', title: 'Spese e «chi porta cosa»', summary: 'Lista da portare, spese condivise, CHF o €',
        body: <>
          <P><strong>Chi porta cosa</strong>: una lista (con quantità) in cui ognuno tocca «Lo porto io».</P>
          <P><strong>Spese</strong>: chi ha pagato cosa e per chi; EvLY calcola i saldi e propone i bonifici più semplici.
            Franchi ed euro sono contati separatamente, senza conversione. Nessun denaro passa da EvLY. Se ci sono spese, un
            riepilogo viene inviato per email prima dell’eliminazione del Plan.</P>
        </>,
      },
    ],
  },
  {
    title: 'Funzioni da attivare',
    topics: [
      {
        id: 'benevoles', emoji: '🙋', title: 'Volontari', summary: 'Turni da coprire, ognuno si iscrive',
        body: <P>Il creatore del Plan e gli organizzatori del Cerchio creano i turni (orario, numero di persone). Iscriversi
          vale «Ci sono». Riepilogo «Mancano X persone», filtro «I miei turni», avviso se due turni si sovrappongono.
          Promemoria con notifica <strong>un’ora prima</strong> dell’inizio del turno.</P>,
      },
      {
        id: 'assemblee', emoji: '🏛️', title: 'Assemblea', summary: 'Ordine del giorno, deleghe, voti, verbale',
        body: <>
          <P>Per l’assemblea generale di un’associazione o un comitato. La data del Plan è quella dell’assemblea; il
            creatore del Plan e gli organizzatori del Cerchio la organizzano, con un segretario o una segretaria
            facoltativi.</P>
          <L items={[
            <><strong>Prima</strong>: ordine del giorno (informazione, votazione, elezione) con documenti, convocazione (app,
              notifica, email), <strong>deleghe</strong> a un altro membro.</>,
            <><strong>Impostazioni</strong>: membri con diritto di voto (togli la spunta ai membri passivi), quorum,
              registrazione con il <strong>codice della sala</strong>, assemblea <strong>ibrida</strong> (partecipazione a
              distanza).</>,
            <><strong>Durante</strong>: votano solo le persone registrate come presenti, una volta per sé e una volta per
              delega. Quorum in diretta, voti a <strong>scrutinio segreto</strong> o per alzata di mano, maggioranza
              semplice, assoluta o dei due terzi, elezioni, decisioni per acclamazione.</>,
            <><strong>Dopo</strong>: verbale PDF (presenti, deleghe, risultati, eletti), inviato al creatore del Plan alla
              chiusura. Ricordati di conservarlo: il Plan sarà eliminato alla data di fine.</>,
          ]} />
          <P>A scrutinio segreto nessuno può sapere chi ha votato cosa. Fanno fede gli statuti dell’associazione.</P>
        </>,
      },
      {
        id: 'cagnotte', emoji: '🐷', title: 'Colletta regalo', summary: 'Un regalo comune, idee e voti',
        body: <P>Per chi, obiettivo, importo proposto, come pagare. Ognuno indica la sua quota e poi «Ho pagato»;
          l’organizzatore spunta «Ricevuto». L’importo di ciascuno è visibile solo all’organizzatore. Idee regalo con voti.
          Nessun denaro passa da EvLY. Ricordati di nascondere il Plan alla persona festeggiata (Plan a sorpresa).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Babbo Natale segreto', summary: 'Sorteggio e regali anonimi',
        body: <P>La data del Plan è quella dello scambio dei regali. Ognuno scrive i suoi desideri (o «nessun desiderio
          particolare»), l’organizzatore lancia il sorteggio. Conosci solo la persona che vizi; due conversazioni anonime
          permettono di fare domande. Rivelazione dal giorno dello scambio.</P>,
      },
      {
        id: 'killer', emoji: '🎯', title: 'Killer', summary: 'Un bersaglio, un oggetto, un luogo',
        body: <P>Ogni giocatore riceve in segreto un bersaglio, un oggetto e un luogo: deve fargli tenere l’oggetto in quel
          posto senza destare sospetti. «Ho preso il mio bersaglio», il bersaglio conferma e tu erediti la sua missione.
          L’ultimo in gioco vince. Giocate nel rispetto di tutti e in sicurezza.</P>,
      },
      {
        id: 'mot-piege', emoji: '🗣️', title: 'La parola trappola', summary: 'Far dire una parola segreta',
        body: <P>Ognuno deve far dire una parola segreta al suo bersaglio senza farsi scoprire. Il bersaglio conferma, o
          smaschera chi lo intrappola. Modalità a punti (classifica in diretta, fine all’ora scelta) o eliminazione.</P>,
      },
      {
        id: 'equipes', emoji: '🏆', title: 'Squadre e torneo', summary: 'Sorteggio equilibrato, campionato o eliminazione',
        body: <P>Sorteggio delle squadre (da 2 a 8, equilibrate per livello se vuoi), poi campionato o eliminazione diretta.
          L’organizzatore inserisce i punteggi, la classifica si calcola da sola.</P>,
      },
    ],
  },
  {
    title: 'Restare informati',
    topics: [
      {
        id: 'notifications', emoji: '🔔', title: 'Notifiche e campanella', summary: 'App, telefono, email: scegli tu',
        body: <>
          <P>Menu ☰ → <strong>«Notifiche»</strong>: notifiche sul telefono, email o entrambe; riepilogo settimanale;
            riepilogo PDF prima dell’eliminazione dei tuoi Plan.</P>
          <P>La <strong>campanella</strong> 🔔 in fondo alla lista dei Cerchi raccoglie ciò che non hai ancora visto, gli
            inviti e le richieste di adesione. Promemoria automatici: il giorno prima di un Plan, prima della fine di un
            sondaggio date, un’ora prima di un turno di volontariato.</P>
        </>,
      },
      {
        id: 'silence', emoji: '🔕', title: 'Modalità silenziosa', summary: 'Silenziare un Plan o un intero Cerchio',
        body: <P>Tocca la campanella sulla scheda di un Plan (accanto alla tua risposta) o in cima alla lista dei Plan di un
          Cerchio: niente più notifiche né email per quel Plan o Cerchio. I pallini arancioni restano. Passano comunque: le
          menzioni, i promemoria dei turni, un posto liberato in lista d’attesa e l’apertura di una votazione in
          assemblea.</P>,
      },
    ],
  },
  {
    title: 'Regole e organizzazione',
    topics: [
      {
        id: 'roles', emoji: '👑', title: 'Ruoli e decisioni', summary: 'Creatore, organizzatori, voti a maggioranza',
        body: <L items={[
          <><strong>Creatore del Cerchio</strong>: gestisce il Cerchio e nomina gli <strong>organizzatori</strong> (lista dei membri).</>,
          <><strong>Organizzatori</strong>: gestiscono il Cerchio con lui (impostazioni, richieste, Plan riservati) ma non
            modificano i Plan degli altri e non eliminano il Cerchio.</>,
          <><strong>Creatore di un Plan</strong>: modifica il suo Plan e le sue impostazioni.</>,
          <>Per impostazione predefinita, ammettere un membro ed eliminare un Cerchio o un Plan si decide <strong>a maggioranza</strong>.</>,
        ]} />,
      },
      {
        id: 'parametres', emoji: '⚙️', title: 'Impostazioni avanzate', summary: 'Per associazioni, club, aziende',
        body: <L items={[
          <>Cerchio: ammissione (voto, organizzatori, libera), creazione dei Plan e dei sondaggi (tutti o organizzatori),
            eliminazione (voto o solo il creatore).</>,
          <>Plan: funzioni del Plan, chi modifica date e luogo, chi modifica le informazioni importanti, eliminazione.</>,
          <>Visibili a tutti (icona impostazioni); una cronologia conserva le modifiche del Cerchio.</>,
        ]} />,
      },
    ],
  },
  {
    title: 'Conservare i ricordi',
    topics: [
      {
        id: 'trace', emoji: '📸', title: 'Story, agenda, riepilogo', summary: 'Ricordi e documenti da conservare',
        body: <L items={[
          <><strong>Story</strong>: un’immagine ricordo (titolo, data, luogo, presenti) con la foto che preferisci.</>,
          <><strong>Agenda</strong>: aggiungi il Plan al tuo calendario (file .ics).</>,
          <><strong>Riepilogo</strong> (creatore del Plan e organizzatori): un PDF con info, partecipanti, volontari, spese e voti.</>,
          <><strong>Cronologia</strong> delle modifiche: menu del Plan.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Eliminazione automatica', summary: 'Un Plan sparisce alla sua data di fine',
        body: <P>Alla sua data di fine, un Plan è eliminato con tutto il suo contenuto: è voluto, EvLY resta leggero. Prima:
          scarica le foto, il riepilogo o il verbale. Il tempo restante appare nella scheda (⏳).</P>,
      },
    ],
  },
  {
    title: 'Il tuo account',
    topics: [
      {
        id: 'compte', emoji: '👤', title: 'Account, app e suggerimenti', summary: 'Profilo, applicazioni, proporre un’idea',
        body: <>
          <P>Menu ☰ in basso a sinistra: <strong>Il mio profilo</strong> (nome, cognome, email), password, notifiche,{' '}
            <strong>Proponi un miglioramento</strong> (e segui la risposta), eliminazione dell’account. Gli altri membri
            vedono il tuo nome e il tuo pseudonimo, mai il tuo cognome (tranne nel verbale di un’assemblea).</P>
          <P><strong>Lingua</strong>: EvLY esiste in francese, tedesco, italiano e inglese. Cambiala in{' '}
            <strong>Il mio profilo</strong>; email e notifiche seguono la tua lingua.</P>
          <P>EvLY esiste anche come <strong>app per iPhone e Android</strong>, con notifiche sul telefono. Tutto si aggiorna
            in diretta; una fascia propone di ricaricare quando è online una nuova versione.</P>
        </>,
      },
      {
        id: 'limites', emoji: '📏', title: 'Limiti da conoscere', summary: 'File, durata, Cerchi, pseudonimo',
        body: <L items={[
          'File: 10 MB per file, 100 MB per Plan.',
          'Un Plan dura al massimo 3 settimane.',
          'Al massimo 20 Cerchi creati per persona.',
          'Pseudonimo: lettere senza accenti, cifre e _ (da 2 a 24 caratteri), senza distinzione tra maiuscole e minuscole.',
        ]} />,
      },
    ],
  },
];

const summary: GuideText['summary'] = [
  { emoji: '👥', text: <>Un <strong>Cerchio</strong> per ogni gruppo, un <strong>Plan</strong> per ogni evento, una chat per Plan.</> },
  { emoji: '✋', text: <>Ognuno risponde <strong>ci sono / forse / assente</strong>; lista d’attesa se è completo.</> },
  { emoji: '🗳️', text: <>Si decide insieme: <strong>date</strong>, sondaggi, <strong>Match</strong>, ruota <strong>A chi tocca?</strong></> },
  { emoji: '🚗', text: <>Ci si organizza: <strong>passaggi</strong>, <strong>chi porta cosa</strong>, <strong>spese</strong>, <strong>volontari</strong>.</> },
  { emoji: '🏛️', text: <>Le associazioni tengono la loro <strong>assemblea</strong>: voti, deleghe, verbale.</> },
  { emoji: '🎉', text: <>Ci si diverte: <strong>colletta</strong>, <strong>Babbo Natale segreto</strong>, <strong>Killer</strong>, <strong>parola trappola</strong>, <strong>torneo</strong>.</> },
  { emoji: '⏳', text: <>Un Plan <strong>sparisce alla sua data di fine</strong>: conserva prima foto, riepilogo o verbale.</> },
];

const it: GuideText = {
  title: 'Guida all’uso',
  subtitle: 'Prima l’essenziale, poi ogni funzione nel dettaglio',
  briefTitle: 'EvLY in breve',
  tocTitle: 'Indice',
  close: 'Chiudi',
  summary,
  groups,
};
export default it;
