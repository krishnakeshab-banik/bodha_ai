/**
 * Voice agent: website help for everyone; product insights only when signed in.
 * Replies in the language the seller actually spoke (en / hi / ta / Hinglish).
 */

import { findAnalysisById } from '../models/productRepository.js';
import { generateText, hasGeminiKey } from './geminiService.js';
import type { AnalysisRecord } from '../types/index.js';
import {
  detectSpokenLanguage,
  languageInstruction,
  type SpokenLanguage,
} from './voiceLanguage.js';

export interface VoiceContext {
  productId?: string;
  page?: string;
  currentReport?: unknown;
  authenticated?: boolean;
}

export interface VoiceQuery {
  text: string;
  language?: SpokenLanguage;
  context?: VoiceContext;
}

const SITE_HINT =
  /bodha|sign ?up|sign ?in|log ?in|account|password|pricing|credit|subscribe|razorpay|home|how (do|to)|kya hai|kaise|kahan|website|page|dashboard|analy|onboard|store|fee|commission|amazon|flipkart|snapdeal|alibaba|break.?even|marketplace|platform|sell|कहाँ|कैसे|क्या|साइन|लॉग|कीमत|विश्लेषण|எப்படி|என்ன|விலை|கணக்கு/i;

const INSIGHT_HINT =
  /recommend|competitor|insight|review|complaint|praise|trend|listing|keyword|title|my product|this report|fit.?score|profit|demand|why (did|this)|सुझा|प्रतियोग|समीक्षा|பரிந்துரை|போட்டி|விமர்சன/i;

function compactReport(record: AnalysisRecord): Record<string, unknown> {
  return {
    title: record.title,
    recommendedPlatform: record.recommendedPlatform,
    recommendedPrice: record.recommendedPrice,
    currentPrice: record.currentPrice,
    manufacturingCost: record.manufacturingCost,
    platforms: record.platforms.map((platform) => ({
      name: platform.name,
      fitScore: platform.fitScore,
      listingCount: platform.listingCount,
      recommendedPrice: platform.recommendedPrice,
      estimatedProfit: platform.estimatedProfit,
      profitMargin: platform.profitMargin,
      demand: platform.demand,
      competition: platform.competition,
      feePercent: platform.feePercent,
      marketPrice: platform.marketPrice,
      marketPriceRange: platform.marketPriceRange,
      breakEvenPrice: platform.breakEvenPrice,
      explanation: platform.explanation,
      unavailable: platform.unavailable,
      lossRiskAvoided: platform.lossRiskAvoided,
      dataFreshness: platform.dataFreshness,
    })),
    optimizedListing: record.optimizedListing,
    insights: {
      competitors: record.insights.competitors.map((item) => item.title),
      topPraises: record.insights.reviewSentiment.topPraises,
      topComplaints: record.insights.reviewSentiment.topComplaints,
      demandStates: record.insights.regionalDemand.states.slice(0, 5),
    },
  };
}

function resolveReport(context?: VoiceContext): Record<string, unknown> | null {
  if (!context?.authenticated) return null;
  if (context.productId) {
    const record = findAnalysisById(context.productId);
    if (record) return compactReport(record);
  }
  if (context.currentReport && typeof context.currentReport === 'object') {
    return context.currentReport as Record<string, unknown>;
  }
  return null;
}

function say(language: SpokenLanguage, copy: Record<SpokenLanguage, string>): string {
  return copy[language];
}

function loginGate(language: SpokenLanguage): string {
  return say(language, {
    en: 'I can explain how Bodha AI works, but product insights and your reports are only available after you sign in. Create a free account to analyse a product.',
    hi: 'मैं साइट के बारे में बता सकता हूँ, लेकिन प्रोडक्ट इनसाइट और आपकी रिपोर्ट साइन-इन के बाद ही मिलती है। मुफ़्त खाता बनाकर विश्लेषण शुरू करें।',
    ta: 'நான் தளத்தைப் பற்றி சொல்லலாம். தயாரிப்பு நுண்ணறிவும் உங்கள் அறிக்கையும் உள்நுழைந்த பிறகுதான். இலவச கணக்கு உருவாக்கி பகுப்பாய்வு செய்யுங்கள்.',
    hinglish: 'Website ke baare mein bata sakta hoon, lekin product insights aur aapki report sign-in ke baad hi milengi. Free account banao, phir analyse karo.',
  });
}

function offTopic(language: SpokenLanguage): string {
  return say(language, {
    en: 'I only help with Bodha AI — signing in, credits, how Analyze works, marketplaces and (after login) your product report. I cannot answer general-knowledge questions.',
    hi: 'मैं केवल Bodha AI पर मदद करता हूँ — साइन-इन, क्रेडिट, Analyze कैसे चलता है, मार्केटप्लेस और लॉगिन के बाद आपकी रिपोर्ट। सामान्य ज्ञान के प्रश्न नहीं लेता।',
    ta: 'நான் Bodha AI பற்றி மட்டுமே உதவுகிறேன் — உள்நுழைவு, கிரெடிட், Analyze எப்படி வேலை செய்கிறது, சந்தைகள் மற்றும் உள்நுழைவுக்குப் பிறகு உங்கள் அறிக்கை.',
    hinglish: 'Main sirf Bodha AI pe help karta hoon — login, credits, Analyze kaise chalta hai, marketplaces, aur login ke baad aapki report. General GK nahi.',
  });
}

function siteAnswer(query: VoiceQuery, language: SpokenLanguage): string {
  const text = query.text;
  const asksCredits = /credit|free|6|subscribe|razorpay|pro|\$10|कीमत|प्लान|கிரெடிட்/i.test(text);
  const asksAuth = /sign ?up|sign ?in|log ?in|account|onboard|store|खाता|साइन|கணக்கு/i.test(text);
  const asksHow = /how|kaise|कैसे|எப்படி|analy|dashboard|work/i.test(text);

  if (asksCredits) {
    return say(language, {
      en: 'New sellers get 6 free product analyses each month. After that, Pro is $10 a month via Razorpay test checkout — open Pricing. Analyze and Dashboard stay locked until you sign in.',
      hi: 'नए सेलर को हर महीने 6 मुफ़्त विश्लेषण मिलते हैं। उसके बाद Pro $10/महीना है, Razorpay टेस्ट से — Pricing खोलें। Analyze और Dashboard साइन-इन के बिना नहीं खुलते।',
      ta: 'புதிய விற்பனையாளருக்கு மாதம் 6 இலவச பகுப்பாய்வு. அதற்கு மேல் Pro $10/மாதம், Razorpay சோதனை — Pricing திறக்கவும். உள்நுழையாமல் Analyze மற்றும் Dashboard திறக்காது.',
      hinglish: 'Naye sellers ko mahine mein 6 free analyses milte hain. Uske baad Pro $10/month Razorpay test se — Pricing page kholo. Bina login Analyze aur Dashboard nahi khulte.',
    });
  }

  if (asksAuth) {
    return say(language, {
      en: 'Use Sign up, then a short store setup — business name, city and main category. After that you can run Analyze. Sign in anytime to open Dashboard.',
      hi: 'Sign up करें, फिर छोटा स्टोर सेटअप — दुकान का नाम, शहर और मुख्य श्रेणी। उसके बाद Analyze चलता है। Dashboard के लिए साइन-इन करें।',
      ta: 'Sign up செய்து, கடை பெயர், நகரம், முக்கிய வகையை நிரப்புங்கள். பிறகு Analyze. Dashboardக்கு உள்நுழையவும்.',
      hinglish: 'Sign up karo, phir chhota store setup — dukan ka naam, city aur category. Uske baad Analyze chalta hai. Dashboard ke liye sign in karo.',
    });
  }

  if (asksHow || SITE_HINT.test(text)) {
    return say(language, {
      en: 'Bodha AI compares Amazon, Flipkart and Snapdeal from live listings, then recommends where to sell and a price that never goes below break-even. Sign in to analyse a product; the mic can explain the site without an account.',
      hi: 'Bodha AI Amazon, Flipkart और Snapdeal की लाइव लिस्टिंग पढ़कर बताता है कहाँ बेचें और कितना चार्ज करें — ब्रेक-ईवन से नीचे कभी नहीं। उत्पाद विश्लेषण के लिए साइन-इन करें; माइक बिना खाते साइट समझा सकता है।',
      ta: 'Bodha AI Amazon, Flipkart, Snapdeal நேரடி பட்டியல்களை ஒப்பிட்டு எங்கு விற்க வேண்டும் என்றும் இலாப-இழப்புக்குக் கீழ் போகாத விலையையும் சொல்கிறது. பகுப்பாய்வுக்கு உள்நுழையவும்; மைக் கணக்கின்றி தளத்தை விளக்கும்.',
      hinglish: 'Bodha AI Amazon, Flipkart aur Snapdeal ki live listings padhke batata hai kahan bechna hai aur kitna charge karna hai — break-even se neeche kabhi nahi. Product analyse ke liye sign in karo; mic bina account site samjha sakta hai.',
    });
  }

  return offTopic(language);
}

function fallbackAnswer(
  query: VoiceQuery,
  report: Record<string, unknown> | null,
  language: SpokenLanguage,
  authenticated: boolean,
): string {
  if (!SITE_HINT.test(query.text) && !INSIGHT_HINT.test(query.text)) {
    return offTopic(language);
  }

  if (!authenticated) {
    if (INSIGHT_HINT.test(query.text) && !SITE_HINT.test(query.text)) return loginGate(language);
    return siteAnswer(query, language);
  }

  if (!report) {
    return siteAnswer(query, language);
  }

  const platforms = Array.isArray(report.platforms)
    ? (report.platforms as Array<Record<string, unknown>>)
    : [];
  const winner = platforms.find((platform) => platform.unavailable !== true) ?? platforms[0];

  if (/break.?even|ब्रेक|இலாப-இழப்பு|floor/i.test(query.text)) {
    return say(language, {
      en:
        'Break-even = cost ÷ (1 − commission) + shipping. We never recommend below that floor.' +
        (winner ? ' Here ' + String(winner.name) + ' is ₹' + String(winner.breakEvenPrice) + '.' : ''),
      hi:
        'ब्रेक-ईवन = लागत ÷ (1 − कमीशन) + शिपिंग। इससे नीचे कीमत नहीं सुझाते।' +
        (winner ? ' यहाँ ' + String(winner.name) + ' ₹' + String(winner.breakEvenPrice) + ' है।' : ''),
      ta:
        'இலாப-இழப்பு = செலவு ÷ (1 − கமிஷன்) + ஷிப்பிங். இதற்குக் கீழ் பரிந்துரை இல்லை.' +
        (winner ? ' இங்கே ' + String(winner.name) + ' ₹' + String(winner.breakEvenPrice) + '.' : ''),
      hinglish:
        'Break-even = cost ÷ (1 − commission) + shipping. Isse neeche price kabhi nahi.' +
        (winner ? ' Yahan ' + String(winner.name) + ' ₹' + String(winner.breakEvenPrice) + ' hai.' : ''),
    });
  }

  if (winner) {
    const line =
      String(winner.name) +
      ' · fit ' +
      String(winner.fitScore) +
      ' · ₹' +
      String(winner.recommendedPrice);
    return say(language, {
      en: line + '. Fit is 40% profit + 30% low competition + 30% demand. ' + String(winner.explanation ?? ''),
      hi: line + '। फिट = 40% लाभ + 30% कम प्रतिस्पर्धा + 30% माँग। ' + String(winner.explanation ?? ''),
      ta: line + '. பொருத்தம் = 40% லாபம் + 30% குறைந்த போட்டி + 30% தேவை. ' + String(winner.explanation ?? ''),
      hinglish: line + '. Fit score 40% profit, 30% kam competition, 30% demand. ' + String(winner.explanation ?? ''),
    });
  }

  return siteAnswer(query, language);
}

function buildPrompt(
  query: VoiceQuery,
  report: Record<string, unknown> | null,
  language: SpokenLanguage,
  authenticated: boolean,
): string {
  return [
    'You are Bodha AI, a concise voice guide for Indian sellers.',
    languageInstruction(language),
    authenticated
      ? 'The seller is signed in. You may use the report JSON for product, price, competitor and review questions.'
      : 'The seller is a guest. Answer ONLY how the website works: Home, Sign up, store onboarding, Pricing (6 free analyses, $10 Pro), languages, mic. Do NOT invent or reveal any product report, competitor list, review themes or recommended price. If they ask for insights, ask them to sign in.',
    'If the question is unrelated general knowledge, refuse and steer back to Bodha AI.',
    'Be 2–5 short sentences. Marketplace names stay in English. Rupee amounts keep the ₹ sign.',
    'Page: ' + (query.context?.page ?? 'unknown'),
    'Seller said: ' + query.text,
    authenticated ? 'Report JSON: ' + JSON.stringify(report ?? {}) : 'No report is attached.',
  ].join('\n');
}

export async function answerVoiceQuery(
  query: VoiceQuery,
): Promise<{ answer: string; language: SpokenLanguage; source: 'gemini' | 'fallback' }> {
  const authenticated = Boolean(query.context?.authenticated);
  const language = detectSpokenLanguage(query.text, query.language ?? 'en');
  const report = resolveReport({ ...query.context, authenticated });

  if (hasGeminiKey()) {
    try {
      const answer = await generateText(buildPrompt(query, report, language, authenticated));
      return { answer, language, source: 'gemini' };
    } catch (error) {
      console.warn('[bodha-ai] Gemini voice query failed, using fallback:', error);
    }
  }

  return {
    answer: fallbackAnswer(query, report, language, authenticated),
    language,
    source: 'fallback',
  };
}
