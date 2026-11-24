import type { Dict } from '../fr';
const legal: Dict['legal'] = {
  notice: {
    title: 'Impressum',
    editorTitle: 'Herausgeber',
    editor: 'André Martins, Genf, Schweiz',
    contactTitle: 'Kontakt',
    contact: 'Für alle Fragen, auch zu deinen Daten: {{email}}',
    hostingTitle: 'Hosting',
    hosting: 'Infomaniak Network SA, Rue Eugène-Marziano 25, 1227 Les Acacias (Genf), Schweiz. Website, App, Datenbank, Dateien und E-Mails werden in der Schweiz gehostet.',
    ipTitle: 'Geistiges Eigentum',
    ip: 'Der Name EvLY, das Logo und die App sind Eigentum des Herausgebers. Die Inhalte, die die Nutzerinnen und Nutzer von EvLY veröffentlichen (Nachrichten, Fotos, Dateien), gehören ihnen.',
    dataTitle: 'Personendaten',
    data: 'Wie deine Daten bearbeitet werden, steht in der Datenschutzerklärung. Für die Nutzung der App gelten die Nutzungsbedingungen.',
    privacy: 'Datenschutzerklärung',
  },
  unsub: {
    title: 'Abmeldung',
    loading: 'Wird geladen…',
    digest: 'Du erhältst die wöchentliche Zusammenfassung deiner Pläne nicht mehr per E-Mail.',
    cockpit: 'Du erhältst die Montags-Zusammenfassung des Cockpits von «{{org}}» nicht mehr.',
    button: 'Abmelden',
    done: 'Erledigt: Du bist abgemeldet.',
    already: 'Du bist von dieser Zusammenfassung bereits abgemeldet.',
    again: 'Du kannst sie jederzeit in der App wieder einschalten: Menü ☰ → Benachrichtigungen (oder unten im Cockpit einer Organisation).',
    invalid: 'Dieser Abmeldelink ist ungültig. Schreib uns an info@evly.ch, wir erledigen es für dich.',
  },
};
export default legal;
