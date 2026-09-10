import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the existing React frontend as a native Android app.
 *
 * Layout (do not merge these trees):
 *   /frontend   shared React source — used by the website AND the Android WebView
 *   /backend    unchanged Express API
 *   /android    generated native project (this config's android.path)
 *   /native     Capacitor plugin adapters (imported as @native/* from the web app)
 *
 * The website build is unchanged: `npm --prefix frontend run build` still emits
 * frontend/dist for the Vite site. The Android package uses the same output
 * after `npm --prefix frontend run build:android`, which only sets API env
 * for the emulator/device (see frontend/.env.android).
 */
const config: CapacitorConfig = {
  appId: 'com.bodhaai.app',
  appName: 'Bodha AI',
  webDir: 'frontend/dist',
  android: {
    path: 'android',
    // Packaged WebView is https://localhost; the local API is http://10.0.2.2.
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    // Required so the WebView can reach a cleartext LAN/emulator API.
    cleartext: true,
    hostname: 'localhost',
  },
  plugins: {
    Camera: {
      // Prompt lets the seller pick Camera or Gallery on Android.
      presentationStyle: 'popover',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
