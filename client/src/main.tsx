import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UpdateBanner } from './components/ui/UpdateBanner';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';
import { captureSource } from './lib/source';

// iPhone / iPad (site et app) : iOS zoome sur tout champ dont le texte fait moins de 16 px, et la page reste zoomée ensuite.
// Sur iOS, maximum-scale=1 coupe seulement ce zoom automatique (Safari laisse toujours zoomer en pinçant) ; pas sur Android,
// où il empêcherait de zoomer. iPad en mode « ordinateur » : se présente comme un Mac, reconnu à son écran tactile.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS) document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover');

captureSource();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <UpdateBanner />
      <OfflineBanner />
    </AuthProvider>
  </React.StrictMode>
);
