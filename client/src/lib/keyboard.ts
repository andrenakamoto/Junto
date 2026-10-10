import type { KeyboardEvent } from 'react';

// Écran tactile (téléphone, tablette) : la touche « retour » du clavier virtuel va à la ligne,
// on envoie avec le bouton. Avec un clavier physique : Entrée envoie, Maj+Entrée va à la ligne.
export function isTouchDevice(): boolean {
  try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch { return false; }
}

export function sendsOnEnter(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchDevice();
}
