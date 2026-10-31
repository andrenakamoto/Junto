import type { AssemblyHelpText } from './types';

const it: AssemblyHelpText = {
  title: 'Gestire un’assemblea',
  intro: 'Tutte le tappe, dalla preparazione al verbale. Tocca una tappa per aprirla.',
  forOrganizers: 'Per l’organizzazione',
  forMembers: 'Per i membri',
  steps: [
    {
      id: 'reglages', emoji: '⚙️', title: '1. Impostare l’assemblea',
      body: <>
        <p>La <b>data del Plan</b> è quella dell’assemblea. Chi ha creato il Plan e chi organizza il Cerchio la gestiscono;
          vedono il pulsante <b>Impostazioni</b>:</p>
        <ul>
          <li><b>Membri con diritto di voto</b>: votano tutti i membri del Cerchio; togli la spunta ai membri passivi o senza diritto di voto.</li>
          <li><b>Quorum</b>: nessuno, un numero di voti o una percentuale degli aventi diritto. Si calcola in diretta durante la seduta.</li>
          <li><b>Deleghe</b>: permesse o no, e quante ne può portare una stessa persona.</li>
          <li><b>Assemblea ibrida</b>: i membri possono anche partecipare e votare a distanza.</li>
          <li><b>Termine di convocazione</b>: EvLY ti avvisa se la convocazione parte troppo tardi.</li>
          <li><b>Segretario/a</b> (facoltativo): scrive le note del verbale e può scaricarlo.</li>
        </ul>
      </>,
    },
    {
      id: 'points', emoji: '📝', title: '2. Preparare l’ordine del giorno',
      body: <>
        <p><b>Aggiungi un punto</b>, poi scegli il tipo:</p>
        <ul>
          <li><b>Informazione</b>: rapporto, presentazione, varie. Nessun voto.</li>
          <li><b>Voto</b>: a <b>scrutinio segreto</b> (nessuno sa chi ha votato cosa) o per <b>alzata di mano</b> (i nomi figurano
            nel verbale). Maggioranza <b>semplice</b> (più sì che no), <b>assoluta</b> (più della metà dei voti, astensioni
            comprese) o dei <b>due terzi</b>.</li>
          <li><b>Elezione</b>: numero di seggi, poi i <b>candidati</b> (da aggiungere nella scheda del punto, prima di aprire il voto).</li>
        </ul>
        <p>La descrizione si può formattare (grassetto, elenchi); allega i documenti (conti, rapporto in PDF). Le frecce ↑ ↓
          cambiano l’ordine. Il tipo di un punto non cambia più una volta aperto il suo voto.</p>
      </>,
    },
    {
      id: 'convoquer', emoji: '📣', title: '3. Inviare la convocazione',
      body: <>
        <p><b>Invia la convocazione</b> la manda a <b>tutti i membri del Cerchio</b>: notifica nell’app ed email con data,
          luogo e ordine del giorno, qualunque sia la loro impostazione delle notifiche. Ne ricevi una copia.</p>
        <p>Puoi rinviarla se l’ordine del giorno cambia (al massimo una volta ogni 10 minuti). La convocazione EvLY non
          sostituisce la forma prevista dal vostro statuto.</p>
      </>,
    },
    {
      id: 'procurations', emoji: '🤝', title: '4. Le deleghe',
      body: <>
        <p>Prima dell’apertura, un membro che non può venire dà la sua delega a un altro membro con diritto di voto, in «La mia
          partecipazione». Quest’ultimo voterà due volte: per sé e per la persona rappresentata.</p>
        <ul>
          <li>Una delega vale solo se chi la porta è <b>registrato/a come presente</b>.</li>
          <li>Se chi l’ha data alla fine viene e si registra, la delega <b>decade</b>: vota di persona.</li>
          <li>L’organizzazione vede tutte le deleghe in «Presenze e deleghe» e può rifiutarne una.</li>
          <li>Una volta aperta l’assemblea, le deleghe non si danno né si ritirano più.</li>
        </ul>
      </>,
    },
    {
      id: 'ouvrir', emoji: '🔔', title: '5. Aprire l’assemblea',
      body: <>
        <p>Il giorno stesso: <b>Apri l’assemblea</b>. I membri ricevono «L’assemblea è aperta: segnala la tua presenza».</p>
        <p>Sotto il quorum appare un <b>codice della sala</b> di 4 cifre. <b>Mostra il codice in grande</b> lo proietta con un
          <b> codice QR</b> e il numero di presenti, aggiornato in diretta.</p>
      </>,
    },
    {
      id: 'presences', emoji: '📍', title: '6. Registrare le presenze',
      body: <>
        <p>Votano solo le persone <b>registrate come presenti</b>. Due modi, utilizzabili insieme:</p>
        <ul>
          <li><b>Con il telefono</b>: ognuno digita il codice della sala nella scheda «Segnala la tua presenza», o scansiona il
            codice QR proiettato (l’app si apre e lo/la registra da sola).</li>
          <li><b>Senza telefono</b>: l’organizzazione spunta la persona in «Presenze e deleghe». Chi non è ancora registrato è in
            cima; da 10 membri compare una ricerca.</li>
          <li><b>A distanza</b> (assemblea ibrida): la persona tocca «Partecipo a distanza».</li>
        </ul>
        <p>Il quorum (presenti + deleghe valide) si aggiorna a ogni registrazione.</p>
      </>,
    },
    {
      id: 'seance', emoji: '🖥️', title: '7. Svolgere l’ordine del giorno',
      body: <>
        <p>L’icona <b>⤢</b> di un punto lo mostra <b>da solo, in grande</b>: ideale da proiettare, nessuno è distratto dai punti
          successivi. «Precedente» / «Punto successivo» (o le frecce della tastiera) passano da un punto all’altro. Ognuno può
          usarlo anche sul proprio telefono.</p>
        <p><b>Note per il verbale</b>: l’organizzazione o il/la segretario/a riassumono, punto per punto, ciò che è stato detto
          e deciso (formattazione possibile). Figurano nel verbale.</p>
      </>,
    },
    {
      id: 'voter', emoji: '🗳️', title: '8. Far votare',
      body: <>
        <ul>
          <li><b>Apri la votazione</b> sul punto: una sola votazione alla volta. Gli aventi diritto ricevono una notifica (anche in
            modalità silenziosa) e in cima alla scheda appare «Votazione in corso — Vai alla votazione».</li>
          <li>Ognuno vota nella scheda del punto, <b>una volta per sé e una volta per ogni delega</b>. Il contatore «x / y hanno
            votato» avanza in diretta.</li>
          <li><b>Chiudi la votazione</b> mostra il risultato (approvato / respinto, o gli eletti). <b>Annulla</b> cancella i voti e
            rimette il punto da votare, in caso di errore.</li>
          <li><b>Senza votazione</b>: «Approvato per acclamazione», «Respinto senza votazione» o «Elezione tacita» (tanti candidati
            quanti seggi) registrano la decisione senza voto.</li>
          <li><b>Parità</b> in un’elezione: l’organizzazione designa chi è eletto tra i pari merito.</li>
        </ul>
      </>,
    },
    {
      id: 'sans-telephone', emoji: '📵', title: '9. Votare senza telefono',
      body: <>
        <p>Una persona presente senza telefono (o senza batteria) può votare comunque, in due modi:</p>
        <ul>
          <li><b>Sul dispositivo dell’organizzazione</b>: durante la votazione, in «Senza telefono», scegli la persona poi «Far
            votare qualcuno su questo dispositivo». Lo schermo mostra solo la sua scheda; vota di persona (per sé e per le sue
            deleghe), vede «Voto registrato» e ti restituisce il dispositivo. <b>La scheda resta segreta</b>: distogli lo sguardo.
            Un tablet in sala può fare da cabina elettorale.</li>
          <li><b>Su carta</b>: nella lista delle presenze, tocca <b>📄 Carta</b> accanto al suo nome <b>prima di aprire la
            votazione</b> (il pulsante è bloccato durante un voto, perché un voto non conti mai due volte). I suoi voti non si
            esprimono più nell’app. Durante la votazione, inserisci il conteggio in «Schede cartacee» (sì / no / astensione, o
            schede e voti per candidato) <b>prima di chiudere</b>. Il risultato e il verbale indicano «di cui N su carta».</li>
        </ul>
        <p>Con molti membri senza smartphone, la carta è più rapida; per una o due persone basta il dispositivo dell’organizzazione.</p>
      </>,
    },
    {
      id: 'clore', emoji: '✅', title: '10. Chiudere l’assemblea e il verbale',
      body: <>
        <ul>
          <li>Chiudi prima la votazione in corso, poi <b>Chiudi l’assemblea</b>. I presenti vengono avvisati.</li>
          <li>Il <b>verbale</b> (PDF) riporta i presenti (nome e cognome), le deleghe, il quorum, ogni punto con le note, i risultati
            e gli eletti, con le righe per le firme. Prima della chiusura è una <b>bozza</b>.</li>
          <li>Alla chiusura, il verbale viene inviato per email a chi ha creato il Plan. <b>Riapri</b> resta possibile in caso di
            dimenticanza.</li>
          <li>Conserva il verbale: il Plan viene eliminato <b>24 ore dopo la sua data di fine</b>. Fallo rileggere e firmare; fa
            fede lo statuto dell’associazione.</li>
        </ul>
      </>,
    },
  ],
  members: {
    id: 'membres', emoji: '🙋', title: 'Cosa fanno i membri',
    body: <>
      <ul>
        <li><b>Prima</b>: leggere l’ordine del giorno e i documenti, dare la delega se non possono venire.</li>
        <li><b>In sala</b>: registrarsi con il codice della sala o il codice QR, poi votare nella scheda del punto quando si apre
          la votazione («Vai alla votazione» ci porta).</li>
        <li><b>Senza telefono</b>: farsi riconoscere dall’organizzazione, che li registra e li fa votare sul suo dispositivo o su carta.</li>
      </ul>
    </>,
  },
};

export default it;
