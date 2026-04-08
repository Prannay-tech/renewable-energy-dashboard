import { NextRequest, NextResponse } from 'next/server'

const NREL_BASE = 'https://developer.nrel.gov/api'
const API_KEY = process.env.NREL_API_KEY || 'DEMO_KEY'

// State centroids for NREL API calls
const STATE_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
  AL: { lat: 32.7, lon: -86.7, name: 'Alabama' },
  AK: { lat: 64.2, lon: -153.4, name: 'Alaska' },
  AZ: { lat: 34.3, lon: -111.1, name: 'Arizona' },
  AR: { lat: 34.9, lon: -92.4, name: 'Arkansas' },
  CA: { lat: 36.8, lon: -119.4, name: 'California' },
  CO: { lat: 39.0, lon: -105.5, name: 'Colorado' },
  CT: { lat: 41.6, lon: -72.7, name: 'Connecticut' },
  DE: { lat: 38.9, lon: -75.5, name: 'Delaware' },
  FL: { lat: 28.6, lon: -81.5, name: 'Florida' },
  GA: { lat: 32.7, lon: -83.4, name: 'Georgia' },
  HI: { lat: 20.3, lon: -156.4, name: 'Hawaii' },
  ID: { lat: 44.4, lon: -114.6, name: 'Idaho' },
  IL: { lat: 40.0, lon: -89.2, name: 'Illinois' },
  IN: { lat: 39.9, lon: -86.3, name: 'Indiana' },
  IA: { lat: 42.1, lon: -93.5, name: 'Iowa' },
  KS: { lat: 38.5, lon: -98.4, name: 'Kansas' },
  KY: { lat: 37.5, lon: -85.3, name: 'Kentucky' },
  LA: { lat: 31.1, lon: -91.9, name: 'Louisiana' },
  ME: { lat: 45.4, lon: -69.2, name: 'Maine' },
  MD: { lat: 39.0, lon: -76.8, name: 'Maryland' },
  MA: { lat: 42.3, lon: -71.8, name: 'Massachusetts' },
  MI: { lat: 44.3, lon: -85.4, name: 'Michigan' },
  MN: { lat: 46.3, lon: -94.3, name: 'Minnesota' },
  MS: { lat: 32.7, lon: -89.7, name: 'Mississippi' },
  MO: { lat: 38.4, lon: -92.5, name: 'Missouri' },
  MT: { lat: 47.0, lon: -110.5, name: 'Montana' },
  NE: { lat: 41.5, lon: -99.8, name: 'Nebraska' },
  NV: { lat: 39.5, lon: -116.8, name: 'Nevada' },
  NH: { lat: 43.7, lon: -71.6, name: 'New Hampshire' },
  NJ: { lat: 40.1, lon: -74.5, name: 'New Jersey' },
  NM: { lat: 34.4, lon: -106.1, name: 'New Mexico' },
  NY: { lat: 42.9, lon: -75.5, name: 'New York' },
  NC: { lat: 35.6, lon: -79.4, name: 'North Carolina' },
  ND: { lat: 47.5, lon: -100.5, name: 'North Dakota' },
  OH: { lat: 40.4, lon: -82.8, name: 'Ohio' },
  OK: { lat: 35.6, lon: -97.5, name: 'Oklahoma' },
  OR: { lat: 44.0, lon: -120.6, name: 'Oregon' },
  PA: { lat: 40.9, lon: -77.8, name: 'Pennsylvania' },
  RI: { lat: 41.7, lon: -71.6, name: 'Rhode Island' },
  SC: { lat: 33.9, lon: -80.9, name: 'South Carolina' },
  SD: { lat: 44.4, lon: -100.2, name: 'South Dakota' },
  TN: { lat: 35.9, lon: -86.4, name: 'Tennessee' },
  TX: { lat: 31.5, lon: -99.3, name: 'Texas' },
  UT: { lat: 39.3, lon: -111.1, name: 'Utah' },
  VT: { lat: 44.1, lon: -72.7, name: 'Vermont' },
  VA: { lat: 37.5, lon: -79.0, name: 'Virginia' },
  WA: { lat: 47.4, lon: -120.5, name: 'Washington' },
  WV: { lat: 38.9, lon: -80.5, name: 'West Virginia' },
  WI: { lat: 44.3, lon: -90.0, name: 'Wisconsin' },
  WY: { lat: 43.0, lon: -107.6, name: 'Wyoming' },
}

// Static solar irradiance by state (kWh/m²/day, annual avg from NREL data)
const STATIC_IRRADIANCE: Record<string, number> = {
  AL: 4.9, AK: 3.0, AZ: 6.6, AR: 5.0, CA: 5.9, CO: 5.5, CT: 4.2, DE: 4.4,
  FL: 5.6, GA: 5.2, HI: 5.9, ID: 4.9, IL: 4.4, IN: 4.3, IA: 4.5, KS: 5.2,
  KY: 4.5, LA: 5.2, ME: 4.0, MD: 4.5, MA: 4.1, MI: 4.1, MN: 4.5, MS: 5.1,
  MO: 4.8, MT: 4.8, NE: 5.0, NV: 6.4, NH: 4.1, NJ: 4.4, NM: 6.3, NY: 4.1,
  NC: 4.9, ND: 4.8, OH: 4.2, OK: 5.5, OR: 4.5, PA: 4.3, RI: 4.2, SC: 5.1,
  SD: 5.0, TN: 4.8, TX: 5.7, UT: 5.8, VT: 4.0, VA: 4.6, WA: 4.0, WV: 4.3,
  WI: 4.4, WY: 5.4,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const stateCode = searchParams.get('state')

  try {
    if (type === 'pvwatts' && stateCode) {
      const centroid = STATE_CENTROIDS[stateCode.toUpperCase()]
      if (!centroid) return NextResponse.json({ error: 'Unknown state' }, { status: 400 })

      try {
        const url = new URL(`${NREL_BASE}/pvwatts/v8.json`)
        url.searchParams.set('api_key', API_KEY)
        url.searchParams.set('lat', String(centroid.lat))
        url.searchParams.set('lon', String(centroid.lon))
        url.searchParams.set('system_capacity', '1')  // 1 kW system
        url.searchParams.set('azimuth', '180')
        url.searchParams.set('tilt', '20')
        url.searchParams.set('array_type', '1')
        url.searchParams.set('module_type', '0')
        url.searchParams.set('losses', '14')

        const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
        if (!res.ok) throw new Error(`NREL API error: ${res.status}`)
        const data = await res.json()

        const annualKwh = data?.outputs?.ac_annual ?? null
        const capacityFactor = annualKwh ? (annualKwh / (1 * 8760)) * 100 : null
        const irradiance = data?.outputs?.solrad_annual ?? STATIC_IRRADIANCE[stateCode.toUpperCase()]

        return NextResponse.json({
          stateCode: stateCode.toUpperCase(),
          stateName: centroid.name,
          annualKwhPerKw: annualKwh,
          capacityFactorPercent: capacityFactor,
          solarIrradiance: irradiance,
          source: 'NREL PVWatts API v8',
          lastUpdated: new Date().toISOString(),
        })
      } catch {
        // Use static data fallback
        const irradiance = STATIC_IRRADIANCE[stateCode.toUpperCase()] ?? 4.5
        const annualKwhPerKw = irradiance * 365 * 0.75  // rough conversion
        return NextResponse.json({
          stateCode: stateCode.toUpperCase(),
          stateName: centroid.name,
          annualKwhPerKw,
          capacityFactorPercent: (annualKwhPerKw / 8760) * 100,
          solarIrradiance: irradiance,
          source: 'NREL (static data)',
          lastUpdated: new Date().toISOString(),
          isFallback: true,
        })
      }
    }

    if (type === 'all-states-irradiance') {
      // Return static irradiance for all states (avoid rate limiting)
      return NextResponse.json({
        states: STATIC_IRRADIANCE,
        centroids: STATE_CENTROIDS,
        source: 'NREL Solar Resource Data',
        lastUpdated: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (error) {
    console.error('NREL route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
