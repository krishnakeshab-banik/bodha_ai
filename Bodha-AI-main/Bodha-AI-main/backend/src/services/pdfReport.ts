/**
 * Paginated print-to-PDF of a stored analysis, in the seller's language.
 */

import { chromium } from 'playwright';

import { CATEGORIES } from '../data/categories.js';
import { PLATFORMS } from '../data/platformConfig.js';
import type { AnalysisRecord, UiLanguage } from '../types/index.js';

const COPY: Record<UiLanguage, Record<string, string>> = {
  en: {
    overview: 'Overview',
    pricing: 'Pricing details',
    comparison: 'Marketplace comparison',
    competitors: 'Competitor analysis',
    reviews: 'Reviews & demand',
    listing: 'Listing optimizer',
    benefits: 'Why this platform besides price',
    why: 'Why this marketplace won',
    breakEven: 'Break-even',
    recommended: 'Recommended',
    yourPrice: 'Your price',
    praises: 'What buyers praise',
    complaints: 'What buyers complain about',
    noReviews: 'Not enough review data available yet.',
    demand: 'Estimated regional interest (based on search trends)',
    noDemand: 'Search-interest data is not available for this category yet.',
    noCompetitors: 'No comparable listings were available to rank competitors.',
    strengths: 'Why this listing wins clicks',
    weaknesses: 'Why customers might skip this one',
    disclaimer: 'Regional interest is a Google Trends search proxy, not sales data.',
  },
  hi: {
    overview: 'सारांश',
    pricing: 'कीमत विवरण',
    comparison: 'मार्केटप्लेस तुलना',
    competitors: 'प्रतियोगी विश्लेषण',
    reviews: 'समीक्षा और माँग',
    listing: 'लिस्टिंग ऑप्टिमाइज़र',
    benefits: 'कीमत के अलावा यह प्लेटफ़ॉर्म क्यों',
    why: 'यह मार्केटप्लेस क्यों जीता',
    breakEven: 'ब्रेक-ईवन',
    recommended: 'सुझाव',
    yourPrice: 'आपकी कीमत',
    praises: 'खरीदार क्या सराहते हैं',
    complaints: 'खरीदार किसकी शिकायत करते हैं',
    noReviews: 'अभी पर्याप्त समीक्षा डेटा नहीं है।',
    demand: 'अनुमानित क्षेत्रीय रुचि (सर्च ट्रेंड्स पर आधारित)',
    noDemand: 'इस श्रेणी के लिए सर्च-रुचि डेटा अभी उपलब्ध नहीं है।',
    noCompetitors: 'प्रतियोगियों को रैंक करने के लिए तुलनात्मक लिस्टिंग नहीं मिली।',
    strengths: 'यह लिस्टिंग क्लिक क्यों जीतती है',
    weaknesses: 'खरीदार इसे क्यों छोड़ सकते हैं',
    disclaimer: 'क्षेत्रीय रुचि Google Trends का सर्च संकेत है, बिक्री डेटा नहीं।',
  },
  ta: {
    overview: 'மேலோட்டம்',
    pricing: 'விலை விவரம்',
    comparison: 'சந்தை ஒப்பீடு',
    competitors: 'போட்டியாளர் பகுப்பாய்வு',
    reviews: 'விமர்சனமும் தேவையும்',
    listing: 'பட்டியல் மேம்படுத்தி',
    benefits: 'விலைக்கு அப்பால் இந்த தளம் ஏன்',
    why: 'இந்த சந்தை ஏன் வென்றது',
    breakEven: 'இலாப-நட்டமின்மை',
    recommended: 'பரிந்துரை',
    yourPrice: 'உங்கள் விலை',
    praises: 'வாங்குபவர் பாராட்டுவது',
    complaints: 'வாங்குபவர் குறை கூறுவது',
    noReviews: 'போதிய விமர்சனத் தரவு இன்னும் இல்லை.',
    demand: 'மதிப்பிடப்பட்ட பிராந்திய ஆர்வம் (தேடல் போக்குகள்)',
    noDemand: 'இந்த வகைக்கு தேடல் ஆர்வத் தரவு இன்னும் இல்லை.',
    noCompetitors: 'போட்டியாளர்களை வரிசைப்படுத்த ஒப்பீட்டு பட்டியல் இல்லை.',
    strengths: 'இந்த பட்டியல் கிளிக்கை ஏன் வெல்கிறது',
    weaknesses: 'வாங்குபவர் இதை ஏன் தவிர்க்கலாம்',
    disclaimer: 'பிராந்திய ஆர்வம் Google Trends தேடல் சமிக்ஞை; விற்பனை அல்ல.',
  },
};

function rupee(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reportPdfFilename(record: AnalysisRecord): string {
  const title = record.title.replace(/[^\w\u0900-\u097F\u0B80-\u0BFF]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const date = record.createdAt.slice(0, 10);
  return 'BodhaAI_Report_' + (title || 'Product') + '_' + date + '.pdf';
}

export function buildReportHtml(record: AnalysisRecord, language: UiLanguage): string {
  const t = COPY[language];
  const winner = record.platforms.find((platform) => platform.id === record.recommendedPlatform);
  const insights = record.insights;
  const bullets = (items: string[]) =>
    items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('');

  const competitorCards = insights.competitors.length
    ? insights.competitors
        .map(
          (competitor) => `
        <article class="card">
          <h3>${escapeHtml(competitor.title)}</h3>
          <p class="figure">${rupee(competitor.price)} · ${competitor.rating ?? '—'} ★ · ${competitor.reviewCount ?? '—'} reviews</p>
          <p class="kicker">${escapeHtml(t.strengths)}</p>
          <ul>${bullets(competitor.strengths)}</ul>
          <p class="kicker">${escapeHtml(t.weaknesses)}</p>
          <ul>${bullets(competitor.weaknesses)}</ul>
        </article>`,
        )
        .join('')
    : '<p>' + escapeHtml(t.noCompetitors) + '</p>';

  const comparisonRows = record.platforms
    .map(
      (platform) => `
      <tr>
        <td>${escapeHtml(platform.name)}</td>
        <td>${(platform.feePercent * 100).toFixed(1)}%</td>
        <td>${platform.unavailable ? '—' : platform.listingCount}</td>
        <td>${platform.unavailable ? '—' : rupee(platform.recommendedPrice)}</td>
        <td>${platform.unavailable ? '—' : platform.fitScore.toFixed(1)}</td>
      </tr>`,
    )
    .join('');

  const demandBars = insights.regionalDemand.available
    ? insights.regionalDemand.states
        .map(
          (state) => `
        <div class="bar-row">
          <span>${escapeHtml(state.state)}</span>
          <span class="track"><span style="width:${state.interest}%"></span></span>
          <span class="figure">${state.interest}</span>
        </div>`,
        )
        .join('')
    : '<p>' + escapeHtml(t.noDemand) + '</p>';

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: "IBM Plex Sans", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif; color: #141814; background: #f3efe6; }
    h1, h2, h3 { font-family: "IBM Plex Serif", Georgia, serif; font-weight: 500; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .banner { background: #141814; color: #f3efe6; padding: 24px; }
    .figure { font-family: "IBM Plex Mono", ui-monospace, monospace; }
    .kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #0a5540; }
    ul { padding-left: 1.1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-top: 1px solid #cfc8ba; padding: 8px 6px; text-align: left; }
    .card { border-top: 1px solid #cfc8ba; padding: 12px 0; }
    .bar-row { display: grid; grid-template-columns: 8rem 1fr 2rem; gap: 8px; align-items: center; margin: 6px 0; }
    .track { height: 4px; background: #cfc8ba; }
    .track span { display: block; height: 100%; background: #0d6b4c; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .note { font-size: 12px; color: #4a4f4a; }
  </style>
</head>
<body>
  <section class="page">
    <p class="kicker">Bodha AI</p>
    <div class="banner">
      <p class="kicker" style="color:#a9d4c0">${escapeHtml(t.overview)}</p>
      <h1>${escapeHtml(winner?.name ?? record.recommendedPlatform)} · ${rupee(record.recommendedPrice)}</h1>
      <p>${escapeHtml(record.title)}</p>
    </div>
    <h2>${escapeHtml(t.why)}</h2>
    <p>${escapeHtml(winner?.explanation ?? '')}</p>
    <h2>${escapeHtml(t.benefits)}</h2>
    <ul>${bullets(insights.platformBenefits)}</ul>
    <p class="note">${escapeHtml(CATEGORIES[record.category].label)} · ${rupee(record.manufacturingCost)} cost · ${rupee(record.currentPrice)} current</p>
  </section>

  <section class="page">
    <h1>${escapeHtml(t.pricing)}</h1>
    <p>${escapeHtml(t.breakEven)} <span class="figure">${rupee(winner?.breakEvenPrice ?? 0)}</span></p>
    <p>${escapeHtml(t.yourPrice)} <span class="figure">${rupee(record.currentPrice)}</span></p>
    <p>${escapeHtml(t.recommended)} <span class="figure">${rupee(record.recommendedPrice)}</span></p>
    <p>${escapeHtml(winner?.explanation ?? '')}</p>
  </section>

  <section class="page">
    <h1>${escapeHtml(t.comparison)}</h1>
    <table>
      <thead><tr><th>Marketplace</th><th>Fee</th><th>Listings</th><th>Price</th><th>Fit</th></tr></thead>
      <tbody>${comparisonRows}</tbody>
    </table>
  </section>

  <section class="page">
    <h1>${escapeHtml(t.competitors)}</h1>
    ${competitorCards}
  </section>

  <section class="page">
    <h1>${escapeHtml(t.reviews)}</h1>
    <div class="cols">
      <div>
        <h2>${escapeHtml(t.praises)}</h2>
        ${insights.reviewSentiment.available ? '<ul>' + bullets(insights.reviewSentiment.topPraises) + '</ul>' : '<p>' + escapeHtml(t.noReviews) + '</p>'}
      </div>
      <div>
        <h2>${escapeHtml(t.complaints)}</h2>
        ${insights.reviewSentiment.available ? '<ul>' + bullets(insights.reviewSentiment.topComplaints) + '</ul>' : '<p>' + escapeHtml(t.noReviews) + '</p>'}
      </div>
    </div>
    <h2>${escapeHtml(t.demand)}</h2>
    ${demandBars}
    <p class="note">${escapeHtml(t.disclaimer)}</p>
  </section>

  <section class="page">
    <h1>${escapeHtml(t.listing)}</h1>
    <h2>${escapeHtml(record.optimizedListing.title)}</h2>
    ${record.optimizedListing.description
      .split('\n\n')
      .map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>')
      .join('')}
    <p>${escapeHtml(record.optimizedListing.keywords.join(' · '))}</p>
  </section>
</body>
</html>`;
}

export async function renderReportPdf(record: AnalysisRecord, language: UiLanguage): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildReportHtml(record, language), { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function platformProfiles() {
  return Object.values(PLATFORMS).map((platform) => ({
    id: platform.id,
    name: platform.name,
    benefits: platform.benefits,
  }));
}
