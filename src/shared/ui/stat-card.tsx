import type { KeyboardEvent, ReactNode } from 'react'
import { IconContext } from '@phosphor-icons/react'
import { cn } from '../lib/cn'
import { CountUp } from './count-up'
import { toneSurface, toneText, type Tone } from './tone'

type StatCardProps = {
  /** Short metric name, shown above the number. */
  label: ReactNode
  /** The main value — the most important thing on the card. */
  value: ReactNode
  /** One line of context under the value. */
  hint?: ReactNode
  /** Small pill next to the hint (change, ratio, warning count). */
  delta?: ReactNode
  deltaTone?: 'success' | 'danger' | 'neutral'
  icon?: ReactNode
  iconTone?: Tone
  /** The single most important KPI of a row — outlined in the brand colour. */
  solid?: boolean
  onOpen?: () => void
  openLabel?: string
  footer?: ReactNode
  className?: string
}

const deltaClasses: Record<NonNullable<StatCardProps['deltaTone']>, string> = {
  success: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  danger: 'bg-[var(--danger-dim)] text-[var(--danger-text)]',
  neutral: 'bg-[var(--input-surface)] text-[var(--muted-strong)]',
}

const DUOTONE = { weight: 'duotone' as const, size: 18 }

/** Accent of the soft circle and the caption dot, per icon tone. */
const toneAccent: Record<Tone, string> = {
  neutral: '#8A90A2',
  blue: '#2B59FF',
  success: '#17924A',
  warning: '#E8590C',
  danger: '#D63B3B',
  violet: '#7C5CFC',
  lime: '#65A30D',
}

/**
 * KPI card — the same compact tile as the Customers page (MetricTile):
 * label + icon on top, a big number, one caption line. Used across the app.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaTone = 'success',
  icon,
  iconTone = 'blue',
  solid = false,
  onOpen,
  openLabel,
  footer,
  className,
}: StatCardProps) {
  const accent = toneAccent[iconTone]
  const clickable = Boolean(onOpen)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpen) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      {...(clickable ? { role: 'button', tabIndex: 0, onClick: onOpen, onKeyDown, 'aria-label': openLabel ?? (typeof label === 'string' ? label : undefined) } : {})}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border bg-[var(--card)] px-4 py-3.5 text-left text-[var(--foreground)] transition-[transform,box-shadow,border-color] duration-300',
        solid ? 'border-transparent shadow-[0_0_0_2px_var(--primary),0_12px_28px_-18px_rgba(43,89,255,0.6)]' : 'border-[var(--border)] shadow-[0_1px_2px_rgba(14,21,37,0.04)]',
        clickable && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(14,21,37,0.45)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:outline-none',
        className,
      )}
    >
      <span className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-125" style={{ background: accent }} />

      <span className="relative flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[12.5px] font-medium text-[var(--muted-strong)]">{label}</span>
        {icon ? (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[9px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] [&_svg]:h-[18px] [&_svg]:w-[18px]', toneSurface[iconTone], toneText[iconTone])}>
            <IconContext.Provider value={DUOTONE}>{icon}</IconContext.Provider>
          </span>
        ) : null}
      </span>

      <span className="relative mt-1 block truncate text-[28px] leading-8 font-bold tracking-[-0.035em] tabular-nums" data-ui-number="true">
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </span>

      {delta || hint ? (
        <span className="relative mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
          {delta ? (
            <span className={cn('inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums', deltaClasses[deltaTone])}>{delta}</span>
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          )}
          {hint ? <span className="truncate">{hint}</span> : null}
        </span>
      ) : null}
      {footer ? <div className="relative mt-2">{footer}</div> : null}
    </div>
  )
}
