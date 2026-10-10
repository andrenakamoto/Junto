import { intlLocale } from '../i18n';

// Formats de dates partagés, dans la langue de l'app (format suisse)
export function shortDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// Libellé d'une date proposée dans un sondage : recalculé dans la langue de chacun quand la date est connue
export function optionLabel(opt: { label: string; eventDate?: string | null }) {
  return opt.eventDate ? shortDateTime(opt.eventDate) : opt.label;
}
