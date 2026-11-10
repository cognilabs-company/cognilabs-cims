import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { translateCurrent } from '../i18n/translations'
import { formatShortDay, monthName, monthShort, weekdayShortNames } from '../lib/calendarLabels'
import { cn } from '../lib/cn'
import { anchorPopover, type PopoverStyle } from './popover-position'
import { TimeColumns } from './time-field'

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

const POPUP = { date: { width: 292, height: 372 }, datetime: { width: 420, height: 372 } }
const popupSize = (mode: 'date' | 'datetime') => (mode === 'datetime' && window.innerWidth < 640 ? { width: 292, height: 560 } : POPUP[mode])

/** Date (or date + time) picker in the app style. Value: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". */
export function CalendarField({ value, onValueChange, mode = 'date', min, max, required = false, disabled = false, id, className, placeholder, ...accessibility }: CalendarFieldProps) {
  const { locale } = useLocale()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [style, setStyle] = useState<PopoverStyle | null>(null)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [month, setMonth] = useState(() => {
    const date = dateParts(value) ?? new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [time, setTime] = useState(() => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : '09:00')
  const open = style !== null
  const selected = dateParts(value)
  const today = isoDate(new Date())
  const minDate = min?.slice(0, 10)
  const maxDate = max?.slice(0, 10)

  const weekdayLabels = useMemo(() => weekdayShortNames(locale), [locale])
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index - offset + 1))
  }, [month])

  useEffect(() => {
    if (!open) return
    const size = popupSize(mode)
    const onMove = () => { if (triggerRef.current) setStyle(anchorPopover(triggerRef.current, size.height, size.width)) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setStyle(null)
      triggerRef.current?.focus()
    }
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, mode])

  function openCalendar() {
    if (disabled) return
    if (open) { closeCalendar(); return }
    const date = dateParts(value) ?? new Date()
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setTime(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : '09:00')
    setView('days')
    if (triggerRef.current) setStyle(anchorPopover(triggerRef.current, popupSize(mode).height, popupSize(mode).width))
  }

  function clamp(next: string) {
    const minValue = min && mode === 'datetime' && min.length === 10 ? `${min}T00:00` : min
    const maxValue = max && mode === 'datetime' && max.length === 10 ? `${max}T23:59` : max
    if (minValue && next < minValue) return minValue
    if (maxValue && next > maxValue) return maxValue
    return next
  }

  function setDate(day: string) {
    const next = clamp(mode === 'datetime' ? `${day}T${time}` : day)
    if (mode === 'datetime') setTime(next.slice(11, 16) || time)
    onValueChange(next)
    const date = dateParts(day)
    if (date && date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    if (mode === 'date') closeCalendar(true)
  }

  function setTimeValue(nextTime: string) {
    setTime(nextTime)
    const day = selected ? value.slice(0, 10) : today
    const next = clamp(`${day}T${nextTime}`)
    setTime(next.slice(11, 16) || nextTime)
    onValueChange(next)
  }

  function closeCalendar(restoreFocus = false) {
    setStyle(null)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const display = selected
    ? formatShortDay(locale, selected) + (mode === 'datetime' ? `, ${value.slice(11, 16) || time}` : '')
    : placeholder ?? (mode === 'datetime' ? translateCurrent('picker.select_datetime', 'Select date and time') : translateCurrent('picker.select_date', 'Select date'))

  const navButton = 'grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]'

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
      className={cn('control-field flex min-h-10 w-full min-w-0 items-center gap-2 rounded-[10px] px-3 text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...accessibility}
    >
      <CalendarDays size={15} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
      <span className={cn('min-w-0 flex-1 truncate tabular-nums', !selected && 'text-[var(--caption)]')}>{display}</span>
      {!required && value && !disabled ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={translateCurrent('common.clear', 'Clear')}
          onClick={(event) => { event.stopPropagation(); onValueChange('') }}
          className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
        >
          <X size={13} />
        </span>
      ) : null}
    </button>
    {open && typeof document !== 'undefined' && createPortal(<div data-floating-layer="true">
      <div className="fixed inset-0 z-[179]" onPointerDown={() => closeCalendar()} aria-hidden="true" />
      <div role="dialog" aria-label={(mode === 'datetime' ? translateCurrent('picker.choose_datetime', 'Choose date and time') : translateCurrent('picker.choose_date', 'Choose date'))} className={cn('popover-panel fixed z-[180] flex flex-col overflow-y-auto sm:flex-row sm:overflow-hidden', mode === 'datetime' && 'sm:h-[340px]')} style={style ?? undefined}>
        <div className="flex w-full shrink-0 flex-col p-2.5 sm:w-[292px]">
          {/* header: month navigation; the title opens the month grid */}
          <div className="flex items-center justify-between gap-1">
            <button type="button" aria-label={(view === 'days' ? translateCurrent('picker.prev_month', 'Previous month') : translateCurrent('picker.prev_year', 'Previous year'))} onClick={() => setMonth((current) => view === 'days' ? new Date(current.getFullYear(), current.getMonth() - 1, 1) : new Date(current.getFullYear() - 1, current.getMonth(), 1))} className={navButton}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setView((current) => current === 'days' ? 'months' : 'days')} aria-expanded={view === 'months'} className="rounded-[8px] px-2 py-1 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)]">
              {view === 'days' ? `${monthName(locale, month.getMonth())} ${month.getFullYear()}` : month.getFullYear()}
            </button>
            <button type="button" aria-label={(view === 'days' ? translateCurrent('picker.next_month', 'Next month') : translateCurrent('picker.next_year', 'Next year'))} onClick={() => setMonth((current) => view === 'days' ? new Date(current.getFullYear(), current.getMonth() + 1, 1) : new Date(current.getFullYear() + 1, current.getMonth(), 1))} className={navButton}><ChevronRight size={16} /></button>
          </div>

          {view === 'months' ? (
            <div className="mt-2 grid flex-1 grid-cols-3 content-start gap-1">
              {Array.from({ length: 12 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => { setMonth(new Date(month.getFullYear(), index, 1)); setView('days') }}
                  className={cn('h-10 rounded-[8px] text-[12.5px] font-medium transition-colors', index === month.getMonth() ? 'bg-[var(--primary)] font-semibold text-white' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]')}
                >
                  {monthShort(locale, index)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-7 text-center text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                {weekdayLabels.map((label, index) => <span key={index} className="py-1">{label}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">{days.map((day) => {
                const iso = isoDate(day)
                const outOfRange = (minDate && iso < minDate) || (maxDate && iso > maxDate)
                const isSelected = iso === value.slice(0, 10)
                const inMonth = day.getMonth() === month.getMonth()
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={Boolean(outOfRange)}
                    aria-pressed={isSelected}
                    onClick={() => setDate(iso)}
                    className={cn(
                      'relative grid h-8 place-items-center rounded-[8px] text-[12.5px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25',
                      isSelected ? 'bg-[var(--primary)] font-semibold text-white'
                        : iso === today ? 'font-semibold text-[var(--primary)] hover:bg-[var(--blue-dim)]'
                          : inMonth ? 'text-[var(--foreground)] hover:bg-[var(--input-surface)]' : 'text-[var(--caption)] hover:bg-[var(--input-surface)]',
                    )}
                  >
                    {day.getDate()}
                    {iso === today ? <span className={cn('absolute bottom-[3px] h-[3px] w-[3px] rounded-full', isSelected ? 'bg-white' : 'bg-[var(--primary)]')} /> : null}
                  </button>
                )
              })}</div>
            </>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-[12px] font-semibold">
            <button type="button" onClick={() => setDate(today)} disabled={Boolean((minDate && today < minDate) || (maxDate && today > maxDate))} className="rounded-[7px] px-2 py-1 text-[var(--primary)] hover:bg-[var(--blue-dim)] disabled:opacity-40">{translateCurrent('common.today', 'Today')}</button>
            {mode === 'datetime' ? (
              <button type="button" onClick={() => closeCalendar(true)} className="rounded-[7px] bg-[var(--primary)] px-3 py-1 text-white hover:bg-[var(--primary-hover)]">{translateCurrent('common.done', 'Done')}</button>
            ) : null}
          </div>
        </div>

        {mode === 'datetime' ? (
          <div className="flex h-[188px] w-full shrink-0 flex-col border-t border-[var(--border)] sm:h-auto sm:w-[128px] sm:border-t-0 sm:border-l">
            <p className="grid shrink-0 grid-cols-2 border-b border-[var(--border)] py-2 text-center text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">
              <span>{translateCurrent('picker.hour', 'Hour')}</span><span>{translateCurrent('picker.min', 'Min')}</span>
            </p>
            <TimeColumns value={time} onChange={setTimeValue} className="min-h-0 flex-1" />
          </div>
        ) : null}
      </div>
    </div>, document.body)}
  </>
}
