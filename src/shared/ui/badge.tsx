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
  | 'lime'
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
    'border-transparent bg-[var(--surface-inverse)] text-white',

  secondary:
    'border-transparent bg-[var(--input-surface)] text-[var(--muted-strong)]',

  outline:
    'border-[var(--border-hover)] bg-transparent text-[var(--muted-strong)]',

  blue:
    'border-transparent bg-[var(--blue-dim)] text-[var(--blue-text)]',

  success:
    'border-transparent bg-[var(--success-dim)] text-[var(--success-text)]',

  warning:
    'border-transparent bg-[var(--warning-dim)] text-[var(--warning-text)]',

  danger:
    'border-transparent bg-[var(--danger-dim)] text-[var(--danger-text)]',

  violet:
    'border-transparent bg-[var(--violet-dim)] text-[var(--violet-text)]',

  lime:
    'border-transparent bg-[var(--lime)] text-[var(--lime-ink)]',

  ghost:
    'border-transparent bg-transparent text-[var(--muted)]',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'gap-1 rounded-full px-2 py-1 text-[11.5px] leading-none',
  md: 'gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none',
}

const dotColors: Record<BadgeVariant, string> = {
  default:   'bg-white',
  secondary: 'bg-[var(--muted)]',
  outline:   'bg-[var(--muted)]',
  blue:      'bg-[var(--blue-text)]',
  success:   'bg-[var(--success-text)]',
  warning:   'bg-[var(--warning-text)]',
  danger:    'bg-[var(--danger-text)]',
  violet:    'bg-[var(--violet-text)]',
  lime:      'bg-[var(--lime-ink)]',
  ghost:     'bg-[var(--muted)]',
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
        'inline-flex items-center justify-center border font-semibold whitespace-nowrap',
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
