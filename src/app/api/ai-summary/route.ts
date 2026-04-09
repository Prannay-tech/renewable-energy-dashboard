import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { scenario, results, marketSnapshot, selectedState } = await req.json()

    const prompt = `You are a senior renewable energy investment analyst. Write a concise, professional 1-page investment summary memo for the following solar project. Use real numbers from the data provided.

## Project Data

**Project Parameters:**
- System size: ${scenario.systemSizeKW?.toLocaleString()} kW (${(scenario.systemSizeKW / 1000).toFixed(1)} MW)
- Location: ${selectedState ? `${selectedState.stateName} (${selectedState.stateCode})` : 'Unspecified'}
- Capacity factor: ${scenario.capacityFactor}%
- Project life: ${scenario.projectLifeYears} years
- Degradation: ${scenario.degradationRate}%/yr

**Cost Structure:**
- Install cost: $${scenario.installCostPerW}/W ($${(scenario.installCostPerW * 1000).toFixed(0)}/kW)
- Total project cost: $${results.totalProjectCostUSD?.toLocaleString()}
- Net cost after ${scenario.itcPercent}% ITC: $${(results.totalProjectCostUSD * (1 - scenario.itcPercent / 100)).toLocaleString()}
- O&M: $${scenario.omCostPerKWYear}/kW/yr

**Revenue:**
- PPA/electricity rate: ${scenario.electricityRateCentsPerKWh}¢/kWh
- Annual escalation: ${scenario.annualEscalation}%
- Year 1 revenue: $${results.annualRevenueUSD?.toLocaleString()}

**Financing:**
- Debt: ${scenario.debtPercent}% at ${scenario.interestRate}% for ${scenario.loanTermYears} years
- Equity: $${results.totalProjectCostUSD ? (results.totalProjectCostUSD * (scenario.debtPercent / 100) === 0 ? results.totalProjectCostUSD : results.totalProjectCostUSD - results.totalProjectCostUSD * (scenario.debtPercent / 100)).toLocaleString() : 'N/A'}

**Returns:**
- IRR: ${results.irr?.toFixed(1)}%
- NPV (8% discount): $${results.npv?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- Simple payback: ${results.paybackYears?.toFixed(1)} years
- LCOE: ${(results.lcoe * 100).toFixed(2)}¢/kWh

**Live Market Context (EIA & FRED APIs):**
- National avg electricity price: ${marketSnapshot?.avgElectricityPrice?.toFixed(2) ?? 'N/A'}¢/kWh
- Total US solar capacity: ${marketSnapshot?.totalSolarCapacityGW?.toFixed(1) ?? 'N/A'} GW (+${marketSnapshot?.yoyGrowthSolar?.toFixed(1) ?? 'N/A'}% YoY)
- Federal Funds Rate: ${marketSnapshot?.federalFundsRate?.toFixed(2) ?? 'N/A'}%
- CPI Inflation: ${marketSnapshot?.inflation?.toFixed(1) ?? 'N/A'}%

---

Write the memo in this exact structure:

# Investment Summary: ${(scenario.systemSizeKW / 1000).toFixed(1)} MW Solar Project${selectedState ? ` — ${selectedState.stateName}` : ''}

**Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
**Prepared by:** AI Research Assistant (grounded in live EIA & FRED data)

## Executive Summary
[2-3 sentences: what is this project, what are the headline return metrics, and the one-line recommendation: invest / pass / conditional]

## Project Economics
[Bullet points covering: total cost, net cost after ITC, annual revenue, LCOE vs market, IRR vs benchmark (note industry target of 10-15% for utility solar)]

## Market Context
[2-3 sentences using the live EIA/FRED numbers above — how does current electricity pricing, solar growth trajectory, and interest rate environment affect this project's attractiveness. Cite the data sources.]

## Key Risks
[3-4 bullet points: specific risks for THIS project based on the inputs — e.g. merchant rate exposure if no PPA, interest rate sensitivity, capacity factor assumptions, ITC recapture risk]

## Recommendation
[1 paragraph: clear recommendation with conditions. Reference the IRR vs. cost of capital, payback vs. project life, and one actionable next step.]

Keep the tone professional and analytical. Be specific — use the actual numbers. Do not use generic filler text.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    return NextResponse.json({
      summary: content.text,
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4-5',
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    })
  } catch (error) {
    console.error('AI summary error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
