import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UpdateBanner } from './components/ui/UpdateBanner';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <UpdateBanner />
    </AuthProvider>
  </React.StrictMode>
);
