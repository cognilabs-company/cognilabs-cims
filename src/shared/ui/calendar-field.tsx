import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../lib/cn'

type CalendarFieldProps = {
  value: string
  onValueChange: (value: string) => void
  mode?: 'date' | 'datetime'
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
  placeholder?: string
}

type Position = { top: number; left: number; width: number }

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function positionFor(trigger: HTMLElement, mode: 'date' | 'datetime'): Position {
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 16)
  const height = mode === 'datetime' ? 480 : 430
  const top = rect.bottom + 8 + height <= window.innerHeight
    ? rect.bottom + 8
    : rect.top - height - 8 >= 8
      ? rect.top - height - 8
      : Math.max(8, window.innerHeight - height - 8)
  return { top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width }
}

export function CalendarField({ value, onValueChange, mode = 'date', min, max, required = false, disabled = false, id, className, placeholder, ...accessibility }: CalendarFieldProps) {
  const { locale } = useLocale()
  const generatedId = useId()
  const timeInputId = `${id ?? generatedId}-time`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const date = dateParts(value) ?? new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [time, setTime] = useState(() => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : '09:00')
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, width: 320 })
  const selected = dateParts(value)
  const today = isoDate(new Date())
  const minDate = min?.slice(0, 10)
  const maxDate = max?.slice(0, 10)

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(month)
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index))), [locale])
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index - offset + 1))
  }, [month])

  useEffect(() => {
    if (!open) return
    const updatePosition = () => { if (triggerRef.current) setPosition(positionFor(triggerRef.current, mode)) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    updatePosition()
    popupRef.current?.focus()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, mode])

  function openCalendar() {
    if (disabled) return
    if (!open) {
      const date = dateParts(value) ?? new Date()
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
      setTime(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : '09:00')
      if (triggerRef.current) setPosition(positionFor(triggerRef.current, mode))
    }
    setOpen((current) => !current)
  }

  function setDate(day: string) {
    let next = mode === 'datetime' ? `${day}T${time}` : day
    const minValue = min && mode === 'datetime' && min.length === 10 ? `${min}T00:00` : min
    const maxValue = max && mode === 'datetime' && max.length === 10 ? `${max}T23:59` : max
    if (minValue && next < minValue) next = minValue
    if (maxValue && next > maxValue) next = maxValue
    if (mode === 'datetime') setTime(next.slice(11, 16) || time)
    onValueChange(next)
    const date = dateParts(day)
    if (date && date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    if (mode === 'date') closeCalendar(true)
  }

  function setTimeValue(nextTime: string) {
    setTime(nextTime)
    if (!selected || !nextTime) return
    let next = `${value.slice(0, 10)}T${nextTime}`
    const minValue = min && min.length === 10 ? `${min}T00:00` : min
    const maxValue = max && max.length === 10 ? `${max}T23:59` : max
    if (minValue && next < minValue) next = minValue
    if (maxValue && next > maxValue) next = maxValue
    setTime(next.slice(11, 16) || nextTime)
    onValueChange(next)
  }

  function closeCalendar(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const display = selected
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(selected) +
      (mode === 'datetime' ? ` · ${value.slice(11, 16) || time}` : '')
    : placeholder ?? (mode === 'datetime' ? 'Select date and time' : 'Select date')

  return <>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      data-ui-control="true"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-required={required}
      disabled={disabled}
      onClick={openCalendar}
      className={cn('flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[14px] border border-transparent bg-[var(--input-surface)] px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface-hover)] focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...accessibility}
    >
      <CalendarDays size={16} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
      <span className={cn('min-w-0 flex-1 truncate tabular-nums', !selected && 'text-[var(--muted)]')}>{display}</span>
      {mode === 'datetime' && <Clock3 size={15} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />}
    </button>
    {open && typeof document !== 'undefined' && createPortal(<>
      <button type="button" className="fixed inset-0 z-[179] cursor-default" aria-label="Close calendar" tabIndex={-1} onClick={() => closeCalendar(true)} />
      <div ref={popupRef} tabIndex={-1} role="dialog" aria-label={mode === 'datetime' ? 'Choose date and time' : 'Choose date'} className="fixed z-[180] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] shadow-[var(--elev-lg)] outline-none" style={{ ...position, maxHeight: 'calc(100vh - 16px)' }}>
        <div className="flex items-center justify-between gap-1">
          <button type="button" title="Previous month" aria-label="Previous month" onClick={() => changeMonth(-1)} className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ChevronLeft size={17} /></button>
          <div className="flex min-w-0 items-center gap-1">
            <select aria-label="Month" value={month.getMonth()} onChange={(event) => setMonth(new Date(month.getFullYear(), Number(event.target.value), 1))} className="max-w-[120px] cursor-pointer bg-transparent text-sm font-semibold outline-none">{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, index, 1))}</option>)}</select>
            <select aria-label="Year" value={month.getFullYear()} onChange={(event) => setMonth(new Date(Number(event.target.value), month.getMonth(), 1))} className="cursor-pointer bg-transparent text-sm font-semibold outline-none">{Array.from({ length: 201 }, (_, index) => 1900 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select>
          </div>
          <button type="button" title="Next month" aria-label="Next month" onClick={() => changeMonth(1)} className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ChevronRight size={17} /></button>
        </div>
        <p className="sr-only" aria-live="polite">{monthLabel} {month.getFullYear()}</p>
        <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--muted)]">{weekdayLabels.map((label, index) => <span key={index} className="py-1.5">{label}</span>)}</div>
        <div className="grid grid-cols-7 gap-0.5">{days.map((day) => {
          const iso = isoDate(day)
          const outOfRange = (minDate && iso < minDate) || (maxDate && iso > maxDate)
          const isSelected = iso === value.slice(0, 10)
          return <button key={iso} type="button" disabled={Boolean(outOfRange)} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day)} aria-pressed={isSelected} onClick={() => setDate(iso)} className={cn('grid aspect-square w-full place-items-center rounded-md text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-25', isSelected ? 'bg-[var(--primary)] font-bold text-white' : iso === today ? 'border border-[var(--primary)] font-semibold text-[var(--primary)] hover:bg-[var(--blue-dim)]' : day.getMonth() !== month.getMonth() ? 'text-[var(--caption)] hover:bg-[var(--input-surface)]' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]')}>{day.getDate()}</button>
        })}</div>
        {mode === 'datetime' && <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3"><label htmlFor={timeInputId} className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-strong)]"><Clock3 size={15} /> Time</label><input id={timeInputId} type="time" value={time} onChange={(event) => setTimeValue(event.target.value)} className="rounded-md bg-[var(--input-surface)] px-2 py-1.5 text-sm tabular-nums text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30" /></div>}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs font-semibold">
          <button type="button" onClick={() => setDate(today)} disabled={Boolean((minDate && today < minDate) || (maxDate && today > maxDate))} className="rounded-md px-2.5 py-1.5 text-[var(--blue-text)] hover:bg-[var(--blue-dim)] disabled:opacity-40">Today</button>
          <div className="flex items-center gap-1">{!required && value && <button type="button" onClick={() => { onValueChange(''); closeCalendar(true) }} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[var(--muted)] hover:bg-[var(--input-surface)]"><X size={13} /> Clear</button>}{mode === 'datetime' && <button type="button" onClick={() => closeCalendar(true)} className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-white">Done</button>}</div>
        </div>
      </div>
    </>, document.body)}
  </>
}
