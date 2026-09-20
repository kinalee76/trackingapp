import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.naddle.trackingapp',
  appName: 'TrackingApp',
  webDir: 'dist',
  android: {
    // Required by @capacitor-community/background-geolocation — prevents
    // location updates from halting after ~5 minutes in the background.
    // See https://github.com/capacitor-community/background-geolocation/issues/89
    useLegacyBridge: true
  }
};

export default config;
