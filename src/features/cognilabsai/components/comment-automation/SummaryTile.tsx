import { cn } from '../../../../shared/lib/cn'

const accentClassName = {
  default: 'border-[var(--border)] bg-[var(--card)]',
  danger: 'border-[var(--danger-border)] bg-[var(--danger-dim)]',
  blue: 'border-[var(--blue-border)] bg-[var(--blue-soft)]',
  success: 'border-[var(--success-border)] bg-[var(--success-dim)]',
} as const

const accentLabelClassName = {
  default: 'text-[var(--blue-text)]',
  danger: 'text-[var(--danger-text)]',
  blue: 'text-[var(--blue-text)]',
  success: 'text-[var(--success-text)]',
} as const

export function SummaryTile({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  accent?: keyof typeof accentClassName
}) {
  return (
    <div className={cn('rounded-xl border px-5 py-4 shadow-sm', accentClassName[accent])}>
      <p className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', accentLabelClassName[accent])}>{label}</p>
      <p data-ui-number="true" className="mt-3 text-[1.75rem] font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-[var(--caption)]">{hint}</p>}
    </div>
  )
}
