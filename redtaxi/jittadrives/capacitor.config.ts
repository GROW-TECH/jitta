import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xiadot.jittadrives.user',
  appName: 'Jitta Drives',
  webDir: 'dist',
  server: {
    url: 'https://jittadrives.com',
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['jittadrives.com', '*.jittadrives.com']
  }
};

export default config;
