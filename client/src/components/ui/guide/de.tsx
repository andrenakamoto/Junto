import { L, P, type Group, type GuideText } from './parts';

// Anleitung auf Deutsch
const groups: Group[] = [
  {
    title: 'Die Grundlagen',
    topics: [
      {
        id: 'vocabulaire', emoji: '🧭', title: 'Kreis, Plan, Chat', summary: 'Die drei Begriffe, die du kennen musst',
        body: <>
          <P>Ein <strong>Kreis</strong> ist deine Gruppe: Freunde, Familie, Arbeitskollegen, Club, Verein. Ein{' '}
            <strong>Plan</strong> ist ein bestimmter Anlass in einem Kreis («Pizza am Freitag?», «Jahreslotto»). Jeder Plan
            hat seinen eigenen <strong>Chat</strong> und seine Bereiche: Ein Geburtstag und ein Apéro vermischen sich nie.</P>
          <P>Links deine Kreise, dann <strong>«Alle meine Pläne»</strong> (nach Datum, der nächste zuerst) und der{' '}
            <strong>Kalender</strong>. Kreise und die Pläne eines Kreises sind nach letzter Aktivität sortiert.</P>
        </>,
      },
      {
        id: 'cercle', emoji: '👥', title: 'Einen Kreis erstellen, beitreten, einladen', summary: 'Zugangscode, Link, QR-Code oder Einladung',
        body: <>
          <P><strong>«Kreis erstellen»</strong> unter «Meine Kreise» (Name, Beschreibung, Farbe). <strong>«Einem Kreis
            beitreten»</strong> mit seinem <strong>Zugangscode</strong>, einem Link oder einem QR-Code. Hast du schon ein
            Konto, kann dich ein Mitglied auch per Pseudonym oder E-Mail einladen: Die Einladung erscheint bei der Glocke 🔔.</P>
          <P>Je nach Kreis wird eine Anfrage durch eine <strong>Mehrheitsabstimmung</strong> der Mitglieder angenommen
            (Standard), durch die Organisatoren oder sofort. Im Abstimmungsmodus kann niemand allein ablehnen.</P>
          <P>Die Mitgliederliste öffnest du mit «N Mitglieder» beim Kreis oder dem Symbol 👥 oben bei seinen Plänen: wer
            online ist, Rollen, Schaltfläche «Einladen».</P>
        </>,
      },
      {
        id: 'plan', emoji: '📅', title: 'Einen Plan erstellen und bearbeiten', summary: 'Titel, Datum, Ort, Grenze, Funktionen',
        body: <>
          <P><strong>«Plan erstellen»</strong> unten in der Liste der Pläne: Titel, Beschreibung, Datum, Ort, maximale
            Teilnehmerzahl, <strong>wichtige Infos</strong> (gut sichtbarer Kasten). Das <strong>Enddatum ist
            Pflicht</strong>: An diesem Tag wird der Plan gelöscht (höchstens 3 Wochen nach Beginn). Die Mitglieder des
            Kreises werden informiert.</P>
          <P>Der Ersteller bearbeitet seinen Plan mit dem Stift; er kann allen erlauben, Daten und Ort oder die wichtigen
            Infos zu ändern. Jede Änderung wird im <strong>Verlauf</strong> festgehalten.</P>
          <P>Unter <strong>«Erweiterte Einstellungen»</strong> ist die Liste <strong>«Funktionen des Plans»</strong> nach
            Kategorien geordnet (Austauschen, Organisieren, Feiern und schenken, Spielen): Wähle ab, was du nicht brauchst,
            und wähle die zu aktivierenden Funktionen (Helfende, Versammlung, Geschenkkasse, Spiele…). Später über das
            Einstellungssymbol des Plans änderbar.</P>
        </>,
      },
      {
        id: 'repondre', emoji: '✋', title: 'Antworten und Warteliste', summary: 'Ich bin dabei · Vielleicht · Abwesend',
        body: <>
          <P>Einem Plan beitreten heisst zusagen: <strong>Ich bin dabei</strong>, <strong>Vielleicht</strong> oder{' '}
            <strong>Abwesend</strong>, sichtbar für alle Teilnehmenden. Die anderen werden informiert, wenn jemand dazukommt
            oder absagt.</P>
          <P><strong>Warteliste</strong>: Ein Plan mit Grenze ist voll, wenn die «Ich bin dabei» und «Vielleicht» sie
            erreichen. Trag dich auf die Warteliste ein: Sobald ein Platz frei wird, wirst du automatisch der Reihe nach
            eingetragen und benachrichtigt. Deine Position steht auf der Karte («Warteliste Nr. 2»).</P>
        </>,
      },
      {
        id: 'sondage-dates', emoji: '🗓️', title: 'Terminumfrage', summary: 'Den Termin finden, bevor der Plan entsteht',
        body: <>
          <P>In einem Kreis <strong>«Termine vorschlagen»</strong>: Alle kreuzen die Termine an, die ihnen passen, oder
            «Nicht interessiert». Die Umfrage hat einen eigenen Chat. Zeichnet sich ein Termin ab, macht{' '}
            <strong>«Plan erstellen»</strong> daraus einen Plan (der Chat wird übernommen).</P>
          <P>Sie endet am Tag nach dem letzten vorgeschlagenen Termin, höchstens nach 30 Tagen; die Person, die sie erstellt
            hat, erhält am Vortag eine Erinnerung.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Wiederkehrende Pläne', summary: 'Jede Woche, alle 2 Wochen, jeden Monat',
        body: <P>Wähle beim Erstellen <strong>«Wiederholen»</strong>: jede Woche, alle 2 Wochen oder jeden Monat, mit
          freiwilligem «Bis». Sobald das Datum vorbei ist, wird der nächste Plan mit denselben Infos und Einstellungen
          erstellt, die Antworten werden zurückgesetzt. Menü des Plans: <strong>«Dieses Mal absagen»</strong> oder{' '}
          <strong>«Wiederholung beenden»</strong>.</P>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Überraschungsplan und -umfrage', summary: 'Einen Plan vor bestimmten Mitgliedern verstecken',
        body: <P>Kreuze <strong>«Überraschungsplan»</strong> an und wähle, vor wem er versteckt wird: Für diese Personen
          existiert er nicht (weder Liste noch Benachrichtigung noch E-Mail). Die anderen sehen ein Band, das daran
          erinnert, für wen es eine Überraschung ist.</P>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Jemanden von aussen einladen', summary: 'Ein Link zu einem einzigen Plan, mit oder ohne Konto',
        body: <>
          <P><strong>Einladen</strong> → «Externe Person»: ein Link zum Teilen (WhatsApp, SMS, QR-Code). Die Person sieht{' '}
            <strong>nur diesen Plan</strong>, sonst nichts vom Kreis.</P>
          <P>Ohne Konto kann sie mit ihrem <strong>Vornamen</strong> antworten (dabei, vielleicht, ich passe). Erstellt sie
            danach ein Konto, folgen ihr ihre Antworten.</P>
          <P>Ausserhalb eines Kreises erstellt <strong>«Einen Ausflug organisieren»</strong> (Anmeldeseite) einen Plan in 30
            Sekunden, auch ohne Konto, abgelegt in deinem persönlichen Kreis «Meine Pläne».</P>
        </>,
      },
    ],
  },
  {
    title: 'In einem Plan',
    topics: [
      {
        id: 'fiche', emoji: '📱', title: 'Die Ansicht des Plans', summary: 'Karten auf dem Handy, Reiter auf grossem Bildschirm',
        body: <>
          <P>Auf dem Handy zeigt die Ansicht <strong>eine Karte pro Bereich</strong> (Chat, Infos, Fahrten, Mitglieder,
            Abstimmen, Ausgaben und aktivierte Funktionen). Ein oranger Punkt zeigt Neues an. Zurück: Pfeil, Zurück-Taste
            oder vom linken Rand wischen. Unten die <strong>Aktionsleiste</strong>: Einladen, Fotos, Kalender, Story und
            Übersicht.</P>
          <P>Auf Computer und Tablet sind die Bereiche Reiter.</P>
        </>,
      },
      {
        id: 'chat', emoji: '💬', title: 'Chat', summary: 'Erwähnungen, Reaktionen, Fotos, Sprachnachrichten',
        body: <>
          <L items={[
            <><strong>@pseudo</strong>, um jemanden zu erwähnen (benachrichtigt, auch wenn stummgeschaltet).</>,
            <>Emoji-Reaktionen und <strong>Antwort-Threads</strong>; auf dem Handy eine Nachricht antippen, um zu reagieren.</>,
            <><strong>Fotos</strong> (Kamera oder Galerie) und <strong>Sprachnachrichten</strong> (Mikrofon-Taste, höchstens 2 Minuten).</>,
            <>Deine Nachricht <strong>15 Minuten</strong> lang bearbeiten oder löschen; dein gesendetes Foto kannst du jederzeit löschen.</>,
            <>Eine Nachricht dem EvLY-Team <strong>melden</strong> oder eine Person <strong>ausblenden</strong> (ihre Nachrichten und Benachrichtigungen verschwinden für dich).</>,
          ]} />
        </>,
      },
      {
        id: 'infos', emoji: '📋', title: 'Infos, Fotos und Dateien', summary: 'Wichtige Infos, Galerie, Dokumente',
        body: <P>Der Bereich <strong>Infos</strong> vereint Beschreibung, <strong>wichtige Infos</strong>, Dateien und
          Fotogalerie. <strong>«Alle Fotos herunterladen»</strong> holt alles auf einmal (ZIP): Mach das vor dem Enddatum.
          10 MB pro Datei, 100 MB pro Plan.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Abstimmen: Umfrage, Match, Wer ist dran?', summary: 'Drei Arten, gemeinsam zu entscheiden',
        body: <>
          <L items={[
            <><strong>Umfrage</strong>: eine Frage, eine Wahl. Anonym oder nicht; wenn nicht, sehen alle, wer was gewählt hat.</>,
            <><strong>Match</strong> ❤️: Alle sagen Ja oder Nein zu jedem Vorschlag (Karten zum Wischen, Foto freiwillig). Die
              Antworten der anderen bleiben verborgen, bis du fertig bist. «Es ist ein Match», wenn alle Ja gesagt haben. Der
              Ersteller des Plans wählt und kann die Wahl als Ort oder in die wichtigen Infos übernehmen.</>,
            <><strong>Wer ist dran?</strong> 🎡: Ein Rad lost eine Person des Plans aus («Ich bin dabei» und «Vielleicht»).
              Wähle die Personen ab, die du herausnehmen willst: Ihre Namen erscheinen mit dem Ergebnis. Das Rad dreht sich
              gleichzeitig auf allen Handys, die den Plan anschauen. Option «Nicht zweimal dieselbe Person».</>,
          ]} />
        </>,
      },
      {
        id: 'trajets', emoji: '🚗', title: 'Fahrten (Fahrgemeinschaft)', summary: 'Anbieten, mitfahren, einen Platz suchen',
        body: <P>Eine fahrende Person bietet eine Hinfahrt an (Abfahrt, Zeit, Plätze, Notiz für die Rückfahrt). Mitfahrende
          tippen auf <strong>«Ich fahre mit»</strong>; ohne Auto <strong>«Ich suche einen Platz»</strong>. Wer «Abwesend»
          antwortet, wird aus seiner Fahrt genommen.</P>,
      },
      {
        id: 'depenses', emoji: '💶', title: 'Ausgaben und «Wer bringt was»', summary: 'Mitbringliste, geteilte Kosten, CHF oder €',
        body: <>
          <P><strong>Wer bringt was</strong>: eine Liste (mit Menge), bei der alle «Ich bringe das» antippen.</P>
          <P><strong>Ausgaben</strong>: wer was für wen bezahlt hat; EvLY berechnet die Salden und schlägt die einfachsten
            Überweisungen vor. Franken und Euro werden getrennt gerechnet, ohne Umrechnung. Kein Geld läuft über EvLY. Gibt
            es Ausgaben, wird vor dem Löschen des Plans eine Übersicht per E-Mail gesendet.</P>
        </>,
      },
    ],
  },
  {
    title: 'Funktionen zum Aktivieren',
    topics: [
      {
        id: 'benevoles', emoji: '🙋', title: 'Helfende', summary: 'Offene Einsätze, alle tragen sich ein',
        body: <P>Der Ersteller des Plans und die Organisatoren des Kreises erstellen die Einsätze (Zeit, Anzahl Personen).
          Sich eintragen heisst «Ich bin dabei». Übersicht «Es fehlen X Personen», Filter «Meine Einsätze», Warnung bei
          Überschneidungen. Erinnerung per Benachrichtigung <strong>eine Stunde vor</strong> Einsatzbeginn.</P>,
      },
      {
        id: 'assemblee', emoji: '🏛️', title: 'Versammlung', summary: 'Traktanden, Vollmachten, Abstimmungen, Protokoll',
        body: <>
          <P>Für die Generalversammlung eines Vereins oder eine Vorstandssitzung. Das Datum des Plans ist das der
            Versammlung; der Ersteller des Plans und die Organisatoren des Kreises organisieren sie, mit freiwilligem
            Aktuar oder freiwilliger Aktuarin.</P>
          <L items={[
            <><strong>Vorher</strong>: Traktanden (Information, Abstimmung, Wahl) mit Dokumenten, Einladung (App,
              Benachrichtigung, E-Mail), <strong>Vollmachten</strong> an ein anderes Mitglied.</>,
            <><strong>Einstellungen</strong>: stimmberechtigte Mitglieder (Passivmitglieder abwählen), Quorum, Eintragen mit
              dem <strong>Saalcode</strong>, <strong>hybride</strong> Versammlung (Teilnahme online).</>,
            <><strong>Während</strong>: Nur als anwesend Eingetragene stimmen ab, einmal für sich und einmal pro Vollmacht.
              Quorum live, <strong>geheime</strong> oder offene Abstimmungen, einfaches, absolutes oder Zweidrittelmehr,
              Wahlen, Beschlüsse per Akklamation.</>,
            <><strong>Danach</strong>: PDF-Protokoll (Anwesende, Vollmachten, Ergebnisse, Gewählte), bei Schluss an den
              Ersteller des Plans gesendet. Bewahre es auf: Der Plan wird an seinem Enddatum gelöscht.</>,
          ]} />
          <P>Bei geheimer Abstimmung kann niemand wissen, wer wie gestimmt hat. Massgebend sind die Statuten des Vereins.</P>
        </>,
      },
      {
        id: 'cagnotte', emoji: '🐷', title: 'Geschenkkasse', summary: 'Ein gemeinsames Geschenk, Ideen und Abstimmungen',
        body: <P>Für wen, Ziel, vorgeschlagener Betrag, Zahlungsweise. Alle geben ihren Beitrag an und dann «Ich habe
          bezahlt»; der Organisator hakt «Erhalten» ab. Den Betrag jeder Person sieht nur der Organisator. Geschenkideen mit
          Abstimmung. Kein Geld läuft über EvLY. Denk daran, den Plan vor der gefeierten Person zu verstecken
          (Überraschungsplan).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Wichteln', summary: 'Auslosung und anonyme Geschenke',
        body: <P>Das Datum des Plans ist der Tag des Geschenkaustauschs. Alle notieren ihre Wünsche (oder «kein besonderer
          Wunsch»), der Organisator startet die Auslosung. Du kennst nur die Person, die du beschenkst; zwei anonyme Chats
          erlauben Fragen. Auflösung ab dem Tag des Austauschs.</P>,
      },
      {
        id: 'killer', emoji: '🎯', title: 'Killer', summary: 'Ein Ziel, ein Gegenstand, ein Ort',
        body: <P>Alle erhalten heimlich ein Ziel, einen Gegenstand und einen Ort: Bring dein Ziel dazu, den Gegenstand an
          diesem Ort in die Hand zu nehmen, ohne Verdacht zu erregen. «Ich habe mein Ziel erwischt», das Ziel bestätigt, und
          du übernimmst seine Mission. Wer zuletzt übrig bleibt, gewinnt. Spielt respektvoll und sicher.</P>,
      },
      {
        id: 'mot-piege', emoji: '🗣️', title: 'Das Fallenwort', summary: 'Jemanden ein geheimes Wort sagen lassen',
        body: <P>Alle müssen ihr Ziel dazu bringen, ein geheimes Wort zu sagen, ohne aufzufliegen. Das Ziel bestätigt oder
          entlarvt die Person. Modus Punkte (Live-Rangliste, Ende zur gewählten Zeit) oder Elimination.</P>,
      },
      {
        id: 'equipes', emoji: '🏆', title: 'Teams und Turnier', summary: 'Ausgeglichene Auslosung, Meisterschaft oder K.-o.',
        body: <P>Auslosung der Teams (2 bis 8, auf Wunsch nach Niveau ausgeglichen), dann Meisterschaft oder K.-o.-System.
          Der Organisator trägt die Resultate ein, die Rangliste berechnet sich von selbst.</P>,
      },
    ],
  },
  {
    title: 'Auf dem Laufenden bleiben',
    topics: [
      {
        id: 'notifications', emoji: '🔔', title: 'Benachrichtigungen und Glocke', summary: 'App, Handy, E-Mail: du entscheidest',
        body: <>
          <P>Menü ☰ → <strong>«Benachrichtigungen»</strong>: Benachrichtigungen auf dem Handy, E-Mails oder beides;
            Wochenübersicht; PDF-Zusammenfassung vor dem Löschen deiner Pläne.</P>
          <P>Die <strong>Glocke</strong> 🔔 unten in der Liste der Kreise sammelt, was du noch nicht gesehen hast,
            Einladungen und Beitrittsanfragen. Automatische Erinnerungen: am Vortag eines Plans, vor dem Ende einer
            Terminumfrage, eine Stunde vor einem Helfereinsatz.</P>
        </>,
      },
      {
        id: 'silence', emoji: '🔕', title: 'Stummschalten', summary: 'Einen Plan oder einen ganzen Kreis stummschalten',
        body: <P>Tippe auf die Glocke auf der Karte eines Plans (neben deiner Antwort) oder oben in der Liste der Pläne eines
          Kreises: keine Benachrichtigung und keine E-Mail mehr für diesen Plan oder Kreis. Die orangen Punkte bleiben.
          Trotzdem kommen durch: Erwähnungen, Erinnerungen an Einsätze, ein frei gewordener Platz auf der Warteliste und die
          Eröffnung einer Abstimmung an einer Versammlung.</P>,
      },
    ],
  },
  {
    title: 'Regeln und Organisation',
    topics: [
      {
        id: 'roles', emoji: '👑', title: 'Rollen und Entscheidungen', summary: 'Ersteller, Organisatoren, Mehrheitsentscheide',
        body: <L items={[
          <><strong>Ersteller des Kreises</strong>: verwaltet den Kreis und ernennt die <strong>Organisatoren</strong> (Mitgliederliste).</>,
          <><strong>Organisatoren</strong>: verwalten den Kreis mit ihm (Einstellungen, Anfragen, reservierte Pläne), ändern
            aber keine Pläne anderer und löschen den Kreis nicht.</>,
          <><strong>Ersteller eines Plans</strong>: bearbeitet seinen Plan und dessen Einstellungen.</>,
          <>Standardmässig werden die Aufnahme eines Mitglieds und das Löschen eines Kreises oder Plans <strong>mit Mehrheit</strong> entschieden.</>,
        ]} />,
      },
      {
        id: 'parametres', emoji: '⚙️', title: 'Erweiterte Einstellungen', summary: 'Für Vereine, Clubs, Unternehmen',
        body: <L items={[
          <>Kreis: Aufnahme (Abstimmung, Organisatoren, frei), Erstellen von Plänen und Umfragen (alle oder Organisatoren),
            Löschen (Abstimmung oder nur Ersteller).</>,
          <>Plan: Funktionen des Plans, wer Daten und Ort ändert, wer die wichtigen Infos ändert, Löschen.</>,
          <>Für alle sichtbar (Einstellungssymbol); ein Verlauf hält die Änderungen am Kreis fest.</>,
        ]} />,
      },
    ],
  },
  {
    title: 'Erinnerungen festhalten',
    topics: [
      {
        id: 'trace', emoji: '📸', title: 'Story, Kalender, Zusammenfassung', summary: 'Erinnerungen und Dokumente zum Behalten',
        body: <L items={[
          <><strong>Story</strong>: ein Erinnerungsbild (Titel, Datum, Ort, Anwesende) mit einem Foto deiner Wahl.</>,
          <><strong>Kalender</strong>: füge den Plan deinem Kalender hinzu (.ics-Datei).</>,
          <><strong>Übersicht</strong> (Ersteller des Plans und Organisatoren): ein PDF mit Infos, Teilnehmenden, Helfenden, Ausgaben und Abstimmungen.</>,
          <><strong>Änderungsverlauf</strong>: Menü des Plans.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Automatisches Löschen', summary: 'Ein Plan verschwindet an seinem Enddatum',
        body: <P>An seinem Enddatum wird ein Plan mit seinem ganzen Inhalt gelöscht: Das ist gewollt, EvLY bleibt schlank.
          Vorher: Lade die Fotos, die Zusammenfassung oder das Protokoll herunter. Die verbleibende Zeit steht in der
          Ansicht (⏳).</P>,
      },
    ],
  },
  {
    title: 'Dein Konto',
    topics: [
      {
        id: 'compte', emoji: '👤', title: 'Konto, Apps und Vorschläge', summary: 'Profil, Apps, eine Idee vorschlagen',
        body: <>
          <P>Menü ☰ unten links: <strong>Mein Profil</strong> (Vorname, Nachname, E-Mail), Passwort, Benachrichtigungen,{' '}
            <strong>Eine Verbesserung vorschlagen</strong> (und die Antwort verfolgen), Löschen des Kontos. Die anderen
            Mitglieder sehen deinen Vornamen und dein Pseudonym, nie deinen Nachnamen (ausser im Protokoll einer
            Versammlung).</P>
          <P><strong>Sprache</strong>: EvLY gibt es auf Französisch, Deutsch, Italienisch und Englisch. Ändere sie unter{' '}
            <strong>Mein Profil</strong>; E-Mails und Benachrichtigungen folgen deiner Sprache.</P>
          <P>EvLY gibt es auch als <strong>App für iPhone und Android</strong>, mit Benachrichtigungen auf dem Handy. Alles
            aktualisiert sich live; ein Band schlägt das Neuladen vor, wenn eine neue Version online ist.</P>
        </>,
      },
      {
        id: 'limites', emoji: '📏', title: 'Grenzen', summary: 'Dateien, Dauer, Kreise, Pseudonym',
        body: <L items={[
          'Dateien: 10 MB pro Datei, 100 MB pro Plan.',
          'Ein Plan dauert höchstens 3 Wochen.',
          'Höchstens 20 erstellte Kreise pro Person.',
          'Pseudonym: Buchstaben ohne Akzente, Ziffern und _ (2 bis 24 Zeichen), Gross- und Kleinschreibung egal.',
        ]} />,
      },
    ],
  },
];

const summary: GuideText['summary'] = [
  { emoji: '👥', text: <>Ein <strong>Kreis</strong> für jede Gruppe, ein <strong>Plan</strong> für jeden Anlass, ein Chat pro Plan.</> },
  { emoji: '✋', text: <>Alle antworten <strong>dabei / vielleicht / abwesend</strong>; Warteliste, wenn es voll ist.</> },
  { emoji: '🗳️', text: <>Gemeinsam entscheiden: <strong>Termine</strong>, Umfragen, <strong>Match</strong>, Rad <strong>Wer ist dran?</strong></> },
  { emoji: '🚗', text: <>Sich organisieren: <strong>Fahrten</strong>, <strong>wer bringt was</strong>, <strong>Ausgaben</strong>, <strong>Helfende</strong>.</> },
  { emoji: '🏛️', text: <>Vereine halten ihre <strong>Versammlung</strong> ab: Abstimmungen, Vollmachten, Protokoll.</> },
  { emoji: '🎉', text: <>Spass haben: <strong>Geschenkkasse</strong>, <strong>Wichteln</strong>, <strong>Killer</strong>, <strong>Fallenwort</strong>, <strong>Turnier</strong>.</> },
  { emoji: '⏳', text: <>Ein Plan <strong>verschwindet an seinem Enddatum</strong>: Sichere vorher Fotos, Übersicht oder Protokoll.</> },
];

const de: GuideText = {
  title: 'Anleitung',
  subtitle: 'Zuerst das Wichtigste, dann jede Funktion im Detail',
  briefTitle: 'EvLY in Kürze',
  tocTitle: 'Inhalt',
  close: 'Schliessen',
  summary,
  groups,
};
export default de;
