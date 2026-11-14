import type { CapacitorConfig } from '@capacitor/cli';

// Apps Android et iOS : la même app web (dossier dist), embarquée. L'identifiant est
// définitif une fois publié sur les stores.
const config: CapacitorConfig = {
  appId: 'ch.evly.app',
  appName: 'EvLY',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // Évite une collision de nom de paquet Swift (recommandé par @capacitor-firebase/messaging)
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    // Clavier : l'app rétrécit au lieu d'être recouverte (Android en plein écran inclus),
    // pour que le chat reste visible au-dessus du clavier
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    // App ouverte : pas de bannière système, la notification s'affiche déjà dans l'app
    FirebaseMessaging: {
      presentationOptions: [],
    },
    SocialLogin: {
      // Google (deux apps) et Apple (app iPhone). Un fournisseur à false est refusé par le module, même sur iPhone.
      providers: { google: true, facebook: false, apple: true, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
