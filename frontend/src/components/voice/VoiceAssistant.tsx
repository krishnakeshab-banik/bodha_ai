import { useCallback, useEffect, useRef, useState } from 'react';
import { Conversation } from '@elevenlabs/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useMatch } from 'react-router-dom';

import { resolveAppLanguage, type AppLanguage } from '../../i18n';
import { requestNativeMicPermission } from '@native/speech';

import { ApiError, api } from '../../services/api';
import { cx } from '../../utils/format';
import { createFallbackListener, speakText, stopSpeaking } from './fallbackSpeech';

const ELEVENLABS_AGENT_ID =
  import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_3301m2486d2qecasbeht51m4ef4t';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

type VoiceSession = Awaited<ReturnType<typeof Conversation.startSession>>;
type Engine = 'elevenlabs' | 'fallback';

let liveSession: VoiceSession | null = null;
let liveGeneration = 0;

function messageText(message: unknown): string {
  if (typeof message === 'string') return message.trim();
  if (!message || typeof message !== 'object') return '';
  const record = message as { message?: unknown; text?: unknown };
  if (typeof record.message === 'string') return record.message.trim();
  if (typeof record.text === 'string') return record.text.trim();
  return '';
}

function messageRole(message: unknown): ChatTurn['role'] {
  if (!message || typeof message !== 'object') return 'assistant';
  const record = message as { source?: unknown; role?: unknown };
  if (record.source === 'user' || record.role === 'user') return 'user';
  return 'assistant';
}

function isElevenLabsUnavailable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('credit') ||
    lower.includes('upgrade your plan') ||
    lower.includes('payment required') ||
    lower.includes('402')
  );
}

function VoiceAssistantInner() {
  const { t, i18n } = useTranslation();
  const siteLanguage = resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [voiceLang, setVoiceLang] = useState<AppLanguage>(siteLanguage);
  const location = useLocation();
  const reportMatch = useMatch('/report/:productId');
  const productId = reportMatch?.params.productId;

  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState<Engine>('elevenlabs');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [mode, setMode] = useState<'listening' | 'speaking' | 'processing'>('listening');
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userClosedRef = useRef(false);
  const engineRef = useRef<Engine>('elevenlabs');
  const mutedRef = useRef(false);
  const listenerRef = useRef<ReturnType<typeof createFallbackListener> | null>(null);
  const askFallbackRef = useRef<(text: string, spokenLanguage: AppLanguage) => Promise<void>>(
    async () => undefined,
  );
  const voiceLangRef = useRef<AppLanguage>(siteLanguage);

  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const speaking = mode === 'speaking';
  const processing = mode === 'processing';
  const active = open && (connecting || connected);
  const usingFallback = engine === 'fallback';

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    voiceLangRef.current = voiceLang;
  }, [voiceLang]);

  useEffect(() => {
    if (!liveSession) return;
    setOpen(true);
    setStatus('connected');
    setEngine('elevenlabs');
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, connecting, speaking, processing]);

  const stopRecognition = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
  }, []);

  const stopFallbackAudio = useCallback(() => {
    stopRecognition();
    stopSpeaking();
  }, [stopRecognition]);

  const startListening = useCallback(() => {
    if (engineRef.current !== 'fallback' || mutedRef.current || userClosedRef.current) return;
    stopRecognition();
    const listener = createFallbackListener({
      language: voiceLangRef.current,
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft('');
        void askFallbackRef.current(text, voiceLangRef.current);
      },
      onDenied: () => setError(t('voice.micDenied')),
    });
    listenerRef.current = listener;
    listener.start();
  }, [stopRecognition, t]);

  const speakAnswer = useCallback(
    (text: string, replyLanguage: AppLanguage) => {
      const spoken = speakText(text, replyLanguage, {
        onstart: () => setMode('speaking'),
        onend: () => {
          setMode('listening');
          startListening();
        },
      });
      if (!spoken) {
        setMode('listening');
        startListening();
      }
    },
    [startListening],
  );

  const askFallback = useCallback(
    async (text: string, spokenLanguage: AppLanguage) => {
      const trimmed = text.trim();
      if (!trimmed || userClosedRef.current) return;
      stopRecognition();
      setTurns((current) => [...current, { id: 'u-' + Date.now(), role: 'user', text: trimmed }]);
      setMode('processing');
      setError(null);
      try {
        const result = await api.askVoiceQuery({
          text: trimmed,
          language: spokenLanguage,
          context: { productId, page: location.pathname },
        });
        if (userClosedRef.current) return;
        setTurns((current) => [
          ...current,
          { id: 'a-' + Date.now(), role: 'assistant', text: result.answer },
        ]);
        const replyLanguage =
          result.language === 'hinglish' ? 'hi' : resolveAppLanguage(result.language);
        speakAnswer(result.answer, replyLanguage);
      } catch (err) {
        if (userClosedRef.current) return;
        if (
          err instanceof ApiError &&
          err.status === 0 &&
          /how|work|bodha|कैसे|எப்படி|kya hai/i.test(trimmed)
        ) {
          const local = t('home.subhead');
          setTurns((current) => [
            ...current,
            { id: 'a-' + Date.now(), role: 'assistant', text: local },
          ]);
          speakAnswer(local, spokenLanguage);
          return;
        }
        setMode('listening');
        setError(
          err instanceof ApiError && err.status === 0 ? t('voice.networkError') : t('voice.error'),
        );
        startListening();
      }
    },
    [location.pathname, productId, speakAnswer, startListening, stopRecognition, t],
  );

  useEffect(() => {
    askFallbackRef.current = askFallback;
  }, [askFallback]);

  const beginFallback = useCallback(
    (generation: number) => {
      if (generation !== liveGeneration || userClosedRef.current) return;
      engineRef.current = 'fallback';
      setEngine('fallback');
      setStatus('connected');
      setMode('listening');
      setMuted(false);
      setError(null);
      void requestNativeMicPermission();
      const greeting = productId
        ? t('voice.fallbackGreetingReport', { lng: voiceLangRef.current })
        : t('voice.fallbackGreeting', { lng: voiceLangRef.current });
      setTurns([{ id: 'a-greet', role: 'assistant', text: greeting }]);
      speakAnswer(greeting, voiceLangRef.current);
      window.setTimeout(() => {
        if (generation === liveGeneration && !userClosedRef.current && !mutedRef.current) {
          startListening();
        }
      }, 2_200);
    },
    [productId, speakAnswer, startListening, t],
  );

  const stopSession = useCallback(async () => {
    userClosedRef.current = true;
    liveGeneration += 1;
    setStatus('idle');
    setMode('listening');
    setEngine('elevenlabs');
    engineRef.current = 'elevenlabs';
    stopFallbackAudio();
    const session = liveSession;
    liveSession = null;
    if (session) {
      try {
        await session.endSession();
      } catch {
        /* already closed */
      }
    }
  }, [stopFallbackAudio]);

  const startSession = useCallback(async () => {
    userClosedRef.current = false;
    const generation = ++liveGeneration;
    setError(null);
    setTurns([]);
    setDraft('');
    setMuted(false);
    setMode('listening');
    setEngine('elevenlabs');
    engineRef.current = 'elevenlabs';
    setStatus('connecting');
    stopFallbackAudio();

    if (import.meta.env.MODE === 'android') {
      beginFallback(generation);
      return;
    }

    if (liveSession) {
      try {
        await liveSession.endSession();
      } catch {
        /* replace */
      }
      liveSession = null;
    }

    let usedFallback = false;
    const fallback = (message?: string) => {
      if (generation !== liveGeneration || userClosedRef.current || usedFallback) return;
      if (message && !isElevenLabsUnavailable(message) && liveSession) {
        setError(message);
        return;
      }
      usedFallback = true;
      if (liveSession) {
        void liveSession.endSession().catch(() => undefined);
        liveSession = null;
      }
      beginFallback(generation);
    };

    try {
      const session = await Conversation.startSession({
        agentId: ELEVENLABS_AGENT_ID,
        connectionType: 'websocket',
        onConnect: () => {
          if (generation !== liveGeneration || userClosedRef.current) return;
          setStatus('connected');
          setError(null);
        },
        onDisconnect: () => {
          if (generation !== liveGeneration) return;
          if (liveSession) liveSession = null;
          if (engineRef.current === 'fallback') return;
          setStatus('idle');
          setMode('listening');
        },
        onMessage: (message) => {
          const text = messageText(message);
          if (!text) return;
          const role = messageRole(message);
          setTurns((current) => {
            const last = current[current.length - 1];
            if (last && last.role === role && last.text === text) return current;
            return [...current, { id: role[0] + '-' + Date.now(), role, text }];
          });
        },
        onError: (message) => {
          if (generation !== liveGeneration || userClosedRef.current) return;
          const detail = typeof message === 'string' ? message.trim() : '';
          if (isElevenLabsUnavailable(detail) || !liveSession) {
            fallback(detail);
            return;
          }
          if (!detail || detail.toLowerCase().includes('unknown error')) return;
          setError(detail);
        },
        onModeChange: ({ mode: next }) => {
          if (generation !== liveGeneration || engineRef.current !== 'elevenlabs') return;
          setMode(next === 'speaking' ? 'speaking' : 'listening');
        },
      });

      if (generation !== liveGeneration || userClosedRef.current || usedFallback) {
        await session.endSession().catch(() => undefined);
        return;
      }
      liveSession = session;
    } catch (caught) {
      fallback(caught instanceof Error ? caught.message : '');
    }
  }, [beginFallback, stopFallbackAudio]);

  function togglePanel() {
    if (open) {
      setOpen(false);
      void stopSession();
      return;
    }
    setOpen(true);
    void startSession();
  }

  function sendTyped(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    if (engine === 'elevenlabs' && liveSession && connected) {
      setTurns((current) => [...current, { id: 'u-' + Date.now(), role: 'user', text: trimmed }]);
      liveSession.sendUserMessage(trimmed);
      return;
    }
    void askFallback(trimmed, voiceLang);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (engine === 'elevenlabs') {
      liveSession?.setMicMuted(next);
      return;
    }
    if (next) {
      stopRecognition();
      return;
    }
    startListening();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-x-3 bottom-28 z-50 max-h-[min(62dvh,28rem)] overflow-hidden border border-rule bg-paper md:bottom-24 sm:inset-x-auto sm:right-6 sm:w-[min(100%-2rem,22rem)]"
          role="dialog"
          aria-label={t('voice.title')}
        >
          <div className="flex items-start justify-between gap-3 border-b border-rule bg-[#faf8f3] px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-ink">{t('voice.title')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                {usingFallback
                  ? import.meta.env.MODE === 'android'
                    ? t('voice.androidHint')
                    : t('voice.fallbackHint')
                  : productId
                    ? t('voice.hintSignedIn')
                    : t('voice.hintGuest')}
              </p>
              {usingFallback && (
                <div className="mt-2 flex gap-1" role="group" aria-label={t('voice.language')}>
                  {(['en', 'hi', 'ta'] as AppLanguage[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setVoiceLang(code);
                        voiceLangRef.current = code;
                        if (connected && !muted) startListening();
                      }}
                      className={cx(
                        'px-2 py-0.5 text-[11px] font-medium',
                        voiceLang === code
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-ink-muted ring-1 ring-rule',
                      )}
                    >
                      {code === 'en' ? 'EN' : code === 'hi' ? 'हि' : 'த'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {connected && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-ink-muted hover:text-ink"
                  aria-label={muted ? t('voice.unmute') : t('voice.mute')}
                  aria-pressed={muted}
                >
                  {muted ? (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
                      <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v3M4 4l16 16" />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
                      <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v3" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void stopSession();
                }}
                className="p-1.5 text-ink-muted hover:text-ink"
                aria-label={t('voice.close')}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={listRef} className="max-h-[40dvh] space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
            {turns.length === 0 && !connecting && (
              <p className="text-sm leading-relaxed text-ink-muted">
                {productId ? t('voice.idle') : t('voice.idleGuest')}
              </p>
            )}
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={cx(
                  'break-words px-3 py-2 text-sm leading-relaxed',
                  turn.role === 'user'
                    ? 'ml-6 bg-brand-600 text-white'
                    : 'mr-6 bg-[#faf8f3] text-ink ring-1 ring-inset ring-rule',
                )}
              >
                {turn.text}
              </div>
            ))}
            {connecting && (
              <p className="text-xs font-semibold text-brand-600">{t('voice.connecting')}</p>
            )}
            {connected && speaking && (
              <p className="text-xs font-semibold text-brand-600">{t('voice.speaking')}</p>
            )}
            {connected && processing && (
              <p className="text-xs font-semibold text-brand-600">{t('voice.processing')}</p>
            )}
            {connected && !speaking && !processing && !muted && (
              <p className="text-xs font-semibold text-brand-600">{t('voice.listening')}</p>
            )}
            {connected && muted && (
              <p className="text-xs font-semibold text-ink-muted">{t('voice.muted')}</p>
            )}
            {error && (
              <p role="alert" className="text-xs font-medium text-danger-600">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex min-w-0 gap-2 border-t border-rule p-3"
            onSubmit={(event) => {
              event.preventDefault();
              sendTyped(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('voice.typePlaceholder')}
              className="field min-w-0 flex-1 !py-2"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-sm bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('voice.send')}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={togglePanel}
        className={cx(
          'fixed bottom-[5.75rem] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lifted transition md:bottom-6 sm:right-6',
          active ? 'bg-[#0c3d2e]' : 'bg-[#0d6b4c] hover:bg-[#0a5540]',
        )}
        aria-label={open ? t('voice.close') : t('voice.open')}
        aria-expanded={open}
      >
        {active ? (
          <span className="h-4 w-4 animate-pulse rounded-full bg-white" />
        ) : (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v3" />
          </svg>
        )}
      </button>
    </>
  );
}

export function VoiceAssistant() {
  return <VoiceAssistantInner />;
}
