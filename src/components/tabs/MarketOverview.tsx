'use client'

import { useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts'
import { useDashboardStore } from '@/store/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip as InfoTooltip } from '@/components/ui/tooltip'
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton'
import { RefreshCw, TrendingUp, TrendingDown, Zap, Wind, Sun, DollarSign, Activity } from 'lucide-react'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, unit, trend, trendLabel, source, lastUpdated, icon: Icon, color = 'blue', isFallback,
}: {
  title: string; value: string | number | null; unit?: string; trend?: number | null
  trendLabel?: string; source?: string; lastUpdated?: string | null
  icon?: React.ElementType; color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red'; isFallback?: boolean
}) {
  const colorMap = { blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400', purple: 'text-purple-400', red: 'text-red-400' }
  const bgMap = { blue: 'bg-blue-900/20', green: 'bg-green-900/20', yellow: 'bg-yellow-900/20', purple: 'bg-purple-900/20', red: 'bg-red-900/20' }

  if (value === null) return <SkeletonCard />

  return (
    <InfoTooltip content={
      <div>
        <p className="font-semibold text-white mb-1">{title}</p>
        {source && <p className="text-slate-400 text-xs">Source: {source}</p>}
        {lastUpdated && <p className="text-slate-400 text-xs">Updated: {new Date(lastUpdated).toLocaleString()}</p>}
        {isFallback && <p className="text-yellow-400 text-xs mt-1">⚠ Fallback data — API unavailable</p>}
      </div>
    }>
      <Card className="cursor-help hover:border-slate-500 transition-all hover:bg-slate-750 group">
        <CardContent>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 truncate">{title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${colorMap[color]}`}>{value}</span>
                {unit && <span className="text-sm text-slate-400">{unit}</span>}
              </div>
              {trend !== null && trend !== undefined && (
                <div className="flex items-center gap-1 mt-1.5">
                  {trend >= 0
                    ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
                    : <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                  <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% {trendLabel}
                  </span>
                </div>
              )}
              {isFallback && <Badge variant="yellow" className="mt-2">Fallback</Badge>}
            </div>
            {Icon && (
              <div className={`p-2.5 rounded-xl ${bgMap[color]} ${colorMap[color]} shrink-0 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </InfoTooltip>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketOverview() {
  const { marketSnapshot, marketLoading, setMarketSnapshot, setMarketLoading } = useDashboardStore()

  const fetchMarketData = useCallback(async () => {
    setMarketLoading(true)
    try {
      const [priceRes, capacityRes, fredRes] = await Promise.all([
        fetch('/api/eia?type=national-price'),
        fetch('/api/eia?type=capacity'),
        fetch('/api/fred?type=macro'),
      ])
      const [priceData, capacityData, fredData] = await Promise.all([
        priceRes.json(), capacityRes.json(), fredRes.json(),
      ])
      setMarketSnapshot({
        avgElectricityPrice: priceData.price,
        electricityPriceSeries: priceData.series || [],
        totalSolarCapacityGW: capacityData.solarCapacityGW,
        totalWindCapacityGW: capacityData.windCapacityGW,
        yoyGrowthSolar: capacityData.yoyGrowthSolar,
        yoyGrowthWind: capacityData.yoyGrowthWind,
        capacityGrowthSeries: capacityData.capacityGrowthSeries || [],
        federalFundsRate: fredData.federalFundsRate,
        inflation: fredData.inflation,
        lastUpdated: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Failed to fetch market data:', err)
    } finally {
      setMarketLoading(false)
    }
  }, [setMarketSnapshot, setMarketLoading])

  useEffect(() => {
    if (!marketSnapshot.lastUpdated) fetchMarketData()
  }, [marketSnapshot.lastUpdated, fetchMarketData])

  const snap = marketSnapshot
  const loading = marketLoading && !snap.lastUpdated

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">U.S. Renewable Energy Market</h2>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Live data from EIA Open Data API &amp; FRED (Federal Reserve)
            {snap.lastUpdated && (
              <span className="text-slate-500">· Refreshed {new Date(snap.lastUpdated).toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchMarketData}
          disabled={marketLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 font-medium transition-colors disabled:opacity-50 border border-slate-600"
        >
          <RefreshCw className={`w-4 h-4 ${marketLoading ? 'animate-spin' : ''}`} />
          {marketLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Avg Electricity Price" value={snap.avgElectricityPrice?.toFixed(2) ?? null} unit="¢/kWh" source="EIA Retail Sales API — All Sectors, National" lastUpdated={snap.lastUpdated} icon={DollarSign} color="blue" />
        <StatCard title="Solar Capacity" value={snap.totalSolarCapacityGW?.toFixed(1) ?? null} unit="GW" trend={snap.yoyGrowthSolar} trendLabel="YoY" source="EIA Electric Power Operational Data" lastUpdated={snap.lastUpdated} icon={Sun} color="yellow" />
        <StatCard title="Wind Capacity" value={snap.totalWindCapacityGW?.toFixed(1) ?? null} unit="GW" trend={snap.yoyGrowthWind} trendLabel="YoY" source="EIA Electric Power Operational Data" lastUpdated={snap.lastUpdated} icon={Wind} color="blue" />
        <StatCard title="Federal Funds Rate" value={snap.federalFundsRate?.toFixed(2) ?? null} unit="%" source="FRED — Effective Federal Funds Rate (FEDFUNDS)" lastUpdated={snap.lastUpdated} icon={TrendingUp} color="purple" />
        <StatCard title="CPI Inflation" value={snap.inflation?.toFixed(1) ?? null} unit="%" source="FRED — CPI All Urban (CPIAUCSL), YoY" lastUpdated={snap.lastUpdated} icon={Activity} color="green" />
        <StatCard title="Total Clean Capacity" value={snap.totalSolarCapacityGW !== null && snap.totalWindCapacityGW !== null ? (snap.totalSolarCapacityGW + snap.totalWindCapacityGW).toFixed(1) : null} unit="GW" source="EIA — Solar + Wind combined nameplate capacity" lastUpdated={snap.lastUpdated} icon={Zap} color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Electricity Price Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>National Avg Electricity Price</CardTitle>
              <InfoTooltip content={<div><p className="font-semibold text-white mb-1">Electricity Price Trend</p><p className="text-slate-400 text-xs">Source: EIA Retail Sales API · All sectors, national avg · Annual</p></div>}>
                <Badge variant="blue" className="cursor-help">EIA ⓘ</Badge>
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <SkeletonChart height={260} /> : snap.electricityPriceSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={snap.electricityPriceSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}¢`} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={ChartTooltipStyle} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(v) => [`${Number(v).toFixed(2)}¢/kWh`, 'Avg Price']} />
                  {snap.avgElectricityPrice && (
                    <ReferenceLine y={snap.avgElectricityPrice} stroke="#3b82f6" strokeDasharray="4 4"
                      label={{ value: 'Current', position: 'insideTopRight', fill: '#3b82f6', fontSize: 10 }} />
                  )}
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2.5} fill="url(#priceGrad)" dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#1e293b' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No data available</div>
            )}
            <p className="text-xs text-slate-500 mt-2">Source: EIA API · Annual all-sector avg ¢/kWh · Hover for provenance</p>
          </CardContent>
        </Card>

        {/* Renewable Capacity Growth */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Renewable Capacity Growth</CardTitle>
              <InfoTooltip content={<div><p className="font-semibold text-white mb-1">Installed Capacity</p><p className="text-slate-400 text-xs">Source: EIA Electric Power Operational Data · Nameplate capacity in GW</p></div>}>
                <Badge variant="green" className="cursor-help">EIA ⓘ</Badge>
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <SkeletonChart height={260} /> : snap.capacityGrowthSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={snap.capacityGrowthSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}GW`} />
                  <Tooltip contentStyle={ChartTooltipStyle} labelStyle={{ color: '#e2e8f0', fontWeight: 600 }} formatter={(v) => [`${Number(v).toFixed(1)} GW`]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
                  <Bar dataKey="solar" name="Solar" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="wind" name="Wind" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No data available</div>
            )}
            <p className="text-xs text-slate-500 mt-2">Source: EIA API · Annual nameplate capacity in GW</p>
          </CardContent>
        </Card>
      </div>

      {/* Market Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-2 border-l-yellow-500">
          <CardContent>
            <p className="text-yellow-400 font-semibold mb-2 flex items-center gap-2"><span>⚡</span> Electricity Prices</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              At <span className="text-white font-semibold">{snap.avgElectricityPrice?.toFixed(2) ?? '—'}¢/kWh</span> nationally (EIA), electricity prices
              {snap.electricityPriceSeries.length >= 2 &&
                snap.electricityPriceSeries[snap.electricityPriceSeries.length - 1]?.price >
                snap.electricityPriceSeries[snap.electricityPriceSeries.length - 2]?.price
                ? ' have been trending upward — improving PPA economics for new long-term contracts.'
                : ' remain stable — supporting bankable PPA negotiations for new projects.'
              }
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-purple-500">
          <CardContent>
            <p className="text-purple-400 font-semibold mb-2 flex items-center gap-2"><span>🏦</span> Rate Environment</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Fed Funds Rate at <span className="text-white font-semibold">{snap.federalFundsRate?.toFixed(2) ?? '—'}%</span> (FRED).
              {snap.federalFundsRate && snap.federalFundsRate > 4
                ? ' Elevated rates compress levered IRR — projects with strong PPAs and lower leverage ratios are better positioned.'
                : ' Moderate rates are supportive of project financing — debt service coverage ratios remain healthy.'
              }
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-green-500">
          <CardContent>
            <p className="text-green-400 font-semibold mb-2 flex items-center gap-2"><span>📈</span> Deployment Pipeline</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Solar growing at <span className="text-white font-semibold">{snap.yoyGrowthSolar?.toFixed(1) ?? '—'}% YoY</span> to <span className="text-white font-semibold">{snap.totalSolarCapacityGW?.toFixed(0) ?? '—'} GW</span> (EIA).
              Strong IRA-driven deployment is increasing supply and tightening merchant PPA spreads in competitive markets.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
