import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { toneSurface, toneText, type Tone } from './tone'

type StatCardProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  delta?: ReactNode
  deltaTone?: 'success' | 'danger' | 'neutral'
  icon?: ReactNode
  iconTone?: Tone
  solid?: boolean
  onOpen?: () => void
  openLabel?: string
  canvas?: string
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  canvas = 'var(--app-canvas)',
  footer,
  className,
}: StatCardProps) {
  const notchStyle = { background: canvas } as CSSProperties
  const cornerStyle = {
    background: `radial-gradient(circle at 0 100%, transparent 19.5px, ${canvas} 20px)`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'relative flex min-h-[168px] flex-col justify-between rounded-[24px] p-[22px]',
        solid ? 'text-white' : 'bg-[var(--card)] text-[var(--foreground)]',
        className,
      )}
      style={solid ? { background: 'var(--primary-gradient)' } : undefined}
    >
      {onOpen ? (
        <div className="absolute top-0 right-0 h-[62px] w-[62px] rounded-bl-[24px]" style={notchStyle}>
          <span className="absolute top-0 -left-5 h-5 w-5" style={cornerStyle} />
          <span className="absolute right-0 -bottom-5 h-5 w-5" style={cornerStyle} />
          <button
            type="button"
            onClick={onOpen}
            aria-label={openLabel ?? (typeof label === 'string' ? label : 'Open')}
            className={cn(
              'absolute top-0 right-0 grid h-[50px] w-[50px] place-items-center rounded-full transition-colors',
              solid
                ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                : 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_0_#E6E8EE] hover:bg-[var(--surface-inverse)] hover:text-white',
            )}
          >
            <ArrowOut />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2.5">
        {icon ? (
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-[11px]',
              solid ? 'bg-white/16 text-white' : cn(toneSurface[iconTone], toneText[iconTone]),
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className={cn('text-[15px] font-medium', solid ? 'text-white' : 'text-[var(--foreground)]')}>
          {label}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[28px] font-bold tracking-[-0.03em] tabular-nums" data-ui-number="true">
            {value}
          </span>
          {delta ? (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-semibold',
                solid ? 'bg-white/18 text-white' : deltaClasses[deltaTone],
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>
        {hint ? (
          <span className={cn('text-[12.5px]', solid ? 'text-[#D7E0FF]' : 'text-[var(--muted)]')}>
            {hint}
          </span>
        ) : null}
        {footer}
      </div>
    </div>
  )
}
