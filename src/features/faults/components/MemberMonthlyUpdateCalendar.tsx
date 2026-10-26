import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../../app/hooks/useTheme'
import type { DayStatus } from '../../../shared/api/types'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { formatShortMonthDayTime, getLocalizedMonthName } from '../../../shared/lib/format'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import type { DailyRecord } from '../../../shared/api/services/attendance.service'
import type {
  MemberMonthlyUpdateCalendar,
  MemberMonthlyUpdateDay,
} from '../lib/salaryEstimates'

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const boardWeekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const longWeekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayLongFallbacks: Record<string, { uz: string; ru: string }> = {
  Sunday: { uz: 'Yakshanba', ru: 'Воскресенье' },
  Monday: { uz: 'Dushanba', ru: 'Понедельник' },
  Tuesday: { uz: 'Seshanba', ru: 'Вторник' },
  Wednesday: { uz: 'Chorshanba', ru: 'Среда' },
  Thursday: { uz: 'Payshanba', ru: 'Четверг' },
  Friday: { uz: 'Juma', ru: 'Пятница' },
  Saturday: { uz: 'Shanba', ru: 'Суббота' },
}
const lt = translateCurrentLiteral
const tr = (key: string, uzFallback: string, ruFallback: string) => {
  const value = lt(key)

  if (value !== key) {
    return value
  }

  const locale = getIntlLocale()

  if (locale.startsWith('ru')) {
    return ruFallback
  }

  if (locale.startsWith('en')) {
    return key
  }

  return uzFallback
}

const dayStyle: Record<DayStatus, string> = {
  submitted: 'cal-day-submitted',
  missing:   'cal-day-missing',
  sunday:    'cal-day-sunday',
  future:    'cal-day-future',
  neutral:   'cal-day-neutral',
}

const dayAccentStyle: Record<DayStatus, string> = {
  submitted: 'cal-accent-submitted',
  missing:   'cal-accent-missing',
  sunday:    'cal-accent-sunday',
  future:    'cal-accent-future',
  neutral:   'cal-accent-neutral',
}

const dayPillStyle: Record<DayStatus, string> = {
  submitted: 'cal-pill-submitted',
  missing:   'cal-pill-missing',
  sunday:    'cal-pill-sunday',
  future:    'cal-pill-future',
  neutral:   'cal-pill-neutral',
}

const dayDotStyle: Record<DayStatus, string> = {
  submitted: 'cal-dot-submitted',
  missing:   'cal-dot-missing',
  sunday:    'cal-dot-sunday',
  future:    'cal-dot-future',
  neutral:   'cal-dot-neutral',
}

const dayStatusTextStyle: Record<DayStatus, string> = {
  submitted: 'cal-text-submitted',
  missing:   'cal-text-missing',
  sunday:    'cal-text-sunday',
  future:    'cal-text-future',
  neutral:   'cal-text-neutral',
}

const dayFocusStyle: Record<DayStatus, string> = {
  submitted: 'cal-focus-submitted',
  missing:   'cal-focus-missing',
  sunday:    'cal-focus-sunday',
  future:    'cal-focus-future',
  neutral:   'cal-focus-neutral',
}

function getLocalizedLongWeekdayName(dayIndex: number) {
  const label = longWeekdayLabels[dayIndex]

  if (!label) {
    return ''
  }

  const fallback = weekdayLongFallbacks[label]

  if (!fallback) {
    return lt(label)
  }

  return tr(label, fallback.uz, fallback.ru)
}

function formatStableMonthPeriod(month: number, year: number): string {
  const monthName = getLocalizedMonthName(month)

  if (!monthName) {
    return `${year}`
  }

  return `${monthName} ${year}`
}

function formatLongDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  const weekdayName = getLocalizedLongWeekdayName(parsed.getDay())
  const monthName = getLocalizedMonthName(parsed.getMonth() + 1)

  if (getIntlLocale().startsWith('en')) {
    return `${weekdayName}, ${monthName} ${parsed.getDate()}, ${parsed.getFullYear()}`
  }

  return `${parsed.getDate()} ${monthName} ${parsed.getFullYear()}, ${weekdayName}`
}

function formatEntryTimestamp(value?: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const formatted = formatShortMonthDayTime(value)
  return formatted === '-' ? value : formatted
}

function formatWorkTime(value?: string | null) {
  if (!value) {
    return '--:--'
  }

  const trimmed = value.trim()

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (timeMatch) {
    return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return trimmed
  }

  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function getMinutesFromTime(value?: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)

  if (timeMatch) {
    const hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null
    }

    return (hours * 60) + minutes
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return (parsed.getHours() * 60) + parsed.getMinutes()
}

function getWorkedDurationLabel(day: MemberMonthlyUpdateDay) {
  const checkInMinutes = getMinutesFromTime(day.checkInTime)
  const checkOutMinutes = getMinutesFromTime(day.checkOutTime)

  if (checkInMinutes === null || checkOutMinutes === null || checkOutMinutes < checkInMinutes) {
    return tr('Hours not returned', 'Ish soatlari qaytmadi', 'Часы работы не получены')
  }

  const totalMinutes = checkOutMinutes - checkInMinutes
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0 && minutes <= 0) {
    return '0h'
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

function getSpecialDayLabel(day: MemberMonthlyUpdateDay | null | undefined) {
  if (!day?.workdayOverride) {
    return null
  }

  return day.workdayOverride.day_type === 'short_day'
    ? tr('Short Day', 'Qisqa kun', 'Короткий день')
    : tr('Holiday', 'Bayram', 'Праздник')
}

function isHolidayDay(day: MemberMonthlyUpdateDay | null | undefined) {
  return day?.status === 'sunday' && day.workdayOverride?.day_type === 'holiday'
}

function getDaySurfaceClass(day: MemberMonthlyUpdateDay) {
  if (isHolidayDay(day)) {
    return 'cal-day-holiday'
  }

  return dayStyle[day.status]
}

function getDayAccentClass(day: MemberMonthlyUpdateDay) {
  if (isHolidayDay(day)) {
    return 'cal-accent-holiday'
  }

  return dayAccentStyle[day.status]
}

function getDayPillClass(day: MemberMonthlyUpdateDay) {
  if (isHolidayDay(day)) {
    return 'cal-pill-holiday'
  }

  return dayPillStyle[day.status]
}

function getDayDotClass(day: MemberMonthlyUpdateDay) {
  if (isHolidayDay(day)) {
    return 'cal-dot-holiday'
  }

  return dayDotStyle[day.status]
}

function getDayTextClass(day: MemberMonthlyUpdateDay) {
  if (isHolidayDay(day)) {
    return 'cal-text-holiday'
  }

  return dayStatusTextStyle[day.status]
}

function getDayFocusClass(day: MemberMonthlyUpdateDay | null) {
  if (!day) {
    return dayFocusStyle.neutral
  }

  if (isHolidayDay(day)) {
    return 'cal-focus-holiday'
  }

  return dayFocusStyle[day.status]
}

function getStatusLabel(status: DayStatus, day?: MemberMonthlyUpdateDay | null) {
  const specialLabel = getSpecialDayLabel(day)

  if (status === 'submitted') return tr('Submitted', 'Topshirildi', 'Обновлено')
  if (status === 'missing') return tr('Missing', 'Yetishmadi', 'Пропущено')
  if (status === 'sunday') return specialLabel ?? tr('Off Day', 'Dam olish kuni', 'Выходной день')
  if (status === 'future') return tr('Upcoming', 'Yaqinlashmoqda', 'Скоро')
  return tr('Open', 'Ochiq', 'Открыто')
}

function getStatusVariant(status: DayStatus, day?: MemberMonthlyUpdateDay | null) {
  if (status === 'submitted') return 'success' as const
  if (status === 'missing') return 'danger' as const
  if (isHolidayDay(day)) return 'blue' as const
  if (status === 'sunday') return 'warning' as const
  if (status === 'future') return 'secondary' as const
  return 'outline' as const
}

function getCalendarCellStatusLabel(status: DayStatus, day?: MemberMonthlyUpdateDay | null) {
  const specialLabel = getSpecialDayLabel(day)

  if (status === 'submitted') return tr('Updated', 'Yangilangan', 'Обновлено')
  if (status === 'missing') return tr('Missed', 'Otib yuborilgan', 'Пропущено')
  if (status === 'sunday') return specialLabel ?? tr('Off Day', 'Dam olish kuni', 'Выходной день')
  if (status === 'future') return tr('Soon', 'Yaqinda', 'Скоро')
  return tr('Open', 'Ochiq', 'Открыто')
}

function getCalendarCellHint(day: MemberMonthlyUpdateDay) {
  if (day.hasUpdate) return tr('Update captured', 'Yangilanish qayd etilgan', 'Обновление зафиксировано')
  if (day.workdayOverride) return day.workdayOverride.note?.trim() || day.workdayOverride.title?.trim() || getSpecialDayLabel(day) || tr('Special day', 'Maxsus kun', 'Особый день')
  if (day.status === 'missing') return tr('Needs submission', 'Yuborish kerak', 'Нужно отправить')
  if (day.status === 'sunday') {
    return isHolidayDay(day)
      ? tr('Holiday schedule', 'Bayram jadvali', 'Праздничный график')
      : tr('Weekend / off day', 'Dam olish / off day', 'Выходной / нерабочий день')
  }
  if (day.status === 'future') return tr('Awaiting date', 'Sana kutilmoqda', 'Ожидание даты')
  return tr('No update yet', 'Hali update yoq', 'Обновления пока нет')
}

function getEntryCount(day: MemberMonthlyUpdateDay) {
  return Math.max(day.updatesCount, day.entries.length)
}

function getBoardWeekday(day: MemberMonthlyUpdateDay) {
  const parsed = new Date(day.date)

  if (Number.isNaN(parsed.getTime())) {
    return day.weekdayShort.toUpperCase()
  }

  return lt(boardWeekdayLabels[parsed.getDay()])
}

function getShortWeekday(day: MemberMonthlyUpdateDay) {
  const parsed = new Date(day.date)

  if (Number.isNaN(parsed.getTime())) {
    return day.weekdayShort.slice(0, 3)
  }

  return lt(boardWeekdayLabels[parsed.getDay()])
}

function getLongWeekday(day: MemberMonthlyUpdateDay) {
  const parsed = new Date(day.date)

  if (Number.isNaN(parsed.getTime())) {
    return day.weekdayLabel
  }

  return getLocalizedLongWeekdayName(parsed.getDay())
}

function getDaySummary(day: MemberMonthlyUpdateDay) {
  if (day.hasUpdate) return tr('Update captured', 'Yangilanish qayd etilgan', 'Обновление зафиксировано')
  if (day.workdayOverride) return day.workdayOverride.title?.trim() || getSpecialDayLabel(day) || tr('Special day', 'Maxsus kun', 'Особый день')
  if (day.status === 'missing') return tr('Needs submission', 'Yuborish kerak', 'Нужно отправить')
  if (day.status === 'sunday') return isHolidayDay(day) ? tr('Holiday', 'Bayram', 'Праздник') : tr('Off day', 'Dam olish kuni', 'Выходной день')
  if (day.status === 'future') return tr('Awaiting date', 'Sana kutilmoqda', 'Ожидание даты')
  return tr('No explicit status returned', 'Aniq status qaytmadi', 'Явный статус не возвращён')
}

function shouldShowTimePanel(day: MemberMonthlyUpdateDay) {
  return day.hasUpdate || Boolean(day.checkInTime) || Boolean(day.checkOutTime)
}

function getFocusDetailText(day: MemberMonthlyUpdateDay | null) {
  if (!day) {
    return tr(
      'Select a calendar day to inspect the update returned by the API.',
      'API qaytargan update ni tekshirish uchun kalendardan kun tanlang.',
      'Выберите день в календаре, чтобы проверить обновление, полученное от API.',
    )
  }

  if (day.entries.length > 0) {
    return day.entries
      .map((entry, index) => {
        const title = entry.title?.trim() || `${tr('Update entry', 'Yangilanish yozuvi', 'Запись обновления')} #${index + 1}`
        const text = entry.text?.trim() || tr('Update submitted for this date.', 'Bu sana uchun update yuborilgan.', 'Для этой даты обновление отправлено.')
        const timestamp = formatEntryTimestamp(entry.createdAt)

        return `${title}${timestamp ? ` (${timestamp})` : ''}\n${text}`
      })
      .join('\n\n')
  }

  if (day.note?.trim()) {
    return day.note.trim()
  }

  if (day.workdayOverride) {
    const specialLabel = getSpecialDayLabel(day)
    return day.workdayOverride.note?.trim() || day.workdayOverride.title?.trim() || `${specialLabel ?? tr('Special day', 'Maxsus kun', 'Особый день')} ${tr('is configured for this date.', 'bu sana uchun sozlangan.', 'настроен для этой даты.')}`
  }

  if (day.status === 'missing') return tr('No update was submitted for this working day.', 'Bu ish kuni uchun update yuborilmagan.', 'Для этого рабочего дня обновление не было отправлено.')
  if (day.status === 'sunday') {
    return isHolidayDay(day)
      ? tr('This date is marked as a holiday.', 'Bu sana bayram kuni deb belgilangan.', 'Эта дата отмечена как праздничный день.')
      : tr('This date is an off day.', 'Bu sana dam olish kuni.', 'Эта дата является выходным днём.')
  }
  if (day.status === 'future') return tr('This date is still in the future.', 'Bu sana hali kelajakda.', 'Эта дата всё ещё в будущем.')
  return tr('No update content was returned by the API for this date.', 'API bu sana uchun update kontentini qaytarmadi.', 'API не вернул содержимое обновления для этой даты.')
}

function formatWorkedTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-rose-500'

  return (
    <div className="h-1.5 w-full rounded-full bg-white/8">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

type MemberMonthlyUpdateCalendarBoardProps = {
  calendar: MemberMonthlyUpdateCalendar
  className?: string
  onMonthShift?: (delta: number) => void
  onJumpToToday?: () => void
  attendanceRecords?: DailyRecord[]
}

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function MemberMonthlyUpdateCalendarBoard({
  calendar,
  className,
  onMonthShift,
  onJumpToToday,
  attendanceRecords,
}: MemberMonthlyUpdateCalendarBoardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const todayKey = getTodayKey()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isFocusPanelOpen, setIsFocusPanelOpen] = useState(false)

  useEffect(() => {
    setSelectedDate(null)
    setIsFocusPanelOpen(false)
  }, [calendar.month, calendar.year])

  useEffect(() => {
    if (!isFocusPanelOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFocusPanelOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFocusPanelOpen])

  const counts = useMemo(() => (
    calendar.days.reduce(
      (accumulator, day) => {
        if (day.status === 'submitted') accumulator.submitted += 1
        else if (day.status === 'missing') accumulator.missing += 1
        else if (day.status === 'sunday') {
          if (isHolidayDay(day)) accumulator.holiday += 1
          else accumulator.offDay += 1
        }
        else if (day.status === 'future') accumulator.upcoming += 1
        else accumulator.open += 1

        return accumulator
      },
      { submitted: 0, missing: 0, offDay: 0, holiday: 0, upcoming: 0, open: 0 },
    )
  ), [calendar.days])

  const selectedDay = useMemo(() => {
    if (calendar.days.length === 0) {
      return null
    }

    if (selectedDate) {
      const matched = calendar.days.find((day) => day.date === selectedDate)

      if (matched) {
        return matched
      }
    }

    return (
      calendar.days.find((day) => day.status === 'submitted') ??
      calendar.days.find((day) => day.status === 'missing') ??
      calendar.days.find((day) => day.date === todayKey) ??
      calendar.days.find((day) => day.hasUpdate) ??
      calendar.days[0] ??
      null
    )
  }, [calendar.days, selectedDate, todayKey])

  const selectedKey = selectedDay?.date ?? null
  const selectedLabel = selectedDay ? formatLongDate(selectedDay.date) : tr('No date selected', 'Sana tanlanmagan', 'Дата не выбрана')
  const latestSubmittedDay = useMemo(() => (
    [...calendar.days]
      .filter((day) => day.status === 'submitted')
      .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null
  ), [calendar.days])
  const nextUpcomingDay = useMemo(() => (
    [...calendar.days]
      .filter((day) => day.status === 'future')
      .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null
  ), [calendar.days])
  const firstDayOffset = useMemo(
    () => (new Date(calendar.year, calendar.month - 1, 1).getDay() + 6) % 7,
    [calendar.month, calendar.year],
  )
  const calendarCells = useMemo(
    () => [...Array.from<null>({ length: firstDayOffset }).fill(null), ...calendar.days],
    [calendar.days, firstDayOffset],
  )
  const calendarWeeks = useMemo(
    () => Array.from(
      { length: Math.ceil(calendarCells.length / 7) },
      (_, index) => calendarCells.slice(index * 7, index * 7 + 7),
    ),
    [calendarCells],
  )
  const elapsedWorkingDays = counts.submitted + counts.missing
  const attentionDays = counts.missing + counts.open
  const monthProgressPct = elapsedWorkingDays > 0
    ? (counts.submitted / elapsedWorkingDays) * 100
    : 0
  const stableMonthPeriod = formatStableMonthPeriod(calendar.month, calendar.year)
  const focusDetailText = getFocusDetailText(selectedDay)
  const shouldShowFocusContent = Boolean(
    selectedDay?.hasUpdate ||
    selectedDay?.entries.length ||
    selectedDay?.note?.trim() ||
    selectedDay?.workdayOverride,
  )
  const nextDayLabel = nextUpcomingDay
    ? `${getShortWeekday(nextUpcomingDay)} ${nextUpcomingDay.day}`
    : latestSubmittedDay
      ? `${getShortWeekday(latestSubmittedDay)} ${latestSubmittedDay.day}`
      : tr('None', "Yo'q", 'Нет')
  const completionSummaryText = elapsedWorkingDays > 0
    ? `${counts.submitted} ${tr('of', 'dan', 'из')} ${elapsedWorkingDays} ${tr('completed workdays updated.', 'bajarilgan ish kunlari yangilandi.', 'завершённых рабочих дней обновлено.')}`
    : tr('No completed workdays yet.', 'Hali bajarilgan ish kunlari yoq.', 'Завершённых рабочих дней пока нет.')
  const canJumpToToday = Boolean(onJumpToToday)

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, DailyRecord>()
    for (const rec of attendanceRecords ?? []) {
      map.set(rec.attendance_date, rec)
    }
    return map
  }, [attendanceRecords])

  const totalWorkedMinutes = useMemo(
    () => (attendanceRecords ?? []).reduce((s, r) => s + (r.worked_minutes ?? 0), 0),
    [attendanceRecords],
  )

  const selectedDayDrawer = isFocusPanelOpen && selectedDay && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[95] calendar-focus-drawer text-[var(--foreground)]"
        data-theme={theme}
        style={{ colorScheme: isLight ? 'light' : 'dark' }}
      >
        <button
          type="button"
          aria-label={lt('Close focus day panel')}
          className={cn(
            'absolute inset-0 backdrop-blur-md',
            isLight
              ? 'bg-[radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_24%),rgba(248,250,252,0.78)]'
              : 'bg-[radial-gradient(circle_at_right,rgba(59,130,246,0.10),transparent_24%),rgba(0,0,0,0.62)]',
          )}
          onClick={() => setIsFocusPanelOpen(false)}
        />

        <div className="absolute inset-y-0 right-0 w-full sm:w-[min(88vw,430px)] xl:w-[min(34vw,480px)]">
          <div
            className={cn(
              'sheet-enter flex h-full flex-col overflow-hidden border-l border-[var(--border)] text-[var(--foreground)]',
              isLight
                ? 'bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))]'
                : 'bg-[linear-gradient(180deg,rgba(10,12,18,0.98),rgba(8,9,14,1))]',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6',
                isLight ? 'bg-white/95' : 'bg-transparent',
              )}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--blue-text)]">
                  {tr('Focus Day', 'Fokus kuni', 'Фокусный день')}
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--foreground)]">
                  {selectedLabel}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-strong)]">
                  {selectedDay ? getDaySummary(selectedDay) : tr('Pick a date from the month grid to inspect details.', 'Tafsilotlarni korish uchun oy setkasidan sana tanlang.', 'Выберите дату из сетки месяца, чтобы посмотреть детали.')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFocusPanelOpen(false)}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] transition',
                  isLight
                    ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)]'
                    : 'bg-white/[0.03] text-white hover:border-white/16 hover:bg-white/[0.06]',
                )}
                aria-label={lt('Close focus day panel')}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6',
                isLight
                  ? 'bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))]'
                  : 'bg-transparent',
              )}
            >
              <div
                className={cn(
                  'rounded-xl border p-5',
                  getDayFocusClass(selectedDay),
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-18 w-18 shrink-0 place-items-center rounded-xl border border-current/20 bg-white/65 text-[1.75rem] font-semibold tabular-nums dark:bg-black/10 dark:text-white">
                    {selectedDay.day}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getStatusVariant(selectedDay.status, selectedDay)} dot>
                        {getStatusLabel(selectedDay.status, selectedDay)}
                      </Badge>
                      {getLongWeekday(selectedDay) ? (
                        <Badge variant="secondary">{getLongWeekday(selectedDay)}</Badge>
                      ) : null}
                      {selectedDay.date === todayKey ? (
                        <Badge variant="blue">{tr('Today', 'Bugun', 'Сегодня')}</Badge>
                      ) : null}
                      {selectedDay.hasUpdate ? (
                        <Badge variant="violet">{lt('Payload available')}</Badge>
                      ) : null}
                      {selectedDay.workdayOverride ? (
                        <Badge variant={isHolidayDay(selectedDay) ? 'blue' : 'warning'}>
                          {getSpecialDayLabel(selectedDay) ?? tr('Special day', 'Maxsus kun', 'Особый день')}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--foreground)] dark:text-white">
                      {getDaySummary(selectedDay)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Status', 'Holat', 'Статус')}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {getStatusLabel(selectedDay.status, selectedDay)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Submission', 'Yuborish', 'Отправка')}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {selectedDay.hasUpdate ? tr('Available', 'Mavjud', 'Доступно') : tr('None', "Yo'q", 'Нет')}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Validation', 'Validatsiya', 'Валидация')}</p>
                  <p
                    className={cn(
                      'mt-1 font-medium',
                      selectedDay.isValid === false
                        ? 'text-amber-600 dark:text-amber-300'
                        : selectedDay.isValid === true
                          ? 'text-[var(--success-text)]'
                          : 'text-[var(--foreground)]',
                    )}
                  >
                    {selectedDay.isValid === false ? lt('Needs review') : selectedDay.isValid === true ? lt('Valid') : lt('N/A')}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Entries', 'Yozuvlar', 'Записи')}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {getEntryCount(selectedDay)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Check in time', 'Kirish vaqti', 'Время входа')}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {formatWorkTime(selectedDay.checkInTime)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-3 text-[12px] text-[var(--muted)]">
                  <p>{tr('Check out time', 'Chiqish vaqti', 'Время выхода')}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {formatWorkTime(selectedDay.checkOutTime)}
                  </p>
                </div>
              </div>

              {shouldShowFocusContent ? (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                        {selectedDay.hasUpdate ? lt('Update Content') : lt('Special Day')}
                      </p>
                      <h4 className="mt-2 text-base font-semibold tracking-tight text-[var(--foreground)]">
                        {selectedDay.hasUpdate
                          ? tr('Returned content for this date', 'Bu sana uchun qaytgan kontent', 'Контент, возвращённый для этой даты')
                          : tr('Details for this date', 'Bu sana uchun tafsilotlar', 'Детали для этой даты')}
                      </h4>
                    </div>
                    {selectedDay.hasUpdate ? (
                      <Badge variant="blue">{lt('API payload')}</Badge>
                    ) : selectedDay.workdayOverride ? (
                      <Badge variant={isHolidayDay(selectedDay) ? 'blue' : 'warning'}>
                        {getSpecialDayLabel(selectedDay) ?? tr('Special day', 'Maxsus kun', 'Особый день')}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] p-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--foreground)]">
                      {focusDetailText}
                    </p>
                  </div>

                  {selectedDay.isValid === false ? (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                      {tr('This update was returned with an invalid flag by the API.', "Bu update API dan noto'g'ri flag bilan qaytdi.", 'Это обновление было возвращено API с некорректным флагом.')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null

  return (
    <>
      <div className={cn('w-full', className)}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <h3 className="text-[1.55rem] font-semibold tracking-tight text-[var(--foreground)] dark:text-white">
              {stableMonthPeriod} {tr('Calendar', 'Kalendar', 'Календарь')}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" dot>{counts.submitted} {tr('Submitted', 'Topshirildi', 'Обновлено')}</Badge>
              <Badge variant="danger" dot>{counts.missing} {tr('Missing', 'Yetishmadi', 'Пропущено')}</Badge>
              {counts.holiday > 0 ? <Badge variant="blue" dot>{counts.holiday} {tr('Holidays', 'Bayramlar', 'Праздники')}</Badge> : null}
              <Badge variant="warning" dot>{counts.offDay} {tr('Off days', 'Dam olish kunlari', 'Выходные')}</Badge>
              {counts.upcoming > 0 ? <Badge variant="secondary">{counts.upcoming} {tr('Upcoming', 'Yaqinlashmoqda', 'Скоро')}</Badge> : null}
              {totalWorkedMinutes > 0 ? (
                <Badge variant="secondary" dot>{formatWorkedTime(totalWorkedMinutes)} {tr('Worked', 'Ishlangan', 'Отработано')}</Badge>
              ) : null}
            </div>
          </div>

          <div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(290px,330px)] lg:items-center">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={cn(
                        'text-[1.45rem] font-semibold tracking-tight sm:text-[1.65rem]',
                        isLight ? 'text-[var(--foreground)]' : 'text-white',
                      )}
                    >
                      {stableMonthPeriod}
                    </h4>
                    <Badge
                      variant="violet"
                      className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                    >
                      {monthProgressPct.toFixed(0)}{lt('% pace')}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-center lg:justify-self-center">
                  <div
                    className={cn(
                      'grid w-fit grid-cols-[44px_auto_44px] items-center gap-2 rounded-xl border p-1.5',
                      isLight
                        ? 'border-[var(--success-border)] bg-white'
                        : 'border-[var(--border)] bg-white dark:border-white/10 dark:bg-black/18',
                    )}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMonthShift?.(-1)}
                      disabled={!onMonthShift}
                      className="min-h-11 min-w-11 rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] px-0 text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 3.5 5.5 8 10 12.5" />
                      </svg>
                    </Button>
                    <button
                      type="button"
                      onClick={() => onJumpToToday?.()}
                      aria-disabled={!canJumpToToday}
                      className={cn(
                        'inline-flex min-h-11 min-w-[144px] items-center justify-center rounded-xl border px-5 text-sm font-bold tracking-[0.01em] transition-none text-[var(--success-text)]',
                        isLight
                          ? 'border-[var(--success-border)] bg-[var(--success-soft)]'
                          : 'border-[var(--success-border)] bg-[var(--success-dim)]',
                        canJumpToToday ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      {stableMonthPeriod}
                    </button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMonthShift?.(1)}
                      disabled={!onMonthShift}
                      className="min-h-11 min-w-11 rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] px-0 text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 3.5 10.5 8 6 12.5" />
                      </svg>
                    </Button>
                  </div>
                </div>

                <div className="hidden rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3 lg:block dark:border-[var(--success-border)] dark:bg-[var(--success-dim)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ui-card-label text-[var(--success-text)] dark:text-white">
                        {lt('Completion To Date')}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)] dark:text-white">
                        {completionSummaryText}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold tabular-nums text-[var(--success-text)] dark:text-white">
                        {counts.submitted}/{elapsedWorkingDays || 0}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--success-text)]">
                        {monthProgressPct.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <CompletionBar pct={monthProgressPct} />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(290px,330px)] lg:items-start">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <Badge variant="success" dot className="w-full justify-start rounded-xl px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                    {counts.submitted} {tr('Updated', 'Yangilangan', 'Обновлено')}
                  </Badge>
                  <Badge variant="danger" dot className="w-full justify-start rounded-xl px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                    {counts.missing} {tr('Missed', 'Otib yuborilgan', 'Пропущено')}
                  </Badge>
                  <Badge variant="secondary" className="w-full justify-start rounded-xl px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                    {attentionDays} {tr('Attention', "E'tibor", 'Внимание')}
                  </Badge>
                  <Badge variant="secondary" className="col-span-2 w-full justify-start rounded-xl px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] sm:col-span-1 sm:w-auto">
                    <span className="truncate">{tr('Next', 'Keyingi', 'Следующий')}: {nextDayLabel}</span>
                  </Badge>
                </div>

                <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3 lg:hidden dark:border-[var(--success-border)] dark:bg-[var(--success-dim)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ui-card-label text-[var(--success-text)] dark:text-white">
                        {lt('Completion To Date')}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)] dark:text-white">
                        {completionSummaryText}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold tabular-nums text-[var(--success-text)] dark:text-white">
                        {counts.submitted}/{elapsedWorkingDays || 0}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--success-text)]">
                        {monthProgressPct.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <CompletionBar pct={monthProgressPct} />
                  </div>
                </div>
              </div>
            </div>

            <div className="calendar-board-scroll mt-4 -mx-2 px-2 pb-3 sm:mx-0 sm:px-0 sm:pb-1">
              <div className="min-w-[736px] pr-1 sm:min-w-[768px]">
                <div className="grid grid-cols-7 gap-2">
                  {weekdayLabels.map((label) => (
                    <div
                      key={label}
                      className="cal-weekday-header rounded-full border px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.26em]"
                    >
                      {lt(label)}
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 space-y-2.5">
                  {calendarWeeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex + 1}`} className="grid grid-cols-7 gap-2">
                      {week.map((day, dayIndex) => {
                        if (!day) {
                          return (
                            <div
                              key={`empty-${weekIndex}-${dayIndex}`}
                              className="cal-day-neutral min-h-28.5 rounded-xl border border-dashed opacity-40"
                              aria-hidden="true"
                            />
                          )
                        }

                        const entryCount = getEntryCount(day)
                        const isSelected = selectedKey === day.date
                        const isToday = day.date === todayKey
                        const attendanceRec = attendanceByDate.get(day.date)
                        const effectiveCheckIn = day.checkInTime ?? attendanceRec?.check_in_time ?? null
                        const effectiveCheckOut = day.checkOutTime ?? attendanceRec?.check_out_time ?? null
                        const effectiveDay = (effectiveCheckIn !== day.checkInTime || effectiveCheckOut !== day.checkOutTime)
                          ? { ...day, checkInTime: effectiveCheckIn, checkOutTime: effectiveCheckOut }
                          : day
                        const showTimePanel = shouldShowTimePanel(effectiveDay)
                        const isCheckoutMissing = Boolean(effectiveCheckIn) && !effectiveCheckOut

                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => {
                              setSelectedDate(day.date)
                              setIsFocusPanelOpen(true)
                            }}
                            aria-pressed={isSelected}
                            className={cn(
                              'group relative flex min-h-[152px] min-w-0 flex-col overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
                              showTimePanel && 'min-h-[164px]',
                              getDaySurfaceClass(day),
                              isSelected
                                ? 'border-violet-400/65 ring-2 ring-violet-400/55 ring-offset-2 ring-offset-[var(--background)]'
                                : 'hover:-translate-y-[1px] hover:border-white/14',
                              isToday && !isSelected && 'border-sky-400 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] dark:border-[var(--border)] dark:bg-transparent',
                            )}
                            title={`${isSelected ? `${tr('Selected', 'Tanlangan', 'Выбрано')}: ` : ''}${formatLongDate(day.date)}: ${getStatusLabel(day.status, day)}`}
                          >
                            <span className={cn('absolute inset-x-3.5 top-0 h-[2px] rounded-full', getDayAccentClass(day))} />
                            <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_42%)] opacity-0 transition group-hover:opacity-100" />

                            <div className="relative flex items-start justify-between gap-3">
                              <div>
                                <p className={cn('text-[10px] font-bold uppercase tracking-[0.24em] opacity-60 dark:opacity-100', getDayTextClass(day))}>
                                  {getBoardWeekday(day)}
                                </p>
                                <p
                                  className={cn(
                                    'mt-1.5 text-[1.5rem] font-semibold leading-none tabular-nums tracking-tight dark:text-white',
                                    day.status === 'submitted' || day.status === 'missing' ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]/82',
                                  )}
                                >
                                  {day.day}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5">
                                {entryCount > 0 ? (
                                  <span className="ui-card-label inline-flex min-w-7 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 px-2 py-0.75 tabular-nums text-[var(--muted-strong)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                                    {entryCount}x
                                  </span>
                                ) : null}
                                {isToday ? (
                                  <span className="grid h-6 w-6 place-items-center rounded-full border border-sky-400 bg-white dark:border-sky-400/30 dark:bg-sky-500/10">
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500 dark:h-2 dark:w-2 dark:bg-sky-300" />
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {showTimePanel ? (
                              <div className="relative mt-3 w-full max-w-[112px] self-center space-y-1.5 text-center">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="rounded-xl border border-[var(--border)] bg-white/85 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="ui-card-label text-[var(--muted)] dark:text-white">
                                      {tr('In', 'Kirish', 'Вход')}
                                    </p>
                                    <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)] dark:text-white">
                                      {formatWorkTime(effectiveCheckIn)}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-[var(--border)] bg-white/85 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                                    <p className="ui-card-label flex items-center justify-center gap-1 text-[var(--muted)] dark:text-white">
                                      <span>{tr('Out', 'Chiqish', 'Выход')}</span>
                                    </p>
                                    {isCheckoutMissing ? (
                                      <p
                                        className="mt-1 inline-flex w-full items-center justify-center text-[18px] leading-none"
                                        aria-label={tr('Missing checkout', "Checkout yo'q", 'Нет отметки выхода')}
                                        title={tr('Missing checkout', "Checkout yo'q", 'Нет отметки выхода')}
                                      >
                                        🚷
                                      </p>
                                    ) : (
                                      <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)] dark:text-white">
                                        {formatWorkTime(effectiveCheckOut)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <p className="ui-helper font-medium uppercase tracking-[0.12em] text-[var(--muted-strong)] dark:text-white">
                                  {getWorkedDurationLabel(effectiveDay)}
                                </p>
                              </div>
                            ) : null}

                            <div className={cn('relative mt-auto pt-2', showTimePanel && 'flex flex-col items-center text-center')}>
                              <span
                                className={cn(
                                  'ui-card-label inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.75 tracking-[0.14em]',
                                  showTimePanel && 'justify-center',
                                  getDayPillClass(day),
                                )}
                              >
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', getDayDotClass(day))} />
                                {getCalendarCellStatusLabel(day.status, day)}
                              </span>
                              <p className={cn('ui-table-meta mt-1.5 text-[var(--muted-strong)] dark:text-white', showTimePanel && 'max-w-[112px] text-center')}>
                                {getCalendarCellHint(day)}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                {tr('Selected', 'Tanlangan', 'Выбрано')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                {tr('Today', 'Bugun', 'Сегодня')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-[var(--success-border)] bg-[var(--success-text)]" />
                {tr('Updated', 'Yangilangan', 'Обновлено')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-rose-500/30 bg-rose-500/20" />
                {tr('Missed', 'Otib yuborilgan', 'Пропущено')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-[var(--border)] bg-white dark:border-white/10 dark:bg-white/4" />
                {tr('Open or upcoming', 'Ochiq yoki yaqinlashayotgan', 'Открыто или скоро')}
              </span>
            </div>
          </div>
        </div>
      {selectedDayDrawer}
    </>
  )
}
