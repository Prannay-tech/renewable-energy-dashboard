import { cn } from '@/lib/utils'
import { CSSProperties, ReactNode } from 'react'

interface CardProps {
  className?: string
  children: ReactNode
  style?: CSSProperties
}

export function Card({ className, children, style }: CardProps) {
  return (
    <div className={cn('bg-slate-800 border border-slate-700 rounded-xl p-4', className)} style={style}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn('mb-3', className)}>{children}</div>
}

export function CardTitle({ className, children }: CardProps) {
  return <h3 className={cn('text-sm font-semibold text-slate-400 uppercase tracking-wider', className)}>{children}</h3>
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn('', className)}>{children}</div>
}
