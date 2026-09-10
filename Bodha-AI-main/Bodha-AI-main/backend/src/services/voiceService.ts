/**
 * On-site voice fallback when ElevenLabs is unavailable (quota, outage).
 * Website help for everyone; stored-report answers when a product is in context.
 */

import { findAnalysisById, findLatestAnalysisForSeller } from '../models/productRepository.js';
import { generateText, hasGeminiKey } from './geminiService.js';
import type { AnalysisRecord } from '../types/index.js';
import {
  getCompetitorAnalysis,
  getPriceExplanation,
  getRegionalDemand,
  getReportSummary,
  getReviewSentiment,
  type VoiceToolLanguage,
} from './voiceToolsService.js';
import {
  languageInstruction,
  resolveReplyLanguage,
  toUiLanguage,
  type SpokenLanguage,
} from './voiceLanguage.js';

export interface VoiceContext {
  productId?: string;
  page?: string;
  sellerId?: string;
  authenticated?: boolean;
}

export interface VoiceQuery {
  text: string;
  language?: SpokenLanguage;
  context?: VoiceContext;
}

const SITE_ONLY =
  /sign ?up|sign ?in|log ?in|account|password|pricing|credit|subscribe|razorpay|onboard|how (do|does|to).*(work|bodha|site|app)|bodha ai (kya|kya hai|what)|कैसे काम|क्या है bodha|எப்படி வேலை/i;

const PRODUCT_HINT =
  /recommend|price|sell|charge|marketplace|platform|amazon|flipkart|snapdeal|alibaba|break.?even|competitor|review|complaint|praise|demand|listing|keyword|title|profit|fit|where|which|how much|kitna|product|report|सुझा|कीमत|बेच|प्रतियोग|समीक्षा|माँग|பரிந்துரை|விலை|போட்டி|விமர்சன|தேவை/i;

function resolveRecord(context?: VoiceContext): AnalysisRecord | null {
  if (context?.productId) {
    const record = findAnalysisById(context.productId);
    if (record) return record;
  }
  if (context?.authenticated && context.sellerId) {
    return findLatestAnalysisForSeller(context.sellerId);
  }
  return null;
}

function say(language: SpokenLanguage, copy: Record<SpokenLanguage, string>): string {
  return copy[language];
}

function toolLanguage(language: SpokenLanguage): VoiceToolLanguage {
  return toUiLanguage(language);
}

function loginGate(language: SpokenLanguage): string {
  return say(language, {
    en: 'I can explain how Bodha AI works, but product numbers come from a stored analysis. Sign in and open a report, or analyse a product first.',
    hi: 'मैं साइट समझा सकता हूँ, लेकिन उत्पाद के आँकड़े सेव की गई रिपोर्ट से आते हैं। साइन-इन करें और रिपोर्ट खोलें, या पहले विश्लेषण करें।',
    ta: 'நான் தளத்தை விளக்கலாம். எண்கள் சேமித்த அறிக்கையிலிருந்து வரும். உள்நுழைந்து அறிக்கையைத் திறக்கவும், அல்லது முதலில் பகுப்பாய்வு செய்யவும்.',
    hinglish: 'Site samjha sakta hoon, lekin product numbers stored report se aate hain. Sign in karke report kholo, ya pehle analyse karo.',
  });
}

function offTopic(language: SpokenLanguage): string {
  return say(language, {
    en: 'I only help with Bodha AI and your analysed product — where to sell, what to charge, competitors and reviews. Ask about this report or how the app works.',
    hi: 'मैं केवल Bodha AI और आपके विश्लेषित उत्पाद पर मदद करता हूँ — कहाँ बेचें, कितना चार्ज करें, प्रतियोगी और समीक्षाएँ। रिपोर्ट या ऐप के बारे में पूछें।',
    ta: 'நான் Bodha AI மற்றும் உங்கள் பகுப்பாய்வு செய்யப்பட்ட பொருள் பற்றி மட்டுமே உதவுகிறேன். இந்த அறிக்கை அல்லது செயலியைப் பற்றிக் கேளுங்கள்.',
    hinglish: 'Main sirf Bodha AI aur aapke analysed product pe help karta hoon — kahan bechna hai, kitna charge karna hai, competitors, reviews. Report ya app ke baare mein poocho.',
  });
}

function siteAnswer(query: VoiceQuery, language: SpokenLanguage): string {
  const text = query.text;
  const asksCredits = /credit|free|6|subscribe|razorpay|pro|\$10|प्लान|கிரெடிட்/i.test(text);
  const asksAuth = /sign ?up|sign ?in|log ?in|account|onboard|store|खाता|साइन|கணக்கு/i.test(text);

  if (asksCredits) {
    return say(language, {
      en: 'New sellers get 6 free product analyses each month. After that, Pro is $10 a month via Razorpay test checkout — open Pricing.',
      hi: 'नए सेलर को हर महीने 6 मुफ़्त विश्लेषण मिलते हैं। उसके बाद Pro $10/महीना है, Razorpay टेस्ट से — Pricing खोलें।',
      ta: 'புதிய விற்பனையாளருக்கு மாதம் 6 இலவச பகுப்பாய்வு. அதற்கு மேல் Pro $10/மாதம், Razorpay சோதனை — Pricing திறக்கவும்.',
      hinglish: 'Naye sellers ko mahine mein 6 free analyses milte hain. Uske baad Pro $10/month Razorpay test se — Pricing page kholo.',
    });
  }

  if (asksAuth) {
    return say(language, {
      en: 'Use Sign up, then a short store setup — business name, city and main category. After that you can run Analyze.',
      hi: 'Sign up करें, फिर छोटा स्टोर सेटअप — दुकान का नाम, शहर और मुख्य श्रेणी। उसके बाद Analyze चलता है।',
      ta: 'Sign up செய்து, கடை பெயர், நகரம், முக்கிய வகையை நிரப்புங்கள். பிறகு Analyze.',
      hinglish: 'Sign up karo, phir chhota store setup — dukan ka naam, city aur category. Uske baad Analyze chalta hai.',
    });
  }

  return say(language, {
    en: 'Bodha AI compares Amazon, Flipkart and Snapdeal from live listings, then recommends where to sell and a price that never goes below break-even. Open a product report to hear its numbers.',
    hi: 'Bodha AI Amazon, Flipkart और Snapdeal की लाइव लिस्टिंग पढ़कर बताता है कहाँ बेचें और कितना चार्ज करें — ब्रेक-ईवन से नीचे कभी नहीं। आँकड़ों के लिए उत्पाद रिपोर्ट खोलें।',
    ta: 'Bodha AI Amazon, Flipkart, Snapdeal நேரடி பட்டியல்களை ஒப்பிட்டு எங்கு விற்க வேண்டும் என்றும் இலாப-இழப்புக்குக் கீழ் போகாத விலையையும் சொல்கிறது. எண்களுக்கு அறிக்கையைத் திறக்கவும்.',
    hinglish: 'Bodha AI Amazon, Flipkart aur Snapdeal ki live listings padhke batata hai kahan bechna hai aur kitna charge karna hai — break-even se neeche kabhi nahi. Numbers ke liye product report kholo.',
  });
}

function compactReport(record: AnalysisRecord): Record<string, unknown> {
  const winner = record.platforms.find((platform) => platform.id === record.recommendedPlatform) ?? record.platforms[0];
  return {
    title: record.title,
    recommendedPlatform: winner?.name ?? record.recommendedPlatform,
    recommendedPrice: winner?.recommendedPrice ?? record.recommendedPrice,
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
      priceAction: platform.priceAction,
      explanation: platform.explanation,
      unavailable: platform.unavailable,
    })),
    optimizedListing: record.optimizedListing,
    insights: {
      competitors: record.insights.competitors.slice(0, 5).map((item) => ({
        title: item.title,
        price: item.price,
        rating: item.rating,
      })),
      topPraises: record.insights.reviewSentiment.topPraises,
      topComplaints: record.insights.reviewSentiment.topComplaints,
      demandStates: record.insights.regionalDemand.states.slice(0, 5),
    },
  };
}

function productAnswer(record: AnalysisRecord, query: VoiceQuery, language: SpokenLanguage): string {
  const lang = toolLanguage(language);
  const text = query.text;
  const title = record.title;
  const winner = record.platforms.find((platform) => platform.id === record.recommendedPlatform) ?? record.platforms[0];
  const platformName = winner?.name ?? record.recommendedPlatform;

  if (/break.?even|floor|ब्रेक|இலாப-இழப்பு/i.test(text) || /price|charge|how much|kitna|कीमत|விலை|hold|increase|decrease/i.test(text)) {
    const price = getPriceExplanation(record.productId, lang);
    if (price.available) {
      return say(language, {
        en:
          'For ' +
          title +
          ', charge ₹' +
          String(record.recommendedPrice) +
          ' on ' +
          platformName +
          '. Break-even is ₹' +
          String(price.breakEvenPrice) +
          '. Market range ₹' +
          String(price.marketRange[0]) +
          '–₹' +
          String(price.marketRange[1]) +
          '. ' +
          price.explanation,
        hi:
          title +
          ' के लिए ' +
          platformName +
          ' पर ₹' +
          String(record.recommendedPrice) +
          ' रखें। ब्रेक-ईवन ₹' +
          String(price.breakEvenPrice) +
          ' है। ' +
          price.explanation,
        ta:
          title +
          'க்கு ' +
          platformName +
          '-இல் ₹' +
          String(record.recommendedPrice) +
          ' வசூலிக்கவும். இலாப-இழப்பு ₹' +
          String(price.breakEvenPrice) +
          '. ' +
          price.explanation,
        hinglish:
          title +
          ' ke liye ' +
          platformName +
          ' pe ₹' +
          String(record.recommendedPrice) +
          ' charge karo. Break-even ₹' +
          String(price.breakEvenPrice) +
          ' hai. ' +
          price.explanation,
      });
    }
  }

  if (/competitor|rival|competition|प्रतियोग|போட்டி/i.test(text)) {
    const competitors = getCompetitorAnalysis(record.productId, lang);
    if (competitors.available) {
      const lines = competitors.competitors
        .slice(0, 3)
        .map((item) => item.title + ' ₹' + String(item.price))
        .join('; ');
      return say(language, {
        en: 'Stored competitors for ' + title + ': ' + lines + '.',
        hi: title + ' के सेव प्रतियोगी: ' + lines + '।',
        ta: title + 'க்கான போட்டியாளர்கள்: ' + lines + '.',
        hinglish: title + ' ke stored competitors: ' + lines + '.',
      });
    }
    return say(language, {
      en: 'Competitor cards were not stored for ' + title + '.',
      hi: title + ' के लिए प्रतियोगी कार्ड सेव नहीं हैं।',
      ta: title + 'க்கு போட்டியாளர் அட்டைகள் சேமிக்கப்படவில்லை.',
      hinglish: title + ' ke liye competitor cards save nahi hain.',
    });
  }

  if (/review|complaint|praise|rating|समीक्षा|விமர்சன/i.test(text)) {
    const reviews = getReviewSentiment(record.productId, lang);
    if (reviews.available) {
      return say(language, {
        en:
          'Reviews for ' +
          title +
          ': praises — ' +
          reviews.topPraises.slice(0, 3).join(', ') +
          '. Complaints — ' +
          reviews.topComplaints.slice(0, 3).join(', ') +
          '.',
        hi:
          title +
          ' की समीक्षाएँ: तारीफ़ — ' +
          reviews.topPraises.slice(0, 3).join(', ') +
          '। शिकायत — ' +
          reviews.topComplaints.slice(0, 3).join(', ') +
          '।',
        ta:
          title +
          ' விமர்சனங்கள்: பாராட்டு — ' +
          reviews.topPraises.slice(0, 3).join(', ') +
          '. புகார் — ' +
          reviews.topComplaints.slice(0, 3).join(', ') +
          '.',
        hinglish:
          title +
          ' ke reviews: praises — ' +
          reviews.topPraises.slice(0, 3).join(', ') +
          '. Complaints — ' +
          reviews.topComplaints.slice(0, 3).join(', ') +
          '.',
      });
    }
    return say(language, {
      en: 'Review themes were not stored for ' + title + '.',
      hi: title + ' की समीक्षा थीम सेव नहीं हैं।',
      ta: title + 'க்கு விமர்சனத் தீம்கள் சேமிக்கப்படவில்லை.',
      hinglish: title + ' ke review themes save nahi hain.',
    });
  }

  if (/demand|state|region|माँग|தேவை/i.test(text)) {
    const demand = getRegionalDemand(record.productId, lang);
    if (demand.available) {
      const lines = demand.topStates
        .slice(0, 4)
        .map((entry) => entry.state + ' ' + String(entry.relativeInterest))
        .join(', ');
      return say(language, {
        en: 'Regional demand for ' + title + ': ' + lines + '.',
        hi: title + ' की क्षेत्रीय माँग: ' + lines + '।',
        ta: title + 'க்கான பிராந்திய தேவை: ' + lines + '.',
        hinglish: title + ' ki regional demand: ' + lines + '.',
      });
    }
  }

  if (/listing|title|keyword|description|कॉपी|தலைப்பு/i.test(text) && record.optimizedListing) {
    return say(language, {
      en: 'Suggested listing title: ' + record.optimizedListing.title + '.',
      hi: 'सुझाया शीर्षक: ' + record.optimizedListing.title + '।',
      ta: 'பரிந்துரைக்கப்பட்ட தலைப்பு: ' + record.optimizedListing.title + '.',
      hinglish: 'Suggested listing title: ' + record.optimizedListing.title + '.',
    });
  }

  const summary = getReportSummary(record.productId, lang);
  if (summary.available) {
    return say(language, {
      en:
        'For ' +
        title +
        ', sell on ' +
        summary.recommendedPlatform +
        ' at ₹' +
        String(summary.recommendedPrice) +
        '. Fit score ' +
        String(summary.fitScore) +
        '.',
      hi:
        title +
        ' के लिए ' +
        summary.recommendedPlatform +
        ' पर ₹' +
        String(summary.recommendedPrice) +
        ' में बेचें। फिट स्कोर ' +
        String(summary.fitScore) +
        '।',
      ta:
        title +
        'க்கு ' +
        summary.recommendedPlatform +
        '-இல் ₹' +
        String(summary.recommendedPrice) +
        'க்கு விற்கவும். பொருத்தம் ' +
        String(summary.fitScore) +
        '.',
      hinglish:
        title +
        ' ke liye ' +
        summary.recommendedPlatform +
        ' pe ₹' +
        String(summary.recommendedPrice) +
        ' mein becho. Fit score ' +
        String(summary.fitScore) +
        '.',
    });
  }

  return siteAnswer(query, language);
}

function fallbackAnswer(query: VoiceQuery, record: AnalysisRecord | null, language: SpokenLanguage): string {
  const wantsSite = SITE_ONLY.test(query.text) && !PRODUCT_HINT.test(query.text);
  if (wantsSite) return siteAnswer(query, language);

  if (record) return productAnswer(record, query, language);

  if (PRODUCT_HINT.test(query.text)) return loginGate(language);
  if (SITE_ONLY.test(query.text)) return siteAnswer(query, language);
  return offTopic(language);
}

function buildPrompt(query: VoiceQuery, record: AnalysisRecord | null, language: SpokenLanguage): string {
  return [
    'You are Bodha AI, a concise voice guide for Indian sellers.',
    languageInstruction(language),
    record
      ? 'Use ONLY the report JSON below. Answer where to sell, price, break-even, competitors, reviews or demand from those numbers. Never invent a figure.'
      : 'No product report is attached. Explain how Bodha AI works, or ask the seller to open a report. Do not invent product numbers.',
    'If the question is unrelated general knowledge, refuse and steer back to this product or the app.',
    'Be 2–5 short sentences. Marketplace names stay in English. Rupee amounts keep the ₹ sign.',
    'Page: ' + (query.context?.page ?? 'unknown'),
    'Seller said: ' + query.text,
    'Report JSON: ' + JSON.stringify(record ? compactReport(record) : null),
  ].join('\n');
}

export async function answerVoiceQuery(
  query: VoiceQuery,
): Promise<{ answer: string; language: SpokenLanguage; source: 'gemini' | 'fallback'; productId?: string }> {
  const language = resolveReplyLanguage(query.text, query.language ?? 'en');
  const record = resolveRecord(query.context);

  if (hasGeminiKey()) {
    try {
      const answer = await generateText(buildPrompt(query, record, language));
      return { answer, language, source: 'gemini', productId: record?.productId };
    } catch (error) {
      console.warn('[bodha-ai] Gemini voice query failed, using fallback:', error);
    }
  }

  return {
    answer: fallbackAnswer(query, record, language),
    language,
    source: 'fallback',
    productId: record?.productId,
  };
}
