# Planning Document

> Completed before writing any code — April 7, 2026

---

## Tech Stack

**Framework / Language:** Next.js 14 (App Router) + TypeScript

> **Why:** Next.js gives us API routes (to proxy all external API calls and hide keys server-side), React for the component-driven dashboard UI, and one-command Vercel deployment. TypeScript ensures correctness for financial math — IRR/NPV/LCOE calculations are where type bugs hide. The App Router enables React Server Components where useful and easy streaming for the AI chat.

**Key Libraries:**

| Library | Purpose |
|---|---|
| `tailwindcss` | Utility-first styling — fast to build, easy to keep consistent |
| `shadcn/ui` | Pre-built accessible components (cards, tabs, inputs, tooltips) |
| `recharts` | React-native charting — cash flow waterfall, price trends, sensitivity heat map |
| `react-leaflet` + `leaflet` | Interactive map for Tab 4 — free, no billing setup, great for state-level overlays |
| `zustand` | Lightweight global store — cross-tab data flow without Redux overhead |
| `ai` (Vercel AI SDK) | Streaming Claude responses with `useChat` hook |
| `@anthropic-ai/sdk` | Direct Claude API integration for the AI route |
| `date-fns` | Date formatting for API timestamps and chart axes |

**AI Provider:** Anthropic Claude (claude-sonnet-4-5 or claude-3-5-haiku for speed)

> **Why Claude:** Direct access via Anthropic SDK, best-in-class instruction following for structured analytical prompts, streaming support via Vercel AI SDK. Will keep context lean (live market snapshot + user scenario inputs) to stay well under $10 in API costs.

---

## Architecture Overview

### Folder Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout — font, metadata
│   ├── page.tsx                # Tab shell with shadcn Tabs
│   ├── globals.css
│   └── api/
│       ├── eia/route.ts        # Proxy: EIA Open Data API
│       ├── nrel/route.ts       # Proxy: NREL PVWatts + solar resource
│       ├── fred/route.ts       # Proxy: FRED economic indicators
│       └── ai/route.ts         # Claude streaming endpoint
├── components/
│   ├── tabs/
│   │   ├── MarketOverview.tsx
│   │   ├── ProjectEconomics.tsx
│   │   ├── ResearchAssistant.tsx
│   │   └── GeographicViz.tsx
│   └── ui/                     # shadcn generated components
├── lib/
│   ├── calculations.ts         # IRR, NPV, LCOE, payback (pure functions, client-side)
│   ├── eia.ts                  # EIA API client functions
│   ├── nrel.ts                 # NREL API client functions
│   ├── fred.ts                 # FRED API client functions
│   └── prompts.ts              # Claude prompt templates
└── store/
    └── dashboard.ts            # Zustand store — shared state across tabs
```

### Cross-Tab Data Flow

All shared state lives in a single Zustand store (`store/dashboard.ts`). This avoids prop-drilling and makes data flow between tabs trivial.

**Flow 1: Geographic → Project Economics**
- User clicks a state on the Leaflet map (Tab 4)
- The click handler updates `store.selectedState` and `store.selectedStateElectricityRate`
- The Project Economics calculator (Tab 2) reads `selectedStateElectricityRate` as its default electricity selling rate input
- A visible badge shows "Rate sourced from [State] via EIA"

**Flow 2: Project Economics → Research Assistant**
- Every time calculator inputs change, the store updates `store.calculatorScenario`
- The AI route (`/api/ai`) receives the current scenario in every request body
- Claude is given the scenario in its system prompt so it can answer questions like "Is my IRR reasonable for this project type?"

**Flow 3: Market Overview → Research Assistant**
- On page load, Tab 1 fetches EIA + FRED data and writes it to `store.marketSnapshot`
- Every AI request includes this snapshot as context
- Claude is told explicitly which numbers are live API data vs. training data, ensuring cited responses

### API Proxy Pattern

All external API calls go through Next.js API routes. This:
1. Keeps API keys server-side only (never exposed to the browser)
2. Allows us to add caching headers
3. Centralizes error handling and fallback logic

---

## Phases & Priorities

| Phase | Target Dates | Goals |
|---|---|---|
| 1 — Foundation | Apr 7 | PLANNING.md ✅, Next.js scaffold, Zustand store, API route proxies (EIA, NREL, FRED, Claude), base tab layout |
| 2 — Core Tabs | Apr 8–9 | Tab 1 complete (KPI cards + charts), Tab 2 complete (full calculator, IRR/NPV/LCOE, scenario comparison, cash flow chart) |
| 3 — AI + Map | Apr 10 | Tab 3 (Claude chat + context injection), Tab 4 (Leaflet map + state data overlays) |
| 4 — Integration + Polish | Apr 11 | Cross-tab wiring verified, Tier 2 features (sensitivity analysis, provenance tooltips, live refresh, AI investment summary), Vercel deploy |
| 5 — Submission | Apr 12 AM | README updated with live URL, docs filled out, walkthrough video recorded and linked, final push |

---

## What I'll Cut If Time Is Short

**Drop first:** Excel/PDF export (Tier 2) — high effort, low scoring impact compared to AI quality

**Drop second:** Data provenance tooltips on every number — scope it to just the KPI cards if time is tight

**Drop last (never cut):**
- All 4 tabs functional with real API data
- IRR/NPV/LCOE calculations correct and instant
- Claude receiving live context and citing sources
- Leaflet map with at least state-level electricity price overlay
- Cross-tab data flow working (geo → economics, economics → AI)
- Deployed and live on Vercel

---

## Open Questions / Risks

| Risk | Mitigation |
|---|---|
| EIA API key approval delay | Request key immediately on Day 1; use EIA's open endpoints as fallback |
| React-Leaflet SSR error in Next.js | Use `dynamic(() => import(...), { ssr: false })` for the map component |
| IRR calculation divergence (Newton-Raphson) | Implement bisection method as fallback; test against known values |
| Claude API costs exceeding $10 | Use claude-3-5-haiku for chat, keep context under 4k tokens per request, no image inputs |
| NREL PVWatts rate limits | Cache responses in Zustand; don't re-fetch on every render |
| Vercel build failing due to Leaflet | Pin leaflet to compatible version, add leaflet CSS import in layout |

---

## Prioritization Rationale

The scoring weights heavily reward AI integration (25%) and architecture (25%) over visual polish. This means:
- We invest time in prompt engineering and context management for Tab 3
- We invest time in the Zustand store design so cross-tab flow is clean and demonstrable
- We invest time in correct financial math (evaluators will check IRR/NPV values)
- We keep UI clean and functional — not trying to win a design award, but professional enough to not lose points
