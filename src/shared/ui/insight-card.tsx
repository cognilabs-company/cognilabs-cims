import type { CSSProperties, ReactNode } from 'react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { CountUp } from './count-up'

type Tone = 'success' | 'danger' | 'warning' | 'neutral'

export type InsightFact = { text: ReactNode; tone?: Tone }

type InsightCardProps = {
  label: string
  value: number | string
  format?: (value: number) => string
  icon: LucideIcon
  /** Accent colour (hex) — top edge, icon, progress bar, active ring. */
  color: string
  /** Small pill in the top-right corner (share, change vs yesterday…). */
  badge?: ReactNode
  badgeTone?: Tone | 'accent'
  /** 0–100: a thin bar under the number. */
  progress?: number | null
  /** Up to three short facts under the number ("Today: 3", "Overdue: 2"). */
  facts?: InsightFact[]
  /** Shown when there are no facts. */
  caption?: ReactNode
  onClick?: () => void
  active?: boolean
  actionLabel?: string
  compact?: boolean
  className?: string
}

const toneClass: Record<Tone, string> = {
  success: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  danger: 'bg-[var(--danger-dim)] text-[var(--danger-text)]',
  warning: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  neutral: 'bg-[var(--input-surface)] text-[var(--muted-strong)]',
}

/**
 * KPI card shared by the Customers page (status cards) and the CEO dashboard:
 * coloured top edge, icon + label + badge, a big number, an optional share bar
 * and a few short facts. Works as a toggle button when `onClick` is given.
 */
export function InsightCard({
  label, value, format, icon: Icon, color, badge, badgeTone = 'accent', progress, facts, caption,
  onClick, active = false, actionLabel, compact = false, className,
}: InsightCardProps) {
  const Cell = onClick ? 'button' : 'div'
  const style = {
    '--insight': color,
    ...(active ? { boxShadow: `0 0 0 2px ${color}, 0 16px 34px -22px ${color}` } : {}),
  } as CSSProperties
  const shownFacts = (facts ?? []).filter(Boolean).slice(0, 3)

  return (
    <Cell
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active, title: actionLabel } : {})}
      style={style}
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-[20px] text-left transition-[transform,box-shadow,background-color] duration-300',
        compact ? 'min-h-[128px] p-3.5' : 'min-h-[158px] p-4',
        active ? 'bg-[color-mix(in_srgb,var(--insight)_6%,var(--card))]' : 'bg-[var(--card)] ring-1 ring-[var(--border)] ring-inset',
        onClick && 'hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(14,21,37,0.5)] focus-visible:ring-2 focus-visible:ring-[var(--insight)] focus-visible:outline-none',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[var(--insight)]" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-8 -bottom-10 h-28 w-28 rounded-full bg-[var(--insight)] opacity-[0.06] blur-xl transition-opacity duration-300 group-hover:opacity-[0.12]" aria-hidden="true" />

      <span className="relative flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--insight)_13%,transparent)] text-[var(--insight)]">
          <Icon size={17} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] leading-tight font-semibold text-[var(--muted-strong)]" title={label}>{label}</span>
        {onClick ? (
          <ArrowUpRight size={16} className="shrink-0 text-[var(--muted)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden="true" />
        ) : null}
      </span>

      {/* number + badge: same height on every card, so numbers line up across a row */}
      <span className={cn('relative flex min-w-0 items-end gap-2', compact ? 'mt-3' : 'mt-4')}>
        <span className={cn('shrink-0 leading-none font-bold tracking-[-0.035em] whitespace-nowrap text-[var(--foreground)] tabular-nums', compact ? 'text-[26px]' : 'text-[30px]')} data-ui-number="true">
          {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
        </span>
        {badge !== undefined && badge !== null && badge !== '' ? (
          <span
            className={cn(
              'mb-0.5 ml-auto min-w-0 truncate rounded-full px-2 py-[3px] text-[11.5px] font-semibold tabular-nums',
              badgeTone === 'accent' ? 'bg-[color-mix(in_srgb,var(--insight)_12%,transparent)] text-[var(--insight)]' : toneClass[badgeTone],
            )}
          >
            {badge}
          </span>
        ) : null}
      </span>

      {progress !== undefined && progress !== null ? (
        <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-[var(--track)]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[var(--insight)] transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </span>
      ) : null}

      {shownFacts.length > 0 ? (
        <span className="relative mt-auto flex flex-wrap gap-1.5 pt-3">
          {shownFacts.map((fact, index) => (
            <span key={index} className={cn('inline-flex max-w-full items-center truncate rounded-[8px] px-2 py-[3px] text-[11.5px] font-medium tabular-nums', toneClass[fact.tone ?? 'neutral'])}>
              {fact.text}
            </span>
          ))}
        </span>
      ) : caption ? (
        <span className="relative mt-auto block truncate pt-3 text-[12px] text-[var(--muted)]">{caption}</span>
      ) : null}
    </Cell>
  )
}
