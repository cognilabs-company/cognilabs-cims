import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { attendanceService } from '../../../shared/api/services/attendance.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Card } from '../../../shared/ui/card'
import { PageHeader } from '../../../shared/ui/page-header'
import { SectionTitle } from '../../../shared/ui/section-title'
import { LoadingStateBlock, ErrorStateBlock, EmptyStateBlock } from '../../../shared/ui/state-block'
import { Badge } from '../../../shared/ui/badge'
import { IconButton } from '../../../shared/ui/icon-button'
import { StatCard } from '../../../shared/ui/stat-card'
import { cn } from '../../../shared/lib/cn'

type NormalizedDay = {
  date: string
  checkIn: string | null
  checkOut: string | null
  workedHours: number
  status: string
}

type NormalizedWeek = {
  weekNumber: number
  workedHours: number
  days: NormalizedDay[]
}

type NormalizedOfficeTime = {
  year: number
  month: number
  totalWorkedHours: number
  weeks: NormalizedWeek[]
}

const headCellClass = 'bg-[var(--muted-surface)] px-3 py-2.5 text-left align-middle text-xs font-medium whitespace-nowrap text-[var(--muted)]'
const bodyCellClass = 'border-b border-[var(--border-subtle)] px-3 py-3.5 align-middle'

const totalHoursIcon = (
  <Clock strokeWidth={1.8} className="h-4.5 w-4.5" aria-hidden="true" />
)

const chevronLeftIcon = (
  <ChevronLeft strokeWidth={1.8} className="h-4.5 w-4.5" aria-hidden="true" />
)

const chevronRightIcon = (
  <ChevronRight strokeWidth={1.8} className="h-4.5 w-4.5" aria-hidden="true" />
)

function resolveHours(
  obj: Record<string, unknown>,
  hourKeys: string[],
  minuteKeys: string[] = [],
): number {
  const hours = resolveNum(obj, ...hourKeys)
  if (hours > 0) return hours

  const minutes = resolveNum(obj, ...minuteKeys)
  return minutes > 0 ? minutes / 60 : 0
}

function resolveNum(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'number' && isFinite(val)) return val
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = parseFloat(val)
      if (isFinite(parsed)) return parsed
    }
  }
  return 0
}

function resolveStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

function normalizeDay(raw: unknown): NormalizedDay {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const workedHours = resolveHours(
    d,
    ['worked_hours', 'worked_hours_decimal', 'hours'],
    ['duration_minutes', 'worked_minutes', 'total_minutes'],
  )
  const checkIn = resolveStr(d, 'check_in_time', 'check_in') || null
  return {
    date: resolveStr(d, 'date', 'attendance_date'),
    checkIn,
    checkOut: resolveStr(d, 'check_out_time', 'check_out') || null,
    workedHours,
    status: checkIn ? 'present' : resolveStr(d, 'status') || 'absent',
  }
}

function normalizeWeek(raw: unknown, index: number, allDays: NormalizedDay[]): NormalizedWeek {
  const w = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const dateFrom = resolveStr(w, 'date_from')
  const dateTo = resolveStr(w, 'date_to')
  const days =
    dateFrom && dateTo
      ? allDays.filter(d => d.date >= dateFrom && d.date <= dateTo)
      : Array.isArray(w.days)
        ? (w.days as unknown[]).map(normalizeDay)
        : []
  const totalHours = resolveHours(
    w,
    ['total_hours', 'worked_hours', 'worked_hours_decimal'],
    ['total_minutes', 'worked_minutes'],
  )
  return {
    weekNumber: resolveNum(w, 'week_number', 'week') || index + 1,
    workedHours: totalHours || days.reduce((sum, d) => sum + d.workedHours, 0),
    days,
  }
}

function sortDays(days: NormalizedDay[]): NormalizedDay[] {
  return [...days].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
}

function buildWeeksFromDays(days: NormalizedDay[]): NormalizedWeek[] {
  const sortedDays = sortDays(days)
  if (sortedDays.length === 0) return []

  const weekMap = new Map<string, NormalizedDay[]>()
  for (const day of sortedDays) {
    const parsed = new Date(day.date)
    if (Number.isNaN(parsed.getTime())) {
      const fallbackKey = `unknown-${weekMap.size + 1}`
      weekMap.set(fallbackKey, [...(weekMap.get(fallbackKey) ?? []), day])
      continue
    }

    const mondayBased = new Date(parsed)
    const dayOfWeek = mondayBased.getDay()
    const delta = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    mondayBased.setDate(mondayBased.getDate() + delta)
    const weekKey = mondayBased.toISOString().slice(0, 10)
    weekMap.set(weekKey, [...(weekMap.get(weekKey) ?? []), day])
  }

  return Array.from(weekMap.values()).map((weekDays, index) => ({
    weekNumber: index + 1,
    workedHours: weekDays.reduce((sum, day) => sum + day.workedHours, 0),
    days: weekDays,
  }))
}

function normalizeOfficeTime(raw: unknown): NormalizedOfficeTime | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const period = (obj.period && typeof obj.period === 'object' ? obj.period : {}) as Record<string, unknown>
  const monthlyStats = (obj.monthly_stats && typeof obj.monthly_stats === 'object' ? obj.monthly_stats : {}) as Record<string, unknown>

  const allDays = sortDays(Array.isArray(obj.days) ? (obj.days as unknown[]).map(normalizeDay) : [])

  const weeklySource = Array.isArray(obj.weekly_stats) ? obj.weekly_stats : Array.isArray(obj.weeks) ? obj.weeks : []
  const weeks: NormalizedWeek[] =
    (weeklySource as unknown[]).length > 0
      ? (weeklySource as unknown[]).map((w, i) => normalizeWeek(w, i, allDays))
      : buildWeeksFromDays(allDays)

  const totalWorkedHours = resolveHours(
    monthlyStats,
    ['total_hours', 'worked_hours', 'worked_hours_decimal'],
    ['total_minutes', 'worked_minutes'],
  ) ||
    resolveHours(
      obj,
      ['total_worked_hours', 'total_hours', 'worked_hours_decimal'],
      ['total_minutes', 'worked_minutes'],
    ) ||
    allDays.reduce((sum, day) => sum + day.workedHours, 0)

  return {
    year: resolveNum(period, 'year') || resolveNum(obj, 'year'),
    month: resolveNum(period, 'month') || resolveNum(obj, 'month'),
    totalWorkedHours,
    weeks,
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function PersonalAttendancePage() {
  const [date, setDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const query = useAsyncData(
    async () => {
      const raw = await attendanceService.getOfficeTimeMe(date.year, date.month)
      return normalizeOfficeTime(raw)
    },
    [date.year, date.month],
  )

  const data = query.data

  const nextMonth = () => setDate(prev =>
    prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 },
  )
  const prevMonth = () => setDate(prev =>
    prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 },
  )

  return (
    <section className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow="Member / Attendance"
        title="My Attendance"
        actions={(
          <div className="flex items-center gap-1 rounded-[14px] bg-[var(--accent-soft)] p-1.5">
            <IconButton label="Previous month" onClick={prevMonth} className="bg-[var(--surface)] text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--primary)]">
              {chevronLeftIcon}
            </IconButton>
            <span className="min-w-[148px] px-1 text-center text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {MONTHS[date.month - 1]} {date.year}
            </span>
            <IconButton label="Next month" onClick={nextMonth} className="bg-[var(--surface)] text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--primary)]">
              {chevronRightIcon}
            </IconButton>
          </div>
        )}
      />

      {data && (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Hours"
            value={`${data.totalWorkedHours.toFixed(1)}h`}
            icon={totalHoursIcon}
            solid
          />
        </div>
      )}

      {query.isLoading ? (
        <LoadingStateBlock eyebrow="Attendance" title="Loading attendance..." description="Please wait while we fetch your records." />
      ) : query.isError ? (
        <ErrorStateBlock eyebrow="Attendance" title="Failed to load attendance" description="There was an error retrieving your records." />
      ) : !data || data.weeks.length === 0 ? (
        <EmptyStateBlock eyebrow="Attendance" title="No attendance data found for this period." />
      ) : (
        <div className="grid gap-[18px]">
          {data.weeks.map(week => (
            <Card key={week.weekNumber} className="space-y-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle
                  title={`Week ${week.weekNumber}`}
                  description="Daily breakdown for this week"
                />
                <Badge variant="blue">{week.workedHours.toFixed(1)}h</Badge>
              </div>
              <div className="custom-scrollbar-visible overflow-x-auto">
                <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      <th className={cn(headCellClass, 'rounded-l-[12px] pl-3.5')}>Date</th>
                      <th className={headCellClass}>Status</th>
                      <th className={headCellClass}>Check In</th>
                      <th className={headCellClass}>Check Out</th>
                      <th className={cn(headCellClass, 'rounded-r-[12px] pr-3.5 text-right')}>Worked Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={cn(bodyCellClass, 'text-center text-[13px] text-[var(--muted)]')}>No days recorded.</td>
                      </tr>
                    ) : week.days.map((day, i) => (
                      <tr key={day.date || i} className="transition-colors hover:bg-[var(--card-hover)]">
                        <td className={cn(bodyCellClass, 'pl-3.5 text-[13.5px] font-medium text-[var(--foreground)]')}>
                          {day.date
                            ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                            : '—'}
                        </td>
                        <td className={bodyCellClass}>
                          <Badge
                            variant={day.status === 'present' ? 'success' : day.status === 'absent' ? 'danger' : 'secondary'}
                            dot
                            className="capitalize"
                          >
                            {day.status}
                          </Badge>
                        </td>
                        <td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>
                          {day.checkIn
                            ? (() => { try { return new Date(day.checkIn!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return day.checkIn } })()
                            : '—'}
                        </td>
                        <td className={cn(bodyCellClass, 'text-[13.5px] tabular-nums text-[var(--muted-strong)]')}>
                          {day.checkOut
                            ? (() => { try { return new Date(day.checkOut!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return day.checkOut } })()
                            : '—'}
                        </td>
                        <td className={cn(bodyCellClass, 'pr-3.5 text-right text-[13.5px] font-semibold tabular-nums text-[var(--foreground)]')}>
                          {day.workedHours > 0 ? `${day.workedHours.toFixed(1)}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
