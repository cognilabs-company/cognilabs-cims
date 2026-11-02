import type { ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Sparkline } from '../../../shared/ui/charts/sparkline'
import { StatCard } from '../../../shared/ui/stat-card'

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

const sparkColorByAccent: Record<MetricAccent, string> = {
  blue: 'var(--blue-text)',
  success: 'var(--success-text)',
  warning: 'var(--warning-text)',
  danger: 'var(--danger-text)',
  violet: 'var(--violet-text)',
}

const trendIcons: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

function TrendArrow({ trend }: { trend: TrendDirection }) {
  const Icon = trendIcons[trend]

  return <Icon strokeWidth={1.8} className="h-3 w-3 shrink-0" aria-hidden="true" />
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
  const spark = sparkBars && sparkBars.length > 1 ? sparkBars : null
  const hasBleedFooter = Boolean(spark) && !children

  const footer = spark || children ? (
    <>
      {children}
      {spark ? <Sparkline points={spark} color={sparkColorByAccent[accent]} /> : null}
    </>
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
      className={cn(hasBleedFooter && 'overflow-hidden pb-0', className)}
    />
  )
}
