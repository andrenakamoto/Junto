import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.estelle.app',
  appName: 'EvLY',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '556163299545-gi37dc52jfptuikci8n4v5hntkd00jpp.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
