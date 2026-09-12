/**
 * Live proof for review snippets + Google Trends (region and 12-month series).
 * Prints raw upstream payloads next to the values that would be shown.
 */
import { composeSearchQuery } from '../src/services/listingRelevance.js';
import { closeBrowser } from '../src/services/scraper/browserPool.js';
import { AmazonScraper } from '../src/services/scraper/amazonScraper.js';
import { FlipkartScraper } from '../src/services/scraper/flipkartScraper.js';
import { SnapdealScraper } from '../src/services/scraper/snapdealScraper.js';
import { collectReviewSnippets, analyzeReviewSentiment, MIN_REVIEW_SNIPPETS } from '../src/services/reviewSentiment.js';
import { fetchRegionalDemand, pickTrendsKeyword } from '../src/services/regionalDemandService.js';
import { computeDataConfidence } from '../src/services/confidenceScore.js';
import type { CategoryId, ComparableListing, PlatformId } from '../src/types/index.js';

const PRODUCTS: { title: string; category: CategoryId }[] = [
  { title: 'USB C Fast Charging Cable', category: 'electronics-accessories' },
  { title: "Men's Running Shoes", category: 'apparel' },
];

async function scrapePlatform(
  platformId: PlatformId,
  title: string,
  category: CategoryId,
): Promise<ComparableListing[]> {
  const query = composeSearchQuery(title, category);
  if (platformId === 'amazon') return new AmazonScraper().search(query, category);
  if (platformId === 'flipkart') return new FlipkartScraper().search(query, category);
  if (platformId === 'snapdeal') return new SnapdealScraper().search(query, category);
  return [];
}

async function main() {
  const trendsByTitle: Record<string, Awaited<ReturnType<typeof fetchRegionalDemand>>> = {};

  for (const product of PRODUCTS) {
    console.log('\n======== TRENDS ' + product.title + ' ========');
    console.log('keyword=' + pickTrendsKeyword(product.title) + ' category=' + product.category);
    const demand = await fetchRegionalDemand(product.title, product.category);
    trendsByTitle[product.title] = demand;
    console.log(
      'DISPLAY regional ' +
        JSON.stringify({
          available: demand.available,
          states: demand.states,
          seasonalTiming: demand.seasonalTiming,
        }),
    );
  }

  const first = trendsByTitle[PRODUCTS[0].title];
  const second = trendsByTitle[PRODUCTS[1].title];
  const sameStates =
    JSON.stringify(first.states) === JSON.stringify(second.states) && first.states.length > 0;
  console.log(
    '\nTRENDS_DIFF ' +
      JSON.stringify({
        sameStateRanking: sameStates,
        cableStates: first.states,
        shoesStates: second.states,
        cableTiming: first.seasonalTiming,
        shoesTiming: second.seasonalTiming,
      }),
  );

  const product = PRODUCTS[0];
  const platforms: PlatformId[] = ['amazon', 'flipkart', 'snapdeal'];
  const listingsByPlatform: Partial<Record<PlatformId, ComparableListing[]>> = {};

  for (const platformId of platforms) {
    try {
      listingsByPlatform[platformId] = await scrapePlatform(platformId, product.title, product.category);
    } catch (error) {
      console.warn('scrape failed', platformId, error instanceof Error ? error.message : error);
      listingsByPlatform[platformId] = [];
    }
  }

  const snippetGroups: Record<string, string[]> = {};
  for (const platformId of platforms) {
    snippetGroups[platformId] = await collectReviewSnippets(
      platformId,
      listingsByPlatform[platformId] ?? [],
    );
  }
  const allSnippets = Object.values(snippetGroups).flat();
  const sentiment = await analyzeReviewSentiment(allSnippets, 'en');
  console.log(
    '\nREVIEW_PROOF ' +
      JSON.stringify({
        minThreshold: MIN_REVIEW_SNIPPETS,
        perPlatformCounts: Object.fromEntries(
          Object.entries(snippetGroups).map(([id, snippets]) => [id, snippets.length]),
        ),
        totalSnippets: allSnippets.length,
        samples: allSnippets.slice(0, 4),
        displayedSentiment: sentiment,
      }),
  );

  const abundant = listingsByPlatform.amazon ?? [];
  const scarce = (listingsByPlatform.flipkart ?? []).slice(0, 2);
  console.log(
    '\nCONFIDENCE_PROOF ' +
      JSON.stringify({
        abundant: computeDataConfidence(product.title, abundant.length, 'live', abundant),
        scarce: computeDataConfidence(product.title, scarce.length, 'cached', scarce),
      }),
  );

  await closeBrowser();
}

await main();
