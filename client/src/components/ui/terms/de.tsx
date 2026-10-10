import { Mail, P, PrivacyLink, Rules, type TermsSection, type TermsText } from './parts';

// Nutzungsbedingungen auf Deutsch (Übersetzung ; massgebend ist die französische Fassung)
const sections: TermsSection[] = [
  {
    title: 'Vorstellung des Dienstes',
    body: <>
      <P>EvLY («der Dienst») ist eine App zur Organisation von Anlässen, herausgegeben in Genf («die Herausgeberin»).
        Sie ermöglicht Gruppen — Angehörigen, Freunden, Familien, Vereinen, Clubs, Teams oder Unternehmen —, sich in
        privaten Gruppen («Kreise») zu treffen und sich rund um Anlässe («Pläne») zu organisieren: Antworten der
        Teilnehmenden, Umfragen und Abstimmungen, Chat, Fahrgemeinschaften, Teilen von Dateien und Ausgaben,
        Einsatzplanung von Helfenden, Geschenkkasse, Spiele, Auslosungen und Durchführung von Versammlungen.</P>
      <P>Diese Bedingungen gelten für jede Nutzung des Dienstes, auf der Website evly.ch wie in den Apps für iPhone und
        Android, mit oder ohne Konto. Wer den Dienst nutzt, akzeptiert diese Bedingungen.</P>
    </>,
  },
  {
    title: 'Nutzungsberechtigung',
    body: <P>Die Nutzung von EvLY ist Personen ab 16 Jahren vorbehalten. Mit der Erstellung eines Kontos erklärst du,
      das erforderliche Alter und die Handlungsfähigkeit zu haben, um diese Bedingungen anzunehmen. Eine Organisation
      darf für eine Person unter 16 Jahren weder ein Konto erstellen noch eine Antwort erfassen. Die Herausgeberin kann
      einen Altersnachweis verlangen und bei begründeten Zweifeln jedes Konto sperren.</P>,
  },
  {
    title: 'Registrierung und Konto',
    body: <>
      <P>Um ein Konto zu erstellen, gibst du ein <strong>Pseudonym</strong>, deinen <strong>Vornamen</strong>, eine{' '}
        <strong>E-Mail-Adresse</strong> — die du über den erhaltenen Link bestätigst — und ein Passwort an; der Nachname
        ist freiwillig. Du kannst dich auch mit einem Google-Konto registrieren. Die Angaben müssen zutreffen: Dein
        Pseudonym und dein Vorname sind für die Mitglieder der Kreise und Pläne sichtbar, denen du beitrittst; dein
        Nachname ist nur für dich sichtbar, ausser im Protokoll einer Versammlung deines Kreises (siehe «Versammlungen
        und Abstimmungen»).</P>
      <P>Du bist allein für die Vertraulichkeit deiner Zugangsdaten und für alle Handlungen über dein Konto
        verantwortlich. Bei Verdacht auf unbefugten Zugriff änderst du dein Passwort und schreibst unverzüglich an{' '}
        <Mail />; die Herausgeberin haftet nicht für eine Nutzung deines Kontos vor dieser Meldung. Die Herausgeberin
        überprüft die Identität der Nutzenden nicht.</P>
    </>,
  },
  {
    title: 'Kreise, Rollen und Gäste',
    body: <>
      <P>Die Person, die einen Kreis erstellt (der «Ersteller»), legt dessen Regeln fest: Aufnahme neuer Mitglieder,
        Erstellen von Plänen und Umfragen, Löschen des Kreises. Sie kann <strong>Organisatoren</strong> ernennen, die
        die Verwaltung des Kreises teilen. Verlässt der Ersteller den Kreis oder löscht er sein Konto, geht der Kreis an
        ein anderes Mitglied (oder wird gelöscht, wenn er das einzige war).</P>
      <P>Ein Mitglied kann eine externe Person über einen Link zu <strong>einem einzigen Plan</strong> einladen: Diese
        Person sieht diesen Plan, aber sonst nichts vom Kreis. Ein Plan oder eine Umfrage kann auch vor bestimmten
        Mitgliedern verborgen werden («Überraschungsplan»). Du bist für die Personen, die du einlädst, und für das
        Teilen der Einladungslinks verantwortlich.</P>
      <P>Eine eingeladene Person kann <strong>ohne Konto</strong>, nur mit ihrem Vornamen, auf einen Plan antworten;
        dasselbe gilt für die Person, die einen Ausflug ohne Konto organisiert («Einen Ausflug organisieren»). Diese
        Personen akzeptieren mit der Nutzung des Dienstes die vorliegenden Bedingungen.</P>
    </>,
  },
  {
    title: 'Vereine, Clubs und Unternehmen',
    body: <>
      <P>Wird ein Kreis von einer Organisation genutzt, erklärt die Person, die ihn erstellt, mit deren Zustimmung zu
        handeln. <strong>Die Organisation ist allein verantwortlich für ihre Nutzung des Dienstes</strong> mit ihren
        Mitgliedern, Helfenden, Mitarbeitenden oder Gästen: Inhalt ihrer Pläne, Wahl der Einstellungen, getroffene
        Entscheidungen, versandte Mitteilungen sowie Einhaltung ihrer Statuten, Reglemente und des Gesetzes.</P>
      <P>Für die Daten ihrer Mitglieder, die sie mit dem Dienst bearbeitet (Personen einladen, eine Präsenzliste oder
        ein Protokoll erstellen, Dokumente aufbewahren), bestimmt die Organisation die Zwecke und haftet für deren
        Rechtmässigkeit, insbesondere nach dem Bundesgesetz über den Datenschutz (DSG): Information ihrer Mitglieder,
        Rechtsgrundlage, Aufbewahrung der Dokumente, die sie herunterlädt.</P>
    </>,
  },
  {
    title: 'Verhaltensregeln',
    body: <>
      <P>Mit der Nutzung von EvLY verpflichtest du dich:</P>
      <Rules items={[
        'keine hasserfüllten, diskriminierenden, gewalttätigen, pornografischen, ehrverletzenden, rechtswidrigen oder irreführenden Inhalte zu veröffentlichen;',
        'die Privatsphäre und die Rechte anderer zu respektieren, insbesondere Fotos oder Informationen über eine Person nur mit deren Einverständnis zu teilen;',
        'dich nicht als eine andere Person oder Organisation auszugeben;',
        'den Dienst nicht für Akquise, unerwünschte Werbung, Spam, Geldspiele oder betrügerische Tätigkeiten zu nutzen;',
        'nicht zu versuchen, auf Daten oder Funktionen zuzugreifen, für die du keine Berechtigung hast, und den Betrieb des Dienstes nicht zu stören (Reverse Engineering, automatisiertes Auslesen, absichtliche Überlastung, Umgehen von Grenzen).',
      ]} />
      <P>Um eine Nachricht zu melden, nutze die Schaltfläche <strong>«Melden»</strong> unter dieser Nachricht; für alle
        anderen Inhalte oder Verhaltensweisen schreibst du an <Mail />. Du kannst eine Person auch{' '}
        <strong>ausblenden</strong>: Du siehst ihre Nachrichten nicht mehr und erhältst keine Benachrichtigungen mehr
        von ihr.</P>
    </>,
  },
  {
    title: 'Rolle der Herausgeberin und Inhalte der Nutzenden',
    body: <>
      <P>Die Herausgeberin stellt ein technisches Werkzeug bereit und <strong>speichert die von den Nutzenden
        veröffentlichten Inhalte</strong> (Nachrichten, Pläne, Fotos, Dateien, Abstimmungen…), ohne sie zu erstellen,
        auszuwählen oder im Voraus zu kontrollieren. Sie ist nicht allgemein verpflichtet, diese Inhalte zu überwachen
        oder nach rechtswidrigen Tätigkeiten zu forschen.</P>
      <P>Du bleibst Eigentümer/in der Inhalte, die du veröffentlichst, räumst der Herausgeberin aber eine nicht
        exklusive, unentgeltliche und weltweite Lizenz ein, sie zu speichern, anzuzeigen und zu übermitteln, soweit
        dies für den Betrieb des Dienstes nötig ist. Du bist allein für diese Inhalte verantwortlich und garantierst,
        die nötigen Rechte zu besitzen, um sie zu teilen.</P>
      <P>Die Herausgeberin kann, ohne dazu verpflichtet zu sein und ohne Vorankündigung, jeden Inhalt entfernen,
        jeden Plan oder Kreis löschen oder jedes Konto einschränken, das sie als Verstoss gegen diese Bedingungen oder
        das Gesetz erachtet, oder auf Verlangen einer Behörde.</P>
    </>,
  },
  {
    title: 'Über den Dienst organisierte Anlässe',
    body: <>
      <P>EvLY ist ein Koordinationswerkzeug: Es erleichtert die Organisation realer Treffen und Anlässe, aber{' '}
        <strong>die Herausgeberin ist weder Veranstalterin noch Beteiligte noch Garantin eines Plans</strong>. Sie
        überprüft weder Personen noch Orte noch vorgeschlagene Aktivitäten. Wer einem Plan beitritt, akzeptiert dessen
        Beschreibung in eigener Verantwortung.</P>
      <P><strong>Jede Person nimmt auf eigenes Risiko an den Anlässen teil.</strong> Die Herausgeberin lehnt jede
        Haftung für den Ablauf der über EvLY organisierten Anlässe ab, insbesondere — ohne Einschränkung — für Unfälle,
        Verletzungen, Sachschäden, Alkoholkonsum, sportliche oder körperliche Aktivitäten, das Verhalten einer
        teilnehmenden Person gegenüber einer anderen, Absagen, Abmeldungen oder Streitigkeiten zwischen Teilnehmenden.
        Diese Situationen betreffen ausschliesslich die beteiligten Teilnehmenden oder die Organisation, die den Anlass
        durchgeführt hat.</P>
    </>,
  },
  {
    title: 'Fahrgemeinschaften',
    body: <P>Die Funktion Fahrgemeinschaft ermöglicht es den Teilnehmenden eines Plans lediglich, miteinander in
      Kontakt zu treten. <strong>Die Herausgeberin ist keine Transportunternehmerin</strong> und greift nicht in die
      Fahrten ein: Jede fahrende Person bleibt allein verantwortlich für ihr Fahrzeug, ihren Führerausweis, ihre
      Versicherung, die Einhaltung der Verkehrsregeln und die mit den Mitfahrenden vereinbarten Bedingungen; diese
      reisen auf eigenes Risiko.</P>,
  },
  {
    title: 'Geteilte Ausgaben und Geschenkkasse',
    body: <P>Das Teilen von Ausgaben und die Geschenkkasse dienen dazu, eine unverbindliche Übersicht darüber zu
      führen, wer was bezahlt hat, in Schweizer Franken oder Euro, wobei jede Währung getrennt und ohne Umrechnung
      geführt wird. <strong>EvLY bearbeitet, hält oder überweist keine Gelder</strong>: Die angezeigten Berechnungen
      dienen nur der Information, und Zahlungen erfolgen ausserhalb des Dienstes in alleiniger Verantwortung der
      betroffenen Personen. Die Herausgeberin haftet nicht für Eingabe- oder Rechenfehler, Unstimmigkeiten oder
      ausbleibende Zahlungen.</P>,
  },
  {
    title: 'Versammlungen und Abstimmungen',
    body: <>
      <P>Die Funktion «Versammlung» hilft einer Organisation, eine Versammlung vorzubereiten und durchzuführen:
        Traktanden, Einladung, Anwesenheit, Vollmachten, Abstimmungen, Wahlen und Protokoll.{' '}
        <strong>Sie ersetzt weder die Statuten der Organisation noch das Gesetz</strong> (insbesondere Art. 60 ff. des
        Schweizerischen Zivilgesetzbuchs). Es ist Sache der Organisation und der Personen, welche die Versammlung
        organisieren, den Dienst gemäss ihren Statuten einzustellen — Form und Frist der Einladung, Stimmrecht,
        Vollmachten, Quorum, Mehrheiten — und für die Gültigkeit der Beschlüsse zu sorgen.</P>
      <P>Eine von EvLY versandte Einladung (Benachrichtigung, E-Mail) <strong>garantiert weder die Einhaltung der in den
        Statuten vorgesehenen Form</strong> (zum Beispiel einen Postversand) noch ihren Empfang durch jedes Mitglied.</P>
      <P>Die geheime Abstimmung speichert die Tatsache der Stimmabgabe und den Stimmzettel getrennt und ohne Verbindung
        zwischen beiden. Es handelt sich um ein praktisches Werkzeug, <strong>nicht um ein zertifiziertes elektronisches
        Abstimmungssystem</strong>. Das Protokoll wird automatisch erstellt: Es muss von der Organisation durchgelesen,
        bei Bedarf ergänzt, unterzeichnet und aufbewahrt werden; es enthält Vor- und Nachnamen der anwesenden,
        vertretenen und kandidierenden Personen.{' '}
        <strong>Die Herausgeberin haftet weder für die Gültigkeit der Einladungen, Abstimmungen, Wahlen und Beschlüsse
        noch für daraus entstehende Streitigkeiten.</strong></P>
    </>,
  },
  {
    title: 'Spiele und Auslosungen',
    body: <>
      <P>Die angebotenen Spiele (Killer, Fallenwort, Wichteln, Turnier…) finden im realen Leben statt,{' '}
        <strong>in alleiniger Verantwortung der Teilnehmenden</strong>, die sich verpflichten:</P>
      <Rules items={[
        'mit Respekt vor allen, ihrer Privatsphäre und ihrem Einverständnis zu spielen;',
        'niemals jemanden in Gefahr zu bringen oder gefährliche Gegenstände zu verwenden;',
        'das Gesetz, private Orte, die Arbeit anderer und die Verkehrssicherheit zu respektieren (niemals beim Fahren);',
        'daraus kein Geld- oder Wettspiel zu machen.',
      ]} />
      <P>Die Auslosungen (Rad «Wer ist dran?», Teamauslosung oder Wichteln) werden vom Dienst zufällig durchgeführt.
        Ihr Ergebnis betrifft nur die Teilnehmenden, die sich dafür entschieden haben; die Herausgeberin haftet nicht
        für ihre Folgen.</P>
    </>,
  },
  {
    title: 'Benachrichtigungen, E-Mails und Erinnerungen',
    body: <P>Benachrichtigungen, E-Mails, Erinnerungen und Einladungen werden ohne Gewähr für Zeitpunkt oder Empfang
      versandt: Sie können verzögert, als unerwünscht gefiltert, durch Einstellungen des Telefons oder des
      Mailprogramms blockiert werden oder bei einem Störfall nicht versandt werden.{' '}
      <strong>Verlasse dich bei einer wichtigen Frist nicht allein darauf.</strong> Die Herausgeberin haftet nicht für
      die Folgen einer nicht, verspätet oder irrtümlich erhaltenen Benachrichtigung.</P>,
  },
  {
    title: 'Aufbewahrung und Verlust von Daten',
    body: <P>EvLY ist kein Archivierungswerkzeug. Pläne werden <strong>an ihrem Enddatum automatisch und endgültig
      gelöscht</strong>, mit ihrem Chat, ihren Fotos, Dateien, Abstimmungen und Ausgaben; Terminumfragen bei ihrem
      Ablauf (höchstens 30 Tage). Es liegt an dir, rechtzeitig herunterzuladen, was du behalten möchtest (Fotos,
      Zusammenfassung, Protokoll, Dokumente). Die Herausgeberin garantiert keine Datensicherung und{' '}
      <strong>haftet nicht für deren Verlust</strong>, sei er Folge dieser automatischen Löschung, einer Handlung einer
      nutzenden Person oder eines technischen Störfalls.</P>,
  },
  {
    title: 'Personendaten',
    body: <>
      <P>EvLY bearbeitet die für den Betrieb des Dienstes nötigen Daten: die deines Kontos (Pseudonym, Vorname,
        freiwilliger Nachname, E-Mail, verschlüsseltes Passwort oder Google-Konto), was du veröffentlichst, und einige
        technische Daten. Sie werden weder verkauft noch zu Werbezwecken verwendet; die Nachrichten sind in der
        Datenbank verschlüsselt. Gewisse technische Dienstleister (Hosting, E-Mail-Versand, Dateispeicherung,
        Benachrichtigungen) haben im unbedingt nötigen Umfang Zugang dazu.</P>
      <P>Einzelheiten zu diesen Bearbeitungen, deinen Rechten und den Aufbewahrungsfristen findest du in der{' '}
        <PrivacyLink>Datenschutzerklärung</PrivacyLink>, die massgebend ist. Du kannst dein Konto und deine Daten
        jederzeit über das Menü löschen («Mein Konto löschen»). Die Kreise und Pläne, die du erstellt hast, gehen dann
        an andere Mitglieder, und geteilte Inhalte bleiben bis zu ihrer Löschung in den Plänen. Gewisse Daten können
        darüber hinaus aufbewahrt werden, wenn eine gesetzliche Pflicht oder ein berechtigtes Interesse besteht (z. B.
        Betrugsbekämpfung).</P>
    </>,
  },
  {
    title: 'Dienste Dritter',
    body: <P>Der Dienst stützt sich auf Dienste Dritter (Hosting, Dateispeicherung, E-Mail-Versand, Benachrichtigungen,
      Google-Anmeldung, App-Stores von Apple und Google). Ihre Nutzung unterliegt deren eigenen Bedingungen. Die
      Herausgeberin haftet nicht für deren Nichtverfügbarkeit, Fehler oder Entscheidungen.</P>,
  },
  {
    title: 'Verfügbarkeit und Weiterentwicklung des Dienstes',
    body: <>
      <P>Die Herausgeberin bemüht sich um die Verfügbarkeit des Dienstes, garantiert aber weder Kontinuität noch
        Richtigkeit noch Fehlerfreiheit. Der Dienst kann jederzeit ganz oder teilweise geändert, ausgesetzt,
        eingeschränkt oder endgültig eingestellt werden, mit oder ohne Vorankündigung, ohne dass die Herausgeberin
        dafür haftet.</P>
      <P><strong>EvLY ist nicht für kritische Zwecke ausgelegt</strong>: Nutze es nicht für einen Notfall, die
        Sicherheit von Personen, einen medizinischen Bedarf oder als einziges Mittel, um eine gesetzliche oder
        vertragliche Formalität zu erfüllen.</P>
    </>,
  },
  {
    title: 'Geistiges Eigentum und Vorschläge',
    body: <P>Der Dienst, sein Name, sein Logo, seine Texte, sein Code und sein Erscheinungsbild gehören der
      Herausgeberin; jede Vervielfältigung oder Weiterverwendung ohne Erlaubnis ist untersagt. Ideen und Vorschläge, die
      du sendest («Eine Verbesserung vorschlagen»), darf die Herausgeberin frei und ohne Gegenleistung verwenden.</P>,
  },
  {
    title: 'Preisentwicklung',
    body: <P>EvLY wird derzeit kostenlos angeboten. <strong>Die Herausgeberin behält sich das Recht vor, künftig
      kostenpflichtige Funktionen, Abonnemente oder andere Preismodelle einzuführen</strong>, für den ganzen Dienst oder
      Teile davon, insbesondere für Vereine und Unternehmen. Bestehende Nutzende werden mit angemessener Frist
      informiert, bevor eine Bepreisung von Funktionen in Kraft tritt, die sie bereits nutzen. Die derzeitige
      Kostenlosigkeit stellt keine endgültige Zusage dar.</P>,
  },
  {
    title: 'Haftungsbeschränkung',
    body: <>
      <P>EvLY wird kostenlos «wie besehen» und «nach Verfügbarkeit» bereitgestellt, ohne ausdrückliche oder
        stillschweigende Gewährleistung jeglicher Art, insbesondere der Eignung für einen bestimmten Zweck.</P>
      <P><strong>Soweit gesetzlich zulässig, ist jede Haftung der Herausgeberin ausgeschlossen</strong>, insbesondere
        für indirekte oder Folgeschäden, entgangenen Gewinn, Datenverlust, von Nutzenden oder Dritten veröffentlichte
        Inhalte, über den Dienst organisierte Anlässe und mithilfe des Dienstes getroffene Entscheidungen. Vorbehalten
        bleibt die Haftung für absichtlich oder grobfahrlässig verursachte Schäden sowie jede andere Haftung, die
        aufgrund zwingender gesetzlicher Bestimmungen nicht ausgeschlossen werden kann (Art. 100 des
        Obligationenrechts). Die Haftung für Hilfspersonen und Dienstleister der Herausgeberin ist im gleichen Umfang
        ausgeschlossen.</P>
      <P>Sollte dennoch eine Haftung der Herausgeberin bestehen, ist sie auf den Betrag beschränkt, den die nutzende
        Person in den letzten zwölf Monaten tatsächlich für den Zugang zum Dienst bezahlt hat.</P>
    </>,
  },
  {
    title: 'Schadloshaltung',
    body: <P>Du verpflichtest dich, die Herausgeberin von allen Ansprüchen, Verlusten, Haftungen oder Kosten
      (einschliesslich angemessener Verteidigungskosten) schadlos zu halten, die sich aus deiner Nutzung des Dienstes,
      den von dir veröffentlichten Inhalten, den von dir organisierten Anlässen, Spielen oder Versammlungen oder aus
      deinem Verstoss gegen diese Bedingungen oder das Gesetz ergeben. Eine Organisation, die den Dienst nutzt, geht
      dieselbe Verpflichtung für die Nutzung durch ihre Mitglieder und Organisatoren ein.</P>,
  },
  {
    title: 'Höhere Gewalt',
    body: <P>Die Herausgeberin haftet nicht für eine Nichterfüllung infolge eines Ereignisses ausserhalb ihrer
      zumutbaren Kontrolle: Ausfall eines Dienstleisters oder Netzes, Cyberangriff, Katastrophe, behördliche
      Entscheidung, Streik, Epidemie oder vergleichbares Ereignis.</P>,
  },
  {
    title: 'Sperrung und Kündigung',
    body: <P>Die Herausgeberin kann ein Konto, einen Kreis oder einen Plan nach eigenem Ermessen und ohne
      Vorankündigung sperren oder löschen, bei Verstoss gegen diese Bedingungen, bei schädlichem Verhalten gegenüber dem
      Dienst oder seinen Mitgliedern oder aus jedem anderen berechtigten Grund. Du kannst die Nutzung des Dienstes
      jederzeit beenden und dein Konto löschen.</P>,
  },
  {
    title: 'Anwendbares Recht und Gerichtsstand',
    body: <P>Diese Bedingungen unterstehen schweizerischem Recht. Für alle Streitigkeiten über ihre Auslegung oder
      Erfüllung sind ausschliesslich die Gerichte in Genf zuständig, vorbehaltlich zwingender gesetzlicher Bestimmungen
      zugunsten von Konsumentinnen und Konsumenten.</P>,
  },
  {
    title: 'Schlussbestimmungen',
    body: <P>Sollte eine Bestimmung dieser Bedingungen ungültig oder nicht anwendbar sein, wird sie durch eine gültige
      Bestimmung ersetzt, die ihrem Zweck möglichst nahekommt, und die übrigen Bestimmungen bleiben vollumfänglich in
      Kraft. Verzichtet die Herausgeberin auf die Geltendmachung einer Bestimmung, gilt dies nicht als Verzicht. Diese
      Bedingungen und die Datenschutzerklärung bilden die gesamte Vereinbarung zwischen dir und der Herausgeberin;{' '}
      <strong>massgebend ist die französische Fassung</strong>, diese Übersetzung dient der Information.</P>,
  },
  {
    title: 'Änderung der Bedingungen',
    body: <P>Diese Bedingungen können aktualisiert werden. Bei einer wesentlichen Änderung wirst du beim nächsten Öffnen
      der App gebeten, sie zu lesen und anzunehmen. Die weitere Nutzung des Dienstes nach Annahme der neuen Fassung gilt
      als Zustimmung. Bei Fragen: <Mail />.</P>,
  },
];

const de: TermsText = {
  title: 'Nutzungsbedingungen',
  version: 'Version 4 — 9. Oktober 2026',
  news: 'Neu: Versammlungen, Spiele, Geschenkkasse, Benachrichtigungen und Haftung.',
  translationNote: 'Übersetzung zur Information: Massgebend ist die französische Fassung.',
  sections,
  confirm: 'Mit einem Klick auf «Ich akzeptiere die Bedingungen» bestätigst du, diese Nutzungsbedingungen vollständig gelesen und akzeptiert zu haben.',
  scroll: 'Scrolle, um die Bedingungen vor dem Akzeptieren zu lesen.',
  accept: 'Ich akzeptiere die Bedingungen',
  accepting: 'Wird gespeichert…',
  close: 'Schliessen',
};
export default de;
