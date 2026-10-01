import { Capacitor } from '@capacitor/core';

// Pages du site (fiche Découvrir, brochure, confidentialité) : dans les apps iOS/Android,
// lien absolu vers www.evly.ch, que Capacitor ouvre dans le navigateur du téléphone.
export function siteUrl(path: string): string {
  return Capacitor.isNativePlatform() ? `https://www.evly.ch${path}` : path;
}
