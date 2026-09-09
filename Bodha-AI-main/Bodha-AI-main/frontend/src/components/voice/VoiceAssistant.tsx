import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useMatch } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { LANGUAGE_LABELS, resolveAppLanguage, SPEECH_LOCALES } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../hooks/useProducts';
import { api } from '../../services/api';
import type { AnalysisResponse } from '../../types';
import { cx } from '../../utils/format';

type SpokenLanguage = 'en' | 'hi' | 'ta' | 'hinglish';

function detectSpokenLanguage(text: string, fallback: SpokenLanguage): SpokenLanguage {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (
    /[A-Za-z]/.test(text) &&
    /\b(kya|hai|kaise|kahan|kyun|kitna|chahiye|bhai|nahi|batao|ka|ke|mein|aur)\b/i.test(text)
  ) {
    return 'hinglish';
  }
  if (/[A-Za-z]/.test(text)) return 'en';
  return fallback;
}

function speechLocaleFor(language: SpokenLanguage): string {
  if (language === 'ta') return 'ta-IN';
  if (language === 'hi' || language === 'hinglish') return 'hi-IN';
  return 'en-IN';
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const win = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function compactReport(analysis: AnalysisResponse) {
  return {
    productId: analysis.productId,
    title: analysis.title,
    recommendedPlatform: analysis.recommendedPlatform,
    recommendedPrice: analysis.recommendedPrice,
    currentPrice: analysis.currentPrice,
    manufacturingCost: analysis.manufacturingCost,
    platforms: analysis.platforms.map((platform) => ({
      name: platform.name,
      fitScore: platform.fitScore,
      listingCount: platform.listingCount,
      recommendedPrice: platform.recommendedPrice,
      estimatedProfit: platform.estimatedProfit,
      demand: platform.demand,
      competition: platform.competition,
      feePercent: platform.feePercent,
      marketPrice: platform.marketPrice,
      breakEvenPrice: platform.breakEvenPrice,
      explanation: platform.explanation,
      unavailable: platform.unavailable,
      lossRiskAvoided: platform.lossRiskAvoided,
    })),
    optimizedListing: analysis.optimizedListing,
    insights: analysis.insights
      ? {
          competitors: analysis.insights.competitors.map((item) => item.title),
          topPraises: analysis.insights.reviewSentiment.topPraises,
          topComplaints: analysis.insights.reviewSentiment.topComplaints,
          demandStates: analysis.insights.regionalDemand.states.slice(0, 5),
        }
      : undefined,
  };
}

function pickVoice(locale: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const prefix = locale.slice(0, 2).toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? null;
}

function pageName(pathname: string): string {
  if (pathname.startsWith('/report')) return 'report';
  if (pathname.startsWith('/analyze')) return 'analyze';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return 'home';
}

/**
 * Persistent floating mic. Opens a chat panel, transcribes in the site language,
 * asks the backend, then speaks the answer (or shows a TTS fallback notice).
 */
export function VoiceAssistant() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language);
  const locale = SPEECH_LOCALES[language];
  const location = useLocation();
  const reportMatch = useMatch('/report/:productId');
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voicesReady, setVoicesReady] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const Recognition = useMemo(() => getSpeechRecognitionCtor(), []);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const bump = () => setVoicesReady((count) => count + 1);
    window.speechSynthesis.addEventListener('voiceschanged', bump);
    bump();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', bump);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, processing]);

  const speak = useCallback(
    (text: string, spoken: SpokenLanguage) => {
      if (!window.speechSynthesis) {
        setTtsNotice(t('voice.ttsMissing', { language: LANGUAGE_LABELS[language] }));
        return;
      }
      const replyLocale = speechLocaleFor(spoken);
      const voice = pickVoice(replyLocale);
      if (!voice && spoken === 'ta') {
        window.speechSynthesis.cancel();
        setTtsNotice(t('voice.ttsMissing', { language: LANGUAGE_LABELS.ta }));
        return;
      }
      setTtsNotice(
        voice || spoken === 'en' ? null : t('voice.ttsMissing', { language: LANGUAGE_LABELS[spoken === 'hinglish' ? 'hi' : spoken] }),
      );
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = replyLocale;
      if (voice) utterance.voice = voice;
      void voicesReady;
      window.speechSynthesis.speak(utterance);
    },
    [language, t, voicesReady],
  );

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processing) return;

      setError(null);
      setDraft('');
      setTurns((current) => [
        ...current,
        { id: 'u-' + Date.now(), role: 'user', text: trimmed },
      ]);
      setProcessing(true);

      const productId = user ? reportMatch?.params.productId : undefined;
      const cached =
        user && productId
          ? queryClient.getQueryData<AnalysisResponse>(queryKeys.product(productId))
          : undefined;
      const spoken = detectSpokenLanguage(trimmed, language);

      try {
        const response = await api.askVoice({
          text: trimmed,
          language: spoken,
          context: {
            productId,
            page: pageName(location.pathname),
            currentReport: cached ? compactReport(cached) : undefined,
          },
        });
        setTurns((current) => [
          ...current,
          { id: 'a-' + Date.now(), role: 'assistant', text: response.answer },
        ]);
        speak(response.answer, response.language ?? spoken);
      } catch {
        setError(t('voice.error'));
      } finally {
        setProcessing(false);
      }
    },
    [language, location.pathname, processing, queryClient, reportMatch, speak, t, user],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!Recognition) return;
    stopListening();
    const recognition = new Recognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setListening(false);
      if (transcript.trim()) void ask(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setListening(false);
    }
  }, [Recognition, ask, locale, stopListening]);

  function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (Recognition) startListening();
    } else {
      stopListening();
      window.speechSynthesis?.cancel();
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-x-3 bottom-24 z-50 max-h-[min(70dvh,28rem)] overflow-hidden border border-rule bg-paper sm:inset-x-auto sm:right-6 sm:w-[min(100%-2rem,22rem)]"
          role="dialog"
          aria-label={t('voice.title')}
        >
          <div className="flex items-start justify-between gap-3 border-b border-rule bg-[#faf8f3] px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-ink">{t('voice.title')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                {user ? t('voice.hintSignedIn') : t('voice.hintGuest')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                stopListening();
                window.speechSynthesis?.cancel();
              }}
              className="p-1.5 text-ink-muted hover:text-ink"
              aria-label={t('voice.close')}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="max-h-[40dvh] space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
            {turns.length === 0 && !processing && (
              <p className="text-sm leading-relaxed text-ink-muted">
                {user ? t('voice.idle') : t('voice.idleGuest')}
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
            {processing && <p className="text-xs font-semibold text-brand-600">{t('voice.processing')}</p>}
            {listening && <p className="text-xs font-semibold text-brand-600">{t('voice.listening')}</p>}
            {ttsNotice && (
              <p role="status" className="rounded-lg bg-risk-50 px-3 py-2 text-xs leading-relaxed text-risk-700">
                {ttsNotice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs font-medium text-danger-600">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex min-w-0 flex-wrap gap-2 border-t border-rule p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            {Recognition && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className={cx(
                  'rounded-sm px-3 text-sm font-medium',
                  listening ? 'bg-danger-50 text-danger-700' : 'bg-[#faf8f3] text-ink ring-1 ring-inset ring-rule',
                )}
              >
                {listening ? t('voice.stop') : t('voice.speak')}
              </button>
            )}
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={Recognition ? t('voice.typePlaceholder') : t('voice.unsupported')}
              className="field min-w-0 flex-1 !py-2"
            />
            <button
              type="submit"
              disabled={processing || !draft.trim()}
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
          'fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lifted transition sm:right-6',
          open || listening ? 'bg-[#0c3d2e]' : 'bg-[#0d6b4c] hover:bg-[#0a5540]',
        )}
        aria-label={open ? t('voice.close') : t('voice.open')}
        aria-expanded={open}
      >
        {listening ? (
          <span className="h-4 w-4 animate-pulse rounded-full bg-white" />
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v3" />
          </svg>
        )}
      </button>
    </>
  );
}
