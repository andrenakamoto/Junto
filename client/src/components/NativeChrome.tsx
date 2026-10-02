import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { listenPush } from '../lib/push';

// Couleur des marges de sécurité (encoche, barre d'accueil, barres système) : bleu nuit
// dans les apps ; sur le site, selon la page (tableau de bord / admin clairs, autres sombres).
const LIGHT_PAGES = ['/dashboard', '/admin', '/confidentialite', '/supprimer-mon-compte', '/securite-enfants'];

// Pages « racines » : le bouton retour Android y met l'app en arrière-plan
const ROOT_PAGES = ['/', '/auth', '/dashboard'];

export function NativeChrome() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Bouton retour Android : le tableau de bord gère d'abord ses vues (Plan → Plans → Cercles)
  // via l'événement « evly-back » ; sinon, page précédente, ou arrière-plan sur une page racine.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const sub = CapApp.addListener('backButton', () => {
      const ev = new Event('evly-back', { cancelable: true });
      window.dispatchEvent(ev);
      if (ev.defaultPrevented) return;
      if (ROOT_PAGES.includes(pathRef.current)) CapApp.minimizeApp();
      else if (window.history.length > 1) navigate(-1);
      else navigate('/dashboard', { replace: true });
    });
    return () => { sub.then(h => h.remove()); };
  }, [navigate]);

  // Toucher une notification push ouvre le Plan / sondage / Cercle concerné
  useEffect(() => listenPush(url => navigate(url)), [navigate]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Apps : bandes du haut et du bas (derrière la barre d'état et les boutons de
      // navigation) toujours bleu nuit, avec icônes claires — lisible sur toutes les pages,
      // même quand Android remet son style par défaut.
      document.documentElement.style.backgroundColor = '#0f172a';
      SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
      return;
    }
    // Site : la couleur des marges suit la page (claire sur le tableau de bord, sombre ailleurs)
    const light = LIGHT_PAGES.some(p => pathname.startsWith(p));
    document.documentElement.style.backgroundColor = light ? '#f1f5f9' : '#0f172a';
  }, [pathname]);
  return null;
}
