# Bodha AI

**An AI-powered marketplace recommendation engine for Indian e-commerce sellers.**

> Team **Code4Bharat** — Sanchit Jaiswal · Krishna Keshab · Chiraag Mutupuri · Sagnik Mitra · Sanjay Kumar Gupta

---
 
## 1. Problem statement

A small Indian seller with a product to list faces three decisions at once, and gets
no help with any of them:

1. **Where should I sell it?** Amazon, Flipkart, Snapdeal and Alibaba have very
   different commissions, buyer demand and competitive density. Picking wrong means
   thin margins or no sales.
2. **What price should I set?** Sellers routinely copy the going rate off a search
   page without checking whether that price even covers their manufacturing cost
   plus the marketplace's commission, GST on that commission, and shipping. The
   result is listings that lose money on every unit sold.
3. **How do I write the listing?** A weak title and missing keywords bury a product
   in search, no matter how good it is.

These questions need live market data, a margin-safe pricing calculation, and
copywriting help — and today a seller answers them by guesswork.

## 2. Solution overview

Bodha AI answers all three questions in a single pass and **never recommends a price
that loses the seller money.**

Given a product (title, description, category, image, manufacturing cost, current
price, and the marketplaces to consider), Bodha AI:

- **Reads the live market.** Playwright scrapes Amazon.in, Flipkart and Snapdeal
  search results at query time for comparable listings, prices, ratings and review
  counts. Results are cached for a few hours; if a scrape is blocked it falls back
  to the last snapshot.
- **Computes a margin-safe price per marketplace.** A pure pricing engine derives a
  **break-even floor** from cost + effective commission (published rate + 18% GST on
  it) + shipping, then recommends `max(market price, break-even)` — clamped so the
  recommendation is *never* below the floor. When comparable products sell below
  what the seller can afford, it says so instead of following the market down.
- **Ranks the marketplaces** by a 0–100 fit score blending normalised profit,
  competition and demand, and names the best one.
- **Rewrites the listing** into an SEO-shaped title, a scannable description and 3–5
  keywords — via Google Gemini when a key is configured, deterministic templates
  otherwise.
- **Adds context:** competitor cards with strengths/weaknesses, buyer review themes
  (praises vs complaints), and region-by-region demand from Google Trends.
- **Explains every number** in plain English (English, Hindi or Tamil), citing the
  evidence behind it.

It ships as a responsive web app, a packaged **Android app**, and a **multilingual
voice assistant** so a seller can simply ask "where should I sell this and for how
much?".

---

## 3. Technologies & tools

| Layer | Stack |
|---|---|
| **Frontend** | React 18, Vite 6, TypeScript, Tailwind CSS 3, React Router 6, TanStack React Query 5, Recharts, i18next (English / हिंदी / தமிழ்) |
| **Mobile** | Capacitor 7 (Android WebView wrapper) — Camera, Filesystem, Preferences, Push Notifications, Share, Speech Recognition plugins |
| **Backend** | Node.js 22.5+, Express 5, TypeScript, Zod (validation) |
| **Market data** | Playwright (headless Chromium scrapers for Amazon / Flipkart / Snapdeal), one-at-a-time per-host queue, `robots.txt` + bot-check aware |
| **Persistence** | `node:sqlite` (Node's built-in driver — no native build step); optional MongoDB mirror via Mongoose |
| **AI** | Google Gemini (`generativelanguage` REST API) — listing copy, voice answers, photo-to-listing vision, review-theme summarisation |
| **Voice** | ElevenLabs Conversational AI agent, with an on-site Gemini/text fallback |
| **External services** | Google Trends (regional demand), Google Identity Services ("Sign in with Google"), Razorpay test checkout (Pro plan) |
| **Reporting** | Server-rendered PDF export of any analysis |
| **Quality** | Vitest (≈110 backend + ≈23 frontend tests), ESLint, Prettier, GitHub Actions CI |
| **Deployment** | Backend on Render; web client configured for Vercel |

---

## 4. Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        CLIENT  ·  Web SPA + Android app                    │
│   React + Vite + Tailwind   ·   Capacitor WebView   ·   i18n (en / hi / ta)│
│   Home → Sign up / Onboarding → Analyze form → Report dashboard → History  │
│   Voice assistant (ElevenLabs, floating)                                   │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │  REST / JSON   (HttpOnly session cookie)
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                BACKEND  ·  Node + Express + TypeScript                     │
│                                                                           │
│  routes/    auth · billing · products · voice · voice-tools               │
│                 │                                                         │
│                 ▼                                                         │
│  analysisService  — orchestration (IDs, clock, persistence, scraping)     │
│     ├─ marketplaceDataProvider ──► Playwright scrapers ──► Amazon         │
│     │      cache-first, TTL 3h          (queue + bot-check)   Flipkart    │
│     │                                                        Snapdeal     │
│     ├─ pricingEngine          (PURE)   where to sell · what to charge     │
│     ├─ listingOptimizer       (PURE + Gemini)   how to write the listing  │
│     ├─ competitorAnalysis / reviewSentiment   (scrape + Gemini)          │
│     └─ regionalDemandService  ──► Google Trends (interest by state)       │
│                                                                           │
│  models/    SQLite (node:sqlite, zero native build)  +  MongoDB (optional)│
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼──────────────────────────┐
         ▼                         ▼                          ▼
   ElevenLabs                Google Gemini              Razorpay (test)
   Conversational AI       listing · voice ·            Pro subscription
   (voice assistant)       vision · review themes       ($10 / mo → ₹830)
```

**Design rule:** `pricingEngine` and `listingOptimizer` are **pure functions** — data
in, data out, no HTTP / DB / clock / UI. Everything impure (IDs, timestamps,
persistence, Playwright, Gemini) lives in `analysisService`. That is what makes the
business rules directly unit-testable.

### Workflow — `POST /api/products/analyze`

```
Analyze form  →  services/api.ts  →  POST /api/products/analyze
                                          │  auth + free-quota check (6 / month)
                                          ▼
                                 zod validation (400 on failure)
                                          ▼
                    marketplaceDataProvider.getMarketData()
                        fresh cache (< 3h)      → use it            (freshness: cached)
                        else Playwright scrape  → Amazon/Flipkart/Snapdeal (live)
                        scrape fails            → stale cache, else "unavailable"
                                          ▼
                    pricingEngine.analyzePricing(snapshots)          ← PURE
                        break-even floor · fit score · ranking · price advice
                                          ▼
                    listingOptimizer.optimizeListing()               ← Gemini or templates
                                          ▼
                    competitor cards + review themes + regional demand
                                          ▼
                    saveAnalysis()  →  SQLite   (+ MongoDB mirror if configured)
                                          ▼
              201 + full report  →  React Query cache  →  /report/:productId
```

### Repository layout

```
bodha-ai/
├── backend/                     Node + Express + TypeScript REST API
│   └── src/
│       ├── routes/              HTTP layer — auth, billing, products, voice, voice-tools
│       ├── services/
│       │   ├── pricingEngine.ts            pure business logic, unit tested
│       │   ├── listingOptimizer.ts         pure + Gemini listing rewriter
│       │   ├── marketplaceDataProvider.ts  cache-first, then Playwright scrape
│       │   ├── analysisService.ts          orchestration (IDs, clock, persistence)
│       │   ├── competitorAnalysis.ts       competitor strengths / weaknesses
│       │   ├── reviewSentiment.ts          review-page scrape + theme summary
│       │   ├── regionalDemandService.ts    Google Trends interest-by-state
│       │   ├── geminiService.ts            Gemini REST client (text + vision)
│       │   ├── voiceService.ts             on-site voice fallback
│       │   ├── pdfReport.ts                server-rendered PDF export
│       │   └── scraper/                    Amazon / Flipkart / Snapdeal adapters, queue, anti-bot
│       ├── models/              SQLite schema + repositories, optional Mongoose mirror
│       ├── middleware/auth.ts   session cookie / bearer token
│       ├── data/                platformConfig.ts (fees) + categories.ts
│       ├── config/env.ts        single source of truth for env vars
│       └── tests/               Vitest suites (live-scrape tests skipped by default)
├── frontend/                    React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── pages/               Home, Login, Signup, Onboarding, Analyze, Report, Dashboard, Pricing
│       ├── components/          layout/, analyze/, report/, auth/, voice/, ui/
│       ├── hooks/               React Query bindings + form state + auth
│       ├── i18n/                en / hi / ta locale bundles
│       └── services/api.ts      the ONLY place that calls fetch
├── native/                      Capacitor plugin adapters (imported as @native/* by the web app)
├── android/                     generated native Android project
├── capacitor.config.ts          wraps frontend/dist as the Android app
└── .github/workflows/ci.yml     lint · format · typecheck · test · build (both packages)
```

---

## 5. Setup & run

### Prerequisites

- **Node.js 22.5 or newer** — the API uses the built-in `node:sqlite` module, so
  there is no native build step. Developed and verified on Node 26.
- For the Android build only: Android Studio + JDK 17.

### Local development

```bash
# 1. Install dependencies for the root, backend and frontend packages
npm run install:all

# 2. Install the Chromium build the live scrapers use
npx --prefix backend playwright install chromium

# 3. Create env files from the templates (defaults work as-is for local dev)
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env

# 4. (optional) seed a demo account with 5 sample analyses
npm --prefix backend run seed:demo
#    → login: bodhaai.test@gmail.com / qwerty123

# 5. Run the API (:4000) and the web app (:5173) together
npm run dev
```

Then open **http://localhost:5173**.

Prefer two terminals? `npm run dev:backend` and `npm run dev:frontend`.

### Optional configuration

**The app runs fully without any API keys** — Gemini falls back to templates, voice
falls back to on-site text, billing uses a mock checkout, and data is stored in
local SQLite. Set any of these in `backend/.env` to switch on the real integration:

| Env var | Enables |
|---|---|
| `GEMINI_API_KEY` | Gemini-written listing copy, voice answers, photo-to-listing, review themes |
| `ELEVENLABS_API_KEY` | ElevenLabs voice assistant (the agent ID is already set; do not create a new one) |
| `MONGODB_URI` | Mirror every write to MongoDB Atlas / local Mongo alongside SQLite |
| `GOOGLE_CLIENT_ID` | "Sign in with Google" button (email + password always works) — same value in `frontend/.env` as `VITE_GOOGLE_CLIENT_ID` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Real Razorpay **test-mode** checkout for the Pro plan |

### Android app

A prebuilt **`Bodha-AI.apk`** sits at the repository root. To rebuild it:

```bash
npm run android:build   # vite build (--mode android) + cap sync
npm run android:open     # open the project in Android Studio
npm run android:run      # build and run on a connected device / emulator
```

The packaged app has no dev proxy, so it reads the deployed API URL from
`frontend/.env.android`.

### All scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web app together |
| `npm run dev:backend` / `npm run dev:frontend` | one package at a time |
| `npm test` | backend unit + API suites (live scrapes skipped) |
| `npm run lint` | ESLint across both packages |
| `npm run format:check` | Prettier check across both packages |
| `npm run build` | type-check and production-build both packages |
| `npm run android:build` / `:open` / `:run` | Capacitor Android tasks |
| `npm --prefix backend run seed:demo` | seed the demo account + 5 analyses |
| `npm --prefix backend run test:live-scrape` | run the real scraper tests (`LIVE_SCRAPE=1`) |

---

## 6. The pricing logic

For each selected marketplace:

| Step | Formula |
|---|---|
| Market price | `median(comparable listing prices)` for that category × platform |
| Effective commission | `feePercent × (1 + 0.18)` — marketplaces charge 18% GST on their own commission, deducted from the seller's settlement alongside it |
| **Break-even floor** | `manufacturingCost / (1 − effectiveFeePercent) + avgShippingFee` |
| Recommended price | `max(marketPrice, breakEvenPrice)` — clamped, never below the floor |
| Estimated profit | `price − price × effectiveFeePercent − avgShippingFee − manufacturingCost` |
| Fit score (0–100) | `0.4 × normalize(profit) + 0.3 × (100 − competition) + 0.3 × demand` |

Platforms are ranked by fit score; the top one becomes the **Recommended
Marketplace**. The weights, the 35% target margin used to normalise profit, the 18%
GST rate, and the ±10% re-pricing dead-band are all exported constants in
[`pricingEngine.ts`](backend/src/services/pricingEngine.ts).

**Price advice** compares the seller's current price to the recommendation: below 90%
→ `increase`, above 110% → `decrease`, otherwise `hold`.

### The loss-prevention guarantee

If comparable products sell *below* what the seller can afford to charge, Bodha AI
does not follow the market down. It floors the recommendation at break-even, sets
`lossRiskAvoided: true`, and shows a "Loss protection applied" notice explaining why.

`demandIndex` and `competitionIndex` are heuristics derived from scraped fields, not
scores the platforms publish:

- `demandIndex = 100 × log10(1 + avg reviewCount) / log10(1 + 10000)`
- `competitionIndex = 100 × listingCount / 20` (page-1 density, cap 20)

Commission rates are each marketplace's real-world published band (Amazon 15–20%,
Flipkart 12–18%, Snapdeal 8–12%, Alibaba 3–6%) — commercial config, not scraped.
Alibaba is B2B and not scraped; it appears as "Data temporarily unavailable".

---

## 7. API

Base URL `http://localhost:4000`. Session is an HttpOnly cookie (or `Authorization:
Bearer <token>`). All errors return `{ "error": { "code", "message", "details?" } }`.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/signup` · `login` · `logout` · `google` | account + session |
| `GET /api/auth/me` · `POST /api/auth/onboarding` | current user + store profile |
| `POST /api/products/analyze` → `201` | run and persist a full analysis |
| `POST /api/products/insight` | photo → suggested title / description / category |
| `GET /api/products/history` | newest-first list of this seller's analyses |
| `GET /api/products/:id` → `200` / `404` | the full stored report (owner only) |
| `GET /api/products/:id/pdf?lang=en\|hi\|ta` | download the report as a PDF |
| `GET /api/billing/plan` · `POST /api/billing/order` · `verify` | Pro subscription (Razorpay) |
| `GET /api/voice/session` · `POST /api/voice/query` | ElevenLabs token + on-site fallback |
| `GET /api/voice-tools/*` | server-tool webhooks the voice agent calls (shared-secret gated) |
| `GET /api/health` | status, active listing optimizer, cache size + TTL |
| `GET /api/meta` | categories + platforms that populate the form controls |
| `DELETE /api/cache` | drop cached listings so the next analyze is forced live (demo helper) |

<details>
<summary><code>POST /api/products/analyze</code> — request / response</summary>

```jsonc
// request
{
  "title": "USB C Fast Charging Cable",
  "description": "Nylon braided 1.5m cable supporting 65W fast charge.",
  "category": "electronics-accessories",
  "imageUrl": null,                    // or a data: URL
  "manufacturingCost": 400,
  "currentPrice": 800,
  "platforms": ["amazon", "flipkart", "snapdeal", "alibaba"],
  "language": "en"                     // en | hi | ta
}
```

```jsonc
// response (abridged)
{
  "productId": "cb7fbc23-…",
  "recommendedPlatform": "amazon",
  "recommendedPrice": 999,
  "platforms": [
    {
      "name": "Amazon", "feePercent": 0.18, "marketPriceRange": [899, 1199],
      "recommendedPrice": 999, "breakEvenPrice": 567.87,
      "estimatedProfit": 170.08, "profitMargin": 0.2126,
      "competition": "High", "demand": "High", "fitScore": 74.8,
      "priceAction": "increase", "explanation": "Similar products on Amazon sell…",
      "lossRiskAvoided": false
    }
  ],
  "optimizedListing": { "title": "…", "description": "…", "keywords": ["fast charging", "…"] },
  "insights": { "competitors": [ … ], "reviewSentiment": { … }, "regionalDemand": { … } },
  "credits": { "plan": "free", "remaining": 5 }
}
```
</details>

---

## 8. Tests & CI

```bash
npm test          # backend: ~110 unit + API tests (3 live-scrape tests skipped)
```

The backend suite covers the pricing engine (including an exhaustive sweep asserting
that across **every** category × platform × cost combination, cost + commission is
always recovered), the listing optimizer, scraper parsing, the market-data provider,
auth and billing routes, the voice tools, i18n, and API-contract round-trips.

GitHub Actions runs `lint → format:check → tsc --noEmit → test → build` for both the
backend and frontend on every push to `main` and every pull request.

---

## 9. Out of scope

Real marketplace seller APIs (search-page scraping is used instead), production
payment settlement (Razorpay stays in test mode), and languages beyond English,
Hindi and Tamil — deliberately excluded to keep the project focused.

---

## Team — Code4Bharat

| Name |
|---|
| Sanchit Jaiswal |
| Krishna Keshab |
| Chiraag Mutupuri |
| Sagnik Mitra |
| Sanjay Kumar Gupta |
