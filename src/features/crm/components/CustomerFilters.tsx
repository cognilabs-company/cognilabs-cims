import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarRange, Check, ChevronDown, X } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

/* Building blocks of the Customers workspace: animated numbers, the facet rail,
   the period picker and removable filter tokens. */

type FacetItem = { value: string; label: string; count: number; color?: string }

export function FacetList({ title, allLabel, total, items, isSelected, onToggle, onClear, anySelected }: {
  title: string
  allLabel: string
  total: number
  items: FacetItem[]
  isSelected: (value: string) => boolean
  onToggle: (value: string) => void
  onClear: () => void
  anySelected: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pt-1 pb-2 text-[10.5px] font-semibold tracking-[0.09em] text-[var(--caption)] uppercase">{title}</p>
      <FacetRow label={allLabel} count={total} share={null} selected={!anySelected} onClick={onClear} color="var(--surface-inverse)" />
      {items.map((item) => (
        <FacetRow
          key={item.value}
          label={item.label}
          count={item.count}
          share={total > 0 ? item.count / total : 0}
          selected={isSelected(item.value)}
          onClick={() => onToggle(item.value)}
          color={item.color ?? 'var(--primary)'}
        />
      ))}
    </div>
  )
}

function FacetRow({ label, count, share, selected, onClick, color }: { label: string; count: number; share: number | null; selected: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full flex-col gap-1.5 rounded-[8px] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30',
        selected ? 'bg-[var(--surface)] shadow-[0_1px_2px_rgba(14,21,37,0.06),0_0_0_1px_var(--border)]' : 'hover:bg-[var(--surface)]',
        count === 0 && !selected && 'opacity-55',
      )}
    >
      {selected ? <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full" style={{ background: color }} /> : null}
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />
        <span className={cn('min-w-0 flex-1 truncate text-[13px]', selected ? 'font-semibold text-[var(--foreground)]' : 'font-medium text-[var(--muted-strong)]')}>{label}</span>
        <span className={cn('text-[12px] tabular-nums', selected ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted)]')}>{count}</span>
      </span>
      {share !== null ? (
        <span className="h-[3px] overflow-hidden rounded-full bg-[var(--input-surface)]">
          <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.round(share * 100)}%`, background: color, opacity: selected ? 1 : 0.55 }} />
        </span>
      ) : null}
    </button>
  )
}

type PeriodOption<T extends string> = { value: T; label: string }

export function PeriodPicker<T extends string>({ value, options, onChange, dateStart, dateEnd, onDatesChange, labels }: {
  value: T
  options: PeriodOption<T>[]
  onChange: (value: T) => void
  dateStart: string
  dateEnd: string
  onDatesChange: (start: string, end: string) => void
  labels: { title: string; custom: string; from: string; to: string; apply: string }
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(dateStart)
  const [to, setTo] = useState(dateEnd)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const formatDay = (day: string) => day.split('-').reverse().slice(0, 2).join('.')
  const hasRange = Boolean(dateStart || dateEnd)
  const current = hasRange
    ? `${dateStart ? formatDay(dateStart) : '…'} – ${dateEnd ? formatDay(dateEnd) : '…'}`
    : options.find((option) => option.value === value)?.label ?? ''
  const active = hasRange || Boolean(value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setFrom(dateStart); setTo(dateEnd); setOpen((state) => !state) }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30',
          active ? 'border-[var(--blue-border)] bg-[var(--blue-dim)] text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
        )}
      >
        <CalendarRange size={15} />
        {active ? current : <><span className="font-medium text-[var(--muted)]">{labels.title}:</span>{current}</>}
        <ChevronDown size={14} className={cn('opacity-60 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open ? (
        <div role="dialog" aria-label={labels.title} className="modal-pop absolute top-[calc(100%+6px)] left-0 z-30 w-[280px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--elev-xl)]">
          <div className="grid grid-cols-2 gap-1">
            {options.map((option) => {
              const selected = !hasRange && option.value === value
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => { onChange(option.value); onDatesChange('', ''); setOpen(false) }}
                  className={cn('flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors', selected ? 'bg-[var(--surface-inverse)] font-semibold text-white' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]')}
                >
                  {option.label}
                  {selected ? <Check size={14} /> : null}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 border-t border-[var(--border)] px-1.5 pt-2.5 pb-1.5">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">{labels.custom}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                {labels.from}
                <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--input-surface)] px-2 text-[13px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                {labels.to}
                <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--input-surface)] px-2 text-[13px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
              </label>
            </div>
            <button
              type="button"
              disabled={!from && !to}
              onClick={() => { onChange(options[0].value); onDatesChange(from, to); setOpen(false) }}
              className="mt-2.5 h-9 w-full rounded-[8px] bg-[var(--primary)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
            >
              {labels.apply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FilterToken({ children, onRemove, color, removeLabel }: { children: ReactNode; onRemove: () => void; color?: string; removeLabel: string }) {
  return (
    <span className="grid-row-in inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pr-1 pl-2 text-[12.5px] font-medium text-[var(--foreground)]">
      {color ? <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} /> : null}
      {children}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-5 w-5 place-items-center rounded-[4px] text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]">
        <X size={12} />
      </button>
    </span>
  )
}
