import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { registerPush, unregisterPush } from '../lib/push';
import { clearLightToken } from '../lib/lightGuest';
import { DEMO_TOKEN, exitDemo, isDemo, loadDemo } from '../lib/demo';
import { User } from '../types';
import { asLang, currentLang, setLanguage } from '../i18n';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Démo sans compte (lib/demo.ts) : session fictive d'Alex, rien n'est envoyé au serveur. Sur /demo même, rien :
    // la page redirige aussitôt, et un chargement interrompu par la redirection ferait quitter la démo.
    if (window.location.pathname === '/demo') { setLoading(false); return; }
    if (isDemo()) {
      loadDemo()
        .then(() => api.get('/auth/me'))
        .then(res => { setToken(DEMO_TOKEN); setUser(res.data); })
        .catch(() => exitDemo())
        .finally(() => setLoading(false));
      return;
    }
    const stored = localStorage.getItem('estelle_token');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    let stopped = false;
    let retry: number | undefined;
    // Sans réseau, on garde la session et on réessaie (au retour du réseau, sinon toutes les 5 s) ;
    // le jeton n'est effacé que si le serveur le refuse vraiment
    function loadMe() {
      api.get('/auth/me')
        .then(res => { if (!stopped) { setUser(res.data); setLoading(false); } })
        .catch(err => {
          if (stopped) return;
          const status = err?.response?.status;
          if (status === 401 || status === 403 || status === 404) {
            localStorage.removeItem('estelle_token');
            setToken(null);
            setLoading(false);
          } else {
            window.clearTimeout(retry);
            retry = window.setTimeout(loadMe, 5000);
          }
        });
    }
    function onOnline() { window.clearTimeout(retry); loadMe(); }
    window.addEventListener('evly-online', onOnline);
    loadMe();
    return () => { stopped = true; window.clearTimeout(retry); window.removeEventListener('evly-online', onOnline); };
  }, []);

  // Langue : celle du compte s'applique ; un compte sans langue reçoit celle de l'appareil
  const accountLocale = user?.locale;
  useEffect(() => {
    if (!user || isDemo()) return;
    const account = asLang(accountLocale);
    if (!account) api.put('/auth/locale', { locale: currentLang() }).catch(() => {});
    else if (account !== currentLang()) setLanguage(account);
  }, [user?.id, accountLocale]);

  // Apps : enregistre l'appareil pour les notifications push une fois connecté
  const userId = user?.id;
  useEffect(() => {
    if (userId) registerPush();
  }, [userId]);

  function login(t: string, u: User) {
    // Les réponses sans compte de cet appareil ont été transférées au compte (serveur)
    clearLightToken();
    localStorage.setItem('estelle_token', t);
    setToken(t);
    setUser(u);
    // Profil complet (personnes masquées…), absent des réponses de connexion
    api.get('/auth/me').then(res => setUser(res.data)).catch(() => {});
  }

  function logout() {
    if (isDemo()) { exitDemo(); return; }
    unregisterPush(localStorage.getItem('estelle_token'));
    localStorage.removeItem('estelle_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
