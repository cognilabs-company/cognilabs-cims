import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

type CardVariant = 'default' | 'elevated' | 'glass' | 'metric' | 'glow' | 'inset'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  noPadding?: boolean
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm',

  elevated:
    'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-md',

  glass:
    'border border-[var(--border)] bg-white/5 backdrop-blur-xl text-[var(--foreground)] shadow-lg',

  metric:
    'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm hover:shadow-md transition-shadow',

  glow:
    'border border-blue-500/20 bg-[var(--card)] text-[var(--foreground)] shadow-[0_0_15px_rgba(59,130,246,0.1)]',

  inset:
    'border border-[var(--border)] bg-[var(--accent-soft)]/20 text-[var(--foreground)]',
}

export function Card({
  className,
  variant = 'default',
  noPadding = false,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-xl',
        variantClasses[variant],
        !noPadding && 'p-4',
        className,
      )}
      {...props}
    />
  )
}

/* ─── Compound sub-components ─────────────────────────── */
export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-header" className={cn('flex flex-col space-y-1 p-4', className)} {...props} />
  )
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-lg font-semibold leading-none tracking-tight text-(--foreground)', className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-(--muted)', className)}
      {...props}
    />
  )
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('p-4 pt-0', className)} {...props} />
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-body" className={cn('px-4 py-4', className)} {...props} />
  )
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'border-t border-(--border) px-4 py-3',
        className,
      )}
      {...props}
    />
  )
}

/**
 * CardSection — a divider-separated panel inside a single Card.
 *
 * Use this to flatten "card-in-card-in-card" layouts: stack multiple sections
 * inside ONE Card (with `noPadding`) and let the section borders render the
 * visual seams instead of nesting bordered boxes.
 */
type CardSectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  headerAction?: ReactNode
  bleed?: boolean
  divider?: boolean
}

export function CardSection({
  className,
  title,
  eyebrow,
  description: _description,
  headerAction,
  bleed = false,
  divider = true,
  children,
  ...props
}: CardSectionProps) {
  const hasHeader = Boolean(title || eyebrow || headerAction)

  return (
    <section
      className={cn(
        divider && 'border-t border-(--border) first:border-t-0',
        !bleed && 'px-4 py-4 sm:px-5 sm:py-5',
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className={cn('flex flex-wrap items-start justify-between gap-3', !bleed && 'mb-4')}>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="ui-eyebrow text-(--muted)">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h3 className={cn('ui-section-title text-(--foreground)', Boolean(eyebrow) && 'mt-1')}>
                {title}
              </h3>
            ) : null}
          </div>
          {headerAction ? <div className="flex flex-wrap items-center gap-2">{headerAction}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

/**
 * CardMetric — borderless inline metric for stat grids inside a Card.
 *
 * Replaces the bordered DetailStatTile when used inside a Card section.
 * A vertical accent rule on the left provides separation without nesting.
 */
type CardMetricTone = 'default' | 'success' | 'danger' | 'blue' | 'warning'

type CardMetricProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: CardMetricTone
  className?: string
}

const cardMetricToneText: Record<CardMetricTone, string> = {
  default: 'text-(--foreground)',
  success: 'text-(--success-text)',
  danger: 'text-(--danger-text)',
  blue: 'text-(--blue-text)',
  warning: 'text-(--warning-text)',
}

const cardMetricToneRule: Record<CardMetricTone, string> = {
  default: 'before:bg-(--border)',
  success: 'before:bg-(--success-text)',
  danger: 'before:bg-(--danger-text)',
  blue: 'before:bg-(--blue-text)',
  warning: 'before:bg-(--warning-text)',
}

export function CardMetric({ label, value, hint, tone = 'default', className }: CardMetricProps) {
  return (
    <div
      className={cn(
        'relative pl-3 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:rounded-full',
        cardMetricToneRule[tone],
        className,
      )}
    >
      <p className="ui-card-label text-(--muted)">
        {label}
      </p>
      <p className={cn('mt-1.5 text-[1.125rem] font-semibold tracking-tight tabular-nums', cardMetricToneText[tone])}>
        {value}
      </p>
      {hint ? <p className="ui-helper mt-1 text-(--muted-strong)">{hint}</p> : null}
    </div>
  )
}
