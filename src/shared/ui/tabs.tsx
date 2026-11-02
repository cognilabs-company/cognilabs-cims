import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type TabItem<T extends string = string> = {
  value: T
  label: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

type TabsProps<T extends string> = {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'segment' | 'underline'
  className?: string
  ariaLabel?: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'segment',
  className,
  ariaLabel,
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-6 border-b border-[var(--border)]', className)}>
        {items.map((item) => {
          const isActive = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm whitespace-nowrap transition-colors',
                'disabled:pointer-events-none disabled:opacity-40',
                isActive
                  ? 'border-[var(--primary)] font-semibold text-[var(--primary)]'
                  : 'border-transparent font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {item.label}
              {item.badge}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-1 rounded-[12px] bg-[var(--input-surface)] p-1', className)}
    >
      {items.map((item) => {
        const isActive = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-[30px] items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] whitespace-nowrap transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              isActive
                ? 'bg-[var(--surface)] font-semibold text-[var(--foreground)] shadow-[var(--elev-seg)]'
                : 'font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
