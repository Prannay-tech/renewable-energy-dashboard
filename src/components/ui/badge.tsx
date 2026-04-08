import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface BadgeProps {
  className?: string
  children: ReactNode
  variant?: 'default' | 'green' | 'blue' | 'yellow' | 'red'
}

const variants = {
  default: 'bg-slate-700 text-slate-300',
  green: 'bg-green-900/50 text-green-400 border border-green-800',
  blue: 'bg-blue-900/50 text-blue-400 border border-blue-800',
  yellow: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  red: 'bg-red-900/50 text-red-400 border border-red-800',
}

export function Badge({ className, children, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
