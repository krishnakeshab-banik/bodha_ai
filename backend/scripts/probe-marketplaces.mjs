/**
 * One-off DOM probe. Run sparingly:
 *   node scripts/probe-marketplaces.mjs
 *
 * Dumps title, block signals, candidate selector counts, and a truncated
 * HTML sample of the first product-like card so scrapers are written against
 * the live page, not remembered class names.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const QUERY = 'USB C Fast Charging Cable';
const OUT_DIR = path.resolve('scripts', 'probe-output');

const TARGETS = [
  {
    id: 'amazon',
    url: `https://www.amazon.in/s?k=${encodeURIComponent(QUERY)}`,
    candidates: [
      '[data-component-type="s-search-result"]',
      'div[data-asin]',
      '.s-result-item',
      '.a-price',
      '.a-price-whole',
      'span.a-offscreen',
      'h2 a span',
      'h2 span',
      '.a-icon-alt',
      'span[aria-label*="stars"]',
    ],
  },
  {
    id: 'flipkart',
    url: `https://www.flipkart.com/search?q=${encodeURIComponent(QUERY)}`,
    candidates: [
      'div[data-id]',
      'a[href*="/p/"]',
      'div.tUxRFH',
      'div._1AtVbE',
      'div._4rR01T',
      'a.wjcEIp',
      'div.KzDlHZ',
      'div.Nx9bqj',
      'div._30jeq3',
      'div._25b18c',
      'div.yiggsN',
      'span.Y1HWSB',
    ],
  },
  {
    id: 'snapdeal',
    url: `https://www.snapdeal.com/search?keyword=${encodeURIComponent(QUERY)}&sort=rlvncy`,
    candidates: [
      '.product-tuple-listing',
      '.col-xs-6.product-tuple-listing',
      '.product-title',
      '.product-price',
      '#products',
      '.product-tuple-image',
      'div[data-js-pos]',
      '.product-desc-rating',
    ],
  },
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function detectBlock(title, html) {
  const hay = `${title}\n${html}`.toLowerCase();
  const needles = ['captcha', 'robot', 'enter the characters', 'access denied', 'unusual traffic'];
  return needles.filter((n) => hay.includes(n));
}

async function probe(page, target) {
  const started = Date.now();
  const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2500);

  const title = await page.title();
  const finalUrl = page.url();
  const html = await page.content();
  const blockHits = detectBlock(title, html);

  const selectorCounts = {};
  for (const selector of target.candidates) {
    selectorCounts[selector] = await page.locator(selector).count();
  }

  const firstCardHtml = await page.evaluate((selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.length > 20) {
        return { selector, html: el.outerHTML.slice(0, 4000), text: el.innerText.slice(0, 800) };
      }
    }
    return null;
  }, target.candidates);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${target.id}.png`), fullPage: false });

  return {
    id: target.id,
    requestedUrl: target.url,
    finalUrl,
    status: response?.status() ?? null,
    title,
    elapsedMs: Date.now() - started,
    blockHits,
    selectorCounts,
    firstCard: firstCardHtml,
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: UA,
  locale: 'en-IN',
  viewport: { width: 1366, height: 768 },
  extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9' },
});
const page = await context.newPage();

const results = [];
for (const target of TARGETS) {
  console.log(`\n=== probing ${target.id} ===`);
  try {
    const result = await probe(page, target);
    results.push(result);
    console.log(JSON.stringify({ ...result, firstCard: result.firstCard ? { selector: result.firstCard.selector, text: result.firstCard.text } : null }, null, 2));
  } catch (error) {
    const failed = { id: target.id, error: error instanceof Error ? error.message : String(error) };
    results.push(failed);
    console.error(failed);
  }
  await page.waitForTimeout(1500 + Math.floor(Math.random() * 800));
}

fs.writeFileSync(path.join(OUT_DIR, 'probe.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(`\nWrote ${path.join(OUT_DIR, 'probe.json')}`);
