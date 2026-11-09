import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import type { DayStatus } from '../../../shared/api/types'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { formatShortMonthDayTime, getLocalizedMonthName } from '../../../shared/lib/format'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { IconButton } from '../../../shared/ui/icon-button'
import { Progress } from '../../../shared/ui/progress'
import { toneDot, tonePill, toneSurface, toneText, type Tone } from '../../../shared/ui/tone'
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

const dayStatusTone: Record<DayStatus, Tone> = {
  submitted: 'success',
  missing:   'danger',
  sunday:    'warning',
  future:    'neutral',
  neutral:   'neutral',
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

function getDayTone(day: MemberMonthlyUpdateDay | null | undefined): Tone {
  if (!day) {
    return 'neutral'
  }

  if (isHolidayDay(day)) {
    return 'blue'
  }

  return dayStatusTone[day.status]
}

function getDayPillClass(tone: Tone) {
  if (tone === 'neutral') {
    return 'bg-[var(--surface)] text-[var(--muted-strong)]'
  }

  return tonePill(tone)
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
  const tone: Tone = pct >= 90 ? 'success' : pct >= 75 ? 'warning' : 'danger'

  return <Progress value={pct} tone={tone} size="xs" />
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
      <div className="fixed inset-0 z-[95] calendar-focus-drawer text-[var(--foreground)]">
        <button
          type="button"
          aria-label={lt('Close focus day panel')}
          className="dialog-backdrop backdrop-fade absolute inset-0"
          onClick={() => setIsFocusPanelOpen(false)}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
          <div className="modal-pop pointer-events-auto flex max-h-full w-full max-w-[540px] flex-col overflow-hidden rounded-[22px] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-xl)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="ui-eyebrow text-[var(--blue-text)]">
                  {tr('Focus Day', 'Fokus kuni', 'Фокусный день')}
                </p>
                <h3 className="mt-1 truncate text-[20px] font-bold tracking-[-0.02em] text-[var(--foreground)]">
                  {selectedLabel}
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                  {selectedDay ? getDaySummary(selectedDay) : tr('Pick a date from the month grid to inspect details.', 'Tafsilotlarni korish uchun oy setkasidan sana tanlang.', 'Выберите дату из сетки месяца, чтобы посмотреть детали.')}
                </p>
              </div>

              <IconButton
                size="lg"
                label={lt('Close focus day panel')}
                onClick={() => setIsFocusPanelOpen(false)}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
                </svg>
              </IconButton>
            </div>

            <div className="min-h-0 flex-1 space-y-[18px] overflow-y-auto bg-[var(--surface)] px-5 py-5 sm:px-6">
              <div
                className={cn(
                  'rounded-[18px] p-[18px]',
                  toneSurface[getDayTone(selectedDay)],
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[14px] bg-[var(--surface)] text-[28px] font-bold tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
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

                    <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                      {getDaySummary(selectedDay)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Status', 'Holat', 'Статус')}</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
                    {getStatusLabel(selectedDay.status, selectedDay)}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Submission', 'Yuborish', 'Отправка')}</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
                    {selectedDay.hasUpdate ? tr('Available', 'Mavjud', 'Доступно') : tr('None', "Yo'q", 'Нет')}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Validation', 'Validatsiya', 'Валидация')}</p>
                  <p
                    className={cn(
                      'mt-1 text-[13px] font-semibold',
                      selectedDay.isValid === false
                        ? 'text-[var(--warning-text)]'
                        : selectedDay.isValid === true
                          ? 'text-[var(--success-text)]'
                          : 'text-[var(--foreground)]',
                    )}
                  >
                    {selectedDay.isValid === false ? lt('Needs review') : selectedDay.isValid === true ? lt('Valid') : lt('N/A')}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Entries', 'Yozuvlar', 'Записи')}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                    {getEntryCount(selectedDay)}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Check in time', 'Kirish vaqti', 'Время входа')}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                    {formatWorkTime(selectedDay.checkInTime)}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3 text-[12.5px] text-[var(--muted)]">
                  <p>{tr('Check out time', 'Chiqish vaqti', 'Время выхода')}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                    {formatWorkTime(selectedDay.checkOutTime)}
                  </p>
                </div>
              </div>

              {shouldShowFocusContent ? (
                <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="ui-eyebrow">
                        {selectedDay.hasUpdate ? lt('Update Content') : lt('Special Day')}
                      </p>
                      <h4 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
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

                  <div className="mt-4 max-h-[320px] overflow-y-auto rounded-[14px] bg-[var(--surface)] p-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--muted-strong)]">
                      {focusDetailText}
                    </p>
                  </div>

                  {selectedDay.isValid === false ? (
                    <p className="mt-3 text-xs text-[var(--warning-text)]">
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
        <div className="space-y-[18px] overflow-hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
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

          <div className="space-y-[18px]">
              <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_auto_minmax(290px,330px)] lg:items-center">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[26px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
                      {stableMonthPeriod}
                    </h4>
                    <Badge variant="violet">
                      {monthProgressPct.toFixed(0)}{lt('% pace')}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-center lg:justify-self-center">
                  <div className="grid w-fit grid-cols-[44px_auto_44px] items-center gap-1.5 rounded-[18px] bg-[var(--muted-surface)] p-1.5">
                    <IconButton
                      size="lg"
                      label={tr('Previous month', 'Oldingi oy', 'Предыдущий месяц')}
                      onClick={() => onMonthShift?.(-1)}
                      disabled={!onMonthShift}
                      className="bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 3.5 5.5 8 10 12.5" />
                      </svg>
                    </IconButton>
                    <Button
                      variant="secondary"
                      onClick={() => onJumpToToday?.()}
                      aria-disabled={!canJumpToToday}
                      className={cn(
                        'min-w-[144px] border-transparent bg-[var(--surface)] px-5 font-bold text-[var(--foreground)]',
                        canJumpToToday ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      {stableMonthPeriod}
                    </Button>
                    <IconButton
                      size="lg"
                      label={tr('Next month', 'Keyingi oy', 'Следующий месяц')}
                      onClick={() => onMonthShift?.(1)}
                      disabled={!onMonthShift}
                      className="bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 3.5 10.5 8 6 12.5" />
                      </svg>
                    </IconButton>
                  </div>
                </div>

                <div className="hidden rounded-[18px] bg-[var(--accent-soft)] p-[18px] lg:block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ui-card-label">
                        {lt('Completion To Date')}
                      </p>
                      <p className="mt-2 text-[13px] font-medium text-[var(--muted-strong)]">
                        {completionSummaryText}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                        {counts.submitted}/{elapsedWorkingDays || 0}
                      </p>
                      <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
                        {monthProgressPct.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <CompletionBar pct={monthProgressPct} />
                  </div>
                </div>
              </div>

              <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(290px,330px)] lg:items-start">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <Badge variant="success" dot className="w-full justify-start sm:w-auto">
                    {counts.submitted} {tr('Updated', 'Yangilangan', 'Обновлено')}
                  </Badge>
                  <Badge variant="danger" dot className="w-full justify-start sm:w-auto">
                    {counts.missing} {tr('Missed', 'Otib yuborilgan', 'Пропущено')}
                  </Badge>
                  <Badge variant="secondary" className="w-full justify-start sm:w-auto">
                    {attentionDays} {tr('Attention', "E'tibor", 'Внимание')}
                  </Badge>
                  <Badge variant="secondary" className="col-span-2 w-full min-w-0 justify-start sm:col-span-1 sm:w-auto">
                    <span className="truncate">{tr('Next', 'Keyingi', 'Следующий')}: {nextDayLabel}</span>
                  </Badge>
                </div>

                <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px] lg:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ui-card-label">
                        {lt('Completion To Date')}
                      </p>
                      <p className="mt-2 text-[13px] font-medium text-[var(--muted-strong)]">
                        {completionSummaryText}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                        {counts.submitted}/{elapsedWorkingDays || 0}
                      </p>
                      <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
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

            <div className="calendar-board-scroll -mx-2 px-2 pb-3 sm:mx-0 sm:px-0 sm:pb-1">
              <div className="min-w-[736px] pr-1 sm:min-w-[768px]">
                <div className="grid grid-cols-7 gap-2">
                  {weekdayLabels.map((label) => (
                    <div
                      key={label}
                      className="rounded-[11px] bg-[var(--muted-surface)] px-3 py-2.5 text-center text-xs font-medium text-[var(--muted)]"
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
                              className="min-h-[152px] rounded-[18px] bg-[var(--border-subtle)] opacity-60"
                              aria-hidden="true"
                            />
                          )
                        }

                        const entryCount = getEntryCount(day)
                        const dayTone = getDayTone(day)
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
                              'group relative flex min-h-[152px] min-w-0 flex-col overflow-hidden rounded-[18px] px-3 py-3 text-left transition-all duration-200',
                              showTimePanel && 'min-h-[164px]',
                              toneSurface[dayTone],
                              isToday && !isSelected && 'bg-[var(--blue-dim)]',
                              isSelected
                                ? 'ring-2 ring-[var(--violet-text)] ring-offset-2 ring-offset-[var(--surface)]'
                                : 'hover:-translate-y-[1px] hover:shadow-[var(--elev-sm)]',
                            )}
                            title={`${isSelected ? `${tr('Selected', 'Tanlangan', 'Выбрано')}: ` : ''}${formatLongDate(day.date)}: ${getStatusLabel(day.status, day)}`}
                          >
                            <span className={cn('absolute inset-x-4 top-0 h-[3px] rounded-b-full', toneDot[dayTone])} />

                            <div className="relative flex items-start justify-between gap-3">
                              <div>
                                <p className={cn('text-[11px] font-semibold uppercase tracking-[0.06em]', toneText[dayTone])}>
                                  {getBoardWeekday(day)}
                                </p>
                                <p
                                  className={cn(
                                    'mt-1.5 text-[24px] font-bold leading-none tabular-nums tracking-[-0.03em]',
                                    day.status === 'submitted' || day.status === 'missing' ? 'text-[var(--foreground)]' : 'text-[var(--muted-strong)]',
                                  )}
                                >
                                  {day.day}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5">
                                {entryCount > 0 ? (
                                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--muted-strong)]">
                                    {entryCount}x
                                  </span>
                                ) : null}
                                {isToday ? (
                                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--surface)]">
                                    <span className="h-2 w-2 rounded-full bg-[var(--blue-text)]" />
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {showTimePanel ? (
                              <div className="relative mt-3 w-full max-w-[112px] self-center space-y-1.5 text-center">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="rounded-[11px] bg-[var(--surface)] px-2 py-1.5">
                                    <p className="ui-card-label text-[var(--muted)]">
                                      {tr('In', 'Kirish', 'Вход')}
                                    </p>
                                    <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)]">
                                      {formatWorkTime(effectiveCheckIn)}
                                    </p>
                                  </div>
                                  <div className="rounded-[11px] bg-[var(--surface)] px-2 py-1.5">
                                    <p className="ui-card-label flex items-center justify-center gap-1 text-[var(--muted)]">
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
                                      <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)]">
                                        {formatWorkTime(effectiveCheckOut)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[11px] font-semibold tabular-nums text-[var(--muted-strong)]">
                                  {getWorkedDurationLabel(effectiveDay)}
                                </p>
                              </div>
                            ) : null}

                            <div className={cn('relative mt-auto pt-2', showTimePanel && 'flex flex-col items-center text-center')}>
                              <span
                                className={cn(
                                  'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                  showTimePanel && 'justify-center',
                                  getDayPillClass(dayTone),
                                )}
                              >
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[dayTone])} />
                                {getCalendarCellStatusLabel(day.status, day)}
                              </span>
                              <p className={cn('mt-1.5 text-[11.5px] leading-[1.35] text-[var(--muted-strong)]', showTimePanel && 'max-w-[112px] text-center')}>
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

            <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--violet-text)]" />
                {tr('Selected', 'Tanlangan', 'Выбрано')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--blue-text)]" />
                {tr('Today', 'Bugun', 'Сегодня')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />
                {tr('Updated', 'Yangilangan', 'Обновлено')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--danger-text)]" />
                {tr('Missed', 'Otib yuborilgan', 'Пропущено')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--border-hover)]" />
                {tr('Open or upcoming', 'Ochiq yoki yaqinlashayotgan', 'Открыто или скоро')}
              </span>
            </div>
          </div>
        </div>
      {selectedDayDrawer}
    </>
  )
}
