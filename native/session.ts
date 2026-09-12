/**
 * Session token storage for the Android WebView.
 *
 * The website keeps using the httpOnly cookie (unchanged). The packaged app
 * talks to the API cross-origin, so it stores the token returned by login
 * and sends it as Authorization: Bearer (already accepted by the backend).
 */

import { isNativeApp } from './platform';

const KEY = 'bodha_session_token';

export async function getNativeSessionToken(): Promise<string | null> {
  if (!(await isNativeApp())) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: KEY });
  return value;
}

export async function saveNativeSessionToken(token: string): Promise<void> {
  if (!(await isNativeApp())) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: KEY, value: token });
}

export async function clearNativeSessionToken(): Promise<void> {
  if (!(await isNativeApp())) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: KEY });
}
