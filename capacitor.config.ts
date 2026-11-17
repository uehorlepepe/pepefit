import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pepefit.app',
  appName: 'Pepefit',
  webDir: 'dist',
  server: {
    // The phone app is a shell around the Pepefit server running on the Mac.
    url: 'http://172.20.10.9:4173',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
