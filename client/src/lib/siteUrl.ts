import { Capacitor } from '@capacitor/core';

// Pages du site (fiche Découvrir, brochure, confidentialité) : dans les apps iOS/Android,
// lien absolu vers www.evly.ch, que Capacitor ouvre dans le navigateur du téléphone.
export function siteUrl(path: string): string {
  return Capacitor.isNativePlatform() ? `https://www.evly.ch${path}` : path;
}

// Adresse publique du site, pour les liens envoyés à d'autres personnes (invitations, QR code) :
// dans les apps, window.location.origin vaut https://localhost (Android) ou capacitor://localhost
// (iPhone), inutilisable hors de l'app.
export function publicOrigin(): string {
  return Capacitor.isNativePlatform() ? 'https://www.evly.ch' : window.location.origin;
}
