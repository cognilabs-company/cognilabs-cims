import { useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Loader2, Trash2 } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import {
  RECALL_MIN_LEAD_MIN,
  addDays,
  earliestRecallSlot,
  formatClock,
  formatDayLong,
  instantFromWall,
  isRecallAllowed,
  monthTitle,
  recallLimit,
  remainingParts,
  sameWall,
  slotAtOrAfter,
  todayKey,
  wallFromInstant,
  weekdayHeaders,
  weekdayIndex,
  type WallTime,
} from '../lib/tashkentTime'

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5)
const pad = (value: number) => String(value).padStart(2, '0')

function parseRecall(value?: string | null): WallTime | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : wallFromInstant(ms)
}

/** Existing recall if it is still allowed, otherwise the next full hour after the earliest slot. */
function initialSelection(current: WallTime | null, now: number): WallTime {
  if (current && isRecallAllowed(current, now)) return current
  const earliest = earliestRecallSlot(now)
  if (earliest.minute === 0) return earliest
  return wallFromInstant(instantFromWall({ ...earliest, minute: 0 }) + 60 * 60_000)
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

type RecallTimePickerProps = {
  /** Current recall_time from the API (ISO), if any. */
  value?: string | null
  saving: boolean
  onSave: (wall: WallTime) => void
  onClear?: () => void
  onCancel: () => void
}

/** Date + time picker for the call-back time, on Tashkent time. */
export function RecallTimePicker({ value, saving, onSave, onClear, onCancel }: RecallTimePickerProps) {
  const { t, locale } = useLocale()
  const [now, setNow] = useState(() => Date.now())
  const [current] = useState(() => parseRecall(value))
  const [selected, setSelected] = useState<WallTime>(() => initialSelection(parseRecall(value), Date.now()))
  const [month, setMonth] = useState(() => selected.date.slice(0, 7))

  // Keep the rules live while the picker is open
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const limit = recallLimit(now)
  const earliest = earliestRecallSlot(now)
  const today = todayKey(now)
  const minDate = earliest.date
  const maxDate = addDays(today, 365)
  const valid = isRecallAllowed(selected, now)
  const unchanged = sameWall(selected, current)

  /* calendar grid */
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const leading = weekdayIndex(`${month}-01`)
  const cells: Array<string | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${month}-${pad(index + 1)}`),
  ]
  const canPrev = month > minDate.slice(0, 7)
  const canNext = month < maxDate.slice(0, 7)

  /** Pick a value; if the time is too early for that day, move it to the earliest allowed slot. */
  function choose(next: WallTime) {
    const fixed = isRecallAllowed(next, now) ? next : next.date === earliest.date ? earliest : next
    setSelected(fixed)
    setMonth(fixed.date.slice(0, 7))
  }

  /* quick presets */
  const tomorrow = addDays(today, 1)
  let monday = tomorrow
  while (weekdayIndex(monday) !== 0) monday = addDays(monday, 1)
  const presets: Array<{ key: string; label: string; wall: WallTime }> = [
    { key: 'hour', label: t('customers.recall.preset_hour', 'In 1 hour'), wall: slotAtOrAfter(now + 60 * 60_000) },
    ...(isRecallAllowed({ date: today, hour: 18, minute: 0 }, now)
      ? [{ key: 'evening', label: t('customers.recall.preset_evening', 'Today, 18:00'), wall: { date: today, hour: 18, minute: 0 } }]
      : []),
    { key: 'tomorrow', label: t('customers.recall.preset_tomorrow', 'Tomorrow, 10:00'), wall: { date: tomorrow, hour: 10, minute: 0 } },
    ...(monday !== tomorrow
      ? [{ key: 'monday', label: t('customers.recall.preset_monday', 'Monday, 10:00'), wall: { date: monday, hour: 10, minute: 0 } }]
      : []),
  ]

  /* remaining time */
  const parts = remainingParts(instantFromWall(selected), now)
  const remaining = [
    parts.days ? t('customers.recall.unit_days', '{{n}} d', { n: parts.days }) : '',
    parts.hours ? t('customers.recall.unit_hours', '{{n}} h', { n: parts.hours }) : '',
    parts.minutes || (!parts.days && !parts.hours) ? t('customers.recall.unit_minutes', '{{n}} min', { n: parts.minutes }) : '',
  ].filter(Boolean).join(' ')

  const earliestLabel = earliest.date === today
    ? formatClock(earliest)
    : `${formatDayLong(locale, earliest.date)}, ${formatClock(earliest)}`

  function save() {
    const at = Date.now()
    if (!isRecallAllowed(selected, at)) { setNow(at); return }
    onSave(selected)
  }

  return (
    <div className="qa-panel rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--elev-sm)] sm:p-3.5">
      {/* presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => choose(preset.wall)}
            className={cn(
              'h-7 rounded-full border px-2.5 text-[12px] font-semibold transition-colors',
              sameWall(preset.wall, selected)
                ? 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-strong)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_212px] sm:gap-4">
        {/* calendar */}
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              disabled={!canPrev}
              aria-label={t('customers.recall.prev_month', 'Previous month')}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--muted-surface)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{monthTitle(locale, year, monthNumber - 1)}</p>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={!canNext}
              aria-label={t('customers.recall.next_month', 'Next month')}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--muted-surface)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
            {weekdayHeaders(locale).map((label, index) => (
              <span key={label} className={cn('pb-1 text-[10.5px] font-semibold tracking-wide uppercase', index >= 5 ? 'text-[var(--caption)]' : 'text-[var(--muted)]')}>{label}</span>
            ))}
            {cells.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} />
              const disabled = date < minDate || date > maxDate
              const isSelected = date === selected.date
              const isToday = date === today
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose({ ...selected, date })}
                  aria-pressed={isSelected}
                  aria-label={formatDayLong(locale, date)}
                  className={cn(
                    'relative grid h-8 place-items-center rounded-[9px] text-[12.5px] tabular-nums transition-colors duration-150',
                    disabled && 'cursor-not-allowed text-[var(--caption)] opacity-40',
                    !disabled && !isSelected && 'text-[var(--foreground)] hover:bg-[var(--muted-surface)]',
                    isSelected && 'bg-[var(--primary)] font-semibold text-white shadow-[0_6px_14px_-8px_var(--primary)]',
                    isToday && !isSelected && !disabled && 'font-semibold text-[var(--primary)]',
                  )}
                >
                  {Number(date.slice(8))}
                  {isToday ? <span className={cn('absolute bottom-[3px] h-[3px] w-[3px] rounded-full', isSelected ? 'bg-white' : 'bg-[var(--primary)]')} /> : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* time */}
        <div className="border-t border-[var(--border)] pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <p className="text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">{t('customers.recall.hour', 'Hour')}</p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {HOURS.map((hour) => {
              const disabled = instantFromWall({ date: selected.date, hour, minute: 55 }) < limit
              const active = hour === selected.hour
              return (
                <button
                  key={hour}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose({ ...selected, hour })}
                  aria-pressed={active}
                  className={cn(
                    'h-7 rounded-[7px] text-[12px] tabular-nums transition-colors duration-150',
                    disabled && 'cursor-not-allowed text-[var(--caption)] opacity-35',
                    !disabled && !active && 'text-[var(--foreground)] hover:bg-[var(--muted-surface)]',
                    active && 'bg-[var(--primary)] font-semibold text-white',
                  )}
                >
                  {pad(hour)}
                </button>
              )
            })}
          </div>

          <p className="mt-3 text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">{t('customers.recall.minute', 'Minute')}</p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {MINUTES.map((minute) => {
              const disabled = instantFromWall({ ...selected, minute }) < limit
              const active = minute === selected.minute
              return (
                <button
                  key={minute}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose({ ...selected, minute })}
                  aria-pressed={active}
                  className={cn(
                    'h-7 rounded-[7px] text-[12px] tabular-nums transition-colors duration-150',
                    disabled && 'cursor-not-allowed text-[var(--caption)] opacity-35',
                    !disabled && !active && 'text-[var(--foreground)] hover:bg-[var(--muted-surface)]',
                    active && 'bg-[var(--primary)] font-semibold text-white',
                  )}
                >
                  :{pad(minute)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* summary + actions */}
      <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {valid ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground)]">
              <Clock3 size={15} className="shrink-0 text-[var(--primary)]" />
              <span className="truncate">{formatDayLong(locale, selected.date)}, {formatClock(selected)}</span>
            </p>
          ) : (
            <p role="alert" className="flex items-start gap-2 text-[12.5px] font-medium text-[var(--danger-text)]">
              <AlertCircle size={15} className="mt-px shrink-0" />
              {t('customers.recall.too_soon', 'At least {{min}} minutes from now — earliest {{time}}.', { min: RECALL_MIN_LEAD_MIN, time: earliestLabel })}
            </p>
          )}
          <p className="mt-0.5 pl-[23px] text-[11.5px] text-[var(--muted)]">
            {t('customers.recall.tz', 'Tashkent time')}{valid ? ` · ${t('customers.recall.remaining', 'in {{value}}', { value: remaining })}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onClear && current ? (
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              title={t('customers.recall.clear', 'Clear')}
              aria-label={t('customers.recall.clear', 'Clear')}
              className="mr-auto grid h-8 w-8 place-items-center rounded-[9px] text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-dim)] disabled:opacity-40 sm:mr-0"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[9px] px-3 text-[12.5px] font-semibold text-[var(--muted-strong)] transition-colors hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid || saving || unchanged}
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--primary)] px-3.5 text-[12.5px] font-semibold text-white transition-[background-color,opacity] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
