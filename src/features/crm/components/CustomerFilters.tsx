import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { gridButton, gridPanel } from '../../../shared/ui/data-grid-styles'

/* Customers page parts: the all-in-one Filter panel, removable filter tokens,
   status pills, platform chips and a copy-to-clipboard button. */

export type FilterOption = { value: string; label: string; count?: number; color?: string; icon?: LucideIcon }

type FilterPanelProps<P extends string> = {
  labels: {
    filter: string
    period: string
    status: string
    platform: string
    custom: string
    from: string
    to: string
    clear: string
    done: string
  }
  activeCount: number
  period: P
  periodOptions: Array<{ value: P; label: string }>
  onPeriodChange: (value: P) => void
  dateStart: string
  dateEnd: string
  onDatesChange: (start: string, end: string) => void
  statusOptions: FilterOption[]
  isStatusSelected: (value: string) => boolean
  onStatusToggle: (value: string) => void
  platformOptions: FilterOption[]
  platform: string
  onPlatformChange: (value: string) => void
  onClearAll: () => void
}

/** One "Filter" button; the panel holds period, status and platform side by side. Changes apply instantly. */
export function FilterPanel<P extends string>({
  labels, activeCount, period, periodOptions, onPeriodChange, dateStart, dateEnd, onDatesChange,
  statusOptions, isStatusSelected, onStatusToggle, platformOptions, platform, onPlatformChange, onClearAll,
}: FilterPanelProps<P>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const hasRange = Boolean(dateStart || dateEnd)
  const sectionTitle = 'px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(gridButton, activeCount > 0 && 'border-[var(--blue-border)] text-[var(--primary)]')}
      >
        <SlidersHorizontal size={14} />
        {labels.filter}
        {activeCount > 0 ? (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--primary)] px-1 text-[10.5px] font-bold text-white">{activeCount}</span>
        ) : null}
        <ChevronDown size={13} className={cn('opacity-50 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open ? (
        <div role="dialog" aria-label={labels.filter} className={cn(gridPanel, 'left-0 w-[min(92vw,640px)] p-0')}>
          <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
            {/* Period */}
            <div className="border-b border-[var(--border)] p-2 sm:border-r sm:border-b-0">
              <p className={sectionTitle}>{labels.period}</p>
              <div className="flex flex-col gap-0.5">
                {periodOptions.map((option) => {
                  const selected = !hasRange && option.value === period
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => { onPeriodChange(option.value); onDatesChange('', '') }}
                      className={cn('flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px] transition-colors', selected ? 'bg-[var(--blue-dim)] font-semibold text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--muted-surface)]')}
                    >
                      {option.label}
                      {selected ? <Check size={14} /> : null}
                    </button>
                  )
                })}
              </div>
              <p className={cn(sectionTitle, 'mt-2')}>{labels.custom}</p>
              <div className="flex flex-col gap-1.5 px-1">
                <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                  {labels.from}
                  <input type="date" value={dateStart} max={dateEnd || undefined} onChange={(event) => { onPeriodChange(periodOptions[0].value); onDatesChange(event.target.value, dateEnd) }} className="h-8 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12.5px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1 text-[11.5px] text-[var(--muted)]">
                  {labels.to}
                  <input type="date" value={dateEnd} min={dateStart || undefined} onChange={(event) => { onPeriodChange(periodOptions[0].value); onDatesChange(dateStart, event.target.value) }} className="h-8 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12.5px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
                </label>
              </div>
            </div>

            {/* Status + platform */}
            <div className="flex max-h-[420px] flex-col overflow-y-auto overscroll-contain p-2">
              <p className={sectionTitle}>{labels.status}</p>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {statusOptions.map((option) => {
                  const selected = isStatusSelected(option.value)
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onStatusToggle(option.value)}
                      className={cn('flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] transition-colors', selected ? 'bg-[var(--blue-dim)]' : 'hover:bg-[var(--muted-surface)]', option.count === 0 && !selected && 'opacity-50')}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px]" style={{ background: `${option.color ?? '#8A90A2'}1A`, color: option.color ?? '#8A90A2' }}>
                        {Icon ? <Icon size={13} strokeWidth={2.2} /> : null}
                      </span>
                      <span className={cn('min-w-0 flex-1 truncate', selected ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-strong)]')}>{option.label}</span>
                      <span className="text-[11px] text-[var(--muted)] tabular-nums">{option.count ?? ''}</span>
                      <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border', selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[#CDD2DC]')}>
                        {selected ? <Check size={11} strokeWidth={3.2} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>

              {platformOptions.length > 0 ? (
                <>
                  <p className={cn(sectionTitle, 'mt-2')}>{labels.platform}</p>
                  <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                    {platformOptions.map((option) => {
                      const selected = platform === option.value
                      const Icon = option.icon
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onPlatformChange(selected ? '' : option.value)}
                          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-all active:scale-95', selected ? 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--primary)]' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted-surface)]')}
                        >
                          {Icon ? <Icon size={13} style={{ color: selected ? undefined : option.color }} /> : null}
                          {option.label}
                          <span className="text-[11px] text-[var(--muted)] tabular-nums">{option.count}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
            <button type="button" onClick={onClearAll} disabled={activeCount === 0} className="text-[12.5px] font-semibold text-[var(--muted-strong)] hover:text-[var(--danger-text)] disabled:opacity-40">{labels.clear}</button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-[8px] bg-[var(--surface-inverse)] px-3.5 text-[12.5px] font-semibold text-white transition-transform active:scale-95">{labels.done}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FilterToken({ children, onRemove, color, removeLabel }: { children: ReactNode; onRemove: () => void; color?: string; removeLabel: string }) {
  return (
    <span className="grid-row-in inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] pr-1 pl-2.5 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_1px_rgba(14,21,37,0.03)]">
      {color ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> : null}
      {children}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-5 w-5 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]">
        <X size={11} />
      </button>
    </span>
  )
}

/** Status as a soft outlined pill: icon + name in the status colour. */
export function StatusPill({ label, color, icon: Icon }: { label: string; color: string; icon: LucideIcon }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] border px-1.5 py-[3px] text-[11.5px] leading-none font-semibold"
      style={{ color, borderColor: `${color}40`, background: `${color}12` }}
    >
      <Icon size={12} strokeWidth={2.4} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Small tag (lead flags), like category chips. */
export function FlagTag({ tone, icon: Icon, children }: { tone: 'danger' | 'warning' | 'neutral'; icon: LucideIcon; children: ReactNode }) {
  const tones = {
    danger: 'bg-[var(--danger-dim)] text-[var(--danger-text)]',
    warning: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
    neutral: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-[5px] px-1.5 py-[3px] text-[11px] leading-none font-semibold', tones[tone])}>
      <Icon size={11} strokeWidth={2.4} />
      {children}
    </span>
  )
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
      className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-[6px] transition-all duration-150 active:scale-90', copied ? 'text-[var(--success-text)]' : 'text-[var(--caption)] opacity-0 group-hover/row:opacity-100 hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)] focus-visible:opacity-100')}
    >
      {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} />}
    </button>
  )
}
