import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.TARGET_URL ?? 'http://localhost:5173';
const REPORT_ID = process.argv[2];
const OUT = path.resolve('..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60000);

async function shot(name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

if (REPORT_ID) {
  await page.goto(BASE + '/report/' + REPORT_ID, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1');
  const heading = await page.locator('h1').first().innerText();
  console.log('report heading:', heading);
  const badges = await page.locator('body').innerText();
  console.log('has cached badge:', /cached|last updated|live prices/i.test(badges));
  await shot('12-report-live-or-cached.png');
}

await page.goto(BASE + '/analyze', { waitUntil: 'networkidle' });
await page.getByLabel('Product title').fill('USB C Fast Charging Cable');
await page.getByLabel('Product description').fill(
  'Nylon braided 1.5m cable supporting 65W fast charge and data sync.',
);
await page.getByLabel('Category').selectOption({ label: 'Electronics Accessories' });
await page.getByLabel('Manufacturing cost per unit').fill('400');
await page.getByLabel('Current selling price').fill('800');
await shot('13-analyze-filled-live.png');

const started = Date.now();
await page.getByRole('button', { name: 'Analyze' }).click();
await page.waitForURL('**/report/**', { timeout: 90000 });
const elapsed = Date.now() - started;
console.log('ui analyze elapsedMs', elapsed);
await page.waitForSelector('h1');
await shot('14-report-after-cached-submit.png');

const text = await page.locator('body').innerText();
console.log('ui heading', (await page.locator('h1').first().innerText()));
console.log('shows cached:', /last updated|cached/i.test(text));
console.log('shows live:', /live prices/i.test(text));
console.log('shows unavailable:', /temporarily unavailable/i.test(text));

await browser.close();
