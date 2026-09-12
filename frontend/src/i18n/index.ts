import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  hi: 'हिंदी',
  ta: 'தமிழ்',
};

export const SPEECH_LOCALES: Record<AppLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

export function isAppLanguage(value: string | undefined | null): value is AppLanguage {
  return value === 'en' || value === 'hi' || value === 'ta';
}

export function resolveAppLanguage(value: string | undefined | null): AppLanguage {
  if (!value) return 'en';
  const short = value.slice(0, 2).toLowerCase();
  return isAppLanguage(short) ? short : 'en';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'bodha.lang',
      caches: ['localStorage'],
    },
  });

function applyDocumentLanguage(language: string): void {
  const resolved = resolveAppLanguage(language);
  document.documentElement.lang = resolved;
}

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
