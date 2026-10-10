import { ProcessorTable, Section, type Processor, type PrivacyText } from './parts';

// Datenschutzerklärung auf Deutsch (Übersetzung; massgebend ist die französische Fassung)
const processors: Processor[] = [
  { name: 'Railway', role: 'Hosting des Servers und der Datenbank (Konten, Nachrichten, Pläne)', where: 'USA (Kalifornien)', safeguard: 'an das Schweizer Recht angepasste Standardvertragsklauseln (Auftragsbearbeitungsvertrag)' },
  { name: 'Vercel', role: 'Hosting der Website evly.ch', where: 'USA', safeguard: 'zertifiziert nach Swiss-U.S. Data Privacy Framework' },
  { name: 'Cloudinary', role: 'Speicherung der in den Plänen geteilten Fotos, Sprachnachrichten und Dateien', where: 'USA', safeguard: 'zertifiziert nach Swiss-U.S. Data Privacy Framework' },
  { name: 'Resend', role: 'Versand der E-Mails (Bestätigung, Erinnerungen, Benachrichtigungen)', where: 'USA', safeguard: 'an das Schweizer Recht angepasste Standardvertragsklauseln (Auftragsbearbeitungsvertrag)' },
  { name: 'Google', role: 'Anmeldung mit einem Google-Konto (wenn du sie wählst), Schriften der Website und Zustellung der Benachrichtigungen der Apps (Firebase Cloud Messaging)', where: 'USA', safeguard: 'zertifiziert nach Swiss-U.S. Data Privacy Framework' },
  { name: 'Apple', role: 'Zustellung der Benachrichtigungen der iPhone-App (Apple Push Notification Service)', where: 'USA', safeguard: 'zertifiziert nach Swiss-U.S. Data Privacy Framework' },
];

const de: PrivacyText = {
  title: 'Datenschutzerklärung',
  version: 'Fassung vom 10. Oktober 2026',
  translationNote: 'Übersetzung zur Information: Massgebend ist die französische Fassung.',
  body: <>
    <p className="mt-3">
      Diese Seite erklärt, welche Daten EvLY bearbeitet, warum, mit wem sie geteilt werden und welche Rechte du
      hast, gemäss dem Bundesgesetz über den Datenschutz (DSG).
    </p>

    <Section title="1. Wer für deine Daten verantwortlich ist">
      <p>EvLY, Genf (Schweiz). Für alle Fragen oder Anliegen zu deinen Daten: <strong>info@evly.ch</strong>.</p>
    </Section>

    <Section title="2. Bearbeitete Daten">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Dein Konto</strong>: Pseudonym, Vorname, Nachname (freiwillig), E-Mail-Adresse, gewählte Sprache
          der App, Passwort (nur verschlüsselt gespeichert, nie lesbar), deine Google-Kennung, wenn du dich mit Google
          anmeldest, und während einer Adressänderung die neue, noch zu bestätigende Adresse (höchstens 24 Stunden).</li>
        <li><strong>Antwort auf eine Einladung ohne Konto</strong>: dein Vorname und deine Antwort (ich komme /
          vielleicht / ich passe) sowie eine Kennung, die in deinem Browser gespeichert wird, um deine Antwort
          wiederzufinden. Gelöscht am Ende des Plans oder sofort mit «Meine Antwort zurückziehen». Erstellst du danach
          ein Konto oder meldest dich an, wird deine Antwort damit verknüpft.</li>
        <li><strong>Ohne Konto organisierter Ausflug</strong> («Einen Ausflug organisieren»): dein Vorname, dein Ausflug
          (Titel, Datum, Ort) und eine im Browser gespeicherte Kennung, um die Antworten zu verfolgen. Gelöscht mit dem
          Ausflug, am Tag nach seinem Datum. Erstellst du danach ein Konto oder meldest dich an, werden deine Ausflüge
          damit verknüpft.</li>
        <li><strong>Einladungen in einen Kreis</strong>: Lädt dich ein Mitglied mit deinem Pseudonym oder deiner
          E-Mail ein, wird die Einladung (wer dich einlädt, in welchen Kreis) aufbewahrt, bis du sie annimmst oder
          ablehnst.</li>
        <li><strong>Meldungen und ausgeblendete Personen</strong>: Meldest du eine Nachricht, werden eine verschlüsselte
          Kopie der Nachricht, dein allfälliger Grund und dein Pseudonym an den Administrator von EvLY übermittelt; die
          Kopie wird gelöscht, sobald die Meldung bearbeitet ist. Die gemeldete Person erfährt nicht, wer sie gemeldet
          hat. Die Liste der Personen, die du ausblendest, ist nur für dich sichtbar.</li>
        <li><strong>Vorschläge</strong> («Eine Verbesserung vorschlagen»): deine Nachricht, ihre Art (Idee, Problem,
          anderes), das verwendete Gerät und die App-Version sowie die allfällige Antwort des Teams. Nur vom
          Administrator von EvLY gelesen, der sie auch per E-Mail erhält; gelöscht mit deinem Konto.</li>
        <li><strong>Was du veröffentlichst</strong>: Nachrichten und Reaktionen, Antworten auf Pläne (ja / vielleicht /
          nein), Stimmen, Infos zu Plänen, Fotos, Sprachnachrichten und Dateien, Fahrten der Fahrgemeinschaft,
          Teilnahme an Spielen (Wichteln, Killer, Fallenwort, Teams und Resultate) und an einer Geschenkkasse (Betrag,
          gemeldete Zahlung), Ausgaben und Rückzahlungen.</li>
        <li><strong>Versammlungen</strong> (in einem Plan zu aktivierende Funktion): deine Anwesenheit (vor Ort oder
          online), die Vollmacht, die du gibst oder erhältst, und deine Stimmen. Bei <strong>geheimer Abstimmung</strong>{' '}
          speichert EvLY getrennt, dass du abgestimmt hast, und den Stimmzettel selbst, ohne Verbindung zwischen beiden:
          Niemand, weder der Organisator noch der Administrator von EvLY, kann herausfinden, wie du abgestimmt hast. Bei
          offener Abstimmung erscheint deine Stimme in den Ergebnissen und im Protokoll. Das <strong>Protokoll</strong>{' '}
          (PDF) nennt <strong>Vor- und Nachnamen</strong> der Anwesenden, der vertretenen Personen und der
          Kandidierenden; es wird vom Organisator oder vom Aktuar / von der Aktuarin heruntergeladen und bei Schluss der
          Versammlung per E-Mail an den Ersteller des Plans gesendet.</li>
        <li><strong>Technische Daten</strong>: dein Online-Status in deinen Kreisen, deine Anmeldesitzung (im Browser
          gespeichert), das Datum deiner letzten Nutzung von EvLY (auf die Stunde genau, um aktive Mitglieder zu zählen),
          das Datum, an dem du jeden Bereich eines Plans angesehen hast (um Neues zu markieren, gelöscht mit dem Plan),
          und die IP-Adresse, die aus Sicherheitsgründen in den Serverprotokollen gespeichert wird.</li>
        <li><strong>Benachrichtigungen der Android- und iPhone-Apps</strong>: Wenn du sie erlaubst, die
          Benachrichtigungskennung deines Telefons, gelöscht bei der Abmeldung. Eine Benachrichtigung zeigt nur, wer
          geschrieben hat und in welchem Plan, Kreis oder welcher Umfrage — nie den Inhalt einer Nachricht. Du kannst
          sie jederzeit in den Einstellungen deines Telefons abschalten.</li>
      </ul>
      <p>Wir erheben weder Geburtsdatum noch Standort noch Adressbuch.</p>
    </Section>

    <Section title="3. Wozu wir sie verwenden">
      <p>
        Ausschliesslich für den Betrieb von EvLY: damit du mit deinen Kreisen Anlässe organisieren kannst, um dir die
        nützlichen E-Mails zu senden (Kontobestätigung, neue Pläne, Erinnerungen, Erwähnungen, abschaltbare
        Wochenübersicht) und um den Dienst vor Missbrauch zu schützen.
        <strong> Keine Werbung, kein Datenverkauf, kein Profiling.</strong>
      </p>
    </Section>

    <Section title="4. Wer was sieht">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Die anderen Mitglieder sehen dein <strong>Pseudonym</strong> und deinen <strong>Vornamen</strong>; dein
          Nachname ist nur für dich sichtbar (und für den Administrator von EvLY, für den Support).</li>
        <li>Die Mitglieder eines Kreises sehen dessen Pläne und Mitglieder; der Inhalt eines Plans (Chat, Fotos,
          Ausgaben…) ist den Personen vorbehalten, die ihm beigetreten sind.</li>
        <li>Eine Person, die zu einem einzigen Plan eingeladen ist, sieht nur diesen Plan, nichts vom Kreis.</li>
        <li>Wer den <strong>Einladungslink</strong> eines Plans hat, sieht dessen Titel, Datum, Ort, Beschreibung und
          die Zahl der Teilnehmenden; die Vornamen der Teilnehmenden erst nach der eigenen Antwort. Die Vorschau des
          Links in Messengern (WhatsApp…) zeigt nur Titel, Datum, Zahl der Teilnehmenden und den Vornamen der
          organisierenden Person. Der Ersteller des Plans kann den Link jederzeit erneuern; der alte funktioniert dann
          nicht mehr.</li>
        <li>Ein Überraschungsplan ist für die Personen, vor denen er verborgen ist, unsichtbar.</li>
        <li>Fotos, Sprachnachrichten und Dateien sind nur über EvLY zugänglich, mit befristeten, den Mitgliedern
          vorbehaltenen Links.</li>
        <li>Die Nachrichten (Chat der Pläne und Umfragen) sind <strong>in der Datenbank verschlüsselt</strong>, mit einem
          getrennt aufbewahrten Schlüssel: Eine Kopie der Datenbank erlaubt es nicht, sie zu lesen. E-Mails zu
          Erwähnungen nennen nur, wer dich erwähnt hat und in welchem Plan, ohne den Inhalt der Nachricht.</li>
        <li>Sie sind hingegen <strong>nicht Ende-zu-Ende-verschlüsselt</strong>: Der technische Administrator von EvLY
          kann darauf zugreifen, nur wenn dies für den Betrieb oder die Sicherheit des Dienstes nötig ist.</li>
      </ul>
    </Section>

    <Section title="5. Unsere Dienstleister und die Übermittlung ins Ausland">
      <p>EvLY stützt sich auf folgende Dienstleister, die in unserem Auftrag Daten bearbeiten:</p>
      <ProcessorTable rows={processors} head={['Dienstleister', 'Aufgabe', 'Land', 'Garantie']} />
      <p>
        Die USA bieten im Allgemeinen kein mit der Schweiz gleichwertiges Schutzniveau. Jede Übermittlung ist daher
        abgesichert: Entweder ist der Dienstleister nach dem Swiss-U.S. Data Privacy Framework zertifiziert, das der
        Bundesrat seit dem 15. September 2024 anerkennt, oder er verpflichtet sich in seinem Auftragsbearbeitungsvertrag
        zu den an das Schweizer Recht angepassten Standardvertragsklauseln.
      </p>
    </Section>

    <Section title="6. Wie lange wir sie aufbewahren">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Pläne</strong>: automatisch an ihrem Enddatum gelöscht (höchstens 3 Wochen nach ihrem Beginn), mit
          ihrem ganzen Inhalt — Nachrichten, Sprachnachrichten, Fotos, Dateien, Fahrten, Ausgaben. Wurden Ausgaben
          erfasst, erhalten die Mitglieder kurz vorher eine Übersicht per E-Mail. Der Ersteller des Plans und die
          Organisatoren des Kreises können eine <strong>PDF-Zusammenfassung</strong> behalten (Infos, Teilnehmende mit
          Vorname und Pseudonym, Helfende, Ausgaben, Abstimmungen): indem sie sie herunterladen oder per E-Mail kurz vor
          der Löschung, wenn sie diese Option aktiviert haben. Das Protokoll einer Versammlung wird bei ihrem Schluss
          per E-Mail an den Ersteller des Plans gesendet: Danach ist es Sache des Vereins, es aufzubewahren.</li>
        <li><strong>Terminumfragen</strong>: gelöscht, sobald daraus ein Plan wird (ihr Chat wird in den Plan
          übernommen), sonst automatisch am Tag nach dem letzten vorgeschlagenen Termin und spätestens 30 Tage nach ihrer
          Erstellung, mit ihren Stimmen und ihrem Chat.</li>
        <li><strong>Konto</strong>: aufbewahrt, bis du es löschst.</li>
        <li><strong>Serverprotokolle</strong>: 7 Tage, danach automatisch gelöscht.</li>
        <li><strong>Besuche der Vorstellungsseite und der Broschüre, Anzahl gesendeter Nachrichten</strong>: nur
          Tagestotale, die keine Personendaten enthalten.</li>
      </ul>
    </Section>

    <Section title="7. Deine Rechte">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Auskunft</strong>: eine Kopie deiner Daten erhalten, indem du an info@evly.ch schreibst — Antwort
          innert 30 Tagen.</li>
        <li><strong>Berichtigung</strong>: Vor- und Nachnamen unter «Mein Profil» ändern.</li>
        <li><strong>Löschung</strong>: dein Konto jederzeit über das Menü löschen («Mein Konto löschen»). Deine
          Personendaten werden dann gelöscht; die Kreise und Pläne, die du erstellt hast, gehen an andere Mitglieder, und
          die Fotos, die du dort geteilt hast, bleiben für sie bis zum Ende des Plans sichtbar.</li>
        <li><strong>Benachrichtigungen</strong>: unter «Benachrichtigungen» wählen, ob du sie per Push, per E-Mail oder
          beides erhältst, und die Wochenübersicht abschalten.</li>
        <li><strong>Beschwerde</strong>: Du kannst dich an den Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten wenden (EDÖB, edoeb.admin.ch).</li>
      </ul>
    </Section>

    <Section title="8. Sicherheit">
      <p>
        Verschlüsselte Verbindung (HTTPS), verschlüsselte Passwörter, Zugang zu Fotos nur für Mitglieder, Begrenzung der
        Anmeldeversuche. Bei einem Datenleck mit hohem Risiko für dich informieren wir den EDÖB und die betroffenen
        Personen.
      </p>
    </Section>

    <Section title="9. Cookies und Speicherung im Browser">
      <p>
        EvLY verwendet weder Werbe- noch Analyse-Cookies. Dein Browser speichert nur deine Anmeldesitzung und einige
        Einstellungen (zum Beispiel die Sprache). Wenn du dich mit Google anmeldest, kann Google eigene Cookies setzen.
      </p>
      <p className="mt-2">
        Die Vorstellungsseite (evly.ch/decouvrir.html) und die PDF-Broschüre (evly.ch/brochure) zählen ihre Besuche
        anonym: Gespeichert wird nur ein Tagestotal, ohne Cookie, ohne IP-Adresse und ohne jede Kennung. Auf der
        Vorstellungsseite werden bereits bei EvLY angemeldete Personen nicht gezählt. Ebenso werden einige Schritte der
        Registrierung (Klick auf «Konto erstellen» oder «Einen Ausflug organisieren», erstellter oder geteilter Ausflug,
        Registrierung, Bestätigung der E-Mail, erster Plan) als Tagestotale gezählt, ohne zu wissen, wer sie gemacht hat.
      </p>
    </Section>

    <Section title="10. Mindestalter">
      <p>EvLY ist Personen ab 16 Jahren vorbehalten.</p>
    </Section>

    <Section title="11. Änderungen">
      <p>
        Diese Erklärung kann sich ändern; das Datum der Fassung oben zeigt die letzte Aktualisierung. Bei einer
        wichtigen Änderung wirst du in der App informiert.
      </p>
    </Section>
  </>,
};
export default de;
