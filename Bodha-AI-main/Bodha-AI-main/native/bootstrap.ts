/**
 * One-shot native shell setup. Called from main.tsx; no-ops on the website.
 */

import { isNativeApp } from './platform';

export async function bootstrapNativeShell(): Promise<void> {
  if (!(await isNativeApp())) return;
  document.documentElement.classList.add('native-app');
  // Push needs android/app/google-services.json. Calling register() without
  // it crashes the process on launch (app opens, then immediately closes).
}
