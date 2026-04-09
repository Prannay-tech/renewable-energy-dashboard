# Architecture Overview

> Post-build documentation. See `planning/PLANNING.md` for the original plan.

---

## Final Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes act as secure server-side proxies; no API keys exposed to browser |
| Language | TypeScript | Type safety critical for financial math (IRR, NPV, LCOE) |
| State | Zustand | Lightweight cross-tab global store; avoids prop-drilling across 4 independent tab components |
| Charts | Recharts | Composable React components; AreaChart, BarChart, ComposedChart, heatmap via custom cells |
| Map | Leaflet (SSR-safe) | Interactive US state markers via dynamic import with `{ ssr: false }` |
| AI | Anthropic Claude API | claude-haiku-4-5 for streaming chat; claude-sonnet-4-5 for investment memo generation |
| Data APIs | EIA, FRED, NREL | Government open-data APIs; all proxied through Next.js `/api/*` routes |
| Styling | Tailwind CSS | Utility-first; dark theme (`slate-900` bg) throughout |
| Deployment | Vercel | Zero-config Next.js hosting; env vars set via Vercel CLI |

**Changes from plan:** Originally considered react-query for data fetching — dropped in favour of direct fetch inside Zustand actions to keep the dependency count low and avoid hydration complexity with Next.js 14's App Router.

---

## Folder Structure

```
src/
├── app/
│   ├── page.tsx                  # Root shell — tab navigation, sticky header
│   ├── layout.tsx                # Global layout, metadata, font
│   └── api/
│       ├── eia/route.ts          # Proxy → EIA Open Data API (prices + capacity)
│       ├── fred/route.ts         # Proxy → FRED API (Fed Funds Rate + CPI)
│       ├── nrel/route.ts         # Proxy → NREL API (solar irradiance by state)
│       ├── ai/route.ts           # Claude claude-haiku-4-5 streaming SSE (Research Assistant)
│       └── ai-summary/route.ts   # Claude claude-sonnet-4-5 (investment memo generation)
├── components/
│   ├── tabs/
│   │   ├── MarketOverview.tsx    # Tab 1 — EIA/FRED KPIs + AreaChart + BarChart
│   │   ├── ProjectEconomics.tsx  # Tab 2 — IRR/NPV/LCOE calculator + sensitivity heatmap + AI memo
│   │   ├── GeographicViz.tsx     # Tab 3 — Leaflet map + state rankings sidebar
│   │   └── ResearchAssistant.tsx # Tab 4 — Claude streaming chat with live context panel
│   ├── MapComponent.tsx          # Leaflet map (client-only, dynamically imported)
│   └── ui/
│       ├── card.tsx              # Card, CardHeader, CardTitle, CardContent
│       ├── badge.tsx             # Coloured status badges
│       ├── tooltip.tsx           # Hover tooltip (provenance labels)
│       └── skeleton.tsx          # Skeleton, SkeletonCard, SkeletonChart
├── store/
│   └── dashboard.ts             # Zustand store — all shared state + types
└── lib/
    └── calculations.ts          # IRR (bisection), NPV, LCOE, sensitivity analysis
```

---

## Cross-Tab Data Flow

Three concrete data flows implemented via Zustand global store:

**1. Geographic → Project Economics**
When a user clicks a state on the Leaflet map (Tab 3), `onStateSelect` calls `setSelectedState(state)` in the Zustand store. Tab 2 (Project Economics) reads `selectedState` from the store and surfaces a banner: _"Using Texas electricity rate: 8.32¢/kWh from EIA"_ with a one-click button to apply that rate to the active calculator scenario. This lets analysts benchmark a real project against its actual grid rate instantly.

**2. Project Economics → Research Assistant**
Every Research Assistant API call (Tab 4) includes the full calculator scenario and computed results in the system prompt — system size, capacity factor, IRR, NPV, LCOE, payback years, debt structure, ITC. The user sees a live _"What AI sees"_ context panel on the right side of the chat interface showing exactly which data is being sent. This means an analyst can ask "Is my IRR realistic?" and receive a grounded, specific answer.

**3. Market Overview → Research Assistant (and all tabs)**
The `marketSnapshot` in Zustand (populated on first load of Tab 1 from EIA + FRED APIs) is included in every AI request. The AI labels data explicitly: 🟢[EIA Live] for electricity prices and capacity, 🟡[FRED Live] for interest rates and inflation. If the snapshot hasn't loaded yet, the AI notes "Not yet loaded" for market context.

---

## AI Integration Design

**Two Claude integrations:**

1. **Research Assistant (claude-haiku-4-5, streaming SSE)**
   - Context injected: market snapshot (EIA + FRED), calculator scenario + results, selected state
   - Response streamed as Server-Sent Events; UI updates word-by-word via ReadableStream
   - Suggested starter questions shown when chat is empty
   - Session history persists in Zustand across tab switches

2. **AI Investment Memo (claude-sonnet-4-5, single request)**
   - Triggered by "AI Investment Summary" button in Tab 2
   - Generates a structured 1-page memo: Executive Summary, Project Economics, Market Context, Key Risks, Recommendation
   - Non-streaming; full response displayed with a timestamp footer: _"AI-generated memo · Grounded in live EIA & FRED data"_
   - Uses sonnet (more capable) for this longer, structured output vs. haiku for interactive chat

**Prompt engineering decisions:**
- Structured source labels in every response (🟢/🟡/🔵/⚪/🔢) so analysts can immediately assess data provenance
- Explicit instruction to "flag anomalies" if a metric looks unusual vs. benchmarks
- Capped at 3-4 paragraphs for chat (not walls of text); memo uses explicit section headers
- System prompt distinguishes Live API data from [Industry Benchmark] knowledge from training data

**Boundary between AI output and verified data:**
- All KPI cards (electricity price, solar/wind capacity, Fed Funds Rate, inflation) are sourced directly from APIs and rendered as primary data — never from AI output
- AI output is visually separated: chat bubbles in Tab 4, purple-bordered memo card in Tab 2
- Tooltip provenance on every KPI card shows exact API endpoint and last-updated timestamp

---

## What Changed From the Plan

| Original Plan | Actual Implementation | Reason |
|---|---|---|
| react-query for data fetching | Direct fetch in Zustand actions | Fewer dependencies, simpler hydration |
| NREL API call for all states | Static pre-compiled irradiance table | NREL's all-states endpoint is rate-limited; static data is more reliable and accurate |
| Basic sensitivity table | Colour-coded heatmap grid | More readable for analysts scanning many scenarios |
| Single Claude integration | Two separate routes (haiku chat + sonnet memo) | Different tasks warrant different models; sonnet's quality justified for structured memo |
| Simple loading spinner | SkeletonCard + SkeletonChart components | Better UX; prevents layout shift |
