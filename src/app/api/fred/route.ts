import { NextRequest, NextResponse } from 'next/server'

const FRED_BASE = 'https://api.stlouisfed.org/fred'
const API_KEY = process.env.FRED_API_KEY?.trim()

async function fredFetch(series_id: string, limit = 12) {
  if (!API_KEY) throw new Error('FRED_API_KEY not configured')
  const url = new URL(`${FRED_BASE}/series/observations`)
  url.searchParams.set('series_id', series_id)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('sort_order', 'desc')
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`FRED API error: ${res.status}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    if (type === 'macro') {
      // Fetch federal funds rate and CPI inflation
      try {
        const [fedfundsData, cpiData] = await Promise.all([
          fredFetch('FEDFUNDS', 1),    // Effective federal funds rate
          fredFetch('CPIAUCSL', 13),   // CPI (need 12mo for YoY)
        ])

        const fedfunds = parseFloat(fedfundsData?.observations?.[0]?.value ?? 'NaN')

        // YoY CPI inflation
        const cpiObs = cpiData?.observations ?? []
        const latestCPI = parseFloat(cpiObs[0]?.value ?? 'NaN')
        const yearAgoCPI = parseFloat(cpiObs[12]?.value ?? 'NaN')
        const inflation = (!isNaN(latestCPI) && !isNaN(yearAgoCPI) && yearAgoCPI > 0)
          ? ((latestCPI - yearAgoCPI) / yearAgoCPI) * 100
          : null

        return NextResponse.json({
          federalFundsRate: isNaN(fedfunds) ? 5.33 : fedfunds,
          inflation: inflation ?? 3.1,
          source: 'FRED (Federal Reserve Bank of St. Louis)',
          lastUpdated: new Date().toISOString(),
          isFallback: isNaN(fedfunds),
        })
      } catch {
        return NextResponse.json({
          federalFundsRate: 5.33,
          inflation: 3.1,
          source: 'FRED (fallback data)',
          lastUpdated: new Date().toISOString(),
          isFallback: true,
        })
      }
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (error) {
    console.error('FRED route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
