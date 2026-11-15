// Mise en page « téléphone » ou « grand écran » (2026-11-15) : un téléphone en paysage (écran large mais peu haut) garde la
// mise en page du téléphone — une colonne à la fois, le Plan en entier — au lieu de trois colonnes écrasées.
// Mêmes règles que les variantes `md:` / `lg:` de tailwind.config.js.
export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px)';
export const WIDE_QUERY = '(min-width: 768px) and (min-height: 501px)';
export const isWideScreen = () => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches;
