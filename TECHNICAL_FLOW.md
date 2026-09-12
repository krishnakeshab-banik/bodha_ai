# Bodha AI — Technical flow

How a product analysis is produced, from the seller’s form to the numbers on the report. This matches the current code: live scrapes first, honest empty states when a source fails, and no invented market or review numbers.

---

## 1. What the system answers

One signed-in request produces four decisions:

| Question | Produced by | Grounded in |
|---|---|---|
| Where should I sell? | Highest **fit score** among *available* platforms | Live (or cached) listings + static fees |
| What should I charge? | `max(market median, break-even)` | Same listings + cost + commission + GST + shipping |
| How much can I trust this? | **High / Medium / Low** confidence | Listing count, title match, data freshness |
| When is demand strongest? | Seasonal peak from 12-month Trends, or “no pattern” | Google Trends `interestOverTime` |

Plus listing copy, competitor cards, review themes, and state-level search interest.

---

## 2. Runtime shape

```
Seller (browser or Android WebView)
        │  HTTPS / cookie session
        ▼
React SPA  :5173          Express API  :4000
  Analyze form              POST /api/products/analyze
  Report sections           analysisService.createAnalysis()
        ▲                           │
        │  JSON report              ├── marketplaceDataProvider  → Playwright
        └───────────────────────────┤── pricingEngine            (pure)
                                    ├── confidenceScore
                                    ├── reviewSentiment          → product pages + Gemini
                                    ├── regionalDemandService    → Google Trends
                                    ├── listingOptimizer         → Gemini or templates
                                    └── SQLite (+ optional Mongo)
```

**Purity rule:** `pricingEngine` has no HTTP, database, clock, or UI. `analysisService` is the only place that creates IDs, talks to scrapers, calls Gemini/Trends, and writes the store.

| Layer | Role |
|---|---|
| `frontend/src/pages/AnalyzePage.tsx` | Collect title, description, category, cost, price, platforms |
| `frontend/src/hooks/useProducts.ts` | `POST` analyze, cache the `201` body, navigate to `/report/:id` |
| `backend/src/routes/productRoutes.ts` | Auth, free-quota (6/month), Zod parse |
| `backend/src/services/analysisService.ts` | Orchestrate one run |
| `backend/src/models/productRepository.ts` | Persist the full `AnalysisRecord` |

---

## 3. Seller journey

```
Sign up / login / Google
        → optional onboarding (store name, city, category)
        → GET /api/meta  (categories + platform fees for the form)
        → Analyze form
              optional: camera / upload → POST /api/products/insight  (Gemini vision)
        → POST /api/products/analyze
        → /report/:productId
              Overview · Pricing · Comparison · Competitors · Reviews & demand · Listing
        → GET /api/products/history
        → GET /api/products/:id/pdf
```

The report is **owner-only**. A missing or foreign `productId` returns `404` (not `403`) so existence cannot be probed.

---

## 4. Main pipeline — `POST /api/products/analyze`

```
1. requireUser + credit check
2. Zod: title, description, category, cost, price, platforms[], language
3. getMarketData()          live scrape per selected platform (parallel, isolated)
4. analyzePricing()         break-even, recommended price, fit score, rank
5. localize explanations    en / hi / ta
6. attachConfidenceScores() from this run’s listings
7. buildInsights()          reviews ∥ Google Trends (region + 12-month series)
8. optimizeListing()        Gemini, or templates if no key
9. saveAnalysis()           SQLite (Mongo mirror if MONGODB_URI is set)
10. 201 + full AnalysisRecord
```

Platforms are fetched in parallel. A throw on Amazon **does not** mark Flipkart or Snapdeal unavailable.

---

## 5. Live market data

Entry: `marketplaceDataProvider.getMarketData()`.

Search query: `composeSearchQuery(title, category)` — a branded model stays exact (`Sony WH-1000XM5`); a generic title gets the category label appended so the page is not a grab-bag.

### Per platform

```
Amazon
  Playwright search  →  listings
       │
       ├─ OK          → dataSource: live, cache written
       ├─ BLOCKED     → Gemini grounded search → else cache → else unavailable
       ├─ TIMEOUT     → skip Gemini, use cache → else unavailable
       └─ NOT_FOUND   → unavailable (or cache)

Flipkart / Snapdeal
  Playwright search  →  live → else cache → else unavailable

Alibaba
  No scraper. Always unavailable for market numbers.
  Profit is still computed from seller price + static fees.
```

Playwright launch order: bundled Chromium → system Chrome → Edge. One browser context at a time **per host** (`scraper/queue.ts`) so concurrent hits on the same site do not trip a block. Page outcome is classified in `pageState.ts` as `OK | BLOCKED | TIMEOUT | NOT_FOUND` (CAPTCHA / `sorry` URL → blocked; blank page → timeout; missing grid → not found).

Listings are then **filtered** (`listingRelevance.ts`) so a search for a specific model does not pull earpads and cases into the median.

### Snapshot derived from those listings

| Field | Source |
|---|---|
| `comparablePrices` | Prices on kept cards |
| `listingCount` | How many cards survived the filter |
| `demandIndex` | Log-scaled average `reviewCount` |
| `competitionIndex` | Page-1 density (`listingCount / 20 × 100`) |
| `dataSource` | `live` · `cached` · `gemini` · `unavailable` |

If the scrape fails and there is no cache, the snapshot is **unavailable**. The UI says so. It does not invent a price range.

---

## 6. Where to sell and what to charge

`pricingEngine.analyzePricing()` is pure.

For each selected platform:

```
effectiveFee     = publishedCommission × 1.18     (GST on marketplace commission)
breakEven        = cost / (1 − effectiveFee) + shipping
marketPrice      = median(comparablePrices)       (only if listings exist)
recommendedPrice = max(marketPrice, breakEven)    never below the floor
profit           = currentPrice − currentPrice×effectiveFee − shipping − cost
fitScore         = 0.4×normalize(profit) + 0.3×(100−competition) + 0.3×demand
```

Published fees (config, not scraped): Amazon 18% + ₹60, Flipkart 15% + ₹50, Snapdeal 10% + ₹45, Alibaba 5% + ₹0 (B2B).

**Price action** vs the seller’s current price: more than 10% below recommendation → `increase`; more than 10% above → `decrease`; else `hold`.

**Ranking:** available platforms first, then highest `fitScore`. An unavailable platform cannot win just because its score is zeroed.

**Loss protection:** if the market median is below break-even, the engine refuses to follow the market down, floors at break-even, and sets `lossRiskAvoided`.

Profit is always at the **seller’s listed price**, even when the platform is unavailable (`profitBasis: seller-fees`). Market listings affect the recommended price, not a silent ₹0 profit.

---

## 7. Confidence (data quality)

Attached after pricing, from **this run’s** listings — not a lookup table.

| Input | How it is read |
|---|---|
| Listing count | `15+` stronger, `6–14` mid, `≤5` weaker |
| Title match | Branded model score, or token overlap (`exact` / `close` / `category`) |
| Freshness | `live` > `gemini` > `cached`; `unavailable` → Low |

Those three combine into **High / Medium / Low**. Shown on the winner banner, each comparison row, and the price panel. Low is visually distinct (danger colour, left border, “treat this recommendation cautiously”).

Logged as `[agent:<platform>] confidence { level, listingCount, titleMatch, freshness, sampleTitles }`.

---

## 8. Insights (reviews, region, season)

`buildInsights()` runs **in parallel** with nothing that the price depends on (price is already computed).

### 8.1 What buyers are saying

1. For **every selected platform**, take that run’s comparable listing URLs.
2. Open the dedicated reviews page (Amazon `/product-reviews/{ASIN}`, Flipkart `/product-reviews/…`).
3. Log per platform: URL count, snippets found, samples.
4. Combined distinct snippets ≥ **4** → Gemini theme call (`topPraises` / `topComplaints`).
5. Below 4, no Gemini key, or Gemini failure → `{ available: false }` empty state.

There is **no** hardcoded praise/complaint list. “Not enough review data available yet” means the threshold was not met or Gemini could not run — the logs say which.

### 8.2 Estimated regional interest

`regionalDemandService.fetchRegionalDemand(title, category)`:

- **Keyword** = the product title (first 8 words if very long). Not a category seed like `fast charging`.
- Google Trends `interestByRegion` (`geo: IN`, last 90 days).
- States and scores are parsed only from `default.geoMapData`. No pre-written India list.
- Empty or failed API → “Regional interest data unavailable for this category”.

Logged: request `{ keyword, category, geo }`, raw `geoMapData`, then the parsed top 8 states.

### 8.3 Best time to sell

Same function also calls `interestOverTime` for the **past 12 months**.

- Weekly points are logged in full.
- Months are averaged; a peak is “seasonal” only if it is ≥ 1.5× the median **and** at least 15 points above it **and** the series spread is ≥ 20.
- Spike → “search interest has historically risen around {month}”.
- Flat / noisy → “No strong seasonal pattern detected for this category”.
- API failure → “Best-time-to-sell data is unavailable…”.

No festival calendar is applied unless the series itself shows the spike.

---

## 9. Listing rewrite

`listingOptimizer.optimizeListing()` takes title, description, category, winning platform, recommended price, language, and (if any) real complaint themes.

- `GEMINI_API_KEY` set → Gemini JSON (title, description, 3–5 keywords).
- Otherwise → deterministic templates from `categories.ts` keyword seeds (copy-writing hints only — never used as market prices or Trends queries).

---

## 10. What the report renders

| Section | Reads |
|---|---|
| Overview | Winner name + recommended price, explanation, freshness, confidence, platform benefits |
| Pricing | Break-even vs your price vs recommended, price action |
| Comparison | All selected platforms: fees, listing count, range, demand, competition, fit, confidence |
| Competitors | Ranked cards from the platform that actually had listings |
| Reviews & demand | Sentiment, Trends states, best-time-to-sell |
| Listing | Optimized title / description / keywords |

Unavailable platforms still appear (including Snapdeal when selected) with an honest status badge and fee-based profit if cost and price exist.

---

## 11. Supporting flows (not on the analyze critical path)

```
POST /api/auth/*          session cookie or Bearer token
POST /api/products/insight   photo → suggested title / description / category (Gemini vision)
GET  /api/products/:id/pdf   server-rendered PDF of the stored record
GET  /api/voice/session      ElevenLabs token; POST /api/voice/query = on-site fallback
GET  /api/voice-tools/*      shared-secret tools that read the stored report (no re-scrape)
POST /api/billing/*          Razorpay test checkout for Pro
```

Voice answers from **stored** insights. It does not invent reviews or Trends numbers that were never fetched.

---

## 12. Honesty rules

These apply everywhere the seller sees a number or a list:

1. Market prices, ranges, and listing counts come from a scrape, Gemini grounding, or cache from a previous real scrape — never from a demo table.
2. If that source is missing → **unavailable**, not ₹0 dressed up as a recommendation.
3. Review themes come from real snippets + Gemini, or the empty state.
4. Regional bars and seasonal advice come from that run’s Trends response, or the empty state.
5. Confidence is computed from the listings already gathered for that analysis.

Proof on a live run: grep backend logs for `[trends]`, `[agent:amazon|flipkart|snapdeal] review`, `review threshold check`, and `confidence`. Re-run with:

```bash
npx --prefix backend tsx scripts/verify-insights-real.ts
```

---

## 13. Key files

| File | Responsibility |
|---|---|
| `backend/src/services/analysisService.ts` | Orchestration |
| `backend/src/services/marketplaceDataProvider.ts` | Live-first market data |
| `backend/src/services/scraper/*` | Playwright, queue, bot/page classification |
| `backend/src/services/listingRelevance.ts` | Search query + keep-the-right-product filter |
| `backend/src/services/pricingEngine.ts` | Break-even, profit, fit, rank |
| `backend/src/services/confidenceScore.ts` | High / Medium / Low from this run |
| `backend/src/services/reviewSentiment.ts` | Per-platform review pages + Gemini themes |
| `backend/src/services/regionalDemandService.ts` | Trends region + 12-month season |
| `backend/src/services/listingOptimizer.ts` | Listing copy |
| `frontend/src/pages/ReportPage.tsx` | Report sections |
| `frontend/src/components/report/*` | Banner, comparison, pricing, reviews, confidence |

Types in `backend/src/types/index.ts` are the contract; the frontend keeps a hand-copied subset in `frontend/src/types/index.ts`.
