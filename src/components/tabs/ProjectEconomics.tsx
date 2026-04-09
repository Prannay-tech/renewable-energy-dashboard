'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import { useDashboardStore } from '@/store/dashboard'
import { runCalculation, runSensitivityAnalysis, formatCurrency, formatPercent, formatNumber } from '@/lib/calculations'
import type { CalculatorScenario } from '@/store/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip as InfoTooltip } from '@/components/ui/tooltip'
import { MapPin, TrendingUp, ChevronDown, ChevronUp, FileText, Loader2, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Input Field Component ────────────────────────────────────────────────────

function InputRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  tooltip,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <label className="text-sm text-slate-300 truncate">{label}</label>
        {tooltip && (
          <InfoTooltip content={<p className="text-xs text-slate-300">{tooltip}</p>}>
            <span className="text-slate-500 text-xs cursor-help">ⓘ</span>
          </InfoTooltip>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-blue-500"
        />
        {unit && <span className="text-xs text-slate-400 w-12">{unit}</span>}
      </div>
    </div>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  highlight,
  tooltip,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'good' | 'warn' | 'bad' | 'neutral'
  tooltip?: string
}) {
  const colors = {
    good: 'text-green-400',
    warn: 'text-yellow-400',
    bad: 'text-red-400',
    neutral: 'text-blue-400',
  }

  const content = (
    <Card className="text-center cursor-help hover:border-slate-500 transition-colors">
      <CardContent>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-xl font-bold ${highlight ? colors[highlight] : 'text-white'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <InfoTooltip content={<p className="text-xs text-slate-300">{tooltip}</p>}>
        {content}
      </InfoTooltip>
    )
  }
  return content
}

// ─── Sensitivity Heatmap ──────────────────────────────────────────────────────

function SensitivityHeatmap({ scenario }: { scenario: CalculatorScenario }) {
  const rateRange = [8, 9, 10, 11, 12, 13, 14, 15, 16]
  const cfRange = [14, 16, 18, 20, 22, 24, 26, 28, 30]
  const matrix = runSensitivityAnalysis(scenario, rateRange, cfRange)

  const allIRRs = matrix.flat().map((c) => c.irr ?? 0)
  const minIRR = Math.min(...allIRRs)
  const maxIRR = Math.max(...allIRRs)

  const getColor = (irr: number | null) => {
    if (irr === null) return '#334155'
    const norm = maxIRR > minIRR ? (irr - minIRR) / (maxIRR - minIRR) : 0.5
    if (norm < 0.33) return '#7f1d1d'  // red
    if (norm < 0.55) return '#78350f'  // orange
    if (norm < 0.7) return '#365314'   // yellow-green
    return '#14532d'                   // green
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-slate-400">Capacity Factor (%) →</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr>
              <th className="text-slate-400 p-1.5 text-right w-16">¢/kWh ↓</th>
              {cfRange.map((cf) => (
                <th key={cf} className="text-slate-400 p-1.5 text-center w-12">{cf}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rateRange.map((rate, ri) => (
              <tr key={rate}>
                <td className="text-slate-400 p-1.5 text-right font-medium">{rate}¢</td>
                {cfRange.map((cf, ci) => {
                  const cell = matrix[ci][ri]
                  const isCurrentApprox =
                    Math.abs(rate - scenario.electricityRateCentsPerKWh) < 1 &&
                    Math.abs(cf - scenario.capacityFactor) < 2
                  return (
                    <td
                      key={cf}
                      className={`p-1.5 text-center font-medium rounded ${isCurrentApprox ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                      style={{ background: getColor(cell.irr), color: '#e2e8f0' }}
                    >
                      {cell.irr !== null ? `${cell.irr.toFixed(1)}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#7f1d1d' }} />
          <span className="text-xs text-slate-400">Poor IRR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#78350f' }} />
          <span className="text-xs text-slate-400">Fair</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#365314' }} />
          <span className="text-xs text-slate-400">Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#14532d' }} />
          <span className="text-xs text-slate-400">Strong</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded ring-2 ring-white bg-transparent" />
          <span className="text-xs text-slate-400">Current scenario</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectEconomics() {
  const { scenarios, activeScenario, results, selectedState, setActiveScenario, updateScenario, setResults } = useDashboardStore()
  const [showSensitivity, setShowSensitivity] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null)
  const [showAiSummary, setShowAiSummary] = useState(false)

  const scenario = scenarios[activeScenario]

  // Apply selected state's electricity rate when it changes
  useEffect(() => {
    if (selectedState) {
      updateScenario('base', { electricityRateCentsPerKWh: selectedState.avgPrice })
      updateScenario('optimistic', { electricityRateCentsPerKWh: selectedState.avgPrice * 1.15 })
      updateScenario('conservative', { electricityRateCentsPerKWh: selectedState.avgPrice * 0.85 })
    }
  }, [selectedState, updateScenario])

  // Recalculate whenever scenario changes
  useEffect(() => {
    const calc = runCalculation(scenario)
    setResults(activeScenario, calc)
  }, [scenario, activeScenario, setResults])

  const result = results[activeScenario]

  const scenarioTabs: Array<{ key: typeof activeScenario; label: string; color: string }> = [
    { key: 'base', label: 'Base Case', color: 'text-blue-400' },
    { key: 'optimistic', label: 'Optimistic', color: 'text-green-400' },
    { key: 'conservative', label: 'Conservative', color: 'text-yellow-400' },
  ]

  const irrQuality = (irr: number | null): 'good' | 'warn' | 'bad' | 'neutral' => {
    if (irr === null) return 'neutral'
    if (irr >= 12) return 'good'
    if (irr >= 8) return 'warn'
    return 'bad'
  }

  const { marketSnapshot } = useDashboardStore()

  const generateAiSummary = async () => {
    if (!result) return
    setAiSummaryLoading(true)
    setAiSummaryError(null)
    setShowAiSummary(true)
    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, results: result, marketSnapshot, selectedState }),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setAiSummary(data.summary)
    } catch (err) {
      setAiSummaryError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setAiSummaryLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Project Economics Calculator</h2>
          <p className="text-sm text-slate-400 mt-0.5">Solar project financial model — all calculations run client-side instantly</p>
        </div>
        <button
          onClick={generateAiSummary}
          disabled={aiSummaryLoading || !result}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors border border-purple-600"
        >
          {aiSummaryLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Sparkles className="w-4 h-4" /> AI Investment Summary</>
          }
        </button>
      </div>

      {/* AI Investment Summary Panel */}
      {showAiSummary && (
        <Card className="border-purple-800 bg-purple-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <CardTitle className="text-purple-300">AI Investment Memo</CardTitle>
                <Badge variant="blue">Claude claude-sonnet-4-5</Badge>
              </div>
              <button onClick={() => setShowAiSummary(false)} className="text-slate-400 hover:text-white text-xs">✕ Close</button>
            </div>
          </CardHeader>
          <CardContent>
            {aiSummaryLoading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}
            {aiSummaryError && (
              <p className="text-red-400 text-sm">{aiSummaryError}</p>
            )}
            {aiSummary && !aiSummaryLoading && (
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  {aiSummary}
                </div>
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  AI-generated memo · Grounded in live EIA &amp; FRED data · {new Date().toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location badge */}
      {selectedState && (
        <div className="flex items-center gap-2 p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            Electricity rate sourced from <strong>{selectedState.stateName}</strong> via EIA ({selectedState.avgPrice.toFixed(2)}¢/kWh).
            Switch tabs to the Map to select a different state.
          </p>
        </div>
      )}

      {/* Scenario Tabs */}
      <div className="flex gap-2">
        {scenarioTabs.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveScenario(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeScenario === key
                ? 'bg-slate-700 text-white border border-slate-500'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
            }`}
          >
            <span className={activeScenario === key ? color : ''}>{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="xl:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle>Project Parameters</CardTitle></CardHeader>
            <CardContent>
              <InputRow label="System Size" value={scenario.systemSizeKW} onChange={(v) => updateScenario(activeScenario, { systemSizeKW: v })} min={10} max={500000} step={100} unit="kW" tooltip="DC nameplate capacity of the solar installation" />
              <InputRow label="Capacity Factor" value={scenario.capacityFactor} onChange={(v) => updateScenario(activeScenario, { capacityFactor: v })} min={10} max={40} step={0.5} unit="%" tooltip="Annual energy yield as % of theoretical max. Typical solar: 18-28%" />
              <InputRow label="Degradation Rate" value={scenario.degradationRate} onChange={(v) => updateScenario(activeScenario, { degradationRate: v })} min={0.1} max={2} step={0.05} unit="%" tooltip="Annual panel efficiency loss. Industry standard: 0.5%/year" />
              <InputRow label="Project Life" value={scenario.projectLifeYears} onChange={(v) => updateScenario(activeScenario, { projectLifeYears: v })} min={10} max={40} step={1} unit="years" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Costs</CardTitle></CardHeader>
            <CardContent>
              <InputRow label="Install Cost" value={scenario.installCostPerW} onChange={(v) => updateScenario(activeScenario, { installCostPerW: v })} min={0.5} max={3} step={0.05} unit="$/W" tooltip="All-in EPC cost per watt DC. Utility-scale solar: $0.85–$1.40/W" />
              <InputRow label="O&M Cost" value={scenario.omCostPerKWYear} onChange={(v) => updateScenario(activeScenario, { omCostPerKWYear: v })} min={5} max={50} step={1} unit="$/kW/yr" tooltip="Annual operations & maintenance. Typical: $12–$20/kW/year" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
            <CardContent>
              <InputRow label="Electricity Rate" value={scenario.electricityRateCentsPerKWh} onChange={(v) => updateScenario(activeScenario, { electricityRateCentsPerKWh: v })} min={4} max={40} step={0.5} unit="¢/kWh" tooltip="PPA or merchant electricity selling price" />
              <InputRow label="Annual Escalation" value={scenario.annualEscalation} onChange={(v) => updateScenario(activeScenario, { annualEscalation: v })} min={0} max={5} step={0.25} unit="%" tooltip="Annual PPA price escalator" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Financing &amp; Incentives</CardTitle></CardHeader>
            <CardContent>
              <InputRow label="Debt %" value={scenario.debtPercent} onChange={(v) => updateScenario(activeScenario, { debtPercent: v })} min={0} max={80} step={5} unit="%" />
              <InputRow label="Interest Rate" value={scenario.interestRate} onChange={(v) => updateScenario(activeScenario, { interestRate: v })} min={2} max={12} step={0.25} unit="%" />
              <InputRow label="Loan Term" value={scenario.loanTermYears} onChange={(v) => updateScenario(activeScenario, { loanTermYears: v })} min={5} max={25} step={1} unit="years" />
              <InputRow label="Federal ITC" value={scenario.itcPercent} onChange={(v) => updateScenario(activeScenario, { itcPercent: v })} min={0} max={40} step={1} unit="%" tooltip="Investment Tax Credit — 30% for projects meeting IRA wage requirements" />
            </CardContent>
          </Card>
        </div>

        {/* Right: Outputs */}
        <div className="xl:col-span-2 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="IRR"
              value={result ? formatPercent(result.irr) : '—'}
              sub="Equity return"
              highlight={result ? irrQuality(result.irr) : 'neutral'}
              tooltip="Internal Rate of Return on equity. Target: >10% for institutional solar"
            />
            <MetricCard
              label="NPV"
              value={result?.npv !== null && result?.npv !== undefined ? formatCurrency(result.npv, 0) : '—'}
              sub="At 8% discount"
              highlight={result?.npv !== null && result?.npv !== undefined ? (result.npv > 0 ? 'good' : 'bad') : 'neutral'}
              tooltip="Net Present Value at 8% discount rate. Positive NPV = value-creating"
            />
            <MetricCard
              label="Payback"
              value={result?.paybackYears !== null && result?.paybackYears !== undefined ? `${result.paybackYears.toFixed(1)} yr` : '—'}
              sub="Simple payback"
              highlight={result?.paybackYears !== null && result?.paybackYears !== undefined ? (result.paybackYears < 10 ? 'good' : result.paybackYears < 15 ? 'warn' : 'bad') : 'neutral'}
              tooltip="Years to recover equity investment from net cash flows"
            />
            <MetricCard
              label="LCOE"
              value={result?.lcoe !== null && result?.lcoe !== undefined ? `$${(result.lcoe * 100).toFixed(2)}¢` : '—'}
              sub="Per kWh"
              highlight="neutral"
              tooltip="Levelized Cost of Energy — total discounted costs / total discounted energy"
            />
          </div>

          {/* Project Summary */}
          <Card>
            <CardHeader><CardTitle>Project Summary (Year 1)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Total Project Cost', value: result ? formatCurrency(result.totalProjectCostUSD) : '—' },
                  { label: 'Annual Energy (Yr 1)', value: result ? `${formatNumber(result.annualEnergyKWh)} kWh` : '—' },
                  { label: 'Annual Revenue (Yr 1)', value: result ? formatCurrency(result.annualRevenueUSD) : '—' },
                  { label: 'Annual O&M Cost', value: result ? formatCurrency(result.annualOMCostUSD) : '—' },
                  { label: 'Annual Debt Service', value: result ? formatCurrency(result.annualDebtService) : '—' },
                  { label: 'Net Operating Income', value: result ? formatCurrency(result.netOperatingIncome) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Annual Cash Flow Waterfall</CardTitle>
                <Badge variant="blue">25-Year Projection</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {result?.cashFlows && result.cashFlows.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={result.cashFlows.filter((_, i) => i % 2 === 0 || i < 5)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="revenue" name="Revenue" fill="#22c55e" opacity={0.8} radius={[2, 2, 0, 0]} stackId="cost" />
                    <Bar dataKey="opex" name="O&M Cost" fill="#ef4444" opacity={0.8} stackId="cost2" />
                    <Bar dataKey="debtService" name="Debt Service" fill="#f59e0b" opacity={0.8} stackId="cost2" />
                    <Line
                      type="monotone"
                      dataKey="netCashFlow"
                      name="Net Cash Flow"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                  Adjust inputs to generate cash flow projection
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenario Comparison */}
          <Card>
            <CardHeader><CardTitle>Scenario Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-slate-400 font-medium">Metric</th>
                      {scenarioTabs.map(({ key, label, color }) => (
                        <th key={key} className={`text-right py-2 font-medium ${color}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[
                      { label: 'Elec. Rate', fn: (r: typeof results.base) => r ? `${scenarios[activeScenario].electricityRateCentsPerKWh.toFixed(1)}¢` : '—', perScenario: true },
                      { label: 'IRR', fn: (r: typeof results.base, s: keyof typeof scenarios) => results[s] ? formatPercent(results[s]?.irr ?? null) : '—' },
                      { label: 'NPV', fn: (r: typeof results.base, s: keyof typeof scenarios) => results[s]?.npv !== null && results[s]?.npv !== undefined ? formatCurrency(results[s]!.npv!) : '—' },
                      { label: 'Payback', fn: (r: typeof results.base, s: keyof typeof scenarios) => results[s]?.paybackYears ? `${results[s]!.paybackYears!.toFixed(1)} yr` : '—' },
                      { label: 'LCOE', fn: (r: typeof results.base, s: keyof typeof scenarios) => results[s]?.lcoe ? `$${(results[s]!.lcoe! * 100).toFixed(2)}¢` : '—' },
                    ].map(({ label, fn }) => (
                      <tr key={label}>
                        <td className="py-2 text-slate-400">{label}</td>
                        {scenarioTabs.map(({ key }) => (
                          <td key={key} className="py-2 text-right text-white font-medium">
                            {(() => {
                              const r = results[key]
                              const s = key as keyof typeof scenarios
                              // Calculate on demand if not yet computed
                              if (!r) {
                                const calc = runCalculation(scenarios[key])
                                if (label === 'IRR') return formatPercent(calc.irr)
                                if (label === 'NPV') return calc.npv !== null ? formatCurrency(calc.npv) : '—'
                                if (label === 'Payback') return calc.paybackYears ? `${calc.paybackYears.toFixed(1)} yr` : '—'
                                if (label === 'LCOE') return calc.lcoe ? `$${(calc.lcoe * 100).toFixed(2)}¢` : '—'
                                if (label === 'Elec. Rate') return `${scenarios[s].electricityRateCentsPerKWh.toFixed(1)}¢`
                              }
                              return fn(r, s)
                            })()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Sensitivity Analysis (Tier 2) */}
          <Card>
            <CardHeader>
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowSensitivity(!showSensitivity)}
              >
                <div className="flex items-center gap-2">
                  <CardTitle>Sensitivity Analysis</CardTitle>
                  <Badge variant="blue">Tier 2</Badge>
                </div>
                {showSensitivity ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </CardHeader>
            {showSensitivity && (
              <CardContent>
                <p className="text-xs text-slate-400 mb-4">
                  IRR across electricity price (¢/kWh) vs. capacity factor (%). White ring = current scenario.
                </p>
                <SensitivityHeatmap scenario={scenario} />
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
