import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.estelle.app',
  appName: 'Estelle',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
