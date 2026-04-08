import { NextRequest, NextResponse } from 'next/server'

const EIA_BASE = 'https://api.eia.gov/v2'
const API_KEY = process.env.EIA_API_KEY

// Fallback data for when API is unavailable
const FALLBACK_ELECTRICITY_PRICE = 12.36  // cents/kWh (2024 national avg)
const FALLBACK_PRICE_SERIES = [
  { year: 2015, price: 10.41 }, { year: 2016, price: 10.32 }, { year: 2017, price: 10.53 },
  { year: 2018, price: 10.72 }, { year: 2019, price: 10.59 }, { year: 2020, price: 10.59 },
  { year: 2021, price: 11.17 }, { year: 2022, price: 12.55 }, { year: 2023, price: 12.78 },
  { year: 2024, price: 12.36 },
]

const FALLBACK_STATE_PRICES: Record<string, number> = {
  AL: 11.9, AK: 22.5, AZ: 11.5, AR: 9.8, CA: 25.8, CO: 12.4, CT: 23.1, DE: 12.8,
  FL: 12.6, GA: 11.2, HI: 38.2, ID: 9.1, IL: 12.3, IN: 11.4, IA: 9.8, KS: 11.1,
  KY: 10.2, LA: 9.3, ME: 18.9, MD: 14.2, MA: 24.6, MI: 14.1, MN: 11.8, MS: 10.8,
  MO: 10.8, MT: 10.6, NE: 10.3, NV: 11.8, NH: 20.2, NJ: 16.8, NM: 12.1, NY: 18.9,
  NC: 11.5, ND: 9.7, OH: 12.5, OK: 9.6, OR: 10.9, PA: 14.3, RI: 22.7, SC: 12.4,
  SD: 10.7, TN: 10.8, TX: 11.3, UT: 10.2, VT: 19.1, VA: 12.5, WA: 9.6, WV: 9.8,
  WI: 13.2, WY: 9.5,
}

async function eiaFetch(endpoint: string, params: Record<string, string>) {
  if (!API_KEY) throw new Error('EIA_API_KEY not configured')
  const url = new URL(`${EIA_BASE}${endpoint}`)
  url.searchParams.set('api_key', API_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`EIA API error: ${res.status}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    if (type === 'national-price') {
      // National average electricity price (residential)
      try {
        const data = await eiaFetch('/electricity/retail-sales/data/', {
          'frequency': 'annual',
          'data[0]': 'price',
          'facets[sectorName][]': 'all sectors',
          'facets[stateid][]': 'US',
          'sort[0][column]': 'period',
          'sort[0][direction]': 'desc',
          'length': '10',
        })
        const rows = data?.response?.data || []
        const priceSeries = rows
          .map((r: { period: string; price: string | null }) => ({
            year: parseInt(r.period),
            price: parseFloat(r.price ?? '0'),
          }))
          .filter((r: { year: number; price: number }) => !isNaN(r.year) && !isNaN(r.price))
          .sort((a: { year: number }, b: { year: number }) => a.year - b.year)

        const latest = priceSeries[priceSeries.length - 1]?.price ?? FALLBACK_ELECTRICITY_PRICE
        return NextResponse.json({
          price: latest,
          series: priceSeries.length > 0 ? priceSeries : FALLBACK_PRICE_SERIES,
          source: 'EIA Retail Sales API',
          lastUpdated: new Date().toISOString(),
        })
      } catch {
        return NextResponse.json({
          price: FALLBACK_ELECTRICITY_PRICE,
          series: FALLBACK_PRICE_SERIES,
          source: 'EIA (fallback data)',
          lastUpdated: new Date().toISOString(),
          isFallback: true,
        })
      }
    }

    if (type === 'capacity') {
      // Solar and wind installed capacity
      try {
        const [solarData, windData] = await Promise.all([
          eiaFetch('/electricity/electric-power-operational-data/data/', {
            'frequency': 'annual',
            'data[0]': 'nameplate-capacity-mw',
            'facets[fueltypeid][]': 'SUN',
            'facets[location][]': 'US',
            'sort[0][column]': 'period',
            'sort[0][direction]': 'desc',
            'length': '10',
          }),
          eiaFetch('/electricity/electric-power-operational-data/data/', {
            'frequency': 'annual',
            'data[0]': 'nameplate-capacity-mw',
            'facets[fueltypeid][]': 'WND',
            'facets[location][]': 'US',
            'sort[0][column]': 'period',
            'sort[0][direction]': 'desc',
            'length': '10',
          }),
        ])

        const parseCapacity = (data: { response?: { data?: { period: string; 'nameplate-capacity-mw': string | null }[] } }) => {
          const rows = data?.response?.data || []
          return rows
            .map((r: { period: string; 'nameplate-capacity-mw': string | null }) => ({
              year: parseInt(r.period),
              capacityMW: parseFloat(r['nameplate-capacity-mw'] ?? '0'),
            }))
            .filter((r: { year: number; capacityMW: number }) => !isNaN(r.year) && !isNaN(r.capacityMW))
            .sort((a: { year: number }, b: { year: number }) => a.year - b.year)
        }

        const solar = parseCapacity(solarData)
        const wind = parseCapacity(windData)

        const latestSolar = solar[solar.length - 1]?.capacityMW ?? 0
        const prevSolar = solar[solar.length - 2]?.capacityMW ?? 0
        const latestWind = wind[wind.length - 1]?.capacityMW ?? 0
        const prevWind = wind[wind.length - 2]?.capacityMW ?? 0

        // Build combined series
        const years = [...new Set([...solar.map((s: { year: number }) => s.year), ...wind.map((w: { year: number }) => w.year)])].sort()
        const combined = years.map(year => ({
          year,
          solar: (solar.find((s: { year: number }) => s.year === year)?.capacityMW ?? 0) / 1000,
          wind: (wind.find((w: { year: number }) => w.year === year)?.capacityMW ?? 0) / 1000,
        }))

        return NextResponse.json({
          solarCapacityGW: latestSolar / 1000,
          windCapacityGW: latestWind / 1000,
          yoyGrowthSolar: prevSolar > 0 ? ((latestSolar - prevSolar) / prevSolar) * 100 : null,
          yoyGrowthWind: prevWind > 0 ? ((latestWind - prevWind) / prevWind) * 100 : null,
          capacityGrowthSeries: combined,
          source: 'EIA Electric Power Operational Data',
          lastUpdated: new Date().toISOString(),
        })
      } catch {
        // Fallback capacity data
        return NextResponse.json({
          solarCapacityGW: 178.5,
          windCapacityGW: 148.4,
          yoyGrowthSolar: 28.5,
          yoyGrowthWind: 10.2,
          capacityGrowthSeries: [
            { year: 2018, solar: 51.3, wind: 96.5 }, { year: 2019, solar: 60.0, wind: 105.6 },
            { year: 2020, solar: 73.5, wind: 122.5 }, { year: 2021, solar: 93.7, wind: 135.0 },
            { year: 2022, solar: 113.4, wind: 140.7 }, { year: 2023, solar: 138.9, wind: 134.6 },
            { year: 2024, solar: 178.5, wind: 148.4 },
          ],
          source: 'EIA (fallback data)',
          lastUpdated: new Date().toISOString(),
          isFallback: true,
        })
      }
    }

    if (type === 'state-prices') {
      // State-level electricity prices
      try {
        const data = await eiaFetch('/electricity/retail-sales/data/', {
          'frequency': 'annual',
          'data[0]': 'price',
          'facets[sectorName][]': 'all sectors',
          'sort[0][column]': 'period',
          'sort[0][direction]': 'desc',
          'length': '55',  // ~51 states + DC
        })
        const rows = data?.response?.data || []
        // Get latest year per state
        const stateMap: Record<string, number> = {}
        for (const row of rows) {
          const state = row.stateid
          if (state && state !== 'US' && !stateMap[state]) {
            stateMap[state] = parseFloat(row.price ?? '0')
          }
        }
        return NextResponse.json({
          states: Object.keys(stateMap).length > 0 ? stateMap : FALLBACK_STATE_PRICES,
          source: 'EIA Retail Sales API',
          lastUpdated: new Date().toISOString(),
          isFallback: Object.keys(stateMap).length === 0,
        })
      } catch {
        return NextResponse.json({
          states: FALLBACK_STATE_PRICES,
          source: 'EIA (fallback data)',
          lastUpdated: new Date().toISOString(),
          isFallback: true,
        })
      }
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (error) {
    console.error('EIA route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
