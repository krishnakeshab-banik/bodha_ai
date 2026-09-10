/**
 * Android speech recognition. WebView has no webkitSpeechRecognition,
 * so the packaged app must use the Capacitor plugin + RECORD_AUDIO.
 */

import { isNativeApp } from './platform';

export async function nativeSpeechAvailable(): Promise<boolean> {
  if (!(await isNativeApp())) return false;
  try {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    const status = await SpeechRecognition.available();
    return Boolean(status.available);
  } catch {
    return false;
  }
}

export async function requestNativeMicPermission(): Promise<boolean> {
  if (!(await isNativeApp())) return false;
  try {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    let permission = await SpeechRecognition.checkPermissions();
    if (permission.speechRecognition !== 'granted') {
      permission = await SpeechRecognition.requestPermissions();
    }
    return permission.speechRecognition === 'granted';
  } catch {
    return false;
  }
}

export function createNativeSpeechListener(options: {
  locale: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onDenied: () => void;
}): { start: () => void; stop: () => void } {
  let wanted = false;
  let last = '';
  let starting = false;
  let restartTimer = 0;

  const stopPlugin = async () => {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      await SpeechRecognition.stop();
    } catch {
      /* not listening */
    }
  };

  const listen = async () => {
    if (!wanted || starting) return;
    starting = true;
    last = '';
    try {
      const granted = await requestNativeMicPermission();
      if (!granted) {
        wanted = false;
        options.onDenied();
        return;
      }
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener('partialResults', (data) => {
        const text = (data.matches?.[0] ?? '').trim();
        if (!text) return;
        last = text;
        options.onInterim(text);
      });
      await SpeechRecognition.addListener('listeningState', (data) => {
        if (data.status !== 'stopped' || !wanted) return;
        const text = last.trim();
        last = '';
        if (text.length >= 2) options.onFinal(text);
        window.clearTimeout(restartTimer);
        restartTimer = window.setTimeout(() => {
          void listen();
        }, 400);
      });
      await SpeechRecognition.start({
        language: options.locale,
        maxResults: 3,
        partialResults: true,
        popup: false,
      });
    } catch {
      if (!wanted) return;
      // One-shot Google dialog if silent listening is unavailable.
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        const result = await SpeechRecognition.start({
          language: options.locale,
          maxResults: 1,
          partialResults: false,
          popup: true,
        });
        const text = (result.matches?.[0] ?? '').trim();
        if (text.length >= 2) options.onFinal(text);
        window.clearTimeout(restartTimer);
        restartTimer = window.setTimeout(() => {
          void listen();
        }, 500);
      } catch {
        options.onDenied();
      }
    } finally {
      starting = false;
    }
  };

  return {
    start() {
      wanted = true;
      void listen();
    },
    stop() {
      wanted = false;
      window.clearTimeout(restartTimer);
      void stopPlugin();
    },
  };
}
