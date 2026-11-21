import type { Dict } from '../fr';

const landing: Dict['landing'] = {
  pageTitle: 'EvLY: Ausflüge mit Freunden, Familie oder Verein organisieren',
  metaDescription: "Weniger organisieren, mehr zusammen sein. EvLY vereint Antworten, Chat, Ausgaben und Fahrten eurer Ausflüge. Gratis, ohne Werbung, in der Schweiz gehostet.",
  nav: { discover: 'Ausgehen', demo: 'Demo', login: 'Anmelden', signup: 'Konto erstellen' },
  hero: {
    kicker: 'Gratis · ohne Werbung · in der Schweiz gehostet',
    title: "Weniger organisieren. Mehr zusammen sein.",
    text: 'EvLY vereint alles, was es zum gemeinsamen Ausgehen braucht: einen klaren Plan, die Antwort aller, den Chat, die Ausgaben, die Fahrten … Für deine Freunde, deine Familie, deinen Verein oder deine Arbeitskollegen.',
    cta: 'Gratis-Konto erstellen',
    demo: 'Demo ansehen',
    guests: 'Deine Gäste antworten sogar ohne Konto.',
  },
  mock: {
    title: 'Apéro auf der Dachterrasse 🌅',
    when: 'Samstag · 19:00',
    where: 'Bei Julie',
    in: 'Ich bin dabei',
    maybe: 'Vielleicht',
    out: 'Ich passe',
    count: '{{n}} dabei · 1 vielleicht',
    bring: 'Tom bringt den Wein 🍷',
  },
  santa: {
    badge: 'Weihnachten naht 🎄',
    title: 'Dein Wichteln, in 2 Minuten organisiert',
    text: 'Die Auslosung, die Wünsche aller und die geheimen Nachrichten: Alles passiert in der EvLY-App, gratis. Für Familie, Arbeitskollegen oder Freunde.',
    p1: 'Automatische Auslosung, Paare getrennt',
    p2: 'Wunschlisten und Budget',
    p3: 'Anonyme Nachrichten mit deinem Wichtel',
    p4: 'Erinnerungen und grosse Enthüllung',
    cta: 'Mein Wichteln organisieren',
    more: 'So funktioniert’s',
    example: 'Beispiel ansehen',
  },
  compare: {
    title: 'Derselbe Abend, zwei Arten, ihn zu organisieren',
    beforeTitle: 'Der Gruppenchat',
    before1: 'wo war das nochmal?',
    before2: 'wer kommt??',
    before3: 'sagen wir 19 oder 20 Uhr?',
    before4: 'ich blick nicht mehr durch 😩',
    unread: '143 ungelesene Nachrichten',
    afterTitle: 'Ein EvLY-Plan',
    after1: '📅 Samstag 19:00 · Bei Julie',
    after2: '✅ 6 dabei · 1 vielleicht · 1 abwesend',
    after3: '🍷 Tom bringt den Wein, Léa das Dessert',
    after4: '🚗 2 Plätze in Noahs Auto',
  },
  audiences: {
    title: 'Für alle deine Gruppen',
    seeExample: 'Beispiel ansehen',
    friends: { tab: 'Mit Freunden', p1: 'Wer kommt, mit einem Tipp: «Ich bin dabei», «Vielleicht», «Ich passe»', p2: 'Wer bringt was, und die Abrechnung macht sich von selbst', p3: 'Spiele für den Abend: Quiz, Killer, Fallwort' },
    family: { tab: 'Familie', p1: 'Der Überraschungsgeburtstag, vor dem Geburtstagskind versteckt', p2: 'Das Weihnachtswichteln, mit den Wünschen aller', p3: 'Die Ferien: Fahrten, Ausgaben, Fotos' },
    work: { tab: 'Arbeitskollegen', p1: 'Der Feierabend-Drink: Abstimmung über den Ort, alle sehen, wer kommt', p2: 'Der Abschiedsapéro als Überraschung, mit Sammelkasse', p3: 'Das Teamfest: Aufgaben, Ablauf, Einsatzplan' },
    clubs: { tab: 'Vereine und Clubs', p1: 'Die Generalversammlung: Einladung, Anwesenheit, Abstimmungen, Protokoll', p2: 'Die wöchentlichen Trainings und die Warteliste', p3: 'Der Einsatzplan der Helfenden und das Material des Vereins' },
    pros: { tab: 'Profis', p1: 'Einen Abend, einen Kurs oder eine Aufführung mit Plakat ankündigen', p2: 'Anmeldungen, freie Plätze und Warteliste', p3: 'Kurse, die sich jede Woche wiederholen' },
  },
  features: {
    title: 'Alles an einem Ort',
    rsvp: { title: 'Wer kommt, endlich klar', text: 'Alle antworten mit einem Tipp. Auch Gäste ohne Konto, über einen einfachen Link.' },
    surprise: { title: 'Überraschungen bleiben Überraschungen', text: 'Ein Plan lässt sich vor dem Geburtstagskind verstecken: keine zweite Gruppe nötig.' },
    money: { title: 'Die Abrechnung, für euch erledigt', text: 'Alle tragen ihre Ausgaben ein, EvLY sagt, wer wem wie viel schuldet.' },
    travel: { title: 'Gemeinsam hinfahren', text: 'Fahrgemeinschaften und Fahrpläne des Schweizer ÖV, bis zur letzten Heimfahrt in der Nacht.' },
    games: { title: 'Gruppenspiele', text: 'Live-Quiz, Killer, Fallwort, Glücksrad, Wichteln.' },
    discover: { title: 'Ideen zum Ausgehen', text: 'Events und Orte aus der ganzen Schweiz, in deiner Nähe.' },
  },
  discover: {
    title: 'Keine Idee fürs Wochenende?',
    text: 'Konzerte, Ausstellungen, Restaurants, Spaziergänge … Ausgehtipps aus der ganzen Schweiz, in deiner Nähe, mit einem Tipp deinen Freunden vorgeschlagen.',
    button: 'Alle Ausgehtipps ansehen',
  },
  trust: {
    title: 'Eine Schweizer App, für euch gemacht, nicht für die Werbung',
    free: { title: 'Gratis', text: 'Für dich und alle deine Gäste.' },
    noads: { title: 'Ohne Werbung', text: 'Weder in der App noch anderswo.' },
    data: { title: 'Deine Daten bleiben deine', text: 'Nie verkauft, Nachrichten verschlüsselt.' },
    swiss: { title: 'In der Schweiz gehostet', text: 'Server bei Infomaniak, einem Schweizer Unternehmen.' },
  },
  brochures: {
    title: 'Für Vereine und Profis',
    text: 'Alle Funktionen für euren Verein, euren Vorstand oder euren Betrieb, auf ein paar illustrierten Seiten (auf Französisch).',
    download: 'Broschüre herunterladen (PDF)',
    assoc: { title: 'Vereine und Clubs', text: 'Generalversammlung, Einsatzplan der Helfenden, Aufgaben des Vorstands, Material, Umfragen und Anmeldungen.' },
    pro: { title: 'Profis', text: 'Bars, Säle, Schulen, Kurse und Aktivitäten: Ankündigungen mit Plakat, Anmeldungen, Warteliste, wiederkehrende Kurse.' },
  },
  faq: {
    title: 'Häufige Fragen',
    q1: 'Ist es wirklich gratis?',
    a1: 'Ja. EvLY ist gratis und werbefrei, für dich wie für deine Gäste.',
    q2: 'Müssen meine Freunde ein Konto erstellen?',
    a2: 'Nein. Sie können über einen einfachen Link mit ihrem Vornamen auf einen Plan antworten. Mit einem Konto haben sie den Chat, die Benachrichtigungen und alles andere.',
    q3: 'Ersetzt das WhatsApp?',
    a3: 'Zum Organisieren eurer Ausflüge, ja: Jeder Ausflug hat seinen Plan, mit Chat, Antworten und Infos. Schluss mit Infos, die in einer Gruppe untergehen, in der über alles geredet wird.',
    q4: 'Auf welchen Geräten?',
    a4: 'Auf iPhone, Android und im Web (evly.ch), auf Französisch, Deutsch, Italienisch und Englisch.',
    q5: 'Was macht ihr mit meinen Daten?',
    a5: 'Sie dienen nur dazu, dass die App funktioniert: nie verkauft, nie für Werbung genutzt. Alles ist in der Schweiz gehostet.',
    q6: 'Und für einen Verein?',
    a6: 'EvLY kann auch Generalversammlungen, den Einsatzplan der Helfenden, die Aufgaben des Vorstands und das Material des Vereins.',
  },
  final: {
    title: 'Dein nächster Plan beginnt hier.',
    text: 'Erstelle dein Konto in einer Minute und lade deine Freunde mit einem einfachen Link ein.',
  },
  footer: {
    brochure: 'Broschüre Vereine (PDF, Französisch)',
    brochurePro: 'Profis (PDF, Französisch)',
    privacy: 'Datenschutz',
    deleteAccount: 'Mein Konto löschen',
    childSafety: 'Kinderschutz',
    contact: 'Kontakt',
    made: 'In Genf entwickelt · in der Schweiz gehostet',
  },
  // Effets et navigation du site d'accueil (2026-11-21)
  fx: {
      "briefKicker": "Kurz & bündig",
      "briefTitle": "Alles, was dich betrifft, auf einen Blick",
      "briefText": "Keinen Plan öffnen, keinen Chat nachlesen: «Kurz & bündig» zeigt dir das Wichtigste, nur für dich.",
      "briefP1": "Wann, wo und wer kommt",
      "briefP2": "Dein Platz im Auto, was noch fehlt",
      "briefP3": "Was du schuldest und wem",
      "briefP4": "Eine Übersicht zum Kopieren, mit Link zum Antworten ohne Konto",
      "briefAlt": "Ansicht «Kurz & bündig» eines Plans in EvLY",
      "rotPrefix": "Schluss mit 300 Nachrichten, um zu wissen, wer kommt…",
      "rot1": "am Samstag",
      "rot2": "zu Omas Geburtstag",
      "rot3": "ins Training",
      "rot4": "an die GV",
      "rot5": "zum Secret Santa",
      "tapHint": "Du bist dran! Tippe auf «Ich bin dabei»",
      "you": "Du",
      "welcome": "Willkommen im Plan 🎉",
      "again": "Nochmal",
      "storyKicker": "So funktioniert’s",
      "storyTitle": "Vom überquellenden Gruppenchat zum Plan, der steht",
      "s1": {
          "title": "Die Gruppe läuft über",
          "text": "«Wo ist das?», «Wer kommt?», «19 oder 20 Uhr?»… Die Infos gehen in 143 Nachrichten unter."
      },
      "s2": {
          "title": "Du erstellst einen Plan",
          "text": "Ein Titel, ein Datum, ein Ort. In 30 Sekunden haben alle dieselbe Info am selben Ort."
      },
      "s3": {
          "title": "Alle antworten mit einem Tipp",
          "text": "«Ich bin dabei», «Vielleicht» oder «Ich passe». Endlich weisst du, wer kommt – auch Gäste ohne Konto."
      },
      "s4": {
          "title": "Alles organisiert sich von selbst",
          "text": "Wer bringt was, Plätze im Auto, geteilte Ausgaben: Alles hat seinen Platz."
      },
      "s5": {
          "title": "Und der nächste Ausflug?",
          "text": "Entdecken schlägt dir Veranstaltungen und Ausflugsideen in deiner Nähe vor. Ein Tipp, und schon ist es ein neuer Plan."
      },
      "created": "Neuer Plan",
      "bringTitle": "Wer bringt was",
      "bring1": "Tom · den Wein 🍷",
      "bring2": "Léa · das Dessert 🍰",
      "bring3": "Chips · noch offen",
      "car": "Noah · 2 Plätze 🚗",
      "expenses": "Ausgaben · 84 CHF, geteilt",
      "nearYou": "In deiner Nähe",
      "idea1": "🎄 Weihnachtsmarkt",
      "idea2": "⛸️ Eisbahn",
      "idea3": "🛷 Schlittelpiste",
      "goCircle": "Mit einem Kreis hingehen",
      "drag": "Zum Vergleichen ziehen",
      "nav": {
          "hero": "Start",
          "story": "So funktioniert’s",
          "compare": "Kurz & bündig",
          "audiences": "Für wen",
          "features": "Funktionen",
          "discover": "Ausflüge",
          "trust": "Vertrauen",
          "faq": "Fragen"
      },
      "big": {
          "free": "{{n}} CHF",
          "noads": "{{n}} Werbung",
          "data": "{{n}} Daten verkauft",
          "swiss": "{{n}} % Schweiz"
      },
      "plans": {
          "friends": {
              "title": "Apéro auf dem Dach 🌅",
              "when": "Samstag · 19:00"
          },
          "family": {
              "title": "Omas 80. Geburtstag 🎂",
              "when": "Sonntag · 12:00"
          },
          "work": {
              "title": "Feierabendbier am Monatsende 🍻",
              "when": "Donnerstag · 18:30"
          },
          "clubs": {
              "title": "Generalversammlung 🏛️",
              "when": "Dienstag · 20:00"
          },
          "pros": {
              "title": "Salsa-Abend 💃",
              "when": "Freitag · 21:00"
          }
      },
      "featured": "Für dich"
  },
};
export default landing;
