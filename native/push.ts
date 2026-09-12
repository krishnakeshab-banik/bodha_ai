/**
 * Client-side push registration for the Android app.
 *
 * Requests permission, registers with FCM via Capacitor, and keeps the token
 * in Preferences so a later backend job can send to it. No server trigger
 * is wired yet — that is an intentional follow-up.
 *
 * Real delivery also needs a Firebase project and android/app/google-services.json.
 * Until that file is added, register() logs a warning and the UI is unaffected.
 */

import { isNativeAndroid } from './platform';

const TOKEN_KEY = 'bodha_push_token';

export async function registerPushNotifications(): Promise<void> {
  if (!(await isNativeAndroid())) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { Preferences } = await import('@capacitor/preferences');

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      console.info('[bodha-ai] push permission not granted');
      return;
    }

    await PushNotifications.addListener('registration', async (token) => {
      await Preferences.set({ key: TOKEN_KEY, value: token.value });
      console.info('[bodha-ai] push token registered');
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('[bodha-ai] push registration failed (add google-services.json):', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.info('[bodha-ai] push received', notification.title);
    });

    await PushNotifications.register();
  } catch (error) {
    console.warn('[bodha-ai] push plugin unavailable:', error);
  }
}
