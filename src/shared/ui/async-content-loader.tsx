import { cn } from '../lib/cn'

type AsyncContentLoaderProps = {
  variant?: 'page' | 'panel' | 'dialog'
  className?: string
}

const containerClasses: Record<NonNullable<AsyncContentLoaderProps['variant']>, string> = {
  page:
    'min-h-[320px] rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] px-6 py-8 shadow-[var(--shadow-xl)] lg:px-8',
  panel:
    'min-h-[280px] rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] px-5 py-6 shadow-[var(--shadow-lg)]',
  dialog:
    'flex h-full min-h-[360px] flex-col rounded-xl bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] px-4 py-4',
}

export function AsyncContentLoader({
  variant = 'page',
  className,
}: AsyncContentLoaderProps) {
  return (
    <div data-ui-surface="true" className={cn('overflow-hidden', containerClasses[variant], className)}>
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--accent-soft)]" />
        <div className="h-8 w-2/5 animate-pulse rounded-full bg-[var(--muted-surface)]" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--accent-soft)]" />
      </div>

      <div className={cn('mt-6 grid gap-3', variant === 'page' ? 'md:grid-cols-2' : 'grid-cols-1')}>
        {Array.from({ length: variant === 'dialog' ? 4 : 6 }).map((_, index) => (
          <div
            key={index}
            data-ui-surface="true"
            className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted-surface)]"
          />
        ))}
      </div>
    </div>
  )
}
