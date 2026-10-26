import type { PropsWithChildren } from 'react'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'blue'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet'
  | 'ghost'

type BadgeSize = 'sm' | 'md'

type BadgeProps = PropsWithChildren<{
  className?: string
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  pulse?: boolean
}>

const variants: Record<BadgeVariant, string> = {
  default:
    'border-transparent bg-white/90 text-black',

  secondary:
    'border-[var(--border)] bg-[var(--muted-surface)] text-[var(--muted-strong)]',

  outline:
    'border-[var(--border)] bg-transparent text-[var(--muted-strong)]',

  blue:
    'border-[var(--blue-border)] bg-[var(--blue-dim)] text-[var(--blue-text)]',

  success:
    'border-[var(--success-border)] bg-[var(--success-dim)] text-[var(--success-text)]',

  warning:
    'border-[var(--warning-border)] bg-[var(--warning-dim)] text-[var(--warning-text)]',

  danger:
    'border-[var(--danger-border)] bg-[var(--danger-dim)] text-[var(--danger-text)]',

  violet:
    'border-[var(--violet-border)] bg-[var(--violet-dim)] text-[var(--violet-text)]',

  ghost:
    'border-transparent bg-transparent text-[var(--muted)]',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[11px] rounded-md gap-1 leading-none',
  md: 'px-2 py-0.5 text-[12px] rounded-md gap-1.5 leading-none',
}

const dotColors: Record<BadgeVariant, string> = {
  default:  'bg-black',
  secondary:'bg-[var(--muted)]',
  outline:  'bg-[var(--muted)]',
  blue:     'bg-[var(--blue-text)] shadow-[0_0_5px_rgba(96,165,250,0.6)]',
  success:  'bg-[var(--success-text)] shadow-[0_0_5px_rgba(74,222,128,0.6)]',
  warning:  'bg-[var(--warning-text)] shadow-[0_0_5px_rgba(251,191,36,0.6)]',
  danger:   'bg-[var(--danger-text)] shadow-[0_0_5px_rgba(248,113,113,0.6)]',
  violet:   'bg-[var(--violet-text)] shadow-[0_0_5px_rgba(167,139,250,0.6)]',
  ghost:    'bg-[var(--muted)]',
}

export function Badge({
  children,
  className,
  variant = 'outline',
  size = 'md',
  dot = false,
  pulse = false,
}: BadgeProps) {
  const localizedChildren = typeof children === 'string' ? translateCurrentLiteral(children) : children

  return (
    <span
      data-ui-control="true"
      className={cn(
        'inline-flex items-center justify-center border font-medium whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            'inline-block shrink-0 rounded-full',
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            dotColors[variant],
            pulse && 'badge-pulse',
          )}
        />
      ) : null}
      {localizedChildren}
    </span>
  )
}

/* ─── Preset semantic badges ──────────────────────────── */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const normalized = status.toLowerCase().replace(/[^a-z]/g, '')

  const map: Record<string, BadgeVariant> = {
    active:      'success',
    online:      'success',
    paid:        'success',
    done:        'success',
    finished:    'success',
    success:     'success',
    pending:     'warning',
    inprocess:   'warning',
    processing:  'warning',
    waiting:     'warning',
    inactive:    'danger',
    failed:      'danger',
    rejected:    'danger',
    deleted:     'danger',
    error:       'danger',
    contacted:   'blue',
    continuing:  'violet',
  }

  const variant = map[normalized] ?? 'outline'

  return (
    <Badge variant={variant} dot className={className}>
      {status}
    </Badge>
  )
}
