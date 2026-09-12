import { composeSearchQuery } from '../src/services/listingRelevance.js';
import { AmazonScraper } from '../src/services/scraper/amazonScraper.js';
import { FlipkartScraper } from '../src/services/scraper/flipkartScraper.js';
import { SnapdealScraper } from '../src/services/scraper/snapdealScraper.js';
import { closeBrowser } from '../src/services/scraper/browserPool.js';

const title = 'USB C Fast Charging Cable';
const category = 'electronics-accessories';
const query = composeSearchQuery(title, category);

async function probe(name: string, run: () => Promise<{ title: string; price: number }[]>) {
  const started = Date.now();
  try {
    const listings = await run();
    console.log(
      JSON.stringify({
        platform: name,
        ok: listings.length > 0,
        count: listings.length,
        sample: listings[0] ? { title: listings[0].title, price: listings[0].price } : null,
        ms: Date.now() - started,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        platform: name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      }),
    );
  }
}

const only = process.argv[2];
if (!only || only === 'amazon') await probe('amazon', () => new AmazonScraper().search(query, category));
if (!only || only === 'flipkart') await probe('flipkart', () => new FlipkartScraper().search(query, category));
if (!only || only === 'snapdeal') await probe('snapdeal', () => new SnapdealScraper().search(query, category));
await closeBrowser();
