'use client'

import { useState, useRef, useEffect } from 'react'
import { useDashboardStore } from '@/store/dashboard'
import { runCalculation } from '@/lib/calculations'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Send, Trash2, Bot, User, Zap, TrendingUp, MapPin, Calculator } from 'lucide-react'

const SUGGESTED_QUESTIONS = [
  'Is my current project IRR competitive for utility-scale solar?',
  'What federal incentives are available for my project?',
  'How does the current interest rate environment affect renewable project financing?',
  'Compare solar potential between the Southwest and Southeast US',
  'What is driving solar capacity growth and how does it affect PPA prices?',
  'Explain LCOE and how my project compares to grid parity',
]

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : 'bg-green-700'
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-slate-700 text-slate-100 rounded-tl-sm border border-slate-600'
        }`}>
          {content}
        </div>
      </div>
    </div>
  )
}

function ContextBadge({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1">
      <Icon className="w-3 h-3 text-slate-400" />
      <span className="text-xs text-slate-400">{label}:</span>
      <span className="text-xs text-slate-200 font-medium">{value}</span>
    </div>
  )
}

export default function ResearchAssistant() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    conversation,
    addMessage,
    clearConversation,
    marketSnapshot,
    scenarios,
    activeScenario,
    results,
    selectedState,
  } = useDashboardStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, streamingContent])

  const currentScenario = scenarios[activeScenario]
  const currentResults = results[activeScenario] ?? runCalculation(currentScenario)

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage = {
      role: 'user' as const,
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    const messagesForAPI = [...conversation, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForAPI,
          marketSnapshot: marketSnapshot.lastUpdated ? marketSnapshot : null,
          calculatorScenario: currentScenario,
          calculatorResults: currentResults,
          selectedState: selectedState,
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  fullContent += parsed.text
                  setStreamingContent(fullContent)
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      }

      addMessage({
        role: 'assistant',
        content: fullContent || 'I encountered an issue generating a response. Please try again.',
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your API configuration.`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-400" />
            AI Research Assistant
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Powered by Claude — grounded in live EIA, FRED &amp; NREL data</p>
        </div>
        <button
          onClick={clearConversation}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Context Indicators */}
      <div className="flex flex-wrap gap-2">
        <ContextBadge
          icon={TrendingUp}
          label="Market data"
          value={marketSnapshot.lastUpdated ? 'Loaded' : 'Not loaded'}
        />
        <ContextBadge
          icon={Calculator}
          label="Scenario"
          value={`${activeScenario} (${currentScenario.systemSizeKW.toLocaleString()} kW)`}
        />
        <ContextBadge
          icon={Zap}
          label="IRR"
          value={currentResults.irr ? `${currentResults.irr.toFixed(1)}%` : '—'}
        />
        {selectedState && (
          <ContextBadge
            icon={MapPin}
            label="Location"
            value={selectedState.stateName}
          />
        )}
        <Badge variant="green" className="text-xs">Context-aware</Badge>
      </div>

      {/* Chat Window */}
      <Card className="flex flex-col" style={{ height: '480px' }}>
        <CardContent className="flex flex-col h-full p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                <div>
                  <Bot className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="text-white font-semibold text-lg">Ready to analyze</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-md">
                    Ask me anything about renewable energy markets, project economics, policy, or your current calculator scenario.
                    I have access to live EIA, FRED, and NREL data.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}

            {isLoading && streamingContent && (
              <MessageBubble role="assistant" content={streamingContent} />
            )}

            {isLoading && !streamingContent && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-700 border border-slate-600 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="border-t border-slate-700 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about renewable energy markets, your project, policy… (Enter to send)"
                rows={2}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 px-1">
              Powered by Claude claude-haiku-4-5 · Context includes live market data + your current scenario
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Context Panel */}
      <Card>
        <CardContent>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Context Being Sent to Claude</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-green-400 font-semibold mb-1">📊 Market Data</p>
              {marketSnapshot.lastUpdated ? (
                <ul className="space-y-0.5 text-slate-400">
                  <li>Electricity: {marketSnapshot.avgElectricityPrice?.toFixed(2)}¢/kWh (EIA)</li>
                  <li>Solar: {marketSnapshot.totalSolarCapacityGW?.toFixed(1)} GW (EIA)</li>
                  <li>Wind: {marketSnapshot.totalWindCapacityGW?.toFixed(1)} GW (EIA)</li>
                  <li>Fed Rate: {marketSnapshot.federalFundsRate?.toFixed(2)}% (FRED)</li>
                </ul>
              ) : (
                <p className="text-slate-500">Visit Market Overview tab to load</p>
              )}
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-blue-400 font-semibold mb-1">🔢 Current Scenario</p>
              <ul className="space-y-0.5 text-slate-400">
                <li>Size: {currentScenario.systemSizeKW.toLocaleString()} kW</li>
                <li>CF: {currentScenario.capacityFactor}%</li>
                <li>Rate: {currentScenario.electricityRateCentsPerKWh}¢/kWh</li>
                <li>ITC: {currentScenario.itcPercent}%</li>
              </ul>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-yellow-400 font-semibold mb-1">📈 Calculated Results</p>
              <ul className="space-y-0.5 text-slate-400">
                <li>IRR: {currentResults.irr?.toFixed(1) ?? '—'}%</li>
                <li>NPV: {currentResults.npv !== null ? `$${(currentResults.npv / 1e6).toFixed(2)}M` : '—'}</li>
                <li>Payback: {currentResults.paybackYears?.toFixed(1) ?? '—'} yr</li>
                <li>LCOE: {currentResults.lcoe ? `${(currentResults.lcoe * 100).toFixed(2)}¢` : '—'}/kWh</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
