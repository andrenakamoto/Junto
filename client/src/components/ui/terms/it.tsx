import { Mail, P, PrivacyLink, Rules, type TermsSection, type TermsText } from './parts';

// Condizioni d'uso in italiano (traduzione; fa fede la versione francese)
const sections: TermsSection[] = [
  {
    title: 'Presentazione del servizio',
    body: <>
      <P>EvLY («il Servizio») è un’applicazione per organizzare eventi, pubblicata da Ginevra («l’Editore»). Permette a
        gruppi — parenti, amici, famiglie, associazioni, club, squadre o aziende — di ritrovarsi in gruppi privati
        («Cerchi») e di organizzarsi intorno a eventi («Plan»): risposte dei partecipanti, sondaggi e voti,
        conversazione, car pooling, condivisione di file e di spese, turni di volontari, colletta, giochi, sorteggi e
        svolgimento di assemblee.</P>
      <P>Le presenti condizioni si applicano a ogni utilizzo del Servizio, sul sito evly.ch come nelle app per iPhone e
        Android, con o senza account. Utilizzare il Servizio equivale ad accettare queste condizioni.</P>
    </>,
  },
  {
    title: 'Requisiti',
    body: <P>L’uso di EvLY è riservato alle persone di almeno 16 anni. Creando un account, dichiari di avere l’età
      richiesta e la capacità giuridica di accettare le presenti condizioni. Un’organizzazione non deve creare un
      account né registrare una risposta per una persona di meno di 16 anni. L’Editore può chiedere una prova dell’età e
      sospendere qualsiasi account in caso di dubbio ragionevole.</P>,
  },
  {
    title: 'Iscrizione e account',
    body: <>
      <P>Per creare un account indichi uno <strong>pseudonimo</strong>, il tuo <strong>nome</strong>, un{' '}
        <strong>indirizzo email</strong> — che confermi tramite il link ricevuto — e una password; il cognome è
        facoltativo. Puoi anche iscriverti con un account Google. Le informazioni fornite devono essere esatte: il tuo
        pseudonimo e il tuo nome sono visibili ai membri dei Cerchi e dei Plan a cui ti unisci; il tuo cognome è visibile
        solo a te, tranne nel verbale di un’assemblea del tuo Cerchio (vedi «Assemblee e voti»).</P>
      <P>Sei l’unico/a responsabile della riservatezza delle tue credenziali e di tutte le azioni effettuate dal tuo
        account. In caso di sospetto accesso non autorizzato, cambia la password e scrivi senza indugio a <Mail />;
        l’Editore non risponde di un uso del tuo account avvenuto prima di tale segnalazione. L’Editore non verifica
        l’identità degli utenti.</P>
    </>,
  },
  {
    title: 'Cerchi, ruoli e ospiti',
    body: <>
      <P>La persona che crea un Cerchio (il «Creatore») ne stabilisce le regole: ammissione dei nuovi membri, creazione
        dei Plan e dei sondaggi, eliminazione del Cerchio. Può nominare degli <strong>organizzatori</strong>, che ne
        condividono la gestione. Quando il Creatore lascia il Cerchio o elimina il suo account, il Cerchio passa a un
        altro membro (o viene eliminato se era l’unico).</P>
      <P>Un membro può invitare una persona esterna a <strong>un solo Plan</strong> tramite un link: questa persona vede
        quel Plan, ma nient’altro del Cerchio. Un Plan o un sondaggio può anche essere nascosto ad alcuni membri («Plan a
        sorpresa»). Sei responsabile delle persone che inviti e della condivisione dei link d’invito.</P>
      <P>Una persona invitata può rispondere a un Plan <strong>senza creare un account</strong>, con il solo nome; lo
        stesso vale per chi organizza un’uscita senza account («Organizza un’uscita»). Queste persone accettano le
        presenti condizioni utilizzando il Servizio.</P>
    </>,
  },
  {
    title: 'Associazioni, club e aziende',
    body: <>
      <P>Quando un Cerchio è usato da un’organizzazione, la persona che lo crea dichiara di agire con il suo consenso.{' '}
        <strong>L’organizzazione è la sola responsabile dell’uso che fa del Servizio</strong> con i suoi membri,
        volontari, collaboratori o ospiti: contenuto dei suoi Plan, scelta delle impostazioni, decisioni prese,
        comunicazioni inviate e rispetto dei suoi statuti, regolamenti e della legge.</P>
      <P>Per i dati dei suoi membri che tratta tramite il Servizio (invitare persone, redigere una lista delle presenze o
        un verbale, conservare documenti), l’organizzazione stabilisce le finalità e risponde della loro liceità, in
        particolare secondo la legge federale sulla protezione dei dati (LPD): informazione dei membri, base legale,
        conservazione dei documenti che scarica.</P>
    </>,
  },
  {
    title: 'Regole di comportamento',
    body: <>
      <P>Utilizzando EvLY ti impegni a:</P>
      <Rules items={[
        'non pubblicare contenuti d’odio, discriminatori, violenti, pornografici, diffamatori, illegali o ingannevoli;',
        'rispettare la vita privata e i diritti altrui, in particolare condividendo foto o informazioni su una persona solo con il suo consenso;',
        'non usurpare l’identità di un’altra persona o di un’organizzazione;',
        'non usare il Servizio per sollecitazioni commerciali, pubblicità non richiesta, spam, giochi d’azzardo o attività fraudolente;',
        'non tentare di accedere a dati o funzioni a cui non hai diritto, né di disturbare il funzionamento del Servizio (reverse engineering, estrazione automatica, sovraccarico deliberato, aggiramento dei limiti).',
      ]} />
      <P>Per segnalare un messaggio, usa il pulsante <strong>«Segnala»</strong> sotto quel messaggio; per qualsiasi altro
        contenuto o comportamento, scrivi a <Mail />. Puoi anche <strong>nascondere</strong> una persona: non vedi più i
        suoi messaggi e non ricevi più le sue notifiche.</P>
    </>,
  },
  {
    title: 'Ruolo dell’Editore e contenuti degli utenti',
    body: <>
      <P>L’Editore fornisce uno strumento tecnico e <strong>ospita i contenuti pubblicati dagli utenti</strong>{' '}
        (messaggi, Plan, foto, file, voti…) senza crearli, sceglierli né controllarli in anticipo. Non ha alcun obbligo
        generale di sorvegliare questi contenuti né di ricercare attività illecite.</P>
      <P>Resti proprietario/a dei contenuti che pubblichi, ma concedi all’Editore una licenza non esclusiva, gratuita e
        mondiale per ospitarli, mostrarli e trasmetterli nella misura necessaria al funzionamento del Servizio. Sei
        l’unico/a responsabile di questi contenuti e garantisci di detenere i diritti necessari per condividerli.</P>
      <P>L’Editore può, senza esservi obbligato e senza preavviso, rimuovere qualsiasi contenuto, eliminare qualsiasi
        Plan o Cerchio o limitare qualsiasi account che ritenga contrario alle presenti condizioni o alla legge, oppure
        su richiesta di un’autorità.</P>
    </>,
  },
  {
    title: 'Eventi organizzati tramite il Servizio',
    body: <>
      <P>EvLY è uno strumento di coordinamento: facilita l’organizzazione di incontri ed eventi reali, ma{' '}
        <strong>l’Editore non è né organizzatore, né parte, né garante di alcun Plan</strong>. Non verifica né le
        persone, né i luoghi, né le attività proposte. Unirsi a un Plan significa accettarne la descrizione, sotto la
        propria responsabilità.</P>
      <P><strong>Ognuno partecipa agli eventi a proprio rischio.</strong> L’Editore declina ogni responsabilità per lo
        svolgimento degli eventi organizzati tramite EvLY, compresi — senza limitarsi a — incidenti, lesioni, danni
        materiali, consumo di alcol, attività sportive o fisiche, comportamenti di un partecipante verso un altro,
        annullamenti, rinunce o controversie tra partecipanti. Queste situazioni riguardano esclusivamente i partecipanti
        interessati o l’organizzazione che ha allestito l’evento.</P>
    </>,
  },
  {
    title: 'Car pooling',
    body: <P>La funzione di car pooling permette soltanto ai partecipanti di un Plan di mettersi in contatto.{' '}
      <strong>L’Editore non è un vettore</strong> e non interviene nei viaggi: ogni conducente resta l’unico
      responsabile del suo veicolo, della sua patente, della sua assicurazione, del rispetto delle norme della
      circolazione e delle condizioni concordate con i passeggeri, che viaggiano a proprio rischio.</P>,
  },
  {
    title: 'Spese condivise e colletta',
    body: <P>La condivisione delle spese e la colletta permettono di tenere un registro indicativo di chi ha pagato
      cosa, in franchi svizzeri o in euro, con conti separati per ogni valuta, senza conversione.{' '}
      <strong>EvLY non tratta, non detiene né trasferisce alcun fondo</strong>: i calcoli mostrati sono puramente
      informativi e i pagamenti avvengono al di fuori del Servizio, sotto la sola responsabilità delle persone
      interessate. L’Editore non risponde di errori di inserimento o di calcolo, disaccordi o mancati pagamenti.</P>,
  },
  {
    title: 'Assemblee e voti',
    body: <>
      <P>La funzione «Assemblea» aiuta un’organizzazione a preparare e tenere un’assemblea: ordine del giorno,
        convocazione, presenze, deleghe, voti, elezioni e verbale. <strong>Non sostituisce né gli statuti
        dell’organizzazione, né la legge</strong> (in particolare gli articoli 60 e seguenti del Codice civile
        svizzero). Spetta all’organizzazione e alle persone che organizzano l’assemblea impostare il Servizio
        conformemente ai loro statuti — forma e termine della convocazione, diritto di voto, deleghe, quorum,
        maggioranze — e vigilare sulla validità delle decisioni.</P>
      <P>Una convocazione inviata da EvLY (notifica, email) <strong>non garantisce il rispetto della forma prevista dagli
        statuti</strong> (per esempio un invio postale) né la sua ricezione da parte di ogni membro.</P>
      <P>Il voto a scrutinio segreto registra separatamente il fatto di aver votato e la scheda, senza legame tra i due.
        Si tratta di uno strumento pratico, <strong>non di un sistema di voto elettronico certificato</strong>. Il
        verbale è generato automaticamente: deve essere riletto, completato se necessario, firmato e conservato
        dall’organizzazione; riporta il nome e il cognome delle persone presenti, rappresentate e candidate.{' '}
        <strong>L’Editore non risponde né della validità delle convocazioni, dei voti, delle elezioni e delle decisioni,
        né delle controversie che ne derivassero.</strong></P>
    </>,
  },
  {
    title: 'Giochi e sorteggi',
    body: <>
      <P>I giochi proposti (Killer, parola trappola, Babbo Natale segreto, torneo…) si svolgono nella vita reale,{' '}
        <strong>sotto la sola responsabilità dei partecipanti</strong>, che si impegnano a:</P>
      <Rules items={[
        'giocare nel rispetto di ciascuno, della sua vita privata e del suo consenso;',
        'non mettere mai in pericolo nessuno, né usare oggetti pericolosi;',
        'rispettare la legge, i luoghi privati, il lavoro altrui e la sicurezza stradale (mai mentre si guida);',
        'non farne un gioco d’azzardo né di scommessa.',
      ]} />
      <P>I sorteggi (ruota «A chi tocca?», sorteggio delle squadre o del Babbo Natale segreto) sono effettuati in modo
        casuale dal Servizio. Il loro risultato impegna solo i partecipanti che hanno scelto di ricorrervi; l’Editore non
        risponde delle loro conseguenze.</P>
    </>,
  },
  {
    title: 'Notifiche, email e promemoria',
    body: <P>Notifiche, email, promemoria e convocazioni sono inviati senza garanzia di tempi né di ricezione: possono
      essere ritardati, filtrati come indesiderati, bloccati dalle impostazioni del telefono o della posta, oppure non
      partire in caso di guasto. <strong>Non affidarti solo a loro per una scadenza importante.</strong> L’Editore non
      risponde delle conseguenze di una notifica non ricevuta, ricevuta in ritardo o inviata per errore.</P>,
  },
  {
    title: 'Conservazione e perdita di dati',
    body: <P>EvLY non è uno strumento di archiviazione. I Plan sono <strong>eliminati automaticamente e definitivamente
      alla loro data di fine</strong>, con la loro conversazione, le foto, i file, i voti e le spese; i sondaggi sulle
      date lo sono alla loro scadenza (al massimo 30 giorni). Spetta a te scaricare in tempo ciò che desideri conservare
      (foto, riepilogo, verbale, documenti). L’Editore non garantisce il salvataggio dei dati e{' '}
      <strong>non risponde della loro perdita</strong>, che derivi da questa eliminazione automatica, da un’azione di
      un utente o da un guasto tecnico.</P>,
  },
  {
    title: 'Dati personali',
    body: <>
      <P>EvLY tratta i dati necessari al funzionamento del Servizio: quelli del tuo account (pseudonimo, nome, cognome
        facoltativo, email, password cifrata o account Google), ciò che pubblichi e alcuni dati tecnici. Non sono né
        venduti né usati a fini pubblicitari; i messaggi sono cifrati nella banca dati. Alcuni fornitori tecnici
        (hosting, invio di email, archiviazione di file, notifiche) vi hanno accesso nella stretta misura necessaria
        alla loro prestazione.</P>
      <P>I dettagli di questi trattamenti, i tuoi diritti e le durate di conservazione figurano nell’{' '}
        <PrivacyLink>informativa sulla privacy</PrivacyLink>, che fa fede. Puoi eliminare il tuo account e i tuoi dati
        in qualsiasi momento dal menu («Elimina il mio account»). I Cerchi e i Plan che hai creato passano allora ad
        altri membri, e i contenuti condivisi restano nei Plan fino alla loro eliminazione. Alcuni dati possono essere
        conservati oltre in caso di obbligo legale o di interesse legittimo (es. lotta contro le frodi).</P>
    </>,
  },
  {
    title: 'Servizi di terzi',
    body: <P>Il Servizio si appoggia a servizi di terzi (hosting, archiviazione di file, invio di email, notifiche,
      accesso con Google, negozi di app di Apple e Google). Il loro uso è soggetto alle loro condizioni. L’Editore non
      risponde della loro indisponibilità, dei loro errori né delle loro decisioni.</P>,
  },
  {
    title: 'Disponibilità ed evoluzione del Servizio',
    body: <>
      <P>L’Editore si impegna ad assicurare la disponibilità del Servizio ma non garantisce alcuna continuità,
        esattezza o assenza di errori. Il Servizio può essere modificato, sospeso, limitato o interrotto definitivamente
        in qualsiasi momento, in tutto o in parte, con o senza preavviso, senza che ciò comporti la responsabilità
        dell’Editore.</P>
      <P><strong>EvLY non è concepito per un uso critico</strong>: non usarlo per un’emergenza, la sicurezza delle
        persone, un bisogno medico, né come unico mezzo per adempiere una formalità legale o contrattuale.</P>
    </>,
  },
  {
    title: 'Proprietà intellettuale e suggerimenti',
    body: <P>Il Servizio, il suo nome, il suo logo, i suoi testi, il suo codice e il suo aspetto appartengono
      all’Editore; ogni riproduzione o riutilizzo senza autorizzazione è vietato. Le idee e i suggerimenti che invii
      («Proponi un miglioramento») possono essere usati liberamente dall’Editore, senza contropartita.</P>,
  },
  {
    title: 'Evoluzione delle tariffe',
    body: <P>EvLY è attualmente offerto gratuitamente. <strong>L’Editore si riserva il diritto di introdurre, in futuro,
      funzioni a pagamento, abbonamenti o qualsiasi altro modello tariffario</strong>, per tutto o parte del Servizio,
      in particolare per associazioni e aziende. Gli utenti esistenti saranno informati con un preavviso ragionevole
      prima dell’entrata in vigore di qualsiasi tariffa che riguardi funzioni che già utilizzano. L’attuale gratuità non
      costituisce un impegno definitivo.</P>,
  },
  {
    title: 'Limitazione di responsabilità',
    body: <>
      <P>EvLY è fornito «così com’è» e «secondo disponibilità», gratuitamente, senza garanzia di alcun tipo, esplicita o
        implicita, in particolare di idoneità a un uso particolare.</P>
      <P><strong>Nella misura massima consentita dalla legge, è esclusa ogni responsabilità dell’Editore</strong>, in
        particolare per danni indiretti o consequenziali, mancato guadagno, perdita di dati, contenuti pubblicati da
        utenti o terzi, eventi organizzati tramite il Servizio e decisioni prese con l’aiuto del Servizio. Resta
        riservata la responsabilità per un danno causato intenzionalmente o per negligenza grave, nonché ogni altra
        responsabilità che non può essere esclusa in virtù di una norma legale imperativa (art. 100 del Codice delle
        obbligazioni). La responsabilità per gli ausiliari e i fornitori dell’Editore è esclusa nella stessa misura.</P>
      <P>Nella misura in cui fosse comunque accertata una responsabilità dell’Editore, essa è limitata all’importo
        effettivamente pagato dall’utente per l’accesso al Servizio negli ultimi dodici mesi.</P>
    </>,
  },
  {
    title: 'Manleva',
    body: <P>Accetti di tenere indenne e manlevare l’Editore da qualsiasi pretesa, perdita, responsabilità o spesa
      (comprese ragionevoli spese di difesa) derivante dal tuo uso del Servizio, dai contenuti che pubblichi, dagli
      eventi, giochi o assemblee che organizzi, o dalla tua violazione delle presenti condizioni o della legge.
      Un’organizzazione che usa il Servizio assume lo stesso impegno per l’uso che ne fanno i suoi membri e
      organizzatori.</P>,
  },
  {
    title: 'Forza maggiore',
    body: <P>L’Editore non risponde di un inadempimento dovuto a un evento al di fuori del suo ragionevole controllo:
      guasto di un fornitore o di una rete, attacco informatico, catastrofe, decisione di un’autorità, sciopero,
      epidemia o evento analogo.</P>,
  },
  {
    title: 'Sospensione e risoluzione',
    body: <P>L’Editore può sospendere o eliminare un account, un Cerchio o un Plan, a sua esclusiva discrezione e senza
      preavviso, in caso di violazione delle presenti condizioni, di comportamento dannoso per il Servizio o per i suoi
      membri, o per qualsiasi altro motivo legittimo. Puoi in qualsiasi momento smettere di usare il Servizio ed
      eliminare il tuo account.</P>,
  },
  {
    title: 'Diritto applicabile e foro',
    body: <P>Le presenti condizioni sono rette dal diritto svizzero. Ogni controversia relativa alla loro interpretazione
      o esecuzione è di competenza esclusiva dei tribunali di Ginevra, fatte salve le disposizioni legali imperative
      applicabili ai consumatori.</P>,
  },
  {
    title: 'Disposizioni finali',
    body: <P>Se una clausola delle presenti condizioni fosse giudicata invalida o inapplicabile, sarebbe sostituita da
      una clausola valida il più possibile vicina al suo scopo, e le altre clausole resterebbero pienamente in vigore. Il
      fatto che l’Editore non si avvalga di una clausola non vale come rinuncia. Le presenti condizioni e l’informativa
      sulla privacy costituiscono l’intero accordo tra te e l’Editore; <strong>fa fede la versione francese</strong>,
      questa traduzione è fornita a titolo informativo.</P>,
  },
  {
    title: 'Modifica delle condizioni',
    body: <P>Queste condizioni possono essere aggiornate. In caso di modifica sostanziale, ti sarà chiesto di rileggerle e
      di accettarle alla prossima apertura dell’app. Continuare a usare il Servizio dopo aver accettato la nuova versione
      vale come consenso. Per qualsiasi domanda: <Mail />.</P>,
  },
];

const it: TermsText = {
  title: 'Condizioni d’uso',
  version: 'Versione 4 — 9 ottobre 2026',
  news: 'Novità: assemblee, giochi, colletta, notifiche e responsabilità.',
  translationNote: 'Traduzione a titolo informativo: fa fede la versione francese.',
  sections,
  confirm: 'Cliccando su «Accetto le condizioni», confermi di aver letto e accettato integralmente le presenti condizioni d’uso.',
  scroll: 'Scorri per leggere le condizioni prima di accettare.',
  accept: 'Accetto le condizioni',
  accepting: 'Salvataggio…',
  close: 'Chiudi',
};
export default it;
