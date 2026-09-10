import { createNativeSpeechListener, nativeSpeechAvailable } from '@native/speech';

import { SPEECH_LOCALES, type AppLanguage } from '../../i18n';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal?: boolean;
    0: { transcript: string; confidence?: number };
    length: number;
  }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function canUseSpeechRecognition(): boolean {
  return Boolean(recognitionCtor());
}

function bestTranscript(result: SpeechRecognitionEventLike['results'][number]): string {
  return (result[0]?.transcript ?? '').trim();
}

export function createFallbackListener(options: {
  language: AppLanguage;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onDenied: () => void;
}): { start: () => void; stop: () => void } {
  if (import.meta.env.MODE === 'android') {
    const native = createNativeSpeechListener({
      locale: SPEECH_LOCALES[options.language],
      onInterim: options.onInterim,
      onFinal: options.onFinal,
      onDenied: options.onDenied,
    });
    return {
      start() {
        void nativeSpeechAvailable().then((available) => {
          if (available) native.start();
        });
      },
      stop: native.stop,
    };
  }

  const Ctor = recognitionCtor();
  if (!Ctor) {
    return { start() {}, stop() {} };
  }

  let recognition: SpeechRecognitionLike | null = null;
  let wanted = true;
  let restartTimer = 0;

  const attach = () => {
    const instance = new Ctor();
    instance.lang = SPEECH_LOCALES[options.language];
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 3;
    instance.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = bestTranscript(result);
        if (!text) continue;
        if (result.isFinal) {
          if (text.length >= 2) options.onFinal(text);
          interim = '';
        } else {
          interim = text;
        }
      }
      if (interim) options.onInterim(interim);
    };
    instance.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wanted = false;
        options.onDenied();
      }
    };
    instance.onend = () => {
      recognition = null;
      if (!wanted) return;
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (wanted) attach();
      }, 280);
    };
    recognition = instance;
    try {
      instance.start();
    } catch {
      /* already started */
    }
  };

  return {
    start() {
      wanted = true;
      if (recognition) return;
      attach();
    },
    stop() {
      wanted = false;
      window.clearTimeout(restartTimer);
      const instance = recognition;
      recognition = null;
      if (!instance) return;
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      try {
        instance.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

export function pickSpeechVoice(language: AppLanguage): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const wanted = SPEECH_LOCALES[language].toLowerCase();
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === wanted) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(language + '-')) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(language)) ??
    null
  );
}

export function speakText(
  text: string,
  language: AppLanguage,
  handlers: { onstart: () => void; onend: () => void },
): boolean {
  if (typeof speechSynthesis === 'undefined') return false;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LOCALES[language];
    const voice = pickSpeechVoice(language);
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      handlers.onend();
    };
    const watchdog = window.setTimeout(done, Math.min(20_000, Math.max(2_400, text.length * 70)));
    utterance.onstart = handlers.onstart;
    utterance.onend = done;
    utterance.onerror = done;
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
}
