import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { translateCurrent } from '../i18n/translations'
import { monthName, monthShort } from '../lib/calendarLabels'
import { cn } from '../lib/cn'
import { anchorPopover, type PopoverStyle } from './popover-position'

type MonthFieldProps = {
  /** "YYYY-MM" */
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  className?: string
  placeholder?: string
  'aria-label'?: string
}

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null
}

/** Month picker (year arrows + 12 months) — replaces the browser's <input type="month">. */
export function MonthField({ value, onValueChange, disabled, id, className, placeholder, 'aria-label': ariaLabel }: MonthFieldProps) {
  const { locale } = useLocale()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [style, setStyle] = useState<PopoverStyle | null>(null)
  const [year, setYear] = useState(() => parse(value)?.year ?? new Date().getFullYear())
  const current = parse(value)
  const now = new Date()
  const open = style !== null
  const close = (focus = false) => { setStyle(null); if (focus) triggerRef.current?.focus() }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setStyle(null)
      triggerRef.current?.focus()
    }
    const onMove = () => { if (triggerRef.current) setStyle(anchorPopover(triggerRef.current, 236, 264)) }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  function toggle() {
    if (open) { close(); return }
    if (!triggerRef.current) return
    setYear(current?.year ?? now.getFullYear())
    setStyle(anchorPopover(triggerRef.current, 236, 264))
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        data-ui-control="true"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        className={cn('control-field flex min-h-10 w-full min-w-0 items-center gap-2 rounded-[10px] px-3 text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50', className)}
      >
        <CalendarDays size={15} className="shrink-0 text-[var(--muted)]" />
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-[var(--caption)]')}>
          {current ? `${monthName(locale, current.month)} ${current.year}` : placeholder ?? translateCurrent('picker.select_month', 'Select month')}
        </span>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div data-floating-layer="true">
          <div className="fixed inset-0 z-[179]" onPointerDown={() => close()} aria-hidden="true" />
          <div role="dialog" aria-label={translateCurrent('picker.choose_month', 'Choose month')} className="popover-panel fixed z-[180] p-2.5" style={style ?? undefined}>
            <div className="flex items-center justify-between">
              <button type="button" aria-label={translateCurrent('picker.prev_year', 'Previous year')} onClick={() => setYear((y) => y - 1)} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ChevronLeft size={16} /></button>
              <span className="text-[13px] font-semibold tabular-nums">{year}</span>
              <button type="button" aria-label={translateCurrent('picker.next_year', 'Next year')} onClick={() => setYear((y) => y + 1)} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ChevronRight size={16} /></button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, month) => {
                const selected = current?.year === year && current.month === month
                const isNow = now.getFullYear() === year && now.getMonth() === month
                return (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => { onValueChange(`${year}-${String(month + 1).padStart(2, '0')}`); close(true) }}
                    className={cn(
                      'h-9 rounded-[8px] text-[12.5px] font-medium transition-colors',
                      selected ? 'bg-[var(--primary)] font-semibold text-white' : isNow ? 'text-[var(--primary)] ring-1 ring-[var(--blue-border)] hover:bg-[var(--blue-dim)]' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
                    )}
                  >
                    {monthShort(locale, month)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
