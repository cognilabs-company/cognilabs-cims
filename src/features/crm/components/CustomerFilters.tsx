import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarRange, Check, ChevronDown, X, type LucideIcon } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'

/* Flat, square filter controls for the Customers table toolbar. */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [close, open])
  return ref
}

const triggerBase = 'inline-flex h-9 items-center gap-2 border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30'
const triggerIdle = 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]'
const triggerActive = 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--primary)]'
const panel = 'modal-pop absolute top-[calc(100%+4px)] left-0 z-30 border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_40px_-20px_rgba(14,21,37,0.45)]'

export type FilterMenuItem = { value: string; label: string; count: number; color?: string; icon?: LucideIcon }

/** A dropdown with a checkable list (status / platform). */
export function FilterMenu({ label, icon: TriggerIcon, items, isSelected, onToggle, onClear, selectedCount, clearLabel }: {
  label: string
  icon: LucideIcon
  items: FilterMenuItem[]
  isSelected: (value: string) => boolean
  onToggle: (value: string) => void
  onClear: () => void
  selectedCount: number
  clearLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const active = selectedCount > 0

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((state) => !state)} aria-expanded={open} aria-haspopup="menu" className={cn(triggerBase, active ? triggerActive : triggerIdle)}>
        <TriggerIcon size={15} />
        {label}
        {active ? <span className="grid h-[18px] min-w-[18px] place-items-center bg-[var(--primary)] px-1 font-mono text-[11px] text-white">{selectedCount}</span> : null}
        <ChevronDown size={14} className={cn('opacity-60 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open ? (
        <div role="menu" className={cn(panel, 'w-[260px] py-1')}>
          <ul className="max-h-[320px] overflow-y-auto overscroll-contain">
            {items.map((item) => {
              const selected = isSelected(item.value)
              const ItemIcon = item.icon
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={selected}
                    onClick={() => onToggle(item.value)}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--input-surface)]', item.count === 0 && !selected && 'opacity-55')}
                  >
                    <span className={cn('grid h-4 w-4 shrink-0 place-items-center border-[1.5px]', selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[#C9CED8] text-transparent')}>
                      <Check size={11} strokeWidth={3.2} />
                    </span>
                    {ItemIcon ? (
                      <span className="grid h-6 w-6 shrink-0 place-items-center" style={{ background: `${item.color ?? '#8A90A2'}1A`, color: item.color ?? 'var(--muted-strong)' }}>
                        <ItemIcon size={13} strokeWidth={2.2} />
                      </span>
                    ) : (
                      <span className="h-2 w-2 shrink-0" style={{ background: item.color ?? 'var(--primary)' }} />
                    )}
                    <span className={cn('min-w-0 flex-1 truncate', selected ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-strong)]')}>{item.label}</span>
                    <span className="font-mono text-[11.5px] text-[var(--muted)] tabular-nums">{item.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {active ? (
            <button type="button" onClick={() => { onClear(); setOpen(false) }} className="mt-1 w-full border-t border-[var(--border)] px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--primary)] hover:bg-[var(--input-surface)]">
              {clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
  const ref = useDismiss(open, () => setOpen(false))

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
        className={cn(triggerBase, active ? triggerActive : triggerIdle)}
      >
        <CalendarRange size={15} />
        {active ? current : <><span className="font-medium text-[var(--muted)]">{labels.title}:</span>{current}</>}
        <ChevronDown size={14} className={cn('opacity-60 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open ? (
        <div role="dialog" aria-label={labels.title} className={cn(panel, 'w-[280px]')}>
          <div className="grid grid-cols-2 border-b border-[var(--border)]">
            {options.map((option, index) => {
              const selected = !hasRange && option.value === value
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => { onChange(option.value); onDatesChange('', ''); setOpen(false) }}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] transition-colors',
                    index % 2 === 1 && 'border-l border-[var(--border)]',
                    index >= 2 && 'border-t border-[var(--border)]',
                    selected ? 'bg-[var(--surface-inverse)] font-semibold text-white' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
                  )}
                >
                  {option.label}
                  {selected ? <Check size={14} /> : null}
                </button>
              )
            })}
          </div>
          <div className="p-3">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">{labels.custom}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                {labels.from}
                <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-9 border border-[var(--border)] bg-[var(--input-surface)] px-2 text-[13px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                {labels.to}
                <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-9 border border-[var(--border)] bg-[var(--input-surface)] px-2 text-[13px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
              </label>
            </div>
            <button
              type="button"
              disabled={!from && !to}
              onClick={() => { onChange(options[0].value); onDatesChange(from, to); setOpen(false) }}
              className="mt-2.5 h-9 w-full bg-[var(--primary)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
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
    <span className="grid-row-in inline-flex h-7 items-center gap-1.5 border border-[var(--border)] bg-[var(--surface)] pr-1 pl-2 text-[12.5px] font-medium text-[var(--foreground)]">
      {color ? <span className="h-2 w-2" style={{ background: color }} /> : null}
      {children}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-5 w-5 place-items-center text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]">
        <X size={12} />
      </button>
    </span>
  )
}
