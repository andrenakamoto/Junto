import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UpdateBanner } from './components/ui/UpdateBanner';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';
import { captureSource } from './lib/source';

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
