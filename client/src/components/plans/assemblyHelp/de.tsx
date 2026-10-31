import type { AssemblyHelpText } from './types';

const de: AssemblyHelpText = {
  title: 'Eine Versammlung leiten',
  intro: 'Alle Schritte, von der Vorbereitung bis zum Protokoll. Tippe auf einen Schritt, um ihn aufzuklappen.',
  forOrganizers: 'Für die Organisation',
  forMembers: 'Für die Mitglieder',
  steps: [
    {
      id: 'reglages', emoji: '⚙️', title: '1. Die Versammlung einstellen',
      body: <>
        <p>Das <b>Datum des Plans</b> ist das der Versammlung. Wer den Plan erstellt hat und die Organisatorinnen und Organisatoren
          des Kreises organisieren sie; sie sehen den Knopf <b>Einstellungen</b>:</p>
        <ul>
          <li><b>Stimmberechtigte</b>: Alle Mitglieder des Kreises stimmen ab; wähle Passivmitglieder oder Mitglieder ohne Stimmrecht ab.</li>
          <li><b>Quorum</b>: keines, eine Anzahl Stimmen oder ein Prozentsatz der Stimmberechtigten. Es wird während der Sitzung live berechnet.</li>
          <li><b>Vollmachten</b>: erlaubt oder nicht, und wie viele eine Person tragen darf.</li>
          <li><b>Hybride Versammlung</b>: Mitglieder können auch online teilnehmen und abstimmen.</li>
          <li><b>Einladungsfrist</b>: EvLY warnt dich, wenn die Einladung zu spät verschickt wird.</li>
          <li><b>Protokollführung</b> (freiwillig): schreibt die Notizen fürs Protokoll und kann es herunterladen.</li>
        </ul>
      </>,
    },
    {
      id: 'points', emoji: '📝', title: '2. Die Traktandenliste vorbereiten',
      body: <>
        <p><b>Punkt hinzufügen</b>, dann wähle die Art:</p>
        <ul>
          <li><b>Information</b>: Bericht, Präsentation, Verschiedenes. Keine Abstimmung.</li>
          <li><b>Abstimmung</b>: <b>geheim</b> (niemand weiss, wer was gestimmt hat) oder <b>offen</b> (die Namen stehen im
            Protokoll). <b>Einfaches</b> Mehr (mehr Ja als Nein), <b>absolutes</b> Mehr (mehr als die Hälfte der Stimmen,
            Enthaltungen mitgezählt) oder <b>Zweidrittelmehr</b>.</li>
          <li><b>Wahl</b>: Anzahl Sitze, dann die <b>Kandidierenden</b> (auf der Karte des Punkts, vor der Eröffnung der Abstimmung).</li>
        </ul>
        <p>Die Beschreibung lässt sich formatieren (fett, Listen); hänge Dokumente an (Rechnung, Bericht als PDF). Die Pfeile ↑ ↓
          ändern die Reihenfolge. Die Art eines Punkts lässt sich nach Eröffnung seiner Abstimmung nicht mehr ändern.</p>
      </>,
    },
    {
      id: 'convoquer', emoji: '📣', title: '3. Die Einladung senden',
      body: <>
        <p><b>Einladung senden</b> schickt sie an <b>alle Mitglieder des Kreises</b>: Mitteilung in der App und E-Mail mit Datum,
          Ort und Traktandenliste, unabhängig von ihren Mitteilungseinstellungen. Du erhältst eine Kopie.</p>
        <p>Ändert sich die Traktandenliste, kannst du sie erneut senden (höchstens alle 10 Minuten). Die Einladung über EvLY
          ersetzt nicht die Form, die eure Statuten vorschreiben.</p>
      </>,
    },
    {
      id: 'procurations', emoji: '🤝', title: '4. Vollmachten',
      body: <>
        <p>Vor der Eröffnung gibt ein Mitglied, das nicht kommen kann, unter „Meine Teilnahme“ einem anderen stimmberechtigten
          Mitglied seine Vollmacht. Dieses stimmt dann zweimal ab: für sich und für die vertretene Person.</p>
        <ul>
          <li>Eine Vollmacht gilt nur, wenn die Person, die sie trägt, <b>als anwesend gemeldet</b> ist.</li>
          <li>Kommt die Person, die sie gegeben hat, doch und meldet sich an, <b>fällt</b> die Vollmacht weg: Sie stimmt selbst ab.</li>
          <li>Die Organisation sieht alle Vollmachten unter „Anwesenheit und Vollmachten“ und kann eine ablehnen.</li>
          <li>Nach der Eröffnung lassen sich keine Vollmachten mehr geben oder zurückziehen.</li>
        </ul>
      </>,
    },
    {
      id: 'ouvrir', emoji: '🔔', title: '5. Die Versammlung eröffnen',
      body: <>
        <p>Am Tag selbst: <b>Versammlung eröffnen</b>. Die Mitglieder erhalten „Die Versammlung ist eröffnet: melde deine Anwesenheit“.</p>
        <p>Unter dem Quorum erscheint ein vierstelliger <b>Saalcode</b>. <b>Code gross anzeigen</b> projiziert ihn mit einem
          <b> QR-Code</b> und der Zahl der Anwesenden, live aktualisiert.</p>
      </>,
    },
    {
      id: 'presences', emoji: '📍', title: '6. Die Anwesenheit erfassen',
      body: <>
        <p>Nur <b>als anwesend Gemeldete</b> stimmen ab. Zwei Wege, gleichzeitig nutzbar:</p>
        <ul>
          <li><b>Mit Handy</b>: Alle tippen den Saalcode in die Karte „Melde deine Anwesenheit“ oder scannen den projizierten
            QR-Code (die App öffnet sich und meldet sie automatisch an).</li>
          <li><b>Ohne Handy</b>: Die Organisation hakt die Person unter „Anwesenheit und Vollmachten“ ab. Noch nicht Gemeldete
            stehen zuoberst; ab 10 Mitgliedern gibt es eine Suche.</li>
          <li><b>Online</b> (hybride Versammlung): Die Person tippt auf „Ich nehme online teil“.</li>
        </ul>
        <p>Das Quorum (Anwesende + gültige Vollmachten) wird bei jeder Meldung aktualisiert.</p>
      </>,
    },
    {
      id: 'seance', emoji: '🖥️', title: '7. Die Traktanden behandeln',
      body: <>
        <p>Das Symbol <b>⤢</b> eines Punkts zeigt ihn <b>allein und gross</b>: ideal für die Leinwand, niemand wird von den
          nächsten Punkten abgelenkt. „Zurück“ / „Nächster Punkt“ (oder die Pfeiltasten) wechseln den Punkt. Alle können das
          auch auf dem eigenen Handy nutzen.</p>
        <p><b>Notizen fürs Protokoll</b>: Die Organisation oder die Protokollführung fasst Punkt für Punkt zusammen, was gesagt
          und beschlossen wurde (mit Formatierung). Sie stehen im Protokoll.</p>
      </>,
    },
    {
      id: 'voter', emoji: '🗳️', title: '8. Abstimmen lassen',
      body: <>
        <ul>
          <li><b>Abstimmung eröffnen</b> beim Punkt: immer nur eine Abstimmung auf einmal. Die Stimmberechtigten erhalten eine
            Mitteilung (auch im Ruhemodus), und oben im Tab erscheint „Laufende Abstimmung – Zur Abstimmung“.</li>
          <li>Alle stimmen in der Karte des Punkts ab, <b>einmal für sich und einmal pro Vollmacht</b>. Der Zähler „x / y haben
            abgestimmt“ läuft live.</li>
          <li><b>Abstimmung schliessen</b> zeigt das Ergebnis (angenommen / abgelehnt oder die Gewählten). <b>Abbrechen</b> löscht
            die Stimmen und setzt den Punkt bei einem Fehler zurück.</li>
          <li><b>Ohne Abstimmung</b>: „Per Akklamation angenommen“, „Ohne Abstimmung abgelehnt“ oder „Stille Wahl“ (so viele
            Kandidierende wie Sitze) halten den Beschluss ohne Abstimmung fest.</li>
          <li><b>Stimmengleichheit</b> bei einer Wahl: Die Organisation bestimmt, wer unter den Gleichplatzierten gewählt ist.</li>
        </ul>
      </>,
    },
    {
      id: 'sans-telephone', emoji: '📵', title: '9. Abstimmen ohne Handy',
      body: <>
        <p>Wer anwesend ist, aber kein Handy (oder keinen Akku) hat, kann trotzdem abstimmen, auf zwei Arten:</p>
        <ul>
          <li><b>Auf dem Gerät der Organisation</b>: Wähle während der Abstimmung unter „Ohne Handy“ die Person und dann „Jemanden
            auf diesem Gerät abstimmen lassen“. Der Bildschirm zeigt nur ihren Stimmzettel; sie stimmt selbst ab (für sich und
            ihre Vollmachten), sieht „Stimme gespeichert“ und gibt dir das Gerät zurück. <b>Die Stimme bleibt geheim</b>: schau
            weg. Ein Tablet im Saal kann als Wahlkabine dienen.</li>
          <li><b>Auf Papier</b>: Tippe in der Anwesenheitsliste <b>vor dem Eröffnen der Abstimmung</b> auf <b>📄 Papier</b> neben
            dem Namen (während einer Abstimmung ist der Knopf gesperrt, damit keine Stimme doppelt zählt). Die Stimmen dieser Person
            werden nicht mehr in der App abgegeben. Gib während der Abstimmung unter „Papierstimmzettel“ die Zählung ein (Ja /
            Nein / Enthaltung, oder Stimmzettel und Stimmen pro Person) <b>vor dem Schliessen</b>. Ergebnis und Protokoll zeigen
            „davon N auf Papier“.</li>
        </ul>
        <p>Bei vielen Mitgliedern ohne Smartphone ist Papier schneller; für ein, zwei Personen genügt das Gerät der Organisation.</p>
      </>,
    },
    {
      id: 'clore', emoji: '✅', title: '10. Die Versammlung schliessen und das Protokoll',
      body: <>
        <ul>
          <li>Schliesse zuerst die laufende Abstimmung, dann <b>Versammlung schliessen</b>. Die Anwesenden werden benachrichtigt.</li>
          <li>Das <b>Protokoll</b> (PDF) enthält die Anwesenden (Vor- und Nachname), die Vollmachten, das Quorum, jeden Punkt mit
            Notizen, die Ergebnisse und die Gewählten, mit Unterschriftszeilen. Vor dem Schliessen ist es ein <b>Entwurf</b>.</li>
          <li>Beim Schliessen wird das Protokoll per E-Mail an die Person geschickt, die den Plan erstellt hat. <b>Wieder eröffnen</b>
            bleibt möglich, falls etwas vergessen ging.</li>
          <li>Bewahre das Protokoll auf: Der Plan wird <b>24 Stunden nach seinem Ende</b> gelöscht. Lass es gegenlesen und
            unterschreiben; massgebend sind die Statuten des Vereins.</li>
        </ul>
      </>,
    },
  ],
  members: {
    id: 'membres', emoji: '🙋', title: 'Was die Mitglieder tun',
    body: <>
      <ul>
        <li><b>Vorher</b>: Traktandenliste und Dokumente lesen, die Vollmacht geben, wenn sie nicht kommen können.</li>
        <li><b>Vor Ort</b>: sich mit dem Saalcode oder dem QR-Code melden, dann in der Karte des Punkts abstimmen, sobald die
          Abstimmung eröffnet ist („Zur Abstimmung“ führt hin).</li>
        <li><b>Ohne Handy</b>: sich bei der Organisation melden, die sie abhakt und auf ihrem Gerät oder auf Papier abstimmen lässt.</li>
      </ul>
    </>,
  },
};

export default de;
