import axios from 'axios';
import { demoAdapter, isDemo } from '../lib/demo';
import { currentLang } from '../i18n';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });

api.interceptors.request.use((config) => {
  // Démo sans compte : rien ne part au serveur (lib/demo.ts)
  if (isDemo()) { config.adapter = demoAdapter; return config; }
  // Langue des réponses du serveur (messages d'erreur…) pour les personnes sans compte ; avec un compte,
  // le serveur utilise la langue enregistrée
  config.headers['Accept-Language'] = currentLang();
  const token = localStorage.getItem('estelle_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
