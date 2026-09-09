/** Spoken reply language, including Hinglish (Latin + Hindi words). */
export type SpokenLanguage = 'en' | 'hi' | 'ta' | 'hinglish';

const HINGLISH =
  /\b(kya|hai|hain|kaise|kahan|kyun|kyu|kitna|kitne|karo|karna|chahiye|please|bhai|yaar|nahi|nahin|accha|theek|samajh|batao|bataye|price|sell|amazon|flipkart|ka|ki|ke|mein|me|aur|wala|wali)\b/i;

export function detectSpokenLanguage(text: string, fallback: SpokenLanguage = 'en'): SpokenLanguage {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  const latin = text.replace(/[^\p{L}\s]/gu, ' ');
  const hasLatin = /[A-Za-z]/.test(latin);
  if (hasLatin && HINGLISH.test(text)) return 'hinglish';
  if (/[A-Za-z]/.test(text)) return 'en';
  return fallback;
}

export function languageInstruction(language: SpokenLanguage): string {
  if (language === 'hi') return 'Reply in natural Hindi (Devanagari). Do not mix English except marketplace names.';
  if (language === 'ta') return 'Reply in natural Tamil. Do not mix English except marketplace names and ₹ amounts.';
  if (language === 'hinglish') {
    return 'Reply in Hinglish — natural spoken Hindi in Latin script mixed with simple English, the way Indian sellers talk. Example tone: "Amazon pe demand zyada hai, lekin fee bhi high hai."';
  }
  return 'Reply in clear English.';
}

export function speechLocale(language: SpokenLanguage): string {
  if (language === 'ta') return 'ta-IN';
  if (language === 'hi' || language === 'hinglish') return 'hi-IN';
  return 'en-IN';
}
