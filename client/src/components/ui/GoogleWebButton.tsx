import { useEffect, useRef, useState } from 'react';
import { currentLang, t } from '../../i18n';

// Connexion Google sur le web via Google Identity Services (GIS).
// L'ancienne bibliothèque gapi.auth2, utilisée par le plugin Capacitor sur le web,
// est abandonnée par Google et refusée pour les identifiants OAuth récents.
// GIS renvoie un ID token (JWT) : exactement ce que vérifie POST /api/auth/google.

declare global {
  interface Window { google?: any }
}

let gisScript: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (!gisScript) {
    gisScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://accounts.google.com/gsi/client?hl=${currentLang()}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { gisScript = null; reject(new Error('gsi')); };
      document.head.appendChild(script);
    });
  }
  return gisScript;
}

interface Props {
  clientId: string;
  text: 'continue_with' | 'signup_with';
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
}

export function GoogleWebButton({ clientId, text, onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  // Le bouton de Google arrive après le reste de la page : emplacement réservé, puis apparition en fondu
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGis()
      .then(() => {
        const el = containerRef.current;
        if (cancelled || !el || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) onCredentialRef.current(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
        });
        el.innerHTML = '';
        window.google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          locale: currentLang(),
          width: Math.min(el.offsetWidth || 320, 400),
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onError(t('auth.googleLoadError'));
      });
    return () => { cancelled = true; };
    // onError volontairement hors dépendances : on ne recharge pas le bouton pour ça
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, text]);

  return (
    <div className="relative w-full min-h-[44px] mb-4">
      {!ready && <div className="absolute inset-x-0 top-0 mx-auto h-10 max-w-[400px] rounded-full bg-white/10 animate-pulse" aria-hidden />}
      <div ref={containerRef} className={`w-full flex justify-center transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
