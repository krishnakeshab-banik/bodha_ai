/**
 * Rank comparable listings and write seller-facing strengths / weaknesses.
 * Advisory only — never fed into the pricing engine.
 *
 * Each card must be about THAT listing (price, rating, reviews, title) versus
 * the rest of the set. Shared review themes are rotated, never copy-pasted
 * onto every competitor.
 */

import type { ComparableListing, CompetitorInsight, ReviewSentiment, UiLanguage } from '../types/index.js';
import { generateJson, hasGeminiKey } from './geminiService.js';

const LANGUAGE_NAME: Record<UiLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

export interface CompetitorDescribeOptions {
  sellerPrice?: number;
}

/** Established listings first: rating × log(1 + reviews). */
export function rankCompetitors(listings: ComparableListing[], limit = 5): ComparableListing[] {
  return [...listings]
    .filter((listing) => listing.title && listing.price > 0)
    .sort((a, b) => provenScore(b) - provenScore(a))
    .slice(0, limit);
}

export function provenScore(listing: ComparableListing): number {
  const rating = listing.rating ?? 0;
  const reviews = listing.reviewCount ?? 0;
  return rating * Math.log10(1 + reviews);
}

export async function describeCompetitors(
  listings: ComparableListing[],
  sentiment: ReviewSentiment,
  language: UiLanguage,
  options: CompetitorDescribeOptions = {},
): Promise<CompetitorInsight[]> {
  if (listings.length === 0) return [];

  const fallback = buildDistinctInsights(listings, sentiment, language, options.sellerPrice);

  if (!hasGeminiKey()) return fallback;

  try {
    const payload = await generateJson<{
      competitors?: Array<{ title?: string; strengths?: string[]; weaknesses?: string[] }>;
    }>(
      [
        'You help an Indian seller understand their top competitors.',
        'Write strengths and weaknesses in ' + LANGUAGE_NAME[language] + ' only.',
        'Each strengths/weaknesses item is one short phrase (max 16 words).',
        'CRITICAL: every competitor must have DIFFERENT bullets. Cite that listing\'s exact price, rating and review count.',
        'Do not reuse the same phrase on two cards. Do not write generic SWOT that could apply to any headphone.',
        'Frame weaknesses as "why a buyer might skip THIS listing", not quoted reviews.',
        'Use these common buyer themes only when they fit a specific card — praises: ' +
          (sentiment.topPraises.join('; ') || 'none') +
          '; complaints: ' +
          (sentiment.topComplaints.join('; ') || 'none') +
          '.',
        options.sellerPrice
          ? 'The seller\'s listed price is ₹' + Math.round(options.sellerPrice) + '. Compare each card to that.'
          : '',
        'Return JSON: { competitors: [{ title, strengths: string[2-3], weaknesses: string[2-3] }] }',
        'Match titles exactly to these listings:',
        ...listings.map(
          (listing, index) =>
            String(index + 1) +
            '. "' +
            listing.title +
            '" — ₹' +
            listing.price +
            ', rating ' +
            (listing.rating ?? 'n/a') +
            ', reviews ' +
            (listing.reviewCount ?? 'n/a'),
        ),
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const byTitle = new Map(
      (payload.competitors ?? []).map((item) => [normalize(item.title ?? ''), item]),
    );

    const fromModel = listings.map((listing) => {
      const match = byTitle.get(normalize(listing.title));
      const strengths = cleanList(match?.strengths);
      const weaknesses = cleanList(match?.weaknesses);
      if (strengths.length === 0 || weaknesses.length === 0) return null;
      return { ...baseCard(listing), strengths, weaknesses };
    });

    if (fromModel.every((card) => card) && insightsAreDistinct(fromModel as CompetitorInsight[])) {
      return fromModel as CompetitorInsight[];
    }
    return fallback;
  } catch (error) {
    console.warn('[bodha-ai] competitor Gemini failed, using fallback:', error);
    return fallback;
  }
}

/** Pure path used when Gemini is off or returns the same SWOT for every card. */
export function buildDistinctInsights(
  listings: ComparableListing[],
  sentiment: ReviewSentiment,
  language: UiLanguage,
  sellerPrice?: number,
): CompetitorInsight[] {
  const ctx = peerContext(listings, sellerPrice);
  const used = new Set<string>();

  return listings.map((listing, index) => {
    const strengths = pickUnused(candidateStrengths(listing, index, ctx, language), used, 2);
    const weaknesses = pickUnused(
      candidateWeaknesses(listing, index, ctx, sentiment, language),
      used,
      2,
    );
    return { ...baseCard(listing), strengths, weaknesses };
  });
}

interface PeerContext {
  listings: ComparableListing[];
  sellerPrice?: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  maxRating: number;
  minRating: number;
  maxReviews: number;
  minReviews: number;
}

function peerContext(listings: ComparableListing[], sellerPrice?: number): PeerContext {
  const prices = listings.map((listing) => listing.price).filter((price) => price > 0);
  const ratings = listings
    .map((listing) => listing.rating)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const reviews = listings.map((listing) => listing.reviewCount ?? 0);

  return {
    listings,
    sellerPrice,
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    maxRating: ratings.length ? Math.max(...ratings) : 0,
    minRating: ratings.length ? Math.min(...ratings) : 0,
    maxReviews: reviews.length ? Math.max(...reviews) : 0,
    minReviews: reviews.length ? Math.min(...reviews) : 0,
  };
}

function candidateStrengths(
  listing: ComparableListing,
  index: number,
  ctx: PeerContext,
  language: UiLanguage,
): string[] {
  const t = COPY[language];
  const out: string[] = [];
  const peers = ctx.listings.length > 1;
  const rating = listing.rating;
  const reviews = listing.reviewCount ?? 0;
  const gen = modelGeneration(listing.title);
  const newerThan = ctx.listings.some((other) => {
    const otherGen = modelGeneration(other.title);
    return Boolean(gen && otherGen && otherGen.family === gen.family && otherGen.gen < gen.gen);
  });

  if (peers && listing.price <= ctx.minPrice && ctx.maxPrice > ctx.minPrice + 50) {
    out.push(t.cheapest.replace('{{price}}', inr(listing.price)));
  }
  if (ctx.sellerPrice && listing.price < ctx.sellerPrice * 0.95) {
    out.push(
      t.belowSeller
        .replace('{{delta}}', inr(ctx.sellerPrice - listing.price))
        .replace('{{seller}}', inr(ctx.sellerPrice)),
    );
  }
  if (rating != null && peers && rating >= ctx.maxRating - 0.05 && ctx.maxRating > ctx.minRating + 0.05) {
    out.push(t.bestRating.replace('{{rating}}', rating.toFixed(1)));
  } else if (rating != null && rating >= 4.3) {
    out.push(t.strongRating.replace('{{rating}}', rating.toFixed(1)));
  }
  if (peers && reviews >= ctx.maxReviews && ctx.maxReviews > ctx.minReviews) {
    out.push(t.mostReviews.replace('{{reviews}}', formatCount(reviews)));
  } else if (reviews >= 1000) {
    out.push(t.manyReviews.replace('{{reviews}}', formatCount(reviews)));
  } else if (reviews >= 100) {
    out.push(t.someReviews.replace('{{reviews}}', formatCount(reviews)));
  }
  if (newerThan && gen) {
    out.push(t.newerGen.replace('{{gen}}', gen.label));
  }
  if (/\b(official|authorised|authorized|brand store)\b/i.test(listing.title)) {
    out.push(t.official);
  }
  if (ctx.sellerPrice && listing.price > ctx.sellerPrice * 1.05) {
    out.push(
      t.aboveSellerStrength
        .replace('{{price}}', inr(listing.price))
        .replace('{{seller}}', inr(ctx.sellerPrice)),
    );
  }
  if (listing.price > 0) {
    out.push(t.pricedAt.replace('{{price}}', inr(listing.price)).replace('{{n}}', String(index + 1)));
  }
  return out;
}

function candidateWeaknesses(
  listing: ComparableListing,
  index: number,
  ctx: PeerContext,
  sentiment: ReviewSentiment,
  language: UiLanguage,
): string[] {
  const t = COPY[language];
  const out: string[] = [];
  const peers = ctx.listings.length > 1;
  const rating = listing.rating;
  const reviews = listing.reviewCount ?? 0;
  const gen = modelGeneration(listing.title);
  const olderThan = ctx.listings.some((other) => {
    const otherGen = modelGeneration(other.title);
    return Boolean(gen && otherGen && otherGen.family === gen.family && otherGen.gen > gen.gen);
  });

  if (peers && listing.price >= ctx.maxPrice && ctx.maxPrice > ctx.minPrice + 50) {
    out.push(t.mostExpensive.replace('{{price}}', inr(listing.price)));
  }
  if (ctx.sellerPrice && listing.price > ctx.sellerPrice * 1.05) {
    out.push(
      t.aboveSeller
        .replace('{{delta}}', inr(listing.price - ctx.sellerPrice))
        .replace('{{seller}}', inr(ctx.sellerPrice)),
    );
  }
  if (rating != null && peers && rating <= ctx.minRating + 0.05 && ctx.maxRating > ctx.minRating + 0.05) {
    out.push(t.worstRating.replace('{{rating}}', rating.toFixed(1)));
  } else if (rating != null && rating < 4) {
    out.push(t.lowRating.replace('{{rating}}', rating.toFixed(1)));
  } else if (rating == null) {
    out.push(t.noRating);
  }
  if (peers && reviews <= ctx.minReviews && ctx.maxReviews > Math.max(reviews, 1) * 2) {
    out.push(
      t.fewestReviews
        .replace('{{reviews}}', formatCount(reviews))
        .replace('{{leader}}', formatCount(ctx.maxReviews)),
    );
  } else if (reviews < 50) {
    out.push(t.thinReviews);
  }
  if (olderThan && gen) {
    out.push(t.olderGen.replace('{{gen}}', gen.label));
  }
  if (/\b(refurbished|renewed|refurb)\b/i.test(listing.title)) {
    out.push(t.refurbished);
  }
  if (/\b(international|import)\b/i.test(listing.title)) {
    out.push(t.importUnit);
  }
  if (sentiment.topComplaints.length > 0) {
    const theme = sentiment.topComplaints[index % sentiment.topComplaints.length];
    out.push(t.complaint.replace('{{theme}}', theme));
  }
  out.push(t.genericWeak.replace('{{n}}', String(index + 1)).replace('{{price}}', inr(listing.price)));
  return out;
}

function pickUnused(candidates: string[], used: Set<string>, count: number): string[] {
  const picked: string[] = [];
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    picked.push(candidate);
    if (picked.length >= count) break;
  }
  return picked;
}

export function insightsAreDistinct(cards: CompetitorInsight[]): boolean {
  if (cards.length <= 1) return true;
  const fingerprints = cards.map(
    (card) => card.strengths.join('|').toLowerCase() + '::' + card.weaknesses.join('|').toLowerCase(),
  );
  if (new Set(fingerprints).size !== cards.length) return false;
  const firstStrength = cards.map((card) => (card.strengths[0] ?? '').toLowerCase());
  const firstWeakness = cards.map((card) => (card.weaknesses[0] ?? '').toLowerCase());
  if (new Set(firstStrength).size === 1) return false;
  if (new Set(firstWeakness).size === 1) return false;
  return true;
}

function baseCard(listing: ComparableListing): Omit<CompetitorInsight, 'strengths' | 'weaknesses'> {
  return {
    title: listing.title,
    price: listing.price,
    rating: listing.rating ?? null,
    reviewCount: listing.reviewCount ?? null,
    url: listing.url,
    thumbnail: listing.thumbnail ?? null,
  };
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 3);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function inr(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

function formatCount(value: number): string {
  return value.toLocaleString('en-IN');
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function modelGeneration(title: string): { family: string; gen: number; label: string } | null {
  const compact = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const xm = compact.match(/(\d{3,5}xm)(\d)/i);
  if (xm) {
    return { family: xm[1], gen: Number(xm[2]), label: xm[1].toUpperCase() + xm[2] };
  }
  const iphone = title.match(/iphone\s*(\d{1,2})/i);
  if (iphone) {
    return { family: 'iphone', gen: Number(iphone[1]), label: 'iPhone ' + iphone[1] };
  }
  return null;
}

const COPY: Record<UiLanguage, Record<string, string>> = {
  en: {
    cheapest: 'Lowest price in this set at {{price}}',
    belowSeller: '{{delta}} cheaper than your {{seller}} list price',
    bestRating: 'Best rating in this set ({{rating}}★)',
    strongRating: '{{rating}}★ — buyers treat this listing as safe',
    mostReviews: 'Most reviewed here ({{reviews}} reviews)',
    manyReviews: '{{reviews}} reviews — an established listing',
    someReviews: '{{reviews}} reviews give it visible social proof',
    newerGen: 'Newer generation ({{gen}}) than older peers in this set',
    official: 'Official / authorised listing — stronger warranty trust',
    aboveSellerStrength: 'Priced at {{price}}, above your {{seller}} so you look like the value pick',
    pricedAt: 'Live at {{price}} (card {{n}} in this comparison)',
    mostExpensive: 'Most expensive here at {{price}} — deal hunters will skip it',
    aboveSeller: '{{delta}} above your {{seller}} — you can undercut this card',
    worstRating: 'Lowest rating in this set ({{rating}}★)',
    lowRating: 'Only {{rating}}★ — weaker trust than the pack',
    noRating: 'No star rating shown — harder to win the first click',
    fewestReviews: 'Only {{reviews}} reviews vs {{leader}} on the leader',
    thinReviews: 'Thin review history compared with the leaders',
    olderGen: 'Older generation ({{gen}}) — buyers may pick the newer model',
    refurbished: 'Renewed/refurbished — some buyers want a new sealed unit',
    importUnit: 'International/import unit — warranty worry for many Indian buyers',
    complaint: 'Similar listings draw complaints about {{theme}}',
    genericWeak: 'Card {{n}} at {{price}} can be beaten with a clearer spec line',
  },
  hi: {
    cheapest: 'इस सेट में सबसे कम कीमत {{price}}',
    belowSeller: 'आपकी {{seller}} से {{delta}} सस्ता',
    bestRating: 'इस सेट में सबसे ऊँची रेटिंग ({{rating}}★)',
    strongRating: '{{rating}}★ — खरीदार इसे सुरक्षित मानते हैं',
    mostReviews: 'यहाँ सबसे अधिक समीक्षाएँ ({{reviews}})',
    manyReviews: '{{reviews}} समीक्षाएँ — स्थापित लिस्टिंग',
    someReviews: '{{reviews}} समीक्षाएँ सामाजिक प्रमाण देती हैं',
    newerGen: 'पुराने पीयर्स से नया जनरेशन ({{gen}})',
    official: 'आधिकारिक लिस्टिंग — वारंटी पर अधिक भरोसा',
    aboveSellerStrength: '{{price}} पर, आपकी {{seller}} से ऊपर — आप सस्ते दिखते हैं',
    pricedAt: '{{price}} पर लाइव (इस तुलना में कार्ड {{n}})',
    mostExpensive: 'यहाँ सबसे महँगा {{price}} — डील ढूँढने वाले छोड़ेंगे',
    aboveSeller: 'आपकी {{seller}} से {{delta}} ऊपर — आप इसे अंडरकट कर सकते हैं',
    worstRating: 'इस सेट में सबसे कम रेटिंग ({{rating}}★)',
    lowRating: 'केवल {{rating}}★ — पैक से कम भरोसा',
    noRating: 'स्टार रेटिंग नहीं — पहला क्लिक जीतना कठिन',
    fewestReviews: 'केवल {{reviews}} समीक्षाएँ, लीडर पर {{leader}}',
    thinReviews: 'लीडर्स की तुलना में पतली समीक्षा हिस्ट्री',
    olderGen: 'पुराना जनरेशन ({{gen}}) — खरीदार नया मॉडल चुन सकते हैं',
    refurbished: 'रिन्यूड/रिफर्बिश्ड — कुछ खरीदार नई सील चाहते हैं',
    importUnit: 'इंटरनेशनल यूनिट — भारतीय खरीदार वारंटी से डरते हैं',
    complaint: 'ऐसी लिस्टिंग पर शिकायत: {{theme}}',
    genericWeak: 'कार्ड {{n}} ({{price}}) को साफ़ स्पेक से हराया जा सकता है',
  },
  ta: {
    cheapest: 'இந்த தொகுப்பில் குறைந்த விலை {{price}}',
    belowSeller: 'உங்கள் {{seller}}ஐ விட {{delta}} மலிவு',
    bestRating: 'இந்த தொகுப்பில் சிறந்த மதிப்பீடு ({{rating}}★)',
    strongRating: '{{rating}}★ — வாங்குபவர் இதை பாதுகாப்பானதாகக் கருதுகிறார்',
    mostReviews: 'இங்கே அதிக விமர்சனங்கள் ({{reviews}})',
    manyReviews: '{{reviews}} விமர்சனங்கள் — நிலைத்த பட்டியல்',
    someReviews: '{{reviews}} விமர்சனங்கள் நம்பிக்கை தருகின்றன',
    newerGen: 'பழைய சகாக்களை விட புதிய தலைமுறை ({{gen}})',
    official: 'அதிகாரப்பூர்வ பட்டியல் — உத்தரவாத நம்பிக்கை',
    aboveSellerStrength: '{{price}} இல், உங்கள் {{seller}}க்கு மேல் — நீங்கள் மலிவாகத் தெரிகிறீர்கள்',
    pricedAt: '{{price}} இல் நேரடி (ஒப்பீட்டில் அட்டை {{n}})',
    mostExpensive: 'இங்கே அதிக விலை {{price}} — சலுகை தேடுபவர் தவிர்ப்பார்',
    aboveSeller: 'உங்கள் {{seller}}ஐ விட {{delta}} அதிகம் — நீங்கள் குறைக்கலாம்',
    worstRating: 'இந்த தொகுப்பில் குறைந்த மதிப்பீடு ({{rating}}★)',
    lowRating: 'வெறும் {{rating}}★ — குழுவை விட குறைந்த நம்பிக்கை',
    noRating: 'நட்சத்திர மதிப்பீடு இல்லை — முதல் கிளிக் கடினம்',
    fewestReviews: 'வெறும் {{reviews}} விமர்சனங்கள், முதலிடத்தில் {{leader}}',
    thinReviews: 'முன்னிலை பட்டியல்களை விட குறைந்த விமர்சனங்கள்',
    olderGen: 'பழைய தலைமுறை ({{gen}}) — வாங்குபவர் புதிய மாடலை தேர்ந்தெடுக்கலாம்',
    refurbished: 'புதுப்பிக்கப்பட்டது — சிலர் புதிய சீலை விரும்புவர்',
    importUnit: 'சர்வதேச யூனிட் — இந்திய வாங்குபவருக்கு உத்தரவாதக் கவலை',
    complaint: 'இதே பட்டியல்களில் புகார்: {{theme}}',
    genericWeak: 'அட்டை {{n}} ({{price}}) தெளிவான விவரத்தால் வெல்லப்படும்',
  },
};
