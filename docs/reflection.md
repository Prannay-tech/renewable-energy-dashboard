# Reflection

---

## What I Built

A four-tab U.S. Renewable Energy Investment Analysis Dashboard, deployed at https://src-nu-red.vercel.app.

**Tab 1 — Market Overview**
- 6 KPI cards pulling live data: national electricity price, solar/wind installed capacity (with YoY growth), Fed Funds Rate, CPI inflation, total clean capacity
- National electricity price trend as an AreaChart with gradient fill and reference line
- Renewable capacity growth as a stacked BarChart (solar + wind, annual)
- Market context cards with dynamic text (e.g. "Elevated rates compress levered IRR" when FFR > 4%)
- All data sourced live from EIA Open Data API and FRED; hover tooltips show exact API endpoint and last-updated time

**Tab 2 — Project Economics Calculator**
- Three preset scenarios (Base Case, Optimistic, Conservative) with a fully editable parameter set
- Outputs: IRR, NPV (8% discount), LCOE, simple payback, annual energy production, revenue, O&M, NOI
- 20-year annual cash flow table
- Sensitivity analysis heatmap — IRR across electricity rate × capacity factor grid
- "AI Investment Summary" button generates a structured 1-page investment memo (Claude Sonnet) with Executive Summary, Project Economics, Market Context, Key Risks, and Recommendation

**Tab 3 — Geographic Visualization**
- Interactive Leaflet map of all 50 states with circle markers
- Two overlay modes: electricity price (EIA) and solar irradiance (NREL static pre-compiled data)
- Click any state to see a popup; "Use in Calculator →" button pushes the state's electricity rate to the calculator
- State rankings sidebar showing top/bottom performers for the active metric

**Tab 4 — Research Assistant**
- Streaming Claude claude-haiku-4-5 chat with live context panel showing exactly what's sent to the model
- Context includes: market snapshot (EIA + FRED), full calculator scenario + computed results, selected state
- Suggested starter questions; session history persists across tab navigation
- Source labels in every response: 🟢[EIA Live] 🟡[FRED Live] 🔵[NREL Live] ⚪[Industry Benchmark] 🔢[Calculated]

**What works:** All four tabs are fully functional with real API data. Cross-tab data flows (Geo→Economics, Economics→AI, Market→AI) all work end-to-end. AI features (both chat and memo) work with live market context. Skeleton loading states shown while data fetches.

**What is partial:** The walkthrough video has not been recorded yet and needs to be added to `docs/walkthrough.md`.

---

## What I'd Do Differently

**1. IRR calibration earlier**
The first IRR result was 143% because the ITC was incorrectly subtracted from equity (making equity $110k on a $440k project). It took two debugging iterations to realize the model needed a clean separation: ITC reduces the displayed net cost but should not appear as a Year 1 cash inflow on top of already-reduced equity. Getting this right from the start would have saved time.

**2. State-level EIA data in the map**
The state-level electricity price data uses EIA's retail sales endpoint, which returns aggregated state averages but doesn't always have the same granularity as NREL irradiance data. A future version would use EIA's state-specific generation mix to also show renewable penetration per state.

**3. Real NREL per-state calls**
Solar irradiance is currently served from a static lookup table pre-compiled from NREL averages. This is accurate but static. A better version would call NREL's PVWatts API for the selected state on demand to get site-specific irradiance when a user focuses on one state.

**4. Persist calculator state to URL**
Currently, if you refresh the page, the calculator resets to defaults. Encoding the active scenario to URL search params (or localStorage) would let analysts share specific scenarios by link — useful for collaborative review.

**5. Wind project support**
The calculator is currently solar-only (capacity factor, degradation, ITC). Adding a wind project type with different cost curves, capacity factor ranges, and production tax credit (PTC) treatment would significantly broaden the tool's utility.

---

## AI Tools Used

**Claude (via API, claude-haiku-4-5 and claude-sonnet-4-5)** — integrated directly into the product as the Research Assistant (Tab 4) and investment memo generator (Tab 2). Haiku handles real-time streaming chat; Sonnet handles the more demanding structured memo task. The AI receives live EIA and FRED data in its context on every request.

**Claude Code (Anthropic's agentic coding tool)** — used throughout the build process to scaffold components, debug TypeScript errors, work through the IRR model calibration, and implement the SSE streaming pattern. Particularly helpful for:
- Designing the Zustand store shape to support all three required cross-tab data flows
- Debugging the Leaflet "Map container already initialized" error in React Strict Mode
- Iterating on the IRR calculation model until outputs were in the realistic 10–18% range for utility-scale solar
- Writing the FRED API proxy and diagnosing the leading-space bug in the API key environment variable
