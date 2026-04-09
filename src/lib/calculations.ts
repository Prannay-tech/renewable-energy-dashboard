import type { CalculatorScenario, CalculatorResults } from '@/store/dashboard'

// ─── Financial Math ───────────────────────────────────────────────────────────

/**
 * Calculate Net Present Value of a cash flow series
 * @param rate - discount rate as decimal (e.g. 0.08 for 8%)
 * @param cashFlows - array of cash flows starting at year 1
 * @param initialInvestment - initial outlay (positive number, will be negated)
 */
export function calculateNPV(rate: number, cashFlows: number[], initialInvestment: number): number {
  const pv = cashFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i + 1), 0)
  return pv - initialInvestment
}

/**
 * Calculate IRR using bisection method (robust vs Newton-Raphson for non-monotonic CFs)
 * Returns null if IRR cannot be found
 */
export function calculateIRR(cashFlows: number[], initialInvestment: number): number | null {
  const allFlows = [-initialInvestment, ...cashFlows]

  const npvAtRate = (rate: number) =>
    allFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0)

  // Check if solution exists (NPV must change sign)
  if (npvAtRate(0) <= 0) return null

  let low = -0.99
  let high = 10.0  // 1000% upper bound
  const tolerance = 1e-7
  const maxIter = 1000

  // Find bracket where NPV changes sign
  if (npvAtRate(high) > 0) return null

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const npvMid = npvAtRate(mid)

    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      return mid * 100 // return as percentage
    }

    if (npvAtRate(low) * npvMid < 0) {
      high = mid
    } else {
      low = mid
    }
  }

  return ((low + high) / 2) * 100
}

/**
 * Calculate simple payback period (years to recover initial investment)
 */
export function calculatePayback(cashFlows: number[], initialInvestment: number): number | null {
  let cumulative = 0
  for (let i = 0; i < cashFlows.length; i++) {
    const prev = cumulative
    cumulative += cashFlows[i]
    if (cumulative >= initialInvestment) {
      // Interpolate
      const fraction = (initialInvestment - prev) / cashFlows[i]
      return i + fraction
    }
  }
  return null // never recovered
}

/**
 * Calculate Levelized Cost of Energy (LCOE) in $/kWh
 * LCOE = (sum of all costs discounted) / (sum of all energy discounted)
 */
export function calculateLCOE(
  annualCosts: number[],
  annualEnergyKWh: number[],
  discountRate: number
): number {
  const pvcosts = annualCosts.reduce((acc, cost, i) => acc + cost / Math.pow(1 + discountRate, i + 1), 0)
  const pvenergy = annualEnergyKWh.reduce((acc, e, i) => acc + e / Math.pow(1 + discountRate, i + 1), 0)
  return pvcosts / pvenergy
}

/**
 * Calculate annual debt service (principal + interest) for a fixed-rate loan
 */
export function calculateAnnualDebtService(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (annualRate === 0) return principal / termYears
  const r = annualRate / 100
  return (principal * r * Math.pow(1 + r, termYears)) / (Math.pow(1 + r, termYears) - 1)
}

// ─── Main Calculator ──────────────────────────────────────────────────────────

export function runCalculation(scenario: CalculatorScenario): CalculatorResults {
  const {
    systemSizeKW,
    capacityFactor,
    degradationRate,
    projectLifeYears,
    installCostPerW,
    omCostPerKWYear,
    electricityRateCentsPerKWh,
    annualEscalation,
    debtPercent,
    interestRate,
    loanTermYears,
    itcPercent,
  } = scenario

  // ── Project Cost ──────────────────────────────────────────────────────────
  const grossProjectCost = systemSizeKW * 1000 * installCostPerW
  const itcValue = grossProjectCost * (itcPercent / 100)
  // Net cost after ITC — ITC is a federal tax credit that reduces effective project cost
  const totalProjectCostUSD = grossProjectCost - itcValue

  // ── Financing ─────────────────────────────────────────────────────────────
  // Debt sized on gross project cost (lenders lend against full asset value)
  // Equity = gross cost - debt (sponsor's cash investment before ITC benefit)
  // ITC reduces effective cost basis but is not modelled as a cash flow here
  const debtAmount = grossProjectCost * (debtPercent / 100)
  const equityAmount = grossProjectCost - debtAmount
  const annualDebtService = calculateAnnualDebtService(debtAmount, interestRate, loanTermYears)

  // ── Year 1 Energy & Revenue ───────────────────────────────────────────────
  const year1EnergyKWh = systemSizeKW * (capacityFactor / 100) * 8760
  const year1Revenue = year1EnergyKWh * (electricityRateCentsPerKWh / 100)
  const year1OMCost = systemSizeKW * omCostPerKWYear

  // ── Annual Cash Flows ─────────────────────────────────────────────────────
  const cashFlows: CalculatorResults['cashFlows'] = []
  const netCashFlowsForIRR: number[] = []
  const annualCostsForLCOE: number[] = []
  const annualEnergyForLCOE: number[] = []

  let cumulative = -equityAmount  // start negative (equity investment)

  for (let year = 1; year <= projectLifeYears; year++) {
    const degradationFactor = Math.pow(1 - degradationRate / 100, year - 1)
    const escalationFactor = Math.pow(1 + annualEscalation / 100, year - 1)

    const energy = year1EnergyKWh * degradationFactor
    const revenue = year1Revenue * escalationFactor * degradationFactor
    const opex = year1OMCost * Math.pow(1 + 2.5 / 100, year - 1)  // O&M escalates at 2.5%/yr
    const ds = year <= loanTermYears ? annualDebtService : 0
    const netCashFlow = revenue - opex - ds

    cumulative += netCashFlow

    cashFlows.push({ year, revenue, opex, debtService: ds, netCashFlow, cumulative })
    netCashFlowsForIRR.push(netCashFlow)
    annualCostsForLCOE.push(opex + ds)
    annualEnergyForLCOE.push(energy)
  }

  // ── Key Metrics ───────────────────────────────────────────────────────────
  const discountRate = 0.08  // 8% discount rate for NPV/LCOE
  const irr = calculateIRR(netCashFlowsForIRR, equityAmount)
  const npv = calculateNPV(discountRate, netCashFlowsForIRR, equityAmount)
  const paybackYears = calculatePayback(netCashFlowsForIRR, equityAmount)
  const lcoe = calculateLCOE(annualCostsForLCOE, annualEnergyForLCOE, discountRate)

  return {
    totalProjectCostUSD,
    annualEnergyKWh: year1EnergyKWh,
    annualRevenueUSD: year1Revenue,
    annualOMCostUSD: year1OMCost,
    annualDebtService,
    netOperatingIncome: year1Revenue - year1OMCost,
    irr,
    npv,
    paybackYears,
    lcoe,
    cashFlows,
  }
}

// ─── Sensitivity Analysis ─────────────────────────────────────────────────────

export interface SensitivityCell {
  electricityRate: number  // cents/kWh
  capacityFactor: number   // %
  irr: number | null
}

export function runSensitivityAnalysis(
  baseScenario: CalculatorScenario,
  rateRange: number[],      // e.g. [8, 9, 10, 11, 12, 13, 14, 15, 16]
  cfRange: number[]         // e.g. [14, 16, 18, 20, 22, 24, 26, 28, 30]
): SensitivityCell[][] {
  return cfRange.map((cf) =>
    rateRange.map((rate) => {
      const scenario: CalculatorScenario = {
        ...baseScenario,
        electricityRateCentsPerKWh: rate,
        capacityFactor: cf,
      }
      const result = runCalculation(scenario)
      return { electricityRate: rate, capacityFactor: cf, irr: result.irr }
    })
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number | null, decimals = 0): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
