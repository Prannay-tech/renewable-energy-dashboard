import { cn } from '@/lib/utils'
import { CSSProperties } from 'react'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-slate-700/60', className)} style={style} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-8" />
        ))}
      </div>
    </div>
  )
}
