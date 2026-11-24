import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { currentLang, t } from '../../i18n';

// Connexion Google sur le web via Google Identity Services (GIS).
// L'ancienne bibliothèque gapi.auth2, utilisée par le plugin Capacitor sur le web,
// est abandonnée par Google et refusée pour les identifiants OAuth récents.
// GIS renvoie un ID token (JWT) : exactement ce que vérifie POST /api/auth/google.
//
// Protection des données (2026-11-24) : le script de Google n'est chargé qu'au toucher du bouton. Avant, il se chargeait à
// l'ouverture de la page de connexion, et Google recevait l'adresse IP de chaque visiteur, même de qui ne s'en servait pas.
// Au toucher : chargement, choix du compte proposé par Google (prompt), et le bouton officiel de Google prend la place du
// nôtre, au cas où le choix du compte ne s'afficherait pas (navigateur qui le bloque) : il suffit alors de le toucher.

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

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export function GoogleWebButton({ clientId, text, onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [state, setState] = useState<'idle' | 'loading' | 'official'>('idle');

  async function start() {
    setState('loading');
    try {
      await loadGis();
      const el = containerRef.current;
      if (!el || !window.google?.accounts?.id) throw new Error('gsi');
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
      setState('official');
      window.google.accounts.id.prompt();
    } catch {
      setState('idle');
      onError(t('auth.googleLoadError'));
    }
  }

  return (
    <div className="w-full mb-4">
      {state !== 'official' && (
        <button
          type="button"
          onClick={start}
          disabled={state === 'loading'}
          className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-semibold rounded-full transition-colors text-sm shadow-sm"
        >
          {state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <GoogleLogo />}
          {text === 'continue_with' ? t('auth.page.continueGoogle') : t('auth.page.signupGoogle')}
        </button>
      )}
      <div ref={containerRef} className="w-full flex justify-center" />
      {state === 'official' && <p className="mt-2 text-center text-xs text-slate-400">{t('auth.page.googleTapAgain')}</p>}
    </div>
  );
}
