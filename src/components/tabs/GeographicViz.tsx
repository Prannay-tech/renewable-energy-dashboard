'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useDashboardStore } from '@/store/dashboard'
import type { StateElectricityData } from '@/store/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Sun, Zap, TrendingUp, RefreshCw } from 'lucide-react'

// Dynamically import map to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false, loading: () => (
  <div className="h-full flex items-center justify-center bg-slate-800 rounded-xl">
    <div className="text-slate-400 text-sm animate-pulse">Loading map...</div>
  </div>
)})

// State name mapping
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

type OverlayMode = 'electricity' | 'solar'

export default function GeographicViz() {
  const { setSelectedState, setStateElectricityData, stateElectricityData, selectedState } = useDashboardStore()
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('electricity')
  const [nrelData, setNrelData] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchGeoData = useCallback(async () => {
    setLoading(true)
    try {
      const [eiaRes, nrelRes] = await Promise.all([
        fetch('/api/eia?type=state-prices'),
        fetch('/api/nrel?type=all-states-irradiance'),
      ])
      const [eiaData, nrelData] = await Promise.all([eiaRes.json(), nrelRes.json()])

      const statePrices: Record<string, number> = eiaData.states || {}
      const irradiance: Record<string, number> = nrelData.states || {}
      setNrelData(irradiance)

      const stateData: StateElectricityData[] = Object.entries(statePrices).map(([code, price]) => ({
        stateCode: code,
        stateName: STATE_NAMES[code] || code,
        avgPrice: price as number,
        solarCapacityMW: 0,
        windCapacityMW: 0,
        solarIrradiance: irradiance[code],
      }))

      setStateElectricityData(stateData)
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      console.error('Failed to fetch geo data:', err)
    } finally {
      setLoading(false)
    }
  }, [setStateElectricityData])

  useEffect(() => {
    if (stateElectricityData.length === 0) {
      fetchGeoData()
    }
  }, [stateElectricityData.length, fetchGeoData])

  const handleStateSelect = (stateData: StateElectricityData) => {
    setSelectedState(stateData)
  }

  // Rankings
  const sorted = {
    byPrice: [...stateElectricityData].sort((a, b) => b.avgPrice - a.avgPrice).slice(0, 5),
    byPriceAsc: [...stateElectricityData].sort((a, b) => a.avgPrice - b.avgPrice).slice(0, 5),
    bySolar: Object.entries(nrelData).sort((a, b) => b[1] - a[1]).slice(0, 5),
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Geographic Analysis</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            State-level electricity prices (EIA) + Solar irradiance (NREL) — click any state to use its data in the calculator
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchGeoData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {lastUpdated && (
            <span className="text-xs text-slate-500">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Overlay Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Show:</span>
        <button
          onClick={() => setOverlayMode('electricity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            overlayMode === 'electricity'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Electricity Prices
        </button>
        <button
          onClick={() => setOverlayMode('solar')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            overlayMode === 'solar'
              ? 'bg-yellow-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          Solar Irradiance
        </button>
      </div>

      {/* Selected State Banner */}
      {selectedState && (
        <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-800 rounded-lg">
          <MapPin className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-300 font-medium">
              {selectedState.stateName} selected — data sent to Project Economics Calculator
            </p>
            <p className="text-xs text-green-400/70 mt-0.5">
              Electricity rate: {selectedState.avgPrice.toFixed(2)}¢/kWh (EIA)
              {selectedState.solarIrradiance && ` · Solar irradiance: ${selectedState.solarIrradiance.toFixed(2)} kWh/m²/day (NREL)`}
            </p>
          </div>
          <button
            onClick={() => setSelectedState(null)}
            className="text-xs text-green-400 hover:text-green-300 shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Map + Side Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Map */}
        <div className="xl:col-span-3 rounded-xl overflow-hidden border border-slate-700" style={{ height: '480px' }}>
          <MapComponent
            stateData={stateElectricityData}
            nrelData={nrelData}
            overlayMode={overlayMode}
            selectedState={selectedState}
            onStateSelect={handleStateSelect}
          />
        </div>

        {/* Side Panel */}
        <div className="xl:col-span-1 space-y-3">
          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle>{overlayMode === 'electricity' ? 'Electricity Price' : 'Solar Irradiance'} Legend</CardTitle>
            </CardHeader>
            <CardContent>
              {overlayMode === 'electricity' ? (
                <div className="space-y-1.5">
                  {[
                    { color: '#1d4ed8', label: '< 10¢/kWh (Low)' },
                    { color: '#16a34a', label: '10–13¢ (Moderate)' },
                    { color: '#d97706', label: '13–17¢ (High)' },
                    { color: '#dc2626', label: '> 17¢/kWh (Very High)' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ background: color }} />
                      <span className="text-xs text-slate-300">{label}</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500 mt-2">Source: EIA Retail Sales API</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[
                    { color: '#93c5fd', label: '< 4.0 kWh/m²/d (Low)' },
                    { color: '#fbbf24', label: '4.0–5.0 (Moderate)' },
                    { color: '#f97316', label: '5.0–6.0 (Good)' },
                    { color: '#dc2626', label: '> 6.0 (Excellent)' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ background: color }} />
                      <span className="text-xs text-slate-300">{label}</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500 mt-2">Source: NREL Solar Resource Data</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Rankings */}
          <Card>
            <CardHeader>
              <CardTitle>{overlayMode === 'electricity' ? 'Highest Price States' : 'Best Solar States'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overlayMode === 'electricity' ? (
                  sorted.byPrice.map((s, i) => (
                    <button
                      key={s.stateCode}
                      onClick={() => handleStateSelect(s)}
                      className="w-full flex items-center justify-between hover:bg-slate-700/50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                        <span className="text-sm text-slate-300">{s.stateCode}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-400">{s.avgPrice.toFixed(1)}¢</span>
                    </button>
                  ))
                ) : (
                  sorted.bySolar.map(([code, irr], i) => (
                    <button
                      key={code}
                      onClick={() => {
                        const sd = stateElectricityData.find(s => s.stateCode === code)
                        if (sd) handleStateSelect({ ...sd, solarIrradiance: irr })
                      }}
                      className="w-full flex items-center justify-between hover:bg-slate-700/50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                        <span className="text-sm text-slate-300">{code}</span>
                      </div>
                      <span className="text-sm font-semibold text-yellow-400">{irr.toFixed(1)}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lowest Price */}
          <Card>
            <CardHeader>
              <CardTitle>Cheapest Power States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sorted.byPriceAsc.map((s, i) => (
                  <button
                    key={s.stateCode}
                    onClick={() => handleStateSelect(s)}
                    className="w-full flex items-center justify-between hover:bg-slate-700/50 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <span className="text-sm text-slate-300">{s.stateCode}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">{s.avgPrice.toFixed(1)}¢</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Click any state to use its data in the calculator →</p>
            </CardContent>
          </Card>

          {/* Cross-tab note */}
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-blue-300 font-semibold">Cross-Tab Data Flow</p>
                <p className="text-xs text-blue-400/70 mt-0.5">
                  Selecting a state here automatically updates the electricity selling rate in the Project Economics calculator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
