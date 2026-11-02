import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { StatCard } from '../../../shared/ui/stat-card'
import { toneDot, type Tone } from '../../../shared/ui/tone'

type TrendDirection = 'up' | 'down' | 'flat'

type MetricAccent = 'blue' | 'success' | 'warning' | 'danger' | 'violet'

type MetricCardProps = {
  label: string
  value: string | number
  delta?: string
  deltaLabel?: string
  trend?: TrendDirection
  accent?: MetricAccent
  sparkBars?: number[]
  className?: string
  children?: ReactNode
}

const deltaToneByTrend: Record<TrendDirection, 'success' | 'danger' | 'neutral'> = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
}

function TrendArrow({ trend }: { trend: TrendDirection }) {
  if (trend === 'up') {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 9 6 3l4 6" />
      </svg>
    )
  }
  if (trend === 'down') {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 3l4 6 4-6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 6h8" />
    </svg>
  )
}

function SparkBars({ values, tone }: { values: number[]; tone: Tone }) {
  const max = Math.max(...values, 1)

  return (
    <div className="flex h-7 items-end gap-1" aria-hidden="true">
      {values.map((val, i) => {
        const pct = Math.max(0.08, val / max)
        const isLast = i === values.length - 1

        return (
          <div
            key={i}
            className={cn(
              'w-1.5 rounded-full transition-all duration-300',
              isLast ? toneDot[tone] : 'bg-[var(--border-hover)]',
            )}
            style={{ height: `${pct * 100}%` }}
          />
        )
      })}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  trend = 'flat',
  accent = 'blue',
  sparkBars,
  className,
  children,
}: MetricCardProps) {
  const localizedLabel = translateCurrentLiteral(label)
  const localizedDeltaLabel = deltaLabel ? translateCurrentLiteral(deltaLabel) : null
  const spark = sparkBars && sparkBars.length > 0 ? sparkBars : null

  const footer = spark || children ? (
    <div className="flex flex-col gap-3">
      {spark ? <SparkBars values={spark} tone={accent} /> : null}
      {children}
    </div>
  ) : null

  return (
    <StatCard
      label={localizedLabel}
      value={value}
      hint={localizedDeltaLabel}
      delta={
        delta ? (
          <span className="inline-flex items-center gap-1">
            <TrendArrow trend={trend} />
            {delta}
          </span>
        ) : null
      }
      deltaTone={deltaToneByTrend[trend]}
      iconTone={accent}
      footer={footer}
      className={cn('min-h-[148px]', className)}
    />
  )
}
