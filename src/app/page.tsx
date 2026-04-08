'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart2, Calculator, Bot, Map, Zap } from 'lucide-react'

// Dynamic imports to avoid SSR issues and enable code splitting
const MarketOverview = dynamic(() => import('@/components/tabs/MarketOverview'), { ssr: false })
const ProjectEconomics = dynamic(() => import('@/components/tabs/ProjectEconomics'), { ssr: false })
const ResearchAssistant = dynamic(() => import('@/components/tabs/ResearchAssistant'), { ssr: false })
const GeographicViz = dynamic(() => import('@/components/tabs/GeographicViz'), { ssr: false })

const TABS = [
  { id: 'market', label: 'Market Overview', icon: BarChart2, color: 'text-blue-400' },
  { id: 'economics', label: 'Project Economics', icon: Calculator, color: 'text-green-400' },
  { id: 'research', label: 'Research Assistant', icon: Bot, color: 'text-purple-400' },
  { id: 'geo', label: 'Geographic Analysis', icon: Map, color: 'text-yellow-400' },
] as const

type TabId = typeof TABS[number]['id']

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('market')

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                U.S. Renewable Energy Investment Dashboard
              </h1>
              <p className="text-xs text-slate-500 leading-tight">
                Live data from EIA · NREL · FRED · Powered by Claude AI
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/40 border border-green-800 rounded-md text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Data
            </span>
            <span className="text-xs text-slate-500">CDF AI Hackathon · April 2026</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-screen-2xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === id
                    ? `border-current ${color} bg-slate-800/30`
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {activeTab === 'market' && <MarketOverview />}
        {activeTab === 'economics' && <ProjectEconomics />}
        {activeTab === 'research' && <ResearchAssistant />}
        {activeTab === 'geo' && <GeographicViz />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 px-4 py-3 text-xs text-slate-500 max-w-screen-2xl mx-auto w-full flex flex-wrap items-center justify-between gap-2">
        <span>Data: EIA Open Data API · FRED (Federal Reserve) · NREL Developer APIs</span>
        <span>AI: Anthropic Claude · Built for CDF AI Engineering Hackathon 2026</span>
      </footer>
    </div>
  )
}
