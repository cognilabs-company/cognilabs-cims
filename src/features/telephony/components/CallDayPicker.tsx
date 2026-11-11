import { useMemo, useRef, useState } from 'react'
import { CalendarDotsIcon, CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { useDismiss } from './useDismiss'
import { dayLabelLong, dayParts, monthTitle, toDayString, weekdaysShort } from './telephonyFormat'

type Props = {
  /** Selected day "YYYY-MM-DD", or '' when the list is not limited to one day. */
  value: string
  onChange: (day: string) => void
  onClear: () => void
}

type Month = { year: number; month: number }

function monthOf(day: string): Month {
  const [y, m] = day.split('-').map(Number)
  if (y && m) return { year: y, month: m - 1 }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

function addMonths({ year, month }: Month, delta: number): Month {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** Calendar button next to the status filter: pick a day → only that day's calls are listed. */
export function CallDayPicker({ value, onChange, onClear }: Props) {
  const { t, locale } = useLocale()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<Month>(() => monthOf(value))
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))

  const now = new Date()
  const today = toDayString(now)
  const yesterday = toDayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const thisMonth = monthOf(today)
  const atCurrentMonth = cursor.year === thisMonth.year && cursor.month === thisMonth.month
  // `locale` keeps names in sync when the language changes.
  const weekdays = useMemo(() => (locale ? weekdaysShort() : []), [locale])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const offset = (first.getDay() + 6) % 7 // Monday first
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(cursor.year, cursor.month, 1 - offset + index)
      return { day: toDayString(date), date: date.getDate(), inMonth: date.getMonth() === cursor.month }
    })
  }, [cursor])
  // Drop a trailing week that is entirely next month.
  const visible = cells.slice(35).every((cell) => !cell.inMonth) ? cells.slice(0, 35) : cells

  function toggle() {
    if (!open) {
      setCursor(monthOf(value))
      setSlide(null)
    }
    setOpen((current) => !current)
  }

  function shift(delta: number) {
    if (delta > 0 && atCurrentMonth) return
    setSlide(delta > 0 ? 'left' : 'right')
    setCursor((current) => addMonths(current, delta))
  }

  function pick(day: string) {
    onChange(day)
    setOpen(false)
  }

  const header = dayParts(value || today)

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'group/day inline-flex h-10 items-center rounded-[13px] ring-1 transition-[background-color,box-shadow,color] duration-200',
          value
            ? 'bg-[var(--blue-dim)] text-[var(--primary)] ring-[var(--primary)]/40 shadow-[0_6px_18px_-12px_rgba(43,89,255,0.8)]'
            : 'bg-[var(--surface)] text-[var(--foreground)] ring-[var(--border)] hover:ring-[var(--border-hover)]',
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn('inline-flex h-full items-center gap-2 rounded-[13px] text-[13.5px] font-semibold whitespace-nowrap', value ? 'pr-1 pl-3' : 'px-3.5')}
        >
          <CalendarDotsIcon size={17} weight="duotone" className={cn('transition-transform duration-300 group-hover/day:-rotate-6', value ? '' : 'text-[var(--primary)]')} />
          {value ? dayLabelLong(value) : t('telephony.filter.by_day', 'By day')}
        </button>
        {value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={t('telephony.filter.clear_day', 'Show all days')}
            className="mr-1.5 grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-[var(--primary)] hover:text-white"
          >
            <XIcon size={12} weight="bold" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label={t('telephony.filter.pick_day', 'Pick a day')}
          className="cal-pop absolute top-[calc(100%+8px)] left-0 z-40 w-[308px] overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--elev-xl)] max-sm:-left-2"
        >
          {/* Header: the chosen (or today's) day, large */}
          <div className="relative overflow-hidden px-4 pt-3.5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #2b59ff 0%, #6d4bff 100%)' }}>
            <span aria-hidden="true" className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
            <p className="text-[12px] font-medium tracking-wide text-white/75 uppercase">{header.weekday}</p>
            <p key={value || today} className="cal-slide-left text-[22px] leading-7 font-bold tracking-[-0.02em]">{header.date}</p>
          </div>

          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between px-1 pb-2">
              <button type="button" onClick={() => shift(-1)} aria-label={t('telephony.filter.prev_month', 'Previous month')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                <CaretLeftIcon size={15} weight="bold" />
              </button>
              <p key={`${cursor.year}-${cursor.month}`} className={cn('text-[14px] font-bold', slide === 'left' ? 'cal-slide-left' : slide === 'right' ? 'cal-slide-right' : '')}>
                {monthTitle(cursor.year, cursor.month)}
              </p>
              <button type="button" onClick={() => shift(1)} disabled={atCurrentMonth} aria-label={t('telephony.filter.next_month', 'Next month')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30">
                <CaretRightIcon size={15} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-7 pb-1">
              {weekdays.map((name, index) => (
                <span key={name} className={cn('text-center text-[11px] font-semibold tracking-wide uppercase', index >= 5 ? 'text-[var(--danger-text)]/70' : 'text-[var(--caption)]')}>{name}</span>
              ))}
            </div>

            <div key={`${cursor.year}-${cursor.month}`} className={cn('grid grid-cols-7 gap-y-0.5', slide === 'left' ? 'cal-slide-left' : slide === 'right' ? 'cal-slide-right' : '')}>
              {visible.map((cell) => {
                const selected = cell.day === value
                const isToday = cell.day === today
                const future = cell.day > today
                return (
                  <button
                    key={cell.day}
                    type="button"
                    disabled={future}
                    onClick={() => pick(cell.day)}
                    aria-pressed={selected}
                    aria-label={dayLabelLong(cell.day)}
                    className={cn(
                      'relative mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] tabular-nums transition-[background-color,color,transform,box-shadow] duration-200',
                      selected
                        ? 'cal-picked font-bold text-white shadow-[0_8px_18px_-8px_rgba(43,89,255,0.9)]'
                        : cell.inMonth
                          ? 'font-semibold text-[var(--foreground)] hover:scale-110 hover:bg-[var(--blue-dim)] hover:text-[var(--primary)]'
                          : 'text-[var(--caption)] hover:bg-[var(--input-surface)]',
                      isToday && !selected && 'ring-1 ring-[var(--primary)]/60',
                      future && 'pointer-events-none opacity-25',
                    )}
                    style={selected ? { background: 'linear-gradient(135deg, #2b59ff 0%, #6d4bff 100%)' } : undefined}
                  >
                    {cell.date}
                    {isToday && !selected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--primary)]" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] px-3 py-2.5">
            {([
              [today, t('telephony.period.today', 'Today')],
              [yesterday, t('telephony.period.yesterday', 'Yesterday')],
            ] as const).map(([day, label]) => (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                className={cn(
                  'h-8 rounded-full px-3 text-[12.5px] font-semibold transition-colors',
                  value === day ? 'bg-[var(--primary)] text-white' : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--blue-dim)] hover:text-[var(--primary)]',
                )}
              >
                {label}
              </button>
            ))}
            {value ? (
              <button type="button" onClick={() => { onClear(); setOpen(false) }} className="ml-auto h-8 rounded-full px-3 text-[12.5px] font-semibold text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-dim)]">
                {t('telephony.filter.clear_day', 'Show all days')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
