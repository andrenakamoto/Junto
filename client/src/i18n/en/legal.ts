import type { Dict } from '../fr';
const legal: Dict['legal'] = {
  notice: {
    title: 'Legal notice',
    editorTitle: 'Publisher',
    editor: 'André Martins, Geneva, Switzerland',
    contactTitle: 'Contact',
    contact: 'For any question, including about your data: {{email}}',
    hostingTitle: 'Hosting',
    hosting: 'Infomaniak Network SA, Rue Eugène-Marziano 25, 1227 Les Acacias (Geneva), Switzerland. The website, app, database, files and emails are hosted in Switzerland.',
    ipTitle: 'Intellectual property',
    ip: 'The EvLY name, logo and app belong to the publisher. Content posted by people who use EvLY (messages, photos, files) belongs to them.',
    dataTitle: 'Personal data',
    data: 'How your data is processed is described in the privacy policy. The terms of use apply to the use of the app.',
    privacy: 'Privacy policy',
  },
  unsub: {
    title: 'Unsubscribe',
    loading: 'Loading…',
    digest: 'You will no longer receive the weekly summary of your Plans by email.',
    cockpit: 'You will no longer receive the Monday summary of the “{{org}}” cockpit.',
    button: 'Unsubscribe',
    done: 'Done: you are unsubscribed.',
    already: 'You are already unsubscribed from this summary.',
    again: 'You can turn it back on at any time in the app: ☰ menu → Notifications (or at the bottom of an Organisation’s cockpit).',
    invalid: 'This unsubscribe link is not valid. Write to us at info@evly.ch and we will do it for you.',
  },
};
export default legal;
