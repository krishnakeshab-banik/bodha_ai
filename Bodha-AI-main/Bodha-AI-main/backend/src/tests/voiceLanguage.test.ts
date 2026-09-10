import { describe, expect, it } from 'vitest';

import { detectSpokenLanguage, resolveReplyLanguage } from '../services/voiceLanguage.js';

describe('resolveReplyLanguage', () => {
  it('keeps English questions in English even if they mention sell or price', () => {
    expect(resolveReplyLanguage('What price should I sell on Amazon?', 'en')).toBe('en');
    expect(detectSpokenLanguage('What price should I sell on Amazon?', 'en')).toBe('en');
  });

  it('replies in Hindi when the seller used Devanagari', () => {
    expect(resolveReplyLanguage('मुझे कहाँ बेचना चाहिए', 'en')).toBe('hi');
  });

  it('replies in Tamil when the seller used Tamil script', () => {
    expect(resolveReplyLanguage('எங்கே விற்க வேண்டும்', 'en')).toBe('ta');
  });

  it('keeps Latin English in English even if Hindi is selected', () => {
    expect(resolveReplyLanguage('Where should I sell this product?', 'hi')).toBe('en');
    expect(resolveReplyLanguage('Where should I sell this product?', 'en')).toBe('en');
  });
});
