/** Spoken reply language, including Hinglish (Latin + Hindi words). */
export type SpokenLanguage = 'en' | 'hi' | 'ta' | 'hinglish';

const HINDI_MARKERS =
  /\b(kya|hai|hain|kaise|kahan|kyun|kyu|kitna|kitne|karo|karna|chahiye|bhai|yaar|nahi|nahin|accha|theek|samajh|batao|bataye|wala|wali)\b/gi;

export function countHindiMarkers(text: string): number {
  return text.match(HINDI_MARKERS)?.length ?? 0;
}

export function detectSpokenLanguage(text: string, preferred: SpokenLanguage = 'en'): SpokenLanguage {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (countHindiMarkers(text) >= 2) return 'hinglish';
  if (/[A-Za-z]/.test(text)) return preferred === 'hinglish' ? 'en' : preferred;
  return preferred;
}

export function resolveReplyLanguage(text: string, preferred: SpokenLanguage = 'en'): SpokenLanguage {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (countHindiMarkers(text) >= 2) return preferred === 'hi' ? 'hi' : 'hinglish';
  if (/[A-Za-z]/.test(text)) return 'en';
  return preferred;
}

export function languageInstruction(language: SpokenLanguage): string {
  if (language === 'hi') {
    return 'Reply only in natural Hindi (Devanagari). Do not reply in English except marketplace names and ₹ amounts.';
  }
  if (language === 'ta') {
    return 'Reply only in natural Tamil. Do not reply in English except marketplace names and ₹ amounts.';
  }
  if (language === 'hinglish') {
    return 'Reply only in Hinglish — spoken Hindi in Latin script mixed with simple English. Do not switch to full Hindi or full English.';
  }
  return 'Reply only in clear English. Do not reply in Hindi or Tamil.';
}

export function speechLocale(language: SpokenLanguage): string {
  if (language === 'ta') return 'ta-IN';
  if (language === 'hi' || language === 'hinglish') return 'hi-IN';
  return 'en-IN';
}

export function toUiLanguage(language: SpokenLanguage): 'en' | 'hi' | 'ta' {
  if (language === 'ta') return 'ta';
  if (language === 'hi' || language === 'hinglish') return 'hi';
  return 'en';
}
