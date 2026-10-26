import type { ReactNode } from 'react'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'

type TrendDirection = 'up' | 'down' | 'flat'

type MetricCardProps = {
  label: string
  value: string | number
  delta?: string        // e.g. "+12%" or "3 today"
  deltaLabel?: string   // e.g. "vs last week"
  trend?: TrendDirection
  accent?: 'blue' | 'success' | 'warning' | 'danger' | 'violet'
  sparkBars?: number[]  // 5–8 values for mini sparkline
  className?: string
  children?: ReactNode  // optional slot for custom content
}

const accentConfig = {
  blue: {
    bar:    'bg-blue-500',
    label:  'text-[var(--blue-text)]',
    glow:   'shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12),0_0_20px_rgba(59,130,246,0.06)]',
    top:    'from-blue-500 via-blue-400 to-transparent',
    surface: 'bg-blue-500/10',
  },
  success: {
    bar:    'bg-emerald-500',
    label:  'text-[var(--success-text)]',
    glow:   'shadow-[inset_0_0_0_1px_rgba(34,197,94,0.12),0_0_20px_rgba(34,197,94,0.05)]',
    top:    'from-emerald-500 via-emerald-400 to-transparent',
    surface: 'bg-emerald-500/10',
  },
  warning: {
    bar:    'bg-amber-400',
    label:  'text-[var(--warning-text)]',
    glow:   'shadow-[inset_0_0_0_1px_rgba(245,158,11,0.12),0_0_20px_rgba(245,158,11,0.05)]',
    top:    'from-amber-400 via-yellow-300 to-transparent',
    surface: 'bg-amber-400/10',
  },
  danger: {
    bar:    'bg-red-500',
    label:  'text-[var(--danger-text)]',
    glow:   'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12),0_0_20px_rgba(239,68,68,0.05)]',
    top:    'from-red-500 via-red-400 to-transparent',
    surface: 'bg-red-500/10',
  },
  violet: {
    bar:    'bg-violet-500',
    label:  'text-[var(--violet-text)]',
    glow:   'shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12),0_0_20px_rgba(139,92,246,0.05)]',
    top:    'from-violet-500 via-violet-400 to-transparent',
    surface: 'bg-violet-500/10',
  },
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

function SparkBars({ values, accentBar }: { values: number[]; accentBar: string }) {
  const max = Math.max(...values, 1)

  return (
    <div
      className="flex items-end gap-0.5"
      aria-hidden="true"
      style={{ height: 28 }}
    >
      {values.map((val, i) => {
        const pct = Math.max(0.08, val / max)
        const isLast = i === values.length - 1

        return (
          <div
            key={i}
            className={cn(
              'w-1.5 rounded-[2px] transition-all duration-300',
              isLast ? accentBar : 'bg-white/12',
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
  const config = accentConfig[accent]
  const localizedLabel = translateCurrentLiteral(label)
  const localizedDeltaLabel = deltaLabel ? translateCurrentLiteral(deltaLabel) : null

  const trendColor =
    trend === 'up'   ? 'text-emerald-400' :
    trend === 'down' ? 'text-red-400'     :
    'text-[var(--muted)]'

  return (
    <div
      className={cn(
        'card-base card-metric relative flex min-h-[128px] flex-col justify-between overflow-hidden p-5',
        config.glow,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r', config.top)} />
      <div className={cn('pointer-events-none absolute -right-6 top-3 h-24 w-24 rounded-full blur-3xl', config.surface)} />

      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.28em]',
            config.label,
          )}
        >
          {localizedLabel}
        </p>

        {sparkBars && sparkBars.length > 0 ? (
          <SparkBars values={sparkBars} accentBar={config.bar} />
        ) : null}
      </div>

      <div className="mt-4">
        <p className="count-up ui-metric-value text-white">
          {value}
        </p>

        {delta ? (
          <div className={cn('mt-2 flex items-center gap-1 text-[11px] font-medium', trendColor)}>
            <TrendArrow trend={trend} />
            <span>{delta}</span>
            {localizedDeltaLabel ? (
              <span className="text-[var(--caption)] font-normal">{localizedDeltaLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  )
}
