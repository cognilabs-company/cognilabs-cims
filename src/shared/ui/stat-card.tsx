import type { ReactNode } from 'react'
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
  /** Highlighted (brand-filled) card — use for the single most important KPI. */
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

function ArrowOut() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M8 7h9v9" />
    </svg>
  )
}

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
  const hasMeta = Boolean(delta || hint)

  return (
    <div
      className={cn(
        'group relative flex min-h-[150px] flex-col rounded-[24px] p-[22px]',
        solid
          ? 'text-white shadow-[var(--elev-primary)]'
          : 'bg-[var(--card)] text-[var(--foreground)] ring-1 ring-inset ring-[var(--border)]',
        onOpen && 'transition-shadow hover:shadow-[var(--elev-lg)]',
        className,
      )}
      style={solid ? { background: 'var(--primary-gradient)' } : undefined}
    >
      {/* 1. What is this number? */}
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [&_svg]:h-[17px] [&_svg]:w-[17px]',
              solid ? 'bg-white/18 text-white' : cn(toneSurface[iconTone], toneText[iconTone]),
            )}
          >
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13.5px] font-medium leading-tight',
            solid ? 'text-white/85' : 'text-[var(--muted-strong)]',
          )}
        >
          {label}
        </span>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={openLabel ?? (typeof label === 'string' ? label : 'Open')}
            title={openLabel ?? (typeof label === 'string' ? label : undefined)}
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
              solid
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--surface-inverse)] hover:text-white',
            )}
          >
            <ArrowOut />
          </button>
        ) : null}
      </div>

      {/* 2. The number itself — biggest element on the card. */}
      <div className="mt-auto pt-5">
        <div
          className="truncate text-[32px] leading-none font-bold tracking-[-0.035em] tabular-nums"
          data-ui-number="true"
        >
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>

        {/* 3. Context: one pill + one line. */}
        {hasMeta ? (
          <div className="mt-3 flex min-w-0 items-center gap-2">
            {delta ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[11.5px] font-semibold tabular-nums',
                  solid ? 'bg-white/20 text-white' : deltaClasses[deltaTone],
                )}
              >
                {delta}
              </span>
            ) : null}
            {hint ? (
              <span className={cn('min-w-0 truncate text-[12.5px]', solid ? 'text-white/75' : 'text-[var(--muted)]')}>
                {hint}
              </span>
            ) : null}
          </div>
        ) : null}
        {footer}
      </div>
    </div>
  )
}
