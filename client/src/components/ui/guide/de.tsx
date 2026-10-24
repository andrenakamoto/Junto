import { L, P, type Group, type GuideText } from './parts';

// Anleitung auf Deutsch
const groups: Group[] = [
  {
    title: 'Die Grundlagen',
    topics: [
      {
        id: 'discussion', emoji: '💬', title: 'Diskussion des Kreises', summary: 'Zwischen zwei Treffen reden, ohne alles zu vermischen',
        body: <>
          <P>Jeder Kreis kann seine <strong>Diskussion</strong> haben: die Karte «💬 Diskussion» oben in der Liste der Pläne. Dort redet man über
            alles, was noch kein Treffen ist («Hat jemand am Samstag Zeit?»). Die Nachrichten <strong>verschwinden nach 7 Tagen</strong>:
            was zählt, gehört in einen Plan.</P>
          <P><strong>Einen Plan machen</strong> unter einer Nachricht öffnet «Plan erstellen» mit dieser Nachricht als Titel. Reaktionen,
            Fotos und Erwähnungen @pseudo wie im Chat eines Plans.</P>
          <P>Die erstellende Person und die Organisatoren wählen in den Einstellungen des Kreises: <strong>Offen</strong> (alle schreiben),{' '}
            <strong>Ankündigungen</strong> (nur sie schreiben, die anderen reagieren) oder <strong>Ausgeschaltet</strong>. Benachrichtigungen:
            ein orangefarbener Punkt und ein Push bei jeder Nachricht (unter Benachrichtigungen kannst du sie auf Nachrichten beschränken, in
            denen du erwähnt wirst).</P>
        </>,
      },
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
          <P>Je nach Kreis wird eine Anfrage durch die <strong>Organisatoren</strong> angenommen (Standard), durch eine
            Mehrheitsabstimmung der Mitglieder oder sofort. Im Abstimmungsmodus kann niemand allein ablehnen.</P>
          <P>Die Mitgliederliste öffnest du mit «N Mitglieder» beim Kreis oder dem Button <strong>«Mitglieder»</strong> oben bei seinen Plänen (die anderen Aktionen des Kreises sind im Menü ⋯): wer
            online ist, Rollen, Schaltfläche «Einladen».</P>
        </>,
      },
      {
        id: 'contacts', emoji: '📇', title: 'Meine Kontakte', summary: 'Alle Personen deiner Kreise an einem Ort',
        body: <>
          <P>Der Knopf <strong>„Kontakte“</strong> (neben „Alle meine Pläne“ und „Kalender“) zeigt alle Personen, mit denen du einen
            Kreis teilst, mit euren gemeinsamen Kreisen. Suche nach Vorname oder Pseudo; ein Kreis öffnet sich beim Antippen.</P>
          <P>Eine Person antippen öffnet ihre <strong>Karte</strong>: gemeinsame Kreise und kommende Pläne, <strong>„Plan machen“</strong>{' '}
            in einem gemeinsamen Kreis und <strong>„Einladen“</strong> in einen deiner anderen Kreise. Dieselbe Karte öffnet sich beim
            Antippen eines Avatars (Mitglieder, Chat).</P>
          <P>Unter „Einladen“ eines Kreises schlägt <strong>„Aus meinen Kontakten“</strong> die Mitglieder deiner anderen Kreise vor:
            ankreuzen und alle auf einmal einladen. Du siehst nur Personen, die du schon in deinen Kreisen siehst (Vorname und
            Pseudo); ausgeblendete Personen erscheinen nicht.</P>
        </>,
      },
      {
        id: 'decouvrir', emoji: '🧭', title: 'Entdecken', summary: 'Ausgehen in deiner Nähe – und gemeinsam hingehen',
        body: <>
          <P>Der Button <strong>„Entdecken“</strong> (neben „Kontakte“) zeigt die Events der nächsten 14 Tage und
            <strong> Ausflugsideen</strong> (Escape Games, Bowling, Museen …) in <strong>Genf, Lausanne und im Wallis</strong>.
            Wähle deine Region, filtere nach Tag oder Kategorie oder suche ein Wort („Salsa“, „Konzert“ …).</P>
          <P>Bei einem Event öffnet <strong>„Mit einem Kreis hingehen“</strong> einen fertig ausgefüllten Plan (Titel, Datum, Ort, Link)
            im Kreis deiner Wahl; <strong>„Mehr Infos“</strong> öffnet die Website der Veranstalter oder der Agenda, aus der die Anzeige stammt.</P>
          <P>Die Anzeigen stammen aus öffentlichen Agenden (zum Beispiel der Stadt Genf) und vom EvLY-Team.
            <strong> Sie können Fehler enthalten</strong>: Prüfe immer auf der Website der Veranstalter und nutze „Fehler melden“,
            wenn etwas nicht stimmt. Entdecken ist auch ohne Konto sichtbar, auf evly.ch/sorties.</P>
          <P><strong>„Öffentliches Event veröffentlichen“</strong> kommt bald für Veranstalter: Hinterlass deine Angaben, um informiert zu werden. Von EvLY bereits freigeschaltete Konten veröffentlichen einen Plan im <strong>Ankündigungsmodus</strong> mit <strong>„In Entdecken veröffentlichen“</strong> (Menü ⋮ oder Symbol 🧭 des Plans): Die Anzeige folgt dem Plan, und alle können sich über den Einladungslink <strong>„Anmelden“</strong>.</P>
        </>,
      },
      {
        id: 'dispo', emoji: '🟢', title: '„Ich hab Zeit“', summary: 'Sagen, dass man frei ist, und daraus einen Plan machen',
        body: <>
          <P>In einem Kreis: <strong>„Ich hab Zeit“</strong> (der grüne Button oder unten „Erstellen“), <strong>jetzt</strong> (für 3 Stunden) oder{' '}
            <strong>heute Abend</strong>, wenn du willst mit einer Aktivität (🍻 Apéro, 🍕 Essen, 🎬 Kino…) und einem kurzen Wort. Du
            kannst es in mehreren Kreisen gleichzeitig sagen. Die Mitglieder werden benachrichtigt, und die Karte des Kreises zeigt
            „🟢 3 haben Zeit“.</P>
          <P>Sobald <strong>genug Personen Zeit haben</strong> (standardmässig 3), schlägt <strong>„Plan starten“</strong> einen fertigen
            Plan vor („Apéro heute Abend 🍻“, Uhrzeit vorgeschlagen); danach verschwinden die Angaben. Alles verschwindet auch von selbst
            am Ende des gewählten Zeitraums.</P>
          <P>Im Fenster übernimmt <strong>„Plan vorschlagen ab“</strong> die Zahl des Kreises; du kannst sie für deine Angabe ändern (zum Beispiel „ab 2“, wenn dir ein Treffen zu zweit reicht).</P>
          <P>Die Funktion ist <strong>standardmässig ausgeschaltet</strong>: Wer den Kreis erstellt hat und die Organisatoren schalten sie ein oder aus und wählen die Anzahl Personen in den
            Einstellungen des Kreises. Keine Mitteilungen mehr: Mitteilungen → „Wer in meinen Kreisen Zeit hat“.</P>
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
            und wähle die zu aktivierenden Funktionen (Einsatzplan, Versammlung, Geschenkkasse, Spiele…). Später über das
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
          <P>In einem Kreis <strong>«Erstellen» › «Termine vorschlagen»</strong>: Alle kreuzen die Termine an, die ihnen passen, oder
            «Kann nicht». Die Umfrage hat einen eigenen Chat. Zeichnet sich ein Termin ab, macht{' '}
            <strong>«Plan erstellen»</strong> daraus einen Plan (der Chat wird übernommen). Wer sie erstellt hat, kann
            unterwegs <strong>Termine hinzufügen</strong>: Wer schon geantwortet hat, wird benachrichtigt.</P>
          <P>Sie endet am Tag nach dem letzten vorgeschlagenen Termin, höchstens nach 30 Tagen; die Person, die sie erstellt
            hat, erhält am Vortag eine Erinnerung.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Wiederkehrende Pläne', summary: 'Jede Woche, alle 2 Wochen, jeden Monat',
        body: <P>Wähle beim Erstellen <strong>«Wiederholen»</strong>: jede Woche, alle 2 Wochen oder jeden Monat, mit
          freiwilligem «Bis». Sobald das Datum vorbei ist, wird der nächste Plan mit denselben Infos und Einstellungen
          erstellt, die Antworten werden zurückgesetzt. Umfragen, Matches und Glücksräder werden ohne Stimmen übernommen: Alle stimmen neu ab. Menü des Plans: <strong>«Dieses Mal absagen»</strong> oder{' '}
          <strong>«Wiederholung beenden»</strong>.</P>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Wer sieht diesen Plan (Überraschung, reserviert)', summary: 'Einen Plan vor bestimmten Personen verstecken oder nur für einige reservieren',
        body: <P>Unter <strong>Weitere Optionen › Teilnehmende › Wer sieht diesen Plan?</strong>: <strong>«Verstecken vor…»</strong>
          (für diese Personen existiert der Plan nicht: weder Liste noch Benachrichtigung noch E-Mail) oder <strong>«Nur für…»</strong>
          (nur die gewählten Personen sehen ihn, zum Beispiel der Vorstand eines Vereins; wer später dem Kreis beitritt, sieht ihn
          auch nicht). Für einen Geburtstag kreuze <strong>«Es ist eine Überraschung»</strong> an: Die anderen sehen ein Banner
          «Pssst, nichts verraten!». Dasselbe gilt für Terminumfragen.</P>,
      },
      {
        id: 'plusieurs-cercles', emoji: '🔗', title: 'Plan für mehrere Kreise', summary: 'Ein Plan für mehrere Gruppen',
        body: <P>Wenn du mehrere Kreise erstellt hast oder organisierst (eine Schule, ein Verein mit mehreren Gruppen), kreuze
          beim Erstellen unter «Teilnehmende» <strong>«Plan für mehrere Kreise»</strong> an: Der Plan erscheint in jedem gewählten
          Kreis, mit einem einzigen Chat und einer einzigen Teilnehmerliste. Die Kreise lassen sich danach nicht mehr ändern. Vor
          dem Beitreten wird jede Person darauf hingewiesen, dass Personen aus anderen Kreisen ihren Vornamen und ihr
          Pseudonym sehen.</P>,
      },
      {
        id: 'annonce', emoji: '📣', title: 'Ankündigungsmodus', summary: 'Informieren und wissen, wer kommt (Aufführung, Kurs…)',
        body: <P>Kreuze beim Erstellen unter <strong>Funktionen › Organisieren</strong> den <strong>«Ankündigungsmodus»</strong> an: Alle Funktionen sind ausgeschaltet und die
          Teilnehmerliste ist der erstellenden Person und den Organisatoren vorbehalten. Teilnehmende sehen die Infos, das Plakat
          und die Dokumente und antworten; sie sehen nur ihre eigene Antwort (und die freien Plätze, wenn der Plan begrenzt ist).
          Die erstellende Person und die Organisatoren fügen das Plakat (Fotos gross oben in den Infos) und die Dokumente hinzu;
          die Teilnehmenden fügen keine hinzu (Regel «Wer Fotos und Dateien hinzufügt» unter Regeln, für jeden Plan möglich).</P>,
      },
      {
        id: 'allerAvec', emoji: '🎟️', title: 'Mit einem Kreis hingehen', summary: 'Mit Freunden an ein Event gehen',
        body: <>
          <P>In einem Plan im Ankündigungsmodus (Gala, Party…) erstellt der Button <strong>«Mit einem Kreis hingehen»</strong> einen
            Plan in einem deiner Kreise, schon mit Titel, Daten und Ort. Deine Freunde organisieren sich dort: wer kommt, Chat,
            Fahrten.</P>
          <P>Der Plan der Freunde zeigt eine Karte <strong>«Event»</strong> mit dem Button «Beim Event anmelden»: Alle melden sich
            selbst an, die Plätze der Organisatoren werden respektiert. Eine Antwort im Plan der Freunde meldet nicht beim Event
            an. Die Organisatoren können das in den Regeln des Plans ausschalten.</P>
        </>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Jemanden von aussen einladen', summary: 'Ein Link zu einem einzigen Plan, mit oder ohne Konto',
        body: <>
          <P>In einem Plan: <strong>Einladen</strong> → «Link des Plans»: ein Link zum Teilen (WhatsApp, SMS, QR-Code). Die Person sieht{' '}
            <strong>nur diesen Plan</strong>, sonst nichts vom Kreis. Die Regel <strong>«Wer externe Personen einlädt»</strong>
            (Regeln des Plans) legt fest, wer ihn teilen darf: alle Teilnehmenden, die erstellende Person und die Organisatoren
            oder niemand. In einem Kreis bietet <strong>Einladen</strong> den Code und den Link des Kreises an, je nach Aufnahmeregel.</P>
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
        id: 'en-bref', emoji: '✨', title: 'Kurz & bündig', summary: 'Deine Übersicht des Plans auf einen Blick',
        body: <>
          <P>Der Knopf <strong>Kurz & bündig</strong> (auf der Karte des Plans und oben auf der Planseite) fasst den Plan
            <strong>für dich</strong> zusammen: Datum, Ort, wer kommt, wichtige Informationen, deine Fahrt, was du mitbringst,
            was du schuldest oder was man dir schuldet, deine Sammelkasse, deine Einsätze und was auf deine Antwort
            wartet. Tippe auf eine Zeile, um den Bereich zu öffnen.</P>
          <P><strong>Übersicht kopieren</strong> kopiert einen Text zum Weiterschicken (Datum, Ort, wer kommt, freie Plätze,
            was fehlt) mit einem Link zum Antworten, auch ohne Konto. Nichts Persönliches steht darin. Nur für die Antworten
            «Ich bin dabei» und «Vielleicht».</P>
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
          10 MB pro Datei, 100 MB pro Plan. Beschreibung (500 Zeichen) und wichtige Infos (5000 Zeichen) lassen sich mit den
          Schaltflächen über dem Feld formatieren: <strong>fett</strong>, <em>kursiv</em>, <u>unterstrichen</u>, Aufzählungen oder nummerierte Listen.</P>,
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
        id: 'transports', emoji: '🚌', title: 'Mit dem ÖV', summary: 'Fahrpläne, gemeinsam reisen, letzte Rückfahrt',
        body: <P>Wähle im Bereich Fahrten wo du losgehst und wohin: eine Adresse, einen Ort oder eine Haltestelle
          (Abfahrt auf Wunsch gespeichert). Niemand sonst sieht deine Adresse. EvLY zeigt die Verbindungen, um pünktlich anzukommen (Busse, Trams und Züge in der ganzen Schweiz), und die
          <strong> letzte Rückfahrt</strong> der Nacht. <strong>«Ich schlage diese Verbindung vor»</strong> lädt die anderen ein, mit dir zu
          reisen; Erinnerung 30 Minuten vor der Abfahrt.</P>,
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
        id: 'benevoles', emoji: '🙋', title: 'Einsatzplan', summary: 'Einsätze mit Zeiten, alle tragen sich ein',
        body: <P>Der Ersteller des Plans und die Organisatoren des Kreises erstellen die Einsätze (Zeit, Anzahl Personen).
          Sich eintragen heisst «Ich bin dabei». Übersicht «Es fehlen X Personen», Filter «Meine Einsätze», Warnung bei
          Überschneidungen. Erinnerung per Benachrichtigung <strong>eine Stunde vor</strong> Einsatzbeginn. Mit <strong>0 Personen</strong> erscheint die Zeile einfach im Programm (Türöffnung,
          Essen…), ohne Anmeldung. Vor Ort können die Eingetragenen (und die Organisatoren) den Einsatz
          <strong> kommentieren</strong> («es fehlt ein Verlängerungskabel»): Die Person, die ihn erstellt hat, wird
          benachrichtigt. Sie melden ihn auch als <strong>«Aufgabe erledigt»</strong>, was sie ebenfalls benachrichtigt. Das Symbol 📅 eines Einsatzes <strong>fügt ihn deinem Kalender hinzu</strong> (Handy oder Kalenderkonto), mit Zeit, Ort des Plans und Link zum Einsatzplan.</P>,
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
          («Verstecken vor…», «Es ist eine Überraschung»).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Wichteln', summary: 'Auslosung und anonyme Geschenke',
        body: <P>Das Datum des Plans ist der Tag des Geschenkaustauschs. Alle notieren ihre Wünsche (oder «kein besonderer
          Wunsch»), der Organisator startet die Auslosung. Du kennst nur die Person, die du beschenkst; zwei anonyme Chats
          erlauben Fragen. Auflösung ab dem Tag des Austauschs.</P>,
      },
      {
        id: 'quiz', emoji: '🧠', title: 'Quiz', summary: 'Live-Fragen, Bonus für Schnelligkeit',
        body: <P>Eine Person bereitet Multiple-Choice-Fragen vor (2 bis 4 Antworten, Foto optional) und leitet das Quiz, ohne mitzuspielen. Nach dem Start erscheint jede Frage gleichzeitig auf allen Handys: Je schneller die Antwort, desto mehr Punkte (höchstens 1000). Wenn alle geantwortet haben oder die Zeit abgelaufen ist: richtige Antwort und Rangliste. Die Spielleitung geht zur nächsten Frage. Option <strong>Saalbildschirm</strong>: ein Link für Fernseher oder Beamer.</P>,
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
            Terminumfrage, eine Stunde vor einem Einsatz.</P>
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
          <>Wer einen Plan erstellt hat, und die Organisatoren können <strong>jemanden aus einem Plan entfernen</strong> (Bereich
            Mitglieder); die erstellende Person und die Organisatoren können <strong>jemanden aus dem Kreis entfernen</strong> (Fenster Mitglieder).</>,
          <>Standardmässig nehmen die <strong>Organisatoren</strong> neue Mitglieder auf, und nur wer den Kreis oder Plan <strong>erstellt</strong> hat, kann ihn löschen; stattdessen kann eine Mehrheitsabstimmung gewählt werden.</>,
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
          <><strong>Übersicht</strong> (Ersteller des Plans und Organisatoren): ein PDF mit Infos, Teilnehmenden, Warteliste, Einsatzplan, Ausgaben, Abstimmungen, Ergebnissen der Versammlung und der beendeten Spiele, Geschenkkasse (nicht der Chat).</>,
          <><strong>Änderungsverlauf</strong>: Menü des Plans.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Automatisches Löschen', summary: 'Ein Plan verschwindet 24 Std. nach seinem Ende',
        body: <P>An seinem Enddatum wird ein Plan <strong>«Beendet»</strong>: Er bleibt <strong>24 Stunden nur zum Ansehen</strong> sichtbar und
          wird dann mit seinem ganzen Inhalt gelöscht (das ist gewollt, EvLY bleibt schlank). In diesen 24 Std.: Lade die Fotos, die
          Zusammenfassung oder das Protokoll herunter; wer «Ich bin dabei» geantwortet hat, wird 4 Std. vor dem Löschen benachrichtigt.
          Dauert der Anlass länger? Verschiebe das Enddatum unter «Bearbeiten». Die verbleibende Zeit steht in der Ansicht (⏳).</P>,
      },
    ],
  },
  {
    title: 'Dein Konto',
    topics: [
      {
        id: 'photos', emoji: '🖼️', title: 'Profilfoto und Foto des Kreises', summary: 'Dein Gesicht und das deiner Gruppe',
        body: <>
          <P><strong>Profilfoto</strong>: Menü ☰ → <strong>Mein Profil</strong> → «Foto hinzufügen». Zieh das Foto für den
            Ausschnitt, zoom mit zwei Fingern. Es ersetzt überall deine Initialen: Chat, Mitglieder, Abstimmungen… Nur Personen,
            mit denen du einen Kreis oder einen Plan teilst, sehen es.</P>
          <P><strong>Foto des Kreises</strong>: Die Person, die den Kreis erstellt hat, und die Organisatoren fügen es in den
            Einstellungen des Kreises hinzu (⚙︎). Es erscheint als Banner oben auf der Karte des Kreises und über seiner Liste der Pläne.</P>
          <P>Tipp auf das Avatar einer Person, um ihr Foto gross zu sehen. Ein anstössiges Foto? <strong>Foto melden</strong>{' '}
            (in ihrem Profil oder in den Einstellungen des Kreises): Das Team von EvLY prüft es und kann es entfernen. Die Fotos
            werden in der Schweiz gespeichert, ohne GPS-Standort.</P>
        </>,
      },
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
  { emoji: '🚗', text: <>Sich organisieren: <strong>Fahrten</strong>, <strong>wer bringt was</strong>, <strong>Ausgaben</strong>, <strong>Einsatzplan</strong>.</> },
  { emoji: '🏛️', text: <>Vereine halten ihre <strong>Versammlung</strong> ab: Abstimmungen, Vollmachten, Protokoll.</> },
  { emoji: '🎉', text: <>Spass haben: <strong>Quiz</strong>, <strong>Geschenkkasse</strong>, <strong>Wichteln</strong>, <strong>Killer</strong>, <strong>Fallenwort</strong>, <strong>Turnier</strong>.</> },
  { emoji: '⏳', text: <>Ein Plan <strong>verschwindet 24 Std. nach seinem Ende</strong> (dazwischen nur zum Ansehen): Sichere Fotos, Übersicht oder Protokoll.</> },
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
