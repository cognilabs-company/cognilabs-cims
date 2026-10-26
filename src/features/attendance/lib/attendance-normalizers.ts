export type NormalizedDay = {
  date: string
  weekday: string
  checkIn: string | null
  checkOut: string | null
  workedHours: number
  workedMinutes: number
  status: string
  isComplete: boolean
  note: string | null
}

export type NormalizedWeek = {
  weekNumber: number
  label: string
  dateFrom: string
  dateTo: string
  workedHours: number
  workedMinutes: number
  daysPresent: number
  avgDailyHours: number
  days: NormalizedDay[]
}

export type NormalizedEmployeeAttendance = {
  employeeId: number
  fullName: string
  role: string
  totalWorkedHours: number
  totalWorkedMinutes: number
  daysPresent: number
  daysComplete: number
  latestStatus: string
  latestCheckIn: string | null
  latestCheckOut: string | null
  weeks: NormalizedWeek[]
  days: NormalizedDay[]
}

export function resolveNum(obj: Record<string, unknown>, ...keys: string[]): number {
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

export function resolveStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

export function resolveHours(
  obj: Record<string, unknown>,
  hourKeys: string[],
  minuteKeys: string[] = [],
): number {
  const hours = resolveNum(obj, ...hourKeys)
  if (hours > 0) return hours

  const minutes = resolveNum(obj, ...minuteKeys)
  return minutes > 0 ? minutes / 60 : 0
}

function resolveMinutes(obj: Record<string, unknown>, minuteKeys: string[], hourKeys: string[] = []): number {
  const minutes = resolveNum(obj, ...minuteKeys)
  if (minutes > 0) return minutes

  const hours = resolveNum(obj, ...hourKeys)
  return hours > 0 ? hours * 60 : 0
}

function weekdayFromDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { weekday: 'short' })
}

export function sortDays(days: NormalizedDay[]): NormalizedDay[] {
  return [...days].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
}

export function normalizeDay(raw: unknown): NormalizedDay {
  const day = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const workedMinutes = resolveMinutes(
    day,
    ['duration_minutes', 'worked_minutes', 'total_minutes'],
    ['worked_hours', 'worked_hours_decimal', 'hours', 'total_hours'],
  )
  const workedHours =
    resolveHours(
      day,
      ['worked_hours', 'worked_hours_decimal', 'hours', 'total_hours'],
      ['duration_minutes', 'worked_minutes', 'total_minutes'],
    ) || workedMinutes / 60
  const checkIn = resolveStr(day, 'check_in_time', 'check_in', 'came_at') || null
  const checkOut = resolveStr(day, 'check_out_time', 'check_out', 'gone_at') || null
  const status = (checkIn ? 'present' : resolveStr(day, 'status')) || 'absent'
  const isComplete =
    Boolean(day.is_complete) ||
    (checkIn !== null && checkOut !== null) ||
    status === 'complete'

  return {
    date: resolveStr(day, 'date', 'attendance_date', 'session_date'),
    weekday: resolveStr(day, 'weekday') || weekdayFromDate(resolveStr(day, 'date', 'attendance_date')),
    checkIn,
    checkOut,
    workedHours,
    workedMinutes,
    status,
    isComplete,
    note: resolveStr(day, 'note') || null,
  }
}

export function normalizeWeek(raw: unknown, index: number, allDays: NormalizedDay[]): NormalizedWeek {
  const week = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const dateFrom = resolveStr(week, 'date_from')
  const dateTo = resolveStr(week, 'date_to')
  const weekDays =
    dateFrom && dateTo
      ? allDays.filter(day => day.date >= dateFrom && day.date <= dateTo)
      : Array.isArray(week.days)
        ? (week.days as unknown[]).map(normalizeDay)
        : []
  const workedMinutes =
    resolveMinutes(week, ['total_minutes', 'worked_minutes'], ['total_hours', 'worked_hours', 'worked_hours_decimal']) ||
    weekDays.reduce((sum, day) => sum + day.workedMinutes, 0)
  const workedHours =
    resolveHours(week, ['total_hours', 'worked_hours', 'worked_hours_decimal'], ['total_minutes', 'worked_minutes']) ||
    workedMinutes / 60
  const weekNumber = resolveNum(week, 'week_number', 'week') || index + 1
  const label =
    resolveStr(week, 'week_label') ||
    (dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : `Week ${weekNumber}`)
  const daysPresent =
    resolveNum(week, 'days_present') ||
    weekDays.filter(day => day.status.toLowerCase() === 'present' || day.workedMinutes > 0).length

  return {
    weekNumber,
    label,
    dateFrom,
    dateTo,
    workedHours,
    workedMinutes,
    daysPresent,
    avgDailyHours: daysPresent > 0 ? workedHours / daysPresent : 0,
    days: sortDays(weekDays),
  }
}

export function buildWeeksFromDays(days: NormalizedDay[]): NormalizedWeek[] {
  const sortedDays = sortDays(days)
  if (sortedDays.length === 0) return []

  const weekMap = new Map<string, NormalizedDay[]>()
  for (const day of sortedDays) {
    const parsed = new Date(day.date)
    if (Number.isNaN(parsed.getTime())) {
      const key = `unknown-${weekMap.size + 1}`
      weekMap.set(key, [...(weekMap.get(key) ?? []), day])
      continue
    }

    const monday = new Date(parsed)
    const dayOfWeek = monday.getDay()
    const delta = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    monday.setDate(monday.getDate() + delta)
    const key = monday.toISOString().slice(0, 10)
    weekMap.set(key, [...(weekMap.get(key) ?? []), day])
  }

  return Array.from(weekMap.entries()).map(([weekStart, weekDays], index) => {
    const weekEnd = weekDays[weekDays.length - 1]?.date ?? weekStart
    const workedMinutes = weekDays.reduce((sum, day) => sum + day.workedMinutes, 0)
    const daysPresent = weekDays.filter(day => day.status.toLowerCase() === 'present' || day.workedMinutes > 0).length

    return {
      weekNumber: index + 1,
      label: `${weekStart} - ${weekEnd}`,
      dateFrom: weekStart,
      dateTo: weekEnd,
      workedHours: workedMinutes / 60,
      workedMinutes,
      daysPresent,
      avgDailyHours: daysPresent > 0 ? workedMinutes / 60 / daysPresent : 0,
      days: weekDays,
    }
  })
}

export function normalizeEmployeeAttendance(raw: unknown): NormalizedEmployeeAttendance {
  const employee = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const employeeInfo =
    (employee.employee && typeof employee.employee === 'object'
      ? employee.employee
      : {}) as Record<string, unknown>
  const monthlyStats =
    (employee.monthly_stats && typeof employee.monthly_stats === 'object'
      ? employee.monthly_stats
      : employee.summary && typeof employee.summary === 'object'
        ? employee.summary
        : {}) as Record<string, unknown>

  const employeeId =
    resolveNum(employee, 'employee_id', 'attendance_user_id', 'id', 'user_id') ||
    resolveNum(employeeInfo, 'id', 'employee_id')

  const fullName =
    resolveStr(employee, 'full_name', 'fullName', 'employee_name') ||
    resolveStr(employeeInfo, 'full_name', 'fullName', 'name') ||
    [resolveStr(employee, 'first_name', 'name'), resolveStr(employee, 'last_name', 'surname')].filter(Boolean).join(' ') ||
    `Employee #${employeeId || '?'}`

  const role =
    resolveStr(employee, 'role', 'role_name', 'job_title', 'position') ||
    resolveStr(employeeInfo, 'role', 'role_name', 'job_title', 'position')

  const rootDays = Array.isArray(employee.days)
    ? (employee.days as unknown[]).map(normalizeDay)
    : Array.isArray(employee.attendance_records)
      ? (employee.attendance_records as unknown[]).map(normalizeDay)
      : []
  const weeklyStats = Array.isArray(employee.weekly_stats) ? (employee.weekly_stats as unknown[]) : []
  const days = sortDays(
    rootDays.length > 0
      ? rootDays
      : weeklyStats.flatMap(item => {
        const week = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return Array.isArray(week.days) ? (week.days as unknown[]).map(normalizeDay) : []
      }),
  )

  const weeks =
    weeklyStats.length > 0
      ? weeklyStats.map((week, index) => normalizeWeek(week, index, days))
      : buildWeeksFromDays(days)

  const totalWorkedMinutes =
    resolveMinutes(monthlyStats, ['total_minutes', 'worked_minutes', 'total_work_minutes'], ['total_hours', 'worked_hours', 'worked_hours_decimal', 'total_work_hours_decimal']) ||
    resolveMinutes(employee, ['total_minutes', 'worked_minutes'], ['total_worked_hours', 'total_hours', 'worked_hours_decimal']) ||
    days.reduce((sum, day) => sum + day.workedMinutes, 0)
  const totalWorkedHours =
    resolveHours(monthlyStats, ['total_hours', 'worked_hours', 'worked_hours_decimal', 'total_work_hours_decimal'], ['total_minutes', 'worked_minutes', 'total_work_minutes']) ||
    resolveHours(employee, ['total_worked_hours', 'total_hours', 'worked_hours_decimal'], ['total_minutes', 'worked_minutes']) ||
    totalWorkedMinutes / 60
  const daysPresent =
    resolveNum(monthlyStats, 'days_present', 'worked_days') ||
    resolveNum(employee, 'days_present') ||
    days.filter(day => day.status.toLowerCase() === 'present' || day.workedMinutes > 0).length
  const daysComplete =
    resolveNum(monthlyStats, 'days_complete', 'complete_days') ||
    resolveNum(employee, 'days_complete') ||
    days.filter(day => day.isComplete).length
  const latestDay = days.length > 0 ? days[days.length - 1] : null

  return {
    employeeId,
    fullName,
    role,
    totalWorkedHours,
    totalWorkedMinutes,
    daysPresent,
    daysComplete,
    latestStatus: latestDay?.status ?? 'no_record',
    latestCheckIn: latestDay?.checkIn ?? null,
    latestCheckOut: latestDay?.checkOut ?? null,
    weeks,
    days,
  }
}

export function extractEmployeeAttendances(raw: unknown): NormalizedEmployeeAttendance[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeEmployeeAttendance)
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const key of ['employees', 'items', 'data', 'results', 'records']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).map(normalizeEmployeeAttendance)
      }
    }
  }

  return []
}

export function mergeEmployeeAttendances(
  primary: NormalizedEmployeeAttendance[],
  fallback: NormalizedEmployeeAttendance[],
): NormalizedEmployeeAttendance[] {
  const merged = new Map<number, NormalizedEmployeeAttendance>()

  for (const item of fallback) {
    merged.set(item.employeeId, item)
  }

  for (const item of primary) {
    const current = merged.get(item.employeeId)
    if (!current) {
      merged.set(item.employeeId, item)
      continue
    }

    merged.set(item.employeeId, {
      ...current,
      ...item,
      role: item.role || current.role,
      days: item.days.length > 0 ? item.days : current.days,
      weeks: item.weeks.length > 0 ? item.weeks : current.weeks,
      totalWorkedHours: item.totalWorkedHours || current.totalWorkedHours,
      totalWorkedMinutes: item.totalWorkedMinutes || current.totalWorkedMinutes,
      daysPresent: item.daysPresent || current.daysPresent,
      daysComplete: item.daysComplete || current.daysComplete,
      latestStatus: item.latestStatus !== 'no_record' ? item.latestStatus : current.latestStatus,
      latestCheckIn: item.latestCheckIn || current.latestCheckIn,
      latestCheckOut: item.latestCheckOut || current.latestCheckOut,
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export function formatHours(value: number): string {
  return `${value.toFixed(1)}h`
}

export function formatIsoDate(value: string): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function statusVariant(status: string): 'success' | 'danger' | 'warning' | 'secondary' {
  const normalized = status.toLowerCase()
  if (normalized === 'present' || normalized === 'complete') return 'success'
  if (normalized === 'late' || normalized === 'partial') return 'warning'
  if (normalized === 'absent' || normalized === 'deleted' || normalized === 'no_record') return 'danger'
  return 'secondary'
}
