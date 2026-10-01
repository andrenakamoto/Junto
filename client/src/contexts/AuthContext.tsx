import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { registerPush, unregisterPush } from '../lib/push';
import { User } from '../types';

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
    const stored = localStorage.getItem('estelle_token');
    if (stored) {
      setToken(stored);
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('estelle_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Apps : enregistre l'appareil pour les notifications push une fois connecté
  const userId = user?.id;
  useEffect(() => {
    if (userId) registerPush();
  }, [userId]);

  function login(t: string, u: User) {
    localStorage.setItem('estelle_token', t);
    setToken(t);
    setUser(u);
  }

  function logout() {
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
