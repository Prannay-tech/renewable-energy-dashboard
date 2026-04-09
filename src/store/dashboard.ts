import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketSnapshot {
  avgElectricityPrice: number | null       // cents/kWh, national avg
  totalSolarCapacityGW: number | null      // GW installed
  totalWindCapacityGW: number | null       // GW installed
  yoyGrowthSolar: number | null            // % change
  yoyGrowthWind: number | null             // % change
  federalFundsRate: number | null          // % from FRED
  inflation: number | null                 // % CPI from FRED
  electricityPriceSeries: { year: number; price: number }[]
  capacityGrowthSeries: { year: number; solar: number; wind: number }[]
  lastUpdated: string | null
}

export interface StateElectricityData {
  stateCode: string
  stateName: string
  avgPrice: number   // cents/kWh
  solarCapacityMW: number
  windCapacityMW: number
  solarIrradiance?: number  // kWh/m²/day
}

export interface CalculatorScenario {
  name: 'base' | 'optimistic' | 'conservative'
  // Project params
  systemSizeKW: number
  capacityFactor: number          // %
  degradationRate: number         // % per year
  projectLifeYears: number
  // Costs
  installCostPerW: number         // $/W
  omCostPerKWYear: number         // $/kW/year
  // Revenue
  electricityRateCentsPerKWh: number
  annualEscalation: number        // %
  // Financing
  debtPercent: number             // %
  interestRate: number            // %
  loanTermYears: number
  // Incentives
  itcPercent: number              // % federal ITC
}

export interface CalculatorResults {
  totalProjectCostUSD: number
  annualEnergyKWh: number
  annualRevenueUSD: number
  annualOMCostUSD: number
  annualDebtService: number
  netOperatingIncome: number
  irr: number | null              // %
  npv: number | null              // USD
  paybackYears: number | null
  lcoe: number | null             // $/kWh
  cashFlows: { year: number; revenue: number; opex: number; debtService: number; netCashFlow: number; cumulative: number }[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface DashboardStore {
  // Tab 1: Market Overview data
  marketSnapshot: MarketSnapshot
  marketLoading: boolean
  setMarketSnapshot: (snapshot: Partial<MarketSnapshot>) => void
  setMarketLoading: (loading: boolean) => void

  // Tab 4 → Tab 2: Selected state data
  selectedState: StateElectricityData | null
  stateElectricityData: StateElectricityData[]
  setSelectedState: (state: StateElectricityData | null) => void
  setStateElectricityData: (data: StateElectricityData[]) => void

  // Tab 2: Calculator scenarios
  scenarios: {
    base: CalculatorScenario
    optimistic: CalculatorScenario
    conservative: CalculatorScenario
  }
  activeScenario: 'base' | 'optimistic' | 'conservative'
  results: {
    base: CalculatorResults | null
    optimistic: CalculatorResults | null
    conservative: CalculatorResults | null
  }
  updateScenario: (name: 'base' | 'optimistic' | 'conservative', updates: Partial<CalculatorScenario>) => void
  setActiveScenario: (name: 'base' | 'optimistic' | 'conservative') => void
  setResults: (name: 'base' | 'optimistic' | 'conservative', results: CalculatorResults) => void

  // Tab 3: Conversation history
  conversation: ConversationMessage[]
  addMessage: (msg: ConversationMessage) => void
  clearConversation: () => void
}

// ─── Default Scenarios ────────────────────────────────────────────────────────

const baseScenario: CalculatorScenario = {
  name: 'base',
  systemSizeKW: 10000,        // 10 MW — typical utility-scale project
  capacityFactor: 22,
  degradationRate: 0.5,
  projectLifeYears: 25,
  installCostPerW: 1.10,
  omCostPerKWYear: 17,
  electricityRateCentsPerKWh: 6.5,  // Wholesale PPA rate (not retail) — utility solar sells at 5–8¢
  annualEscalation: 1.5,
  debtPercent: 55,
  interestRate: 5.5,
  loanTermYears: 18,
  itcPercent: 30,
}

const optimisticScenario: CalculatorScenario = {
  ...baseScenario,
  name: 'optimistic',
  capacityFactor: 26,
  installCostPerW: 0.95,
  electricityRateCentsPerKWh: 8.0,  // Higher PPA or merchant premium
  annualEscalation: 2.5,
  interestRate: 4.5,
}

const conservativeScenario: CalculatorScenario = {
  ...baseScenario,
  name: 'conservative',
  capacityFactor: 18,
  installCostPerW: 1.30,
  electricityRateCentsPerKWh: 5.5,  // Compressed merchant market
  annualEscalation: 0.5,
  interestRate: 6.5,
}

// ─── Create Store ─────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Market snapshot initial state
  marketSnapshot: {
    avgElectricityPrice: null,
    totalSolarCapacityGW: null,
    totalWindCapacityGW: null,
    yoyGrowthSolar: null,
    yoyGrowthWind: null,
    federalFundsRate: null,
    inflation: null,
    electricityPriceSeries: [],
    capacityGrowthSeries: [],
    lastUpdated: null,
  },
  marketLoading: false,
  setMarketSnapshot: (snapshot) =>
    set((state) => ({ marketSnapshot: { ...state.marketSnapshot, ...snapshot } })),
  setMarketLoading: (loading) => set({ marketLoading: loading }),

  // State data
  selectedState: null,
  stateElectricityData: [],
  setSelectedState: (selectedState) => set({ selectedState }),
  setStateElectricityData: (stateElectricityData) => set({ stateElectricityData }),

  // Calculator
  scenarios: {
    base: baseScenario,
    optimistic: optimisticScenario,
    conservative: conservativeScenario,
  },
  activeScenario: 'base',
  results: { base: null, optimistic: null, conservative: null },
  updateScenario: (name, updates) =>
    set((state) => ({
      scenarios: {
        ...state.scenarios,
        [name]: { ...state.scenarios[name], ...updates },
      },
    })),
  setActiveScenario: (activeScenario) => set({ activeScenario }),
  setResults: (name, results) =>
    set((state) => ({
      results: { ...state.results, [name]: results },
    })),

  // Conversation
  conversation: [],
  addMessage: (msg) =>
    set((state) => ({ conversation: [...state.conversation, msg] })),
  clearConversation: () => set({ conversation: [] }),
}))
