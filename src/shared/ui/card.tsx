import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

type CardVariant = 'default' | 'elevated' | 'glass' | 'metric' | 'glow' | 'inset'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  noPadding?: boolean
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-[var(--card)] text-[var(--foreground)]',

  elevated:
    'bg-[var(--card)] text-[var(--foreground)] shadow-[var(--elev-md)]',

  glass:
    'bg-[var(--card)] text-[var(--foreground)]',

  metric:
    'bg-[var(--card)] text-[var(--foreground)] transition-shadow hover:shadow-[var(--elev-md)]',

  glow:
    'bg-[var(--card)] text-[var(--foreground)] ring-1 ring-[var(--blue-border)]',

  inset:
    'bg-[var(--accent-soft)] text-[var(--foreground)]',
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
        'rounded-[24px]',
        variantClasses[variant],
        !noPadding && 'p-[22px]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-header" className={cn('flex flex-col space-y-1 p-[22px]', className)} {...props} />
  )
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-[17px] leading-none font-semibold tracking-[-0.01em] text-[var(--foreground)]', className)}
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
      className={cn('text-[13px] text-[var(--muted)]', className)}
      {...props}
    />
  )
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('p-[22px] pt-0', className)} {...props} />
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-body" className={cn('p-[22px]', className)} {...props} />
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
        'border-t border-[var(--border)] px-[22px] py-4',
        className,
      )}
      {...props}
    />
  )
}

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
  description,
  headerAction,
  bleed = false,
  divider = true,
  children,
  ...props
}: CardSectionProps) {
  const hasHeader = Boolean(title || eyebrow || headerAction || description)

  return (
    <section
      className={cn(
        divider && 'border-t border-[var(--border)] first:border-t-0',
        !bleed && 'p-[22px]',
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className={cn('flex flex-wrap items-start justify-between gap-3', !bleed && 'mb-4')}>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="ui-eyebrow">{eyebrow}</p>
            ) : null}
            {title ? (
              <h3 className={cn('ui-section-title text-[var(--foreground)]', Boolean(eyebrow) && 'mt-1')}>
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-[13px] text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
          {headerAction ? <div className="flex flex-wrap items-center gap-2">{headerAction}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

type CardMetricTone = 'default' | 'success' | 'danger' | 'blue' | 'warning'

type CardMetricProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: CardMetricTone
  className?: string
}

const cardMetricToneText: Record<CardMetricTone, string> = {
  default: 'text-[var(--foreground)]',
  success: 'text-[var(--success-text)]',
  danger: 'text-[var(--danger-text)]',
  blue: 'text-[var(--blue-text)]',
  warning: 'text-[var(--warning-text)]',
}

const cardMetricToneRule: Record<CardMetricTone, string> = {
  default: 'before:bg-[var(--border-hover)]',
  success: 'before:bg-[var(--success-text)]',
  danger: 'before:bg-[var(--danger-text)]',
  blue: 'before:bg-[var(--blue-text)]',
  warning: 'before:bg-[var(--warning-text)]',
}

export function CardMetric({ label, value, hint, tone = 'default', className }: CardMetricProps) {
  return (
    <div
      className={cn(
        'relative pl-3 before:absolute before:top-1 before:bottom-1 before:left-0 before:w-[2px] before:rounded-full',
        cardMetricToneRule[tone],
        className,
      )}
    >
      <p className="ui-card-label">{label}</p>
      <p className={cn('mt-1.5 text-[1.125rem] font-bold tracking-[-0.02em] tabular-nums', cardMetricToneText[tone])}>
        {value}
      </p>
      {hint ? <p className="ui-helper mt-1">{hint}</p> : null}
    </div>
  )
}
