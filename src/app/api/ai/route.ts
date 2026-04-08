import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, marketSnapshot, calculatorScenario, calculatorResults, selectedState } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    }

    // ── Build system prompt with live context ──────────────────────────────
    const marketContext = marketSnapshot
      ? `## Live Market Data (from EIA & FRED APIs, fetched ${marketSnapshot.lastUpdated ?? 'recently'})
- National average electricity price: ${marketSnapshot.avgElectricityPrice?.toFixed(2) ?? 'N/A'} cents/kWh
- Total installed solar capacity: ${marketSnapshot.totalSolarCapacityGW?.toFixed(1) ?? 'N/A'} GW
- Total installed wind capacity: ${marketSnapshot.totalWindCapacityGW?.toFixed(1) ?? 'N/A'} GW
- Solar capacity YoY growth: ${marketSnapshot.yoyGrowthSolar?.toFixed(1) ?? 'N/A'}%
- Wind capacity YoY growth: ${marketSnapshot.yoyGrowthWind?.toFixed(1) ?? 'N/A'}%
- Federal Funds Rate: ${marketSnapshot.federalFundsRate?.toFixed(2) ?? 'N/A'}% (FRED)
- CPI Inflation: ${marketSnapshot.inflation?.toFixed(1) ?? 'N/A'}% (FRED)`
      : '## Live Market Data\n(Not yet loaded)'

    const scenarioContext = calculatorScenario
      ? `## User's Current Project Scenario (from Project Economics Calculator)
Scenario: ${calculatorScenario.name.toUpperCase()}
- System size: ${calculatorScenario.systemSizeKW?.toLocaleString()} kW (${(calculatorScenario.systemSizeKW / 1000).toFixed(1)} MW)
- Capacity factor: ${calculatorScenario.capacityFactor}%
- Degradation rate: ${calculatorScenario.degradationRate}% per year
- Project life: ${calculatorScenario.projectLifeYears} years
- Install cost: $${calculatorScenario.installCostPerW}/W ($${(calculatorScenario.installCostPerW * 1000).toFixed(0)}/kW)
- O&M cost: $${calculatorScenario.omCostPerKWYear}/kW/year
- Electricity selling rate: ${calculatorScenario.electricityRateCentsPerKWh} cents/kWh
- Annual price escalation: ${calculatorScenario.annualEscalation}%
- Debt financing: ${calculatorScenario.debtPercent}% at ${calculatorScenario.interestRate}% for ${calculatorScenario.loanTermYears} years
- Federal ITC: ${calculatorScenario.itcPercent}%`
      : ''

    const resultsContext = calculatorResults
      ? `## Calculated Project Results
- Total project cost: $${calculatorResults.totalProjectCostUSD?.toLocaleString()}
- Annual energy production (Year 1): ${calculatorResults.annualEnergyKWh?.toLocaleString()} kWh
- Annual revenue (Year 1): $${calculatorResults.annualRevenueUSD?.toLocaleString()}
- Annual O&M cost: $${calculatorResults.annualOMCostUSD?.toLocaleString()}
- Net Operating Income (Year 1): $${calculatorResults.netOperatingIncome?.toLocaleString()}
- IRR: ${calculatorResults.irr?.toFixed(1) ?? 'N/A'}%
- NPV (8% discount): $${calculatorResults.npv?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 'N/A'}
- Simple payback: ${calculatorResults.paybackYears?.toFixed(1) ?? 'N/A'} years
- LCOE: $${calculatorResults.lcoe?.toFixed(4) ?? 'N/A'}/kWh`
      : ''

    const locationContext = selectedState
      ? `## Selected Location (from Geographic Tab)
- State: ${selectedState.stateName} (${selectedState.stateCode})
- State avg electricity price: ${selectedState.avgPrice?.toFixed(2)} cents/kWh (EIA)
- State solar irradiance: ${selectedState.solarIrradiance?.toFixed(2) ?? 'N/A'} kWh/m²/day (NREL)`
      : ''

    const systemPrompt = `You are a renewable energy investment analyst assistant for an investment analysis dashboard. You help analysts evaluate U.S. solar and wind energy investment opportunities.

You have access to LIVE data from public APIs — treat numbers from the data sections below as current and cite them as such. Clearly distinguish between:
1. Live API data (marked as such) — cite the source and date
2. Your training knowledge — label this as "Based on industry data" or "Historically"
3. Your own analysis/calculations — label as "Analysis:"

When answering questions about the user's project, use the scenario data provided. If results look unusual, explain why.

Always be analytical and specific. Avoid vague answers. Investment analysts need numbers and reasoning.

${marketContext}

${scenarioContext}

${resultsContext}

${locationContext}

Keep responses concise but substantive (2-4 paragraphs max unless a detailed breakdown is requested). Always cite which data source supports key claims.`

    // ── Stream response ────────────────────────────────────────────────────
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const claudeMessages = messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))

          const response = await client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            system: systemPrompt,
            messages: claudeMessages,
          })

          for await (const chunk of response) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({ text: chunk.delta.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Claude streaming error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'AI error occurred' })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
