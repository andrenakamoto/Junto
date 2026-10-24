import { L, P, type Group, type GuideText } from './parts';

// Guida all'uso in italiano
const groups: Group[] = [
  {
    title: 'Le basi',
    topics: [
      {
        id: 'discussion', emoji: '💬', title: 'Discussione del Cerchio', summary: "Parlare tra un'uscita e l'altra, senza mescolare tutto",
        body: <>
          <P>Ogni Cerchio può avere la sua <strong>Discussione</strong>: la scheda «💬 Discussione» in cima all'elenco dei Plan. Lì si parla di
            tutto ciò che non è ancora un'uscita («Qualcuno è libero sabato?»). I messaggi <strong>scompaiono dopo 7 giorni</strong>:
            ciò che conta va in un Plan.</P>
          <P><strong>Fare un Plan</strong> sotto un messaggio apre «Crea un Plan» con quel messaggio come titolo. Reazioni, foto e menzioni
            @pseudo come nella chat di un Plan.</P>
          <P>Chi ha creato il Cerchio e gli organizzatori scelgono nelle impostazioni del Cerchio: <strong>Aperta</strong> (tutti scrivono),{' '}
            <strong>Annunci</strong> (scrivono solo loro, gli altri reagiscono) o <strong>Disattivata</strong>. Notifiche: un punto
            arancione e un push a ogni messaggio (in Notifiche puoi limitarle ai messaggi in cui sei menzionato/a).</P>
        </>,
      },
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
          <P>A seconda del Cerchio, una richiesta è accettata dagli <strong>organizzatori</strong> (per impostazione
            predefinita), con un voto a maggioranza dei membri o subito. In modalità voto nessuno può rifiutare da solo.</P>
          <P>La lista dei membri si apre toccando «N membri» sul Cerchio o il pulsante <strong>«Membri»</strong> in cima ai suoi Plan (le altre azioni del Cerchio sono nel menu ⋯): chi è online,
            ruoli, pulsante «Invita».</P>
        </>,
      },
      {
        id: 'contacts', emoji: '📇', title: 'I miei contatti', summary: 'Tutte le persone dei tuoi Cerchi, in un solo posto',
        body: <>
          <P>Il pulsante <strong>«Contatti»</strong> (accanto a «Tutti i miei plan» e «Calendario») riunisce tutte le persone con cui
            condividi un Cerchio, con i Cerchi in comune. Cerca per nome o pseudo; toccando un Cerchio lo apri.</P>
          <P>Toccando una persona si apre la sua <strong>scheda</strong>: Cerchi e Plan in arrivo in comune, <strong>«Fare un Plan»</strong>{' '}
            in un Cerchio in comune e <strong>«Invita»</strong> in uno dei tuoi altri Cerchi. La stessa scheda si apre toccando un avatar
            (membri, chat).</P>
          <P>In «Invita» di un Cerchio, <strong>«Tra i miei contatti»</strong> propone i membri dei tuoi altri Cerchi: selezionali e
            invitali tutti insieme. Vedi solo persone che vedi già nei tuoi Cerchi (nome e pseudo); le persone nascoste non
            compaiono.</P>
        </>,
      },
      {
        id: 'decouvrir', emoji: '🧭', title: 'Scopri', summary: 'Le uscite vicino a te, e andarci insieme',
        body: <>
          <P>Il pulsante <strong>«Scopri»</strong> (accanto a «Contatti») mostra gli eventi dei prossimi 14 giorni e delle
            <strong> idee per uscire</strong> (escape game, bowling, musei…) a <strong>Ginevra, Losanna e in Vallese</strong>.
            Scegli la tua regione, filtra per giorno o categoria, oppure cerca una parola («salsa», «concerto»…).</P>
          <P>Su un evento, <strong>«Andarci con un Cerchio»</strong> apre un Plan già compilato (titolo, data, luogo, link) nel
            Cerchio che preferisci; <strong>«Più info»</strong> apre il sito dell’organizzatore o dell’agenda da cui proviene l’annuncio.</P>
          <P>Gli annunci provengono da agende pubbliche (per esempio quella della Città di Ginevra) e dal team di EvLY.
            <strong> Possono contenere errori</strong>: verifica sempre sul sito dell’organizzatore e usa «Segnala un errore» se
            qualcosa non va. Scopri è visibile anche senza account, su evly.ch/sorties.</P>
          <P><strong>«Pubblica un evento pubblico»</strong> arriva presto per gli organizzatori: lascia i tuoi dati per essere avvisato. Gli account già autorizzati da EvLY pubblicano un Plan in <strong>modalità annuncio</strong> con <strong>«Pubblica in Scopri»</strong> (menu ⋮ o icona 🧭 del Plan): l'annuncio segue il Plan e ognuno può <strong>«Iscriversi»</strong> tramite il link d'invito.</P>
        </>,
      },
      {
        id: 'dispo', emoji: '🟢', title: '«Sono libero/a»', summary: 'Dire che si è liberi, e farne un Plan',
        body: <>
          <P>In un Cerchio, <strong>«Sono libero/a»</strong> (il pulsante verde, o «Crea» in basso): <strong>adesso</strong> (per 3 ore) o{' '}
            <strong>stasera</strong>, se vuoi con un'attività (🍻 Aperitivo, 🍕 Mangiare, 🎬 Cinema…) e una parola. Puoi dirlo in più
            Cerchi alla volta. I membri ricevono una notifica e la scheda del Cerchio mostra «🟢 3 liberi».</P>
          <P>Appena <strong>abbastanza persone sono libere</strong> (3 di default), <strong>«Lancia un Plan»</strong> propone un Plan
            pronto («Aperitivo stasera 🍻», ora proposta); poi le disponibilità si cancellano. Tutto sparisce anche da solo alla fine
            del momento scelto.</P>
          <P>Nella finestra, <strong>«Plan proposto da»</strong> riprende il numero del Cerchio; puoi cambiarlo per la tua disponibilità (per esempio «da 2» se ti basta un incontro a due).</P>
          <P>La funzione è <strong>disattivata per impostazione predefinita</strong>: chi ha creato il Cerchio e gli organizzatori la attivano o la disattivano e scelgono il numero di persone nelle
            impostazioni del Cerchio. Per non ricevere più notifiche: Notifiche → «Chi è libero nei miei Cerchi».</P>
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
            spunta le funzioni da attivare (turni, assemblea, colletta, giochi…). Modificabile in seguito con l’icona
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
          <P>In un Cerchio, <strong>«Crea» › «Proponi delle date»</strong>: ognuno spunta tutte le date che gli vanno bene, oppure
            «Non disponibile». Il sondaggio ha la sua chat. Quando emerge una data, <strong>«Crea il Plan»</strong> lo
            trasforma in Plan (la conversazione segue). Chi l’ha creato può <strong>aggiungere delle date</strong> strada
            facendo: chi ha già risposto viene avvisato.</P>
          <P>Termina il giorno dopo l’ultima data proposta, al massimo dopo 30 giorni; chi l’ha creato riceve un promemoria
            il giorno prima.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Plan ricorrenti', summary: 'Ogni settimana, ogni 2 settimane, ogni mese',
        body: <P>Alla creazione, scegli <strong>«Ripeti»</strong>: ogni settimana, ogni 2 settimane o ogni mese, con «Fino
          al» facoltativo. Appena la data è passata, viene creato il Plan successivo con le stesse info e impostazioni, e le
          risposte azzerate. Sondaggi, match e ruote vengono ripresi senza i voti: ognuno vota di nuovo. Menu del Plan: <strong>«Annulla questa volta»</strong> o <strong>«Interrompi la
          ripetizione»</strong>.</P>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Chi vede questo Plan (sorpresa, riservato)', summary: 'Nascondere un Plan ad alcune persone o riservarlo ad alcune',
        body: <P>In <strong>Altre opzioni › Partecipanti › Chi vede questo Plan?</strong>: <strong>«Nascondi a…»</strong> (per
          queste persone il Plan non esiste: né lista, né notifica, né email) oppure <strong>«Riservato a…»</strong> (solo le
          persone scelte lo vedono, per esempio il comitato di un’associazione; chi entra nel Cerchio più tardi non lo vede
          nemmeno). Per un compleanno, spunta <strong>«È una sorpresa»</strong>: gli altri vedono un avviso «Shh, non dire
          niente!». Lo stesso vale per i sondaggi di date.</P>,
      },
      {
        id: 'plusieurs-cercles', emoji: '🔗', title: 'Plan per più Cerchi', summary: 'Un solo Plan per più gruppi',
        body: <P>Se sei creatore o organizzatore di più Cerchi (una scuola, un club con più gruppi), spunta
          <strong> «Plan per più Cerchi»</strong> in «Partecipanti» alla creazione: il Plan appare in ogni Cerchio scelto, con una
          sola chat e un solo elenco di partecipanti. I Cerchi non si possono più cambiare dopo. Prima di unirsi, ognuno viene
          avvisato che persone di altri Cerchi vedranno il suo nome e il suo pseudonimo.</P>,
      },
      {
        id: 'annonce', emoji: '📣', title: 'Modalità annuncio', summary: 'Informare e sapere chi viene (spettacolo, corso…)',
        body: <P>Alla creazione, in <strong>Funzioni › Organizzare</strong>, spunta la <strong>«Modalità annuncio»</strong>: tutte le funzioni sono disattivate e l’elenco
          dei partecipanti è riservato al creatore e agli organizzatori. I partecipanti vedono le info, la locandina e i
          documenti e rispondono; vedono solo la propria risposta (e i posti rimasti se il Plan è limitato). Il creatore e gli
          organizzatori aggiungono la locandina (foto in grande in cima alle info) e i documenti.</P>,
      },
      {
        id: 'allerAvec', emoji: '🎟️', title: 'Andarci con un Cerchio', summary: 'Andare a un evento con gli amici',
        body: <>
          <P>In un Plan in Modalità annuncio (un gala, una serata…), il pulsante <strong>«Andarci con un Cerchio»</strong> crea un
            Plan in uno dei tuoi Cerchi, già compilato con titolo, date e luogo. I tuoi amici si organizzano lì: chi viene, chat,
            tragitti.</P>
          <P>Il Plan degli amici mostra una scheda <strong>«Evento»</strong> con il pulsante «Iscriviti all’evento»: ognuno si
            iscrive da sé, i posti dell’organizzatore sono rispettati. Rispondere nel Plan degli amici non iscrive all’evento.
            L’organizzatore può disattivarlo nelle Regole del Plan.</P>
        </>,
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
        id: 'en-bref', emoji: '✨', title: 'In breve', summary: 'Il riepilogo del Plan a colpo d’occhio',
        body: <>
          <P>Il pulsante <strong>In breve</strong> (sulla scheda del Plan e in cima alla pagina del Plan) riassume il Plan
            <strong>per te</strong>: data, luogo, chi viene, informazioni importanti, il tuo passaggio, cosa porti, quanto
            devi o ti devono, la tua colletta, i tuoi turni e cosa aspetta la tua risposta. Tocca una riga per
            aprire la sezione.</P>
          <P><strong>Copia il riepilogo</strong> copia un testo da inviare a qualcuno (data, luogo, chi viene, posti liberi,
            cosa manca) con un link per rispondere, anche senza account. Non contiene nulla di personale. Solo per chi ha
            risposto «Ci sono» o «Forse».</P>
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
          della data di fine. 10 MB per file, 100 MB per Plan. Descrizione (500 caratteri) e informazioni importanti (5000
          caratteri) si formattano con i pulsanti sopra il campo: <strong>grassetto</strong>, <em>corsivo</em>, <u>sottolineato</u>, elenchi puntati o numerati.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Voti: sondaggio, Match, A chi tocca?', summary: 'Tre modi per decidere insieme',
        body: <>
          <L items={[
            <><strong>Sondaggio</strong>: una domanda, una scelta. Anonimo o no; se non lo è, ognuno vede chi ha votato cosa.</>,
            <><strong>Match</strong> ❤️: ognuno dice sì o no a ogni proposta (carte da scorrere, foto facoltativa). Le
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
        id: 'transports', emoji: '🚌', title: 'Con i mezzi pubblici', summary: 'Orari, viaggiare insieme, ultimo ritorno',
        body: <P>Nella sezione Passaggi indica da dove parti e dove vai: un indirizzo, un luogo o una fermata
          (partenza da memorizzare se vuoi). Nessun altro vede il tuo indirizzo. EvLY mostra i collegamenti per arrivare in orario (bus, tram e treni di tutta la Svizzera) e
          l’<strong>ultimo ritorno</strong> della notte. <strong>«Propongo questo collegamento»</strong> invita gli altri a viaggiare con te;
          promemoria 30 minuti prima della partenza.</P>,
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
        id: 'benevoles', emoji: '🙋', title: 'Turni', summary: 'Turni da coprire, ognuno si iscrive',
        body: <P>Il creatore del Plan e gli organizzatori del Cerchio creano i turni (orario, numero di persone). Iscriversi
          vale «Ci sono». Riepilogo «Mancano X persone», filtro «I miei turni», avviso se due turni si sovrappongono.
          Promemoria con notifica <strong>un’ora prima</strong> dell’inizio del turno. Con <strong>0 persone</strong> la riga compare semplicemente nel programma (apertura
          delle porte, pranzo…), senza iscrizione. Sul posto, gli iscritti al turno (e gli organizzatori) possono
          <strong> commentarlo</strong> («manca una prolunga»): la persona che ha creato il turno viene avvisata. Lo
          segnano anche come <strong>«Compito terminato»</strong>, e anche in questo caso viene avvisata. L'icona 📅 di un turno lo <strong>aggiunge al tuo calendario</strong> (telefono o account calendario), con orario, luogo del Plan e link ai turni.</P>,
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
          Nessun denaro passa da EvLY. Ricordati di nascondere il Plan alla persona festeggiata («Nascondi a…», «È una sorpresa»).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Babbo Natale segreto', summary: 'Sorteggio e regali anonimi',
        body: <P>La data del Plan è quella dello scambio dei regali. Ognuno scrive i suoi desideri (o «nessun desiderio
          particolare»), l’organizzatore lancia il sorteggio. Conosci solo la persona che vizi; due conversazioni anonime
          permettono di fare domande. Rivelazione dal giorno dello scambio.</P>,
      },
      {
        id: 'quiz', emoji: '🧠', title: 'Quiz', summary: 'Domande in diretta, bonus velocità',
        body: <P>Una persona prepara domande a scelta multipla (da 2 a 4 risposte, foto facoltativa) e conduce senza giocare. Al via, ogni domanda appare nello stesso momento su tutti i telefoni: più rispondi in fretta, più punti guadagni (al massimo 1000). Quando tutti hanno risposto o il tempo è scaduto: risposta giusta e classifica. Chi conduce passa alla domanda successiva. Opzione <strong>schermo in sala</strong>: un link da aprire su una TV o un proiettore.</P>,
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
            sondaggio date, un’ora prima di un turno.</P>
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
          <>Per impostazione predefinita, gli <strong>organizzatori</strong> ammettono i nuovi membri e solo chi ha <strong>creato</strong> un Cerchio o un Plan può eliminarlo; si può scegliere invece un voto a maggioranza.</>,
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
          <><strong>Riepilogo</strong> (creatore del Plan e organizzatori): un PDF con info, partecipanti, lista d’attesa, turni, spese, voti, risultati dell’assemblea e dei giochi conclusi, colletta (non la chat).</>,
          <><strong>Cronologia</strong> delle modifiche: menu del Plan.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Eliminazione automatica', summary: 'Un Plan sparisce 24 ore dopo la fine',
        body: <P>Alla sua data di fine, un Plan diventa <strong>«Terminato»</strong>: resta visibile <strong>24 ore in sola lettura</strong>, poi è
          eliminato con tutto il suo contenuto (è voluto, EvLY resta leggero). In queste 24 ore: scarica le foto, il riepilogo o il verbale;
          chi aveva risposto «Ci sono» riceve un avviso 4 ore prima dell’eliminazione. L’evento dura di più? Sposta la data di fine in
          «Modifica». Il tempo restante appare nella scheda (⏳).</P>,
      },
    ],
  },
  {
    title: 'Il tuo account',
    topics: [
      {
        id: 'photos', emoji: '🖼️', title: 'Foto del profilo e del Cerchio', summary: 'Il tuo volto e quello del tuo gruppo',
        body: <>
          <P><strong>Foto del profilo</strong>: menu ☰ → <strong>Il mio profilo</strong> → «Aggiungi una foto». Trascinala per
            inquadrarla, zooma con due dita. Sostituisce le tue iniziali ovunque: chat, membri, voti… La vedono solo le persone con
            cui condividi un Cerchio o un Plan.</P>
          <P><strong>Foto del Cerchio</strong>: chi ha creato il Cerchio e gli organizzatori la aggiungono nelle impostazioni del
            Cerchio (⚙︎). Appare come banner in alto nella scheda del Cerchio e sopra l’elenco dei suoi Plan.</P>
          <P>Tocca l’avatar di qualcuno per vedere la sua foto in grande. Una foto inappropriata? <strong>Segnala la foto</strong>{' '}
            (nella sua scheda o nelle impostazioni del Cerchio): il team di EvLY la verifica e può rimuoverla. Le foto sono
            conservate in Svizzera, senza la posizione GPS.</P>
        </>,
      },
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
  { emoji: '🚗', text: <>Ci si organizza: <strong>passaggi</strong>, <strong>chi porta cosa</strong>, <strong>spese</strong>, <strong>turni</strong>.</> },
  { emoji: '🏛️', text: <>Le associazioni tengono la loro <strong>assemblea</strong>: voti, deleghe, verbale.</> },
  { emoji: '🎉', text: <>Ci si diverte: <strong>quiz</strong>, <strong>colletta</strong>, <strong>Babbo Natale segreto</strong>, <strong>Killer</strong>, <strong>parola trappola</strong>, <strong>torneo</strong>.</> },
  { emoji: '⏳', text: <>Un Plan <strong>sparisce 24 ore dopo la fine</strong> (nel frattempo in sola lettura): conserva foto, riepilogo o verbale.</> },
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
