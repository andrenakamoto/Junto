import { ProcessorTable, Section, type Processor, type PrivacyText } from './parts';

// Informativa sulla privacy in italiano (traduzione; fa fede la versione francese)
const processors: Processor[] = [
  { name: 'Railway', role: 'hosting del server e della banca dati (account, messaggi, Plan)', where: 'Stati Uniti (California)', safeguard: 'clausole contrattuali tipo adattate al diritto svizzero (contratto di trattamento dei dati)' },
  { name: 'Vercel', role: 'hosting del sito evly.ch', where: 'Stati Uniti', safeguard: 'certificato Swiss-U.S. Data Privacy Framework' },
  { name: 'Cloudinary', role: 'archiviazione di foto, messaggi vocali e file condivisi nei Plan', where: 'Stati Uniti', safeguard: 'certificato Swiss-U.S. Data Privacy Framework' },
  { name: 'Resend', role: 'invio delle email (conferma, promemoria, notifiche)', where: 'Stati Uniti', safeguard: 'clausole contrattuali tipo adattate al diritto svizzero (contratto di trattamento dei dati)' },
  { name: 'Google', role: 'accesso con un account Google (se lo scegli), caratteri del sito e consegna delle notifiche delle app (Firebase Cloud Messaging)', where: 'Stati Uniti', safeguard: 'certificato Swiss-U.S. Data Privacy Framework' },
  { name: 'Apple', role: 'consegna delle notifiche dell’app iPhone (Apple Push Notification service)', where: 'Stati Uniti', safeguard: 'certificato Swiss-U.S. Data Privacy Framework' },
];

const it: PrivacyText = {
  title: 'Informativa sulla privacy',
  version: 'Versione del 10 ottobre 2026',
  translationNote: 'Traduzione a titolo informativo: fa fede la versione francese.',
  body: <>
    <p className="mt-3">
      Questa pagina spiega quali dati tratta EvLY, perché, con chi sono condivisi e quali sono i tuoi diritti,
      conformemente alla legge federale svizzera sulla protezione dei dati (LPD).
    </p>

    <Section title="1. Chi è responsabile dei tuoi dati">
      <p>EvLY, Ginevra (Svizzera). Per qualsiasi domanda o richiesta sui tuoi dati: <strong>info@evly.ch</strong>.</p>
    </Section>

    <Section title="2. I dati trattati">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Il tuo account</strong>: pseudonimo, nome, cognome (facoltativo), indirizzo email, lingua scelta per
          l’app, password (conservata solo in forma cifrata, mai leggibile), il tuo identificativo Google se accedi con
          Google e, durante un cambio d’indirizzo, il nuovo indirizzo in attesa di conferma (al massimo 24 ore).</li>
        <li><strong>Risposta a un invito senza account</strong>: il tuo nome e la tua risposta (vengo / forse / passo),
          oltre a un identificativo conservato nel tuo browser per ritrovare la tua risposta. Cancellati alla fine del
          Plan, o subito con «Ritira la mia risposta». Se poi crei un account o accedi, la tua risposta vi viene
          collegata.</li>
        <li><strong>Uscita organizzata senza account</strong> («Organizza un’uscita»): il tuo nome, la tua uscita (titolo,
          data, luogo) e un identificativo conservato nel browser per seguire le risposte. Cancellati con l’uscita, il
          giorno dopo la sua data. Se poi crei un account o accedi, le tue uscite vi vengono collegate.</li>
        <li><strong>Inviti in un Cerchio</strong>: se un membro ti invita con il tuo pseudonimo o la tua email, l’invito
          (chi ti invita, in quale Cerchio) è conservato finché non lo accetti o lo rifiuti.</li>
        <li><strong>Segnalazioni e persone nascoste</strong>: se segnali un messaggio, una copia cifrata del messaggio, il
          tuo eventuale motivo e il tuo pseudonimo sono trasmessi all’amministratore di EvLY; la copia è cancellata appena
          la segnalazione è trattata. La persona segnalata non sa chi l’ha segnalata. La lista delle persone che nascondi
          è visibile solo a te.</li>
        <li><strong>Suggerimenti</strong> («Proponi un miglioramento»): il tuo messaggio, il suo tipo (idea, problema,
          altro), il dispositivo e la versione dell’app usati e l’eventuale risposta del team. Letti solo
          dall’amministratore di EvLY, che li riceve anche per email; eliminati con il tuo account.</li>
        <li><strong>Ciò che pubblichi</strong>: messaggi e reazioni, risposte ai Plan (sì / forse / no), voti, informazioni
          dei Plan, foto, messaggi vocali e file, passaggi in car pooling, partecipazioni ai giochi (Babbo Natale segreto,
          Killer, parola trappola, squadre e punteggi) e a una colletta (importo, pagamento segnalato), spese e
          rimborsi.</li>
        <li><strong>Assemblee</strong> (funzione da attivare in un Plan): la tua presenza (sul posto o a distanza), la
          delega che dai o ricevi e i tuoi voti. A <strong>scrutinio segreto</strong>, EvLY registra separatamente che hai
          votato e la scheda stessa, senza legame tra i due: nessuno, né l’organizzatore né l’amministratore di EvLY, può
          risalire a come hai votato. Per alzata di mano, il tuo voto figura nei risultati e nel verbale. Il{' '}
          <strong>verbale</strong> (PDF) indica <strong>nome e cognome</strong> dei presenti, delle persone rappresentate e
          dei candidati; è scaricato dall’organizzatore o dal segretario o dalla segretaria e inviato per email al
          creatore del Plan alla chiusura dell’assemblea.</li>
        <li><strong>Dati tecnici</strong>: il tuo stato online nei tuoi Cerchi, la tua sessione di accesso (conservata nel
          browser), la data del tuo ultimo utilizzo di EvLY (all’ora, per contare i membri attivi), la data in cui hai
          consultato ogni scheda di un Plan (per segnalare le novità, cancellata con il Plan) e l’indirizzo IP registrato
          nei log del server per la sicurezza.</li>
        <li><strong>Notifiche delle app Android e iPhone</strong>: se le autorizzi, l’identificativo di notifica del tuo
          telefono, cancellato quando esci. Una notifica indica solo chi ha scritto e in quale Plan, Cerchio o sondaggio —
          mai il contenuto di un messaggio. Puoi disattivarle in qualsiasi momento nelle impostazioni del telefono.</li>
      </ul>
      <p>Non raccogliamo né data di nascita, né posizione, né rubrica.</p>
    </Section>

    <Section title="3. Perché li usiamo">
      <p>
        Unicamente per far funzionare EvLY: permetterti di organizzare eventi con i tuoi Cerchi, inviarti le email utili
        (conferma dell’account, nuovi Plan, promemoria, menzioni, riepilogo settimanale disattivabile) e proteggere il
        servizio dagli abusi.
        <strong> Niente pubblicità, niente vendita di dati, niente profilazione.</strong>
      </p>
    </Section>

    <Section title="4. Chi vede cosa">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Gli altri membri vedono il tuo <strong>pseudonimo</strong> e il tuo <strong>nome</strong>; il tuo cognome è
          visibile solo a te (e all’amministratore di EvLY, per l’assistenza).</li>
        <li>I membri di un Cerchio vedono i suoi Plan e i suoi membri; il contenuto di un Plan (chat, foto, spese…) è
          riservato alle persone che vi si sono unite.</li>
        <li>Una persona invitata a un solo Plan vede solo quel Plan, niente del Cerchio.</li>
        <li>Chiunque abbia il <strong>link d’invito</strong> di un Plan ne vede titolo, data, luogo, descrizione e numero
          di partecipanti; i nomi dei partecipanti solo dopo aver risposto. L’anteprima del link nelle app di messaggistica
          (WhatsApp…) mostra solo titolo, data, numero di partecipanti e nome di chi organizza. Il creatore del Plan può
          rinnovare il link in qualsiasi momento; quello vecchio smette allora di funzionare.</li>
        <li>Un Plan a sorpresa è invisibile alle persone a cui è nascosto.</li>
        <li>Foto, messaggi vocali e file sono accessibili solo da EvLY, tramite link temporanei riservati ai membri.</li>
        <li>I messaggi (chat dei Plan e dei sondaggi) sono <strong>cifrati nella banca dati</strong>, con una chiave
          conservata separatamente: una copia della banca dati non permette di leggerli. Le email di menzione indicano
          solo chi ti ha menzionato e in quale Plan, senza il contenuto del messaggio.</li>
        <li>Non sono invece <strong>cifrati end-to-end</strong>: l’amministratore tecnico di EvLY può accedervi, solo
          quando è necessario al funzionamento o alla sicurezza del servizio.</li>
      </ul>
    </Section>

    <Section title="5. I nostri fornitori e il trasferimento all’estero">
      <p>EvLY si appoggia ai seguenti fornitori, che trattano dati per nostro conto:</p>
      <ProcessorTable rows={processors} head={['Fornitore', 'Ruolo', 'Paese', 'Garanzia']} />
      <p>
        Gli Stati Uniti non offrono in generale un livello di protezione equivalente alla Svizzera. Ogni trasferimento è
        quindi regolato: o il fornitore è certificato secondo lo Swiss-U.S. Data Privacy Framework, riconosciuto dal
        Consiglio federale dal 15 settembre 2024, oppure si impegna con le clausole contrattuali tipo, adattate al diritto
        svizzero, del suo contratto di trattamento dei dati.
      </p>
    </Section>

    <Section title="6. Per quanto tempo li conserviamo">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Plan</strong>: eliminati automaticamente alla loro data di fine (al massimo 3 settimane dopo l’inizio),
          con tutto il loro contenuto — messaggi, messaggi vocali, foto, file, passaggi, spese. Se erano state registrate
          spese, poco prima i membri ricevono un riepilogo per email. Il creatore del Plan e gli organizzatori del Cerchio
          possono conservarne un <strong>riepilogo PDF</strong> (info, partecipanti con nome e pseudonimo, volontari,
          spese, voti): scaricandolo, o per email poco prima dell’eliminazione se hanno attivato questa opzione. Il
          verbale di un’assemblea è inviato per email al creatore del Plan alla sua chiusura: spetta poi all’associazione
          conservarlo.</li>
        <li><strong>Sondaggi sulle date</strong>: eliminati appena diventano un Plan (la loro conversazione è ripresa nel
          Plan), altrimenti automaticamente il giorno dopo l’ultima data proposta, e al più tardi 30 giorni dopo la loro
          creazione, con i loro voti e la loro chat.</li>
        <li><strong>Account</strong>: conservato finché non lo elimini.</li>
        <li><strong>Log del server</strong>: 7 giorni, poi cancellati automaticamente.</li>
        <li><strong>Visite della pagina di presentazione e dell’opuscolo, numero di messaggi inviati</strong>: solo totali
          giornalieri, che non contengono alcun dato personale.</li>
      </ul>
    </Section>

    <Section title="7. I tuoi diritti">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Accesso</strong>: ottenere una copia dei tuoi dati scrivendo a info@evly.ch — risposta entro 30
          giorni.</li>
        <li><strong>Rettifica</strong>: modificare nome e cognome in «Il mio profilo».</li>
        <li><strong>Cancellazione</strong>: eliminare il tuo account in qualsiasi momento dal menu («Elimina il mio
          account»). I tuoi dati personali sono allora cancellati; i Cerchi e i Plan che hai creato passano ad altri
          membri, e le foto che vi hai condiviso restano loro visibili fino alla fine del Plan.</li>
        <li><strong>Notifiche</strong>: scegliere in «Notifiche» se riceverle via push, per email o entrambi, e
          disattivare il riepilogo settimanale.</li>
        <li><strong>Reclamo</strong>: puoi rivolgerti all’Incaricato federale della protezione dei dati e della
          trasparenza (IFPDT, edoeb.admin.ch).</li>
      </ul>
    </Section>

    <Section title="8. Sicurezza">
      <p>
        Connessione cifrata (HTTPS), password cifrate, accesso alle foto riservato ai membri, limitazione dei tentativi
        di accesso. In caso di fuga di dati che presenti un rischio elevato per te, informeremo l’IFPDT e le persone
        interessate.
      </p>
    </Section>

    <Section title="9. Cookie e archiviazione nel browser">
      <p>
        EvLY non usa alcun cookie pubblicitario né di misurazione dell’audience. Il tuo browser conserva solo la tua
        sessione di accesso e alcune preferenze (per esempio la lingua). Se accedi con Google, Google può depositare i
        propri cookie.
      </p>
      <p className="mt-2">
        La pagina di presentazione (evly.ch/decouvrir.html) e l’opuscolo PDF (evly.ch/brochure) contano le visite in modo
        anonimo: viene registrato solo un totale giornaliero, senza cookie, senza indirizzo IP e senza alcun
        identificativo. Sulla pagina di presentazione, le persone già connesse a EvLY non sono contate. Allo stesso modo,
        alcune tappe dell’iscrizione (clic su «Crea il mio account» o «Organizza un’uscita», uscita creata o condivisa,
        iscrizione, conferma dell’email, primo Plan) sono contate in totali giornalieri, senza sapere chi le ha fatte.
      </p>
    </Section>

    <Section title="10. Età minima">
      <p>EvLY è riservato alle persone dai 16 anni in su.</p>
    </Section>

    <Section title="11. Modifiche">
      <p>
        Questa informativa può cambiare; la data della versione qui sopra indica l’ultimo aggiornamento. In caso di
        cambiamento importante, ne sarai informato/a nell’app.
      </p>
    </Section>
  </>,
};
export default it;
