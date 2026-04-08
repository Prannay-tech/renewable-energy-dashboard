'use client'

import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  className?: string
}

export function Tooltip({ children, content, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-700 border border-slate-600 rounded-lg p-3 text-xs text-slate-200 shadow-xl">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  )
}
