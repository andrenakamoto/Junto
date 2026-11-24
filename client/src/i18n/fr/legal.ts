// Mentions légales (pages/LegalNoticePage.tsx) et désinscription en un clic (pages/UnsubscribePage.tsx), 2026-11-24
const legal = {
  notice: {
    title: 'Mentions légales',
    editorTitle: 'Éditeur',
    editor: 'André Martins, Genève, Suisse',
    contactTitle: 'Contact',
    contact: 'Pour toute question, y compris sur tes données : {{email}}',
    hostingTitle: 'Hébergement',
    hosting: 'Infomaniak Network SA, Rue Eugène-Marziano 25, 1227 Les Acacias (Genève), Suisse. Le site, l’application, la base de données, les fichiers et les emails sont hébergés en Suisse.',
    ipTitle: 'Propriété intellectuelle',
    ip: 'Le nom EvLY, le logo et l’application sont la propriété de l’éditeur. Les contenus publiés par les personnes qui utilisent EvLY (messages, photos, fichiers) leur appartiennent.',
    dataTitle: 'Données personnelles',
    data: 'Le traitement de tes données est décrit dans la politique de confidentialité. Les conditions d’utilisation s’appliquent à l’usage de l’application.',
    privacy: 'Politique de confidentialité',
  },
  unsub: {
    title: 'Désinscription',
    loading: 'Chargement…',
    digest: 'Tu ne recevras plus le résumé hebdomadaire de tes Plans par email.',
    cockpit: 'Tu ne recevras plus le résumé du lundi du cockpit de « {{org}} ».',
    button: 'Me désinscrire',
    done: 'C’est fait : tu es désinscrit(e).',
    already: 'Tu es déjà désinscrit(e) de ce résumé.',
    again: 'Tu peux le réactiver à tout moment dans l’app : menu ☰ → Notifications (ou en bas du cockpit pour une Organisation).',
    invalid: 'Ce lien de désinscription n’est pas valable. Écris-nous à info@evly.ch et nous le ferons pour toi.',
  },
};
export default legal;
