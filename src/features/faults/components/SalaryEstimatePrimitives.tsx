import { cn } from '../../../shared/lib/cn'
import { StatCard } from '../../../shared/ui/stat-card'
import { toneSurface, toneText, type Tone } from '../../../shared/ui/tone'

type SalaryTileTone = 'default' | 'danger' | 'success' | 'blue'

const salaryTileTone: Record<SalaryTileTone, Tone> = {
  default: 'neutral',
  danger: 'danger',
  success: 'success',
  blue: 'blue',
}

export function SummaryMetricCard({
  label,
  value,
  tone = 'default',
  badge,
}: {
  label: string
  value: string | number
  tone?: 'default' | 'danger' | 'success'
  badge?: string
}) {
  return (
    <StatCard
      label={label}
      value={value}
      delta={badge}
      deltaTone={tone === 'default' ? 'neutral' : tone}
    />
  )
}

export function DetailStatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'danger' | 'success' | 'blue'
}) {
  const resolvedTone = salaryTileTone[tone]

  return (
    <div className={cn('rounded-[18px] px-4 py-3.5', toneSurface[resolvedTone])}>
      <p className={cn('text-[12.5px] font-medium', toneText[resolvedTone])}>
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-[17px] font-semibold tracking-[-0.02em] tabular-nums',
          tone === 'default' ? 'text-[var(--foreground)]' : toneText[resolvedTone],
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3v4h-4" />
      <path d="M2 13v-4h4" />
      <path d="M3.7 6.1A5 5 0 0 1 12 4.5L14 7" />
      <path d="M12.3 9.9A5 5 0 0 1 4 11.5L2 9" />
    </svg>
  )
}
