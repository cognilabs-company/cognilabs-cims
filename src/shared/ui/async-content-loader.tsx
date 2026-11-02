import { cn } from '../lib/cn'

type AsyncContentLoaderProps = {
  variant?: 'page' | 'panel' | 'dialog'
  className?: string
}

const containerClasses: Record<NonNullable<AsyncContentLoaderProps['variant']>, string> = {
  page: 'min-h-[320px] rounded-[24px] bg-[var(--surface)] p-[22px]',
  panel: 'min-h-[280px] rounded-[24px] bg-[var(--surface)] p-[22px]',
  dialog: 'flex h-full min-h-[360px] flex-col rounded-[18px] bg-[var(--surface)] p-4',
}

export function AsyncContentLoader({
  variant = 'page',
  className,
}: AsyncContentLoaderProps) {
  return (
    <div data-ui-surface="true" className={cn('overflow-hidden', containerClasses[variant], className)}>
      <div className="space-y-4">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-8 w-2/5 rounded-full" />
        <div className="skeleton h-3 w-4/5 rounded-full" />
      </div>

      <div className={cn('mt-6 grid gap-[18px]', variant === 'page' ? 'md:grid-cols-2' : 'grid-cols-1')}>
        {Array.from({ length: variant === 'dialog' ? 4 : 6 }).map((_, index) => (
          <div key={index} className="skeleton h-20 rounded-[18px]" />
        ))}
      </div>
    </div>
  )
}
