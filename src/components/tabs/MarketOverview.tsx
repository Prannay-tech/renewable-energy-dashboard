'use client'

import { useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useDashboardStore } from '@/store/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip as InfoTooltip } from '@/components/ui/tooltip'
import { RefreshCw, TrendingUp, TrendingDown, Zap, Wind, Sun, DollarSign } from 'lucide-react'

function StatCard({
  title,
  value,
  unit,
  trend,
  trendLabel,
  source,
  lastUpdated,
  icon: Icon,
  color = 'blue',
  isFallback,
}: {
  title: string
  value: string | number | null
  unit?: string
  trend?: number | null
  trendLabel?: string
  source?: string
  lastUpdated?: string | null
  icon?: React.ElementType
  color?: 'blue' | 'green' | 'yellow' | 'purple'
  isFallback?: boolean
}) {
  const colorMap = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  }

  return (
    <InfoTooltip
      content={
        <div>
          <p className="font-semibold text-white mb-1">{title}</p>
          {source && <p className="text-slate-400">Source: {source}</p>}
          {lastUpdated && <p className="text-slate-400">Updated: {new Date(lastUpdated).toLocaleString()}</p>}
          {isFallback && (
            <p className="text-yellow-400 mt-1">⚠ Using fallback data (API unavailable)</p>
          )}
        </div>
      }
    >
      <Card className="cursor-help hover:border-slate-500 transition-colors">
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{title}</p>
              <div className="flex items-baseline gap-1">
                {value !== null ? (
                  <>
                    <span className={`text-2xl font-bold ${colorMap[color]}`}>{value}</span>
                    {unit && <span className="text-sm text-slate-400">{unit}</span>}
                  </>
                ) : (
                  <div className="h-7 w-24 bg-slate-700 rounded animate-pulse" />
                )}
              </div>
              {trend !== null && trend !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  {trend >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% {trendLabel}
                  </span>
                </div>
              )}
            </div>
            {Icon && (
              <div className={`p-2 rounded-lg bg-slate-700/50 ${colorMap[color]}`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
          </div>
          {isFallback && (
            <Badge variant="yellow" className="mt-2 text-xs">Fallback</Badge>
          )}
        </CardContent>
      </Card>
    </InfoTooltip>
  )
}

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
        priceRes.json(),
        capacityRes.json(),
        fredRes.json(),
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
    if (!marketSnapshot.lastUpdated) {
      fetchMarketData()
    }
  }, [marketSnapshot.lastUpdated, fetchMarketData])

  const snap = marketSnapshot

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">U.S. Renewable Energy Market</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Live data from EIA Open Data API &amp; FRED
            {snap.lastUpdated && (
              <span className="ml-2 text-slate-500">
                · Updated {new Date(snap.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchMarketData}
          disabled={marketLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${marketLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Avg Electricity Price"
          value={snap.avgElectricityPrice?.toFixed(2) ?? null}
          unit="¢/kWh"
          source="EIA Retail Sales API"
          lastUpdated={snap.lastUpdated}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Solar Capacity"
          value={snap.totalSolarCapacityGW?.toFixed(1) ?? null}
          unit="GW"
          trend={snap.yoyGrowthSolar}
          trendLabel="YoY"
          source="EIA Electric Power Data"
          lastUpdated={snap.lastUpdated}
          icon={Sun}
          color="yellow"
        />
        <StatCard
          title="Wind Capacity"
          value={snap.totalWindCapacityGW?.toFixed(1) ?? null}
          unit="GW"
          trend={snap.yoyGrowthWind}
          trendLabel="YoY"
          source="EIA Electric Power Data"
          lastUpdated={snap.lastUpdated}
          icon={Wind}
          color="blue"
        />
        <StatCard
          title="Federal Funds Rate"
          value={snap.federalFundsRate?.toFixed(2) ?? null}
          unit="%"
          source="FRED (Federal Reserve)"
          lastUpdated={snap.lastUpdated}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="CPI Inflation"
          value={snap.inflation?.toFixed(1) ?? null}
          unit="%"
          source="FRED — CPI (YoY)"
          lastUpdated={snap.lastUpdated}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Total Clean Capacity"
          value={
            snap.totalSolarCapacityGW !== null && snap.totalWindCapacityGW !== null
              ? (snap.totalSolarCapacityGW + snap.totalWindCapacityGW).toFixed(1)
              : null
          }
          unit="GW"
          source="EIA (Solar + Wind)"
          lastUpdated={snap.lastUpdated}
          icon={Zap}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Electricity Price Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>National Avg Electricity Price Trend</CardTitle>
              <InfoTooltip content={
                <div>
                  <p className="font-semibold text-white mb-1">Electricity Price Trend</p>
                  <p className="text-slate-400">Source: EIA Retail Sales API</p>
                  <p className="text-slate-400">All-sector national average, ¢/kWh</p>
                </div>
              }>
                <Badge variant="blue" className="cursor-help">EIA</Badge>
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent>
            {snap.electricityPriceSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={snap.electricityPriceSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}¢`} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v) => [`${Number(v).toFixed(2)}¢/kWh`, 'Avg Price']}
                  />
                  <ReferenceLine y={snap.avgElectricityPrice ?? 12} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Current', position: 'right', fill: '#3b82f6', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <div className="text-slate-500 text-sm animate-pulse">Loading chart data...</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renewable Capacity Growth */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Renewable Capacity Growth (GW)</CardTitle>
              <InfoTooltip content={
                <div>
                  <p className="font-semibold text-white mb-1">Capacity Growth</p>
                  <p className="text-slate-400">Source: EIA Electric Power Operational Data</p>
                  <p className="text-slate-400">Nameplate capacity in GW</p>
                </div>
              }>
                <Badge variant="green" className="cursor-help">EIA</Badge>
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent>
            {snap.capacityGrowthSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={snap.capacityGrowthSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}GW`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v) => [`${Number(v).toFixed(1)} GW`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="solar" name="Solar" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="wind" name="Wind" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <div className="text-slate-500 text-sm animate-pulse">Loading chart data...</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market Context */}
      <Card>
        <CardHeader>
          <CardTitle>Market Context &amp; Investment Implications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-yellow-400 font-semibold mb-1">⚡ Electricity Prices</p>
              <p className="text-slate-300">
                At {snap.avgElectricityPrice?.toFixed(2) ?? '—'}¢/kWh nationally, electricity prices
                {snap.electricityPriceSeries.length >= 2 &&
                  snap.electricityPriceSeries[snap.electricityPriceSeries.length - 1]?.price >
                  snap.electricityPriceSeries[snap.electricityPriceSeries.length - 2]?.price
                  ? ' have been rising, improving PPA economics for new projects.'
                  : ' remain stable, supporting long-term PPA negotiations.'
                }
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-blue-400 font-semibold mb-1">🏦 Interest Rate Environment</p>
              <p className="text-slate-300">
                Fed Funds Rate at {snap.federalFundsRate?.toFixed(2) ?? '—'}% means project financing costs
                remain elevated. Equity-heavy structures or longer tenors may improve project IRR.
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-green-400 font-semibold mb-1">📈 Capacity Growth</p>
              <p className="text-slate-300">
                Solar growing at {snap.yoyGrowthSolar?.toFixed(1) ?? '—'}% YoY ({snap.totalSolarCapacityGW?.toFixed(0) ?? '—'} GW total).
                Strong deployment pipeline driven by IRA incentives and declining install costs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
