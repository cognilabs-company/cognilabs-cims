import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { membersService } from '../../../shared/api/services/members.service'
import {
  updateTrackingService,
  type WorkdayOverrideMemberOption,
  type WorkdayOverrideRecord,
} from '../../../shared/api/services/updateTracking.service'
import type { DayStatus, EmployeeDayStatus, EmployeeMonthlyStats } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { formatShortDate, getLocalizedMonthName } from '../../../shared/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardFooter } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { MemberAvatar as SharedMemberAvatar } from '../../../shared/ui/member-avatar'
import { SelectField } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const currentDateKey = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-')

const COMPLETION_ON_TRACK = 80
const recentTextKeys = ['update_content', 'update_text', 'message', 'text', 'summary', 'description', 'content', 'body', 'note', 'comment', 'remarks', 'title']
const recentDateKeys = ['update_date', 'date', 'created_at', 'submitted_at', 'updated_at', 'timestamp']

type UnknownRecord = Record<string, unknown>
type TeamUpdatesSummary = {
  totalEmployees: number
  totalReports: number
  averageCompletion: number
}
type TeamSalarySummary = {
  employeesCount: number
  totalBaseSalary: number
  totalDeductionAmount: number
  totalBonusAmount: number
  totalFinalSalary: number
  totalEstimatedSalary: number
}

type TeamSalaryEntry = {
  userId: number
  baseSalary: number | null
  deductionAmount: number | null
  bonusAmount: number | null
  finalSalary: number | null
  estimatedSalary: number | null
  penaltyPoints: number | null
  penaltiesCount: number | null
  bonusesCount: number | null
}

/* Month Name Helper */
function getMonthName(month: number): string {
  return getLocalizedMonthName(month)
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate()
}

function hasUsefulMonthlyStats(employee: Pick<EmployeeMonthlyStats, 'submitted_count' | 'missing_count' | 'completion_percentage' | 'last_update_date' | 'daily_statuses'>) {
  return (
    employee.submitted_count > 0 ||
    employee.missing_count > 0 ||
    employee.completion_percentage > 0 ||
    Boolean(employee.last_update_date) ||
    Boolean(employee.daily_statuses?.length)
  )
}

function hasUsefulMonthlyNumericStats(employee: Pick<EmployeeMonthlyStats, 'submitted_count' | 'missing_count' | 'completion_percentage'>) {
  return (
    employee.submitted_count > 0 ||
    employee.missing_count > 0 ||
    employee.completion_percentage > 0
  )
}

/* Activity Strip */
const activitySegmentStyle = {
  submitted: 'team-activity-segment team-activity-segment-submitted',
  missing:   'team-activity-segment team-activity-segment-missing',
  sunday:    'team-activity-segment team-activity-segment-sunday',
  future:    'team-activity-segment team-activity-segment-future',
  neutral:   'team-activity-segment team-activity-segment-neutral',
} as const satisfies Record<DayStatus, string>

function splitStatusesIntoWeeks(entries: EmployeeDayStatus[], chunkSize = 7) {
  const weeks: EmployeeDayStatus[][] = []

  for (let index = 0; index < entries.length; index += chunkSize) {
    weeks.push(entries.slice(index, index + chunkSize))
  }

  return weeks
}

function getActivityStatusLabel(status: DayStatus) {
  switch (status) {
    case 'submitted':
      return translateCurrentLiteral('Active month')
    case 'missing':
      return translateCurrentLiteral('No reports')
    case 'sunday':
      return translateCurrentLiteral('Weekend / off day')
    case 'future':
      return translateCurrentLiteral('Future month')
    default:
      return translateCurrentLiteral('No data')
  }
}

function getLocalizedDayStatusTitle(day: number, status: DayStatus) {
  return `${translateCurrentLiteral('Day')} ${day}: ${getActivityStatusLabel(status)}`
}

function buildMonthlyActivityStatuses(
  employee: Pick<EmployeeMonthlyStats, 'daily_statuses' | 'submitted_count' | 'missing_count' | 'completion_percentage' | 'last_update_date'>,
  month: number,
  year: number,
) {
  if (!hasUsefulMonthlyStats(employee)) {
    return null
  }

  const daysInMonth = getDaysInMonth(month, year)
  const statusesByDay = new Map<number, EmployeeDayStatus>()

  employee.daily_statuses?.forEach((entry) => {
    if (entry.day < 1 || entry.day > daysInMonth) {
      return
    }

    const current = statusesByDay.get(entry.day)

    if (!current || (current.status !== 'submitted' && entry.status === 'submitted')) {
      statusesByDay.set(entry.day, entry)
    }
  })

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const existing = statusesByDay.get(day)

    if (existing) {
      return existing
    }

    return {
      day,
      status: getFallbackDayStatus(new Date(year, month - 1, day)),
    } satisfies EmployeeDayStatus
  })
}

function deriveMonthlyStatsFromActivity(
  employee: Pick<EmployeeMonthlyStats, 'daily_statuses' | 'submitted_count' | 'missing_count' | 'completion_percentage' | 'last_update_date'>,
  month: number,
  year: number,
) {
  const statuses = buildMonthlyActivityStatuses(employee, month, year)

  if (!statuses || statuses.length === 0) {
    return null
  }

  const submittedCount = statuses.filter((entry) => entry.status === 'submitted').length
  const missingCount = statuses.filter((entry) => entry.status === 'missing').length
  const trackedDays = submittedCount + missingCount

  if (trackedDays === 0) {
    return null
  }

  return {
    submitted_count: submittedCount,
    missing_count: missingCount,
    completion_percentage: Math.round((submittedCount / trackedDays) * 1000) / 10,
    last_update_date: getLatestDateFromDayStatuses(statuses, month, year),
  }
}

function reconcileEmployeeMonthlyStats(
  employee: EmployeeMonthlyStats,
  month: number,
  year: number,
): EmployeeMonthlyStats {
  const derivedStats = deriveMonthlyStatsFromActivity(employee, month, year)

  if (!derivedStats) {
    return employee
  }

  const employeeHasUsefulNumericStats = hasUsefulMonthlyNumericStats(employee)
  const derivedHasUsefulNumericStats = hasUsefulMonthlyNumericStats(derivedStats)
  const shouldUseDerivedNumericStats = derivedHasUsefulNumericStats && !employeeHasUsefulNumericStats

  return {
    ...employee,
    submitted_count: shouldUseDerivedNumericStats ? derivedStats.submitted_count : employee.submitted_count,
    missing_count: shouldUseDerivedNumericStats ? derivedStats.missing_count : employee.missing_count,
    completion_percentage: shouldUseDerivedNumericStats ? derivedStats.completion_percentage : employee.completion_percentage,
    last_update_date: employee.last_update_date ?? derivedStats.last_update_date,
  }
}

function ActivityStrip({ employee, month, year }: { employee: EmployeeMonthlyStats, month: number, year: number }) {
  const statuses = buildMonthlyActivityStatuses(employee, month, year)

  if (!statuses || statuses.length === 0) {
    return <span className="text-xs text-(--muted)">-</span>
  }

  const weeks = splitStatusesIntoWeeks(statuses)

  return (
    <div
      data-i18n-skip="true"
      data-activity-strip="true"
      className="team-activity-rail w-[18rem] px-2.5 py-2"
      aria-label={translateCurrentLiteral('Monthly activity')}
    >
      <div className="team-activity-rail-inner">
        {weeks.map((week, weekIndex) => (
          <div
            key={`week-${weekIndex + 1}`}
            className="team-activity-week"
            style={{ flexGrow: week.length, flexBasis: 0 }}
          >
            {week.map((entry) => (
              <span
                key={entry.day}
                title={entry.label ?? getLocalizedDayStatusTitle(entry.day, entry.status)}
                className={cn('min-w-[0.34rem] flex-1', activitySegmentStyle[entry.status])}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityLegendItem({
  status,
  label,
}: {
  status: DayStatus
  label: string
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('h-2.5 w-4 shrink-0', activitySegmentStyle[status])} />
      {translateCurrentLiteral(label)}
    </span>
  )
}

function TrackBadge({ pct }: { pct: number }) {
  return pct >= COMPLETION_ON_TRACK
    ? <Badge variant="success" dot>{translateCurrentLiteral('On Track')}</Badge>
    : <Badge variant="warning" dot>{translateCurrentLiteral('Needs Attention')}</Badge>
}

function CompletionPill({ pct }: { pct: number }) {
  const color =
    pct >= 90 ? 'bg-emerald-500 text-white' :
    pct >= 75 ? 'bg-amber-400/90 text-black' :
    'bg-rose-500 text-white'

  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums', color)}>
      {pct.toFixed(1)}%
    </span>
  )
}

function EmployeeAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [firstName = '', ...surnameParts] = name.trim().split(/\s+/)

  return (
    <SharedMemberAvatar
      name={firstName || name}
      surname={surnameParts.join(' ')}
      imageUrl={imageUrl}
      size="md"
      className="shadow-md"
      title={name}
    />
  )
}

/* Parse All Users Updates Response */
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') {
    return payload
  }

  const trimmed = payload.trim()

  if (!trimmed) {
    return ''
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return payload
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (!normalized) {
      return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false
  }

  return null
}

function findFirstString(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      return source[key] as string
    }
  }

  return undefined
}

function findFirstNumber(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(source[key])

    if (value !== null) {
      return value
    }
  }

  return undefined
}

function findFirstRecord(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (isRecord(value)) {
      return value
    }
  }

  return undefined
}

function findFirstArray(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
    }
  }

  return undefined
}

const employeeCollectionKeys = ['employees', 'users', 'data', 'results', 'items', 'team', 'members', 'team_updates', 'all_users', 'monthly_updates', 'rows'] as const
const employeeNestedKeys = ['data', 'summary', 'statistics', 'result', 'payload', 'monthly_summary', 'team', 'employee', 'member'] as const
const employeeIdKeys = ['user_id', 'employee_id', 'member_id', 'id'] as const

function normalizeLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function looksLikeEmployeeRecord(source: UnknownRecord) {
  return [
    ...employeeIdKeys,
    'submitted_count',
    'update_days',
    'updates_count',
    'working_days',
    'missing_count',
    'missing_days',
    'completion_percentage',
    'percentage',
    'daily_statuses',
    'day_statuses',
    'updates',
    'reports',
    'periods',
    'calendar',
    'summary',
    'statistics',
    'user',
    'employee',
    'member',
  ].some((key) => key in source)
}

function extractEmployeeRecords(data: unknown): UnknownRecord[] {
  const parsed = parsePayload(data)

  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord)
  }

  if (!isRecord(parsed)) {
    return []
  }

  const directEntries = findFirstArray(parsed, [...employeeCollectionKeys])

  if (directEntries) {
    return directEntries.filter(isRecord)
  }

  for (const key of employeeNestedKeys) {
    const nested = parsed[key]

    if (!isRecord(nested)) {
      continue
    }

    const nestedEntries = findFirstArray(nested, [...employeeCollectionKeys])

    if (nestedEntries) {
      return nestedEntries.filter(isRecord)
    }

    const nestedValues = Object.values(nested).filter(isRecord).filter(looksLikeEmployeeRecord)

    if (nestedValues.length > 0) {
      return nestedValues
    }

    if (looksLikeEmployeeRecord(nested)) {
      return [nested]
    }
  }

  if (looksLikeEmployeeRecord(parsed)) {
    return [parsed]
  }

  return Object.values(parsed).filter(isRecord).filter(looksLikeEmployeeRecord)
}

function resolveEmployeeUserId(...sources: Array<UnknownRecord | null | undefined>) {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const userId = findFirstNumber(source, [...employeeIdKeys])

    if (typeof userId === 'number' && userId > 0) {
      return userId
    }
  }

  return 0
}

const unknownNameLabels = new Set(['unknown', 'unknown member', 'unknown user', 'member unknown'])

function joinNameParts(...parts: Array<string | undefined>) {
  const value = parts.filter(Boolean).join(' ').trim()
  return value || undefined
}

function resolveDisplayName(...sources: Array<UnknownRecord | null | undefined>) {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const directName = findFirstString(source, ['full_name', 'user_name', 'employee_name', 'member_name', 'display_name'])

    if (directName && !unknownNameLabels.has(directName.trim().toLowerCase())) {
      return directName.trim()
    }

    const composedName = joinNameParts(
      findFirstString(source, ['first_name', 'firstName', 'name']),
      findFirstString(source, ['surname', 'last_name', 'lastName']),
    )

    if (composedName && !unknownNameLabels.has(composedName.trim().toLowerCase())) {
      return composedName
    }

    const plainName = findFirstString(source, ['name'])

    if (plainName && !unknownNameLabels.has(plainName.trim().toLowerCase())) {
      return plainName.trim()
    }
  }

  return undefined
}

function resolveProfileImage(...sources: Array<UnknownRecord | null | undefined>) {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const image = findFirstString(source, ['profile_image', 'profileImage', 'image', 'avatar', 'photo'])

    if (image) {
      return image
    }
  }

  return null
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parseDateValue(value: string) {
  if (isDateKey(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function getLatestDateValue(values: Array<string | null | undefined>) {
  return values.reduce<string | null>((latest, current) => {
    if (!current) {
      return latest
    }

    const currentDate = new Date(current)

    if (Number.isNaN(currentDate.getTime())) {
      return latest
    }

    if (!latest) {
      return current
    }

    const latestDate = new Date(latest)

    if (Number.isNaN(latestDate.getTime()) || currentDate > latestDate) {
      return current
    }

    return latest
  }, null)
}

function getLatestDateFromEntries(entries: unknown[] | null | undefined) {
  if (!entries || entries.length === 0) {
    return null
  }

  return getLatestDateValue(
    entries
      .map((entry) => (isRecord(entry) ? findFirstString(entry, recentDateKeys) : undefined))
      .filter((value): value is string => Boolean(value)),
  )
}

function getLatestDateFromDayStatuses(
  dayStatuses: EmployeeDayStatus[] | null | undefined,
  month: number,
  year: number,
) {
  if (!dayStatuses || dayStatuses.length === 0) {
    return null
  }

  const latestSubmittedDay = [...dayStatuses]
    .filter((entry) => entry.status === 'submitted')
    .sort((left, right) => right.day - left.day)[0]

  if (!latestSubmittedDay) {
    return null
  }

  return new Date(year, month - 1, latestSubmittedDay.day).toISOString()
}

function normalizeOverrideDayType(value: unknown): WorkdayOverrideRecord['day_type'] {
  if (typeof value !== 'string') {
    return 'holiday'
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  return normalized === 'short_day' ? 'short_day' : 'holiday'
}

function extractWorkdayOverride(source: UnknownRecord): WorkdayOverrideRecord | null {
  const rawOverride = isRecord(source.workday_override)
    ? source.workday_override
    : isRecord(source.workdayOverride)
      ? source.workdayOverride
      : null

  if (!rawOverride) {
    return null
  }

  return {
    id: toNumber(rawOverride.id) ?? 0,
    special_date: findFirstString(rawOverride, ['special_date', 'date']) ?? '',
    day_type: normalizeOverrideDayType(rawOverride.day_type ?? rawOverride.type),
    title: findFirstString(rawOverride, ['title', 'label', 'name']) ?? 'Workday override',
    note: findFirstString(rawOverride, ['note', 'description', 'remarks']) ?? null,
    target_type: findFirstString(rawOverride, ['target_type']) ?? 'all',
    member_id: toNumber(rawOverride.member_id ?? rawOverride.user_id),
    member_name: findFirstString(rawOverride, ['member_name', 'member', 'user_name']) ?? null,
    workday_hours:
      typeof rawOverride.workday_hours === 'string'
        ? rawOverride.workday_hours
        : typeof rawOverride.workday_hours === 'number' && Number.isFinite(rawOverride.workday_hours)
          ? String(rawOverride.workday_hours)
          : null,
    update_required: toBoolean(rawOverride.update_required) ?? false,
    created_by: toNumber(rawOverride.created_by) ?? 0,
    created_at: findFirstString(rawOverride, ['created_at']) ?? '',
    updated_at: findFirstString(rawOverride, ['updated_at']) ?? '',
  }
}

function isWorkdayOverrideOffDay(override: WorkdayOverrideRecord | null) {
  if (!override) {
    return false
  }

  if (override.day_type === 'holiday') {
    return true
  }

  return override.update_required === false
}

function getFallbackDayStatus(date: Date | null): DayStatus {
  if (!date) {
    return 'neutral'
  }

  if (date > todayStart) {
    return 'future'
  }

  if (date.getDay() === 0) {
    return 'sunday'
  }

  return 'missing'
}

function normalizeDayStatus(
  value: unknown,
  date: Date | null,
  options?: { isDayOff?: boolean | null },
): DayStatus {
  if ((date && date.getDay() === 0) || options?.isDayOff) {
    return 'sunday'
  }

  const fallback = getFallbackDayStatus(date)
  const booleanValue = toBoolean(value)

  if (booleanValue !== null) {
    return booleanValue ? 'submitted' : fallback
  }

  if (typeof value === 'number') {
    return value > 0 ? 'submitted' : fallback
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (!normalized) {
      return fallback
    }

    if (
      normalized.includes('submitted') ||
      normalized.includes('complete') ||
      normalized.includes('done') ||
      normalized.includes('present') ||
      normalized.includes('sent') ||
      normalized.includes('logged')
    ) {
      return 'submitted'
    }

    if (
      normalized.includes('missing') ||
      normalized.includes('absent') ||
      normalized.includes('not submitted') ||
      normalized.includes('missed')
    ) {
      return 'missing'
    }

    if (
      normalized.includes('sunday') ||
      normalized.includes('weekend') ||
      normalized.includes('off')
    ) {
      return 'sunday'
    }

    if (
      normalized.includes('future') ||
      normalized.includes('upcoming')
    ) {
      return 'future'
    }

    if (
      normalized.includes('neutral') ||
      normalized.includes('open') ||
      normalized.includes('pending')
    ) {
      return 'neutral'
    }
  }

  if (isRecord(value)) {
    const workdayOverride = extractWorkdayOverride(value)
    const sundayValue = toBoolean(value.is_sunday ?? value.sunday)

    if (sundayValue) {
      return 'sunday'
    }

    const workingDayValue = toBoolean(value.is_working_day ?? value.working_day)

    if (workingDayValue === false) {
      return 'sunday'
    }

    const isDayOff = toBoolean(value.is_day_off ?? value.day_off)

    if (isDayOff === true || isWorkdayOverrideOffDay(workdayOverride)) {
      return 'sunday'
    }

    const missingValue = toBoolean(value.is_missing ?? value.missing)

    if (missingValue === true) {
      return 'missing'
    }

    const submittedValue = toBoolean(value.is_submitted ?? value.submitted)

    if (submittedValue === true) {
      return 'submitted'
    }

    return normalizeDayStatus(
      value.status ??
        value.day_status ??
        value.submission_status ??
        value.type ??
        value.value ??
        value.result,
      date,
      { isDayOff },
    )
  }

  return fallback
}

function normalizeDayStatusEntry(
  raw: unknown,
  month: number,
  year: number,
): EmployeeDayStatus | null {
  if (!isRecord(raw)) {
    return null
  }

  const dateValue = findFirstString(raw, ['date', 'full_date', 'calendar_date', 'day_date', ...recentDateKeys])
  const numericDay = toNumber(raw.day ?? raw.day_of_month ?? raw.day_number)
  const date = dateValue
    ? parseDateValue(dateValue)
    : numericDay
      ? new Date(year, month - 1, numericDay)
      : null

  if (date && Number.isNaN(date.getTime())) {
    return null
  }

  const workdayOverride = extractWorkdayOverride(raw)
  const isDayOff = toBoolean(raw.is_day_off ?? raw.day_off) ?? isWorkdayOverrideOffDay(workdayOverride)
  const explicitHasUpdate = toBoolean(raw.has_update ?? raw.has_updates ?? raw.is_submitted ?? raw.submitted)
  const updatesCount = toNumber(raw.updates_count ?? raw.count ?? raw.total_updates ?? raw.submitted_count)
  const updateContent = findFirstString(raw, recentTextKeys)
  const normalizedStatus = normalizeDayStatus(
    raw.status ??
      raw.day_status ??
      raw.submission_status ??
      raw.type ??
      raw.is_submitted ??
      raw.submitted ??
      raw.is_missing ??
      raw.missing ??
      raw.is_sunday ??
      raw.sunday ??
      raw.value,
    date,
    { isDayOff },
  )
  const hasUpdate = explicitHasUpdate === true || (updatesCount !== null && updatesCount > 0) || Boolean(updateContent)
  const status = hasUpdate && normalizedStatus !== 'sunday' ? 'submitted' : normalizedStatus
  const resolvedDay = numericDay ?? (date ? date.getDate() : null)

  if (!resolvedDay || resolvedDay < 1) {
    return null
  }

  return {
    day: resolvedDay,
    status,
  }
}

function parseDayStatuses(
  raw: unknown,
  month: number,
  year: number,
): EmployeeDayStatus[] | null {
  const entries = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? Object.entries(raw)
        .filter(([key]) => isDateKey(key) || /^\d{1,2}$/.test(key))
        .map(([key, value]) => (isDateKey(key) ? { date: key, status: value } : { day: Number(key), status: value }))
      : []

  const parsedEntries = entries
    .map((entry) => normalizeDayStatusEntry(entry, month, year))
    .filter((entry): entry is EmployeeDayStatus => Boolean(entry))
  const parsedByDay = new Map<number, EmployeeDayStatus>()

  parsedEntries.forEach((entry) => {
    const current = parsedByDay.get(entry.day)

    if (!current) {
      parsedByDay.set(entry.day, entry)
      return
    }

    if (current.status !== 'submitted' && entry.status === 'submitted') {
      parsedByDay.set(entry.day, entry)
    }
  })

  const parsed = Array.from(parsedByDay.values()).sort((left, right) => left.day - right.day)

  return parsed.length > 0 ? parsed : null
}

function normalizeEmployee(
  raw: Record<string, unknown>,
  month: number,
  year: number,
): EmployeeMonthlyStats {
  const userRecord =
    findFirstRecord(raw, ['user', 'employee', 'member']) ??
    findFirstRecord(raw, ['member_data', 'user_data']) ??
    null
  const summaryRecord =
    findFirstRecord(raw, ['summary', 'statistics', 'monthly_stats', 'update_stats', 'salary_update']) ??
    null
  const name = resolveDisplayName(raw, userRecord, summaryRecord) ?? 'Unknown'
  const sources = [raw, userRecord, summaryRecord].filter(Boolean) as UnknownRecord[]

  const dayStatuses = parseDayStatuses(
    raw.daily_statuses ??
    summaryRecord?.daily_statuses ??
    userRecord?.daily_statuses ??
    raw.day_statuses ??
    summaryRecord?.day_statuses ??
    userRecord?.day_statuses ??
    raw.updates ??
    summaryRecord?.updates ??
    userRecord?.updates ??
    raw.reports ??
    raw.daily_updates ??
    summaryRecord?.daily_updates ??
    raw.statuses ??
    raw.days ??
    raw.calendar ??
    raw.entries ??
    raw.monthly_activity ??
    raw.activity,
    month,
    year,
  )
  const updatesList = sources
    .map((source) => findFirstArray(source, ['updates', 'reports', 'entries', 'items']))
    .find((value): value is unknown[] => Array.isArray(value))
  const derivedSubmitted = dayStatuses ? dayStatuses.filter((entry) => entry.status === 'submitted').length : 0
  const derivedMissing = dayStatuses ? dayStatuses.filter((entry) => entry.status === 'missing').length : 0

  const directSubmitted =
    sources
      .map((source) => findFirstNumber(source, ['update_days', 'submitted_count', 'updates_count', 'total_submitted', 'logged_count', 'submitted', 'total_reports', 'report_count', 'reports_count']))
      .find((value): value is number => value !== undefined) ??
    (updatesList ? updatesList.length : null) ??
    derivedSubmitted
  const submitted = directSubmitted === 0 && derivedSubmitted > 0 ? derivedSubmitted : directSubmitted

  const directMissing = sources
    .map((source) => findFirstNumber(source, ['missing_days', 'missing_count', 'total_missing', 'missed_count', 'absent_count', 'missing']))
    .find((value): value is number => value !== undefined)
  const workingDays = sources
    .map((source) => findFirstNumber(source, ['working_days', 'work_days', 'expected_updates', 'expected_working_days']))
    .find((value): value is number => value !== undefined)
  const missing =
    directMissing ??
    (typeof workingDays === 'number' ? Math.max(workingDays - submitted, 0) : undefined) ??
    derivedMissing
  const resolvedMissing =
    missing === 0 && derivedMissing > 0 && typeof workingDays !== 'number'
      ? derivedMissing
      : missing

  const rawCompletion = sources
    .map((source) => findFirstNumber(source, ['percentage', 'completion_percentage', 'completion_rate', 'percent', 'avg_percentage', 'update_percentage', 'average_update_percentage', 'salary_update_percentage']))
    .find((value): value is number => value !== undefined)
  const completion =
    rawCompletion !== undefined && rawCompletion > 0
      ? rawCompletion <= 1 ? rawCompletion * 100 : rawCompletion
      : submitted + resolvedMissing > 0
        ? Math.round((submitted / (submitted + resolvedMissing)) * 100)
        : 0

  const lastDate = getLatestDateValue(
    sources.map((source) => findFirstString(source, ['last_update_date', 'last_update', 'updated_at', 'submitted_at', 'last_report_date', 'latest_report_date'])),
  ) ??
    getLatestDateFromEntries(updatesList) ??
    getLatestDateFromDayStatuses(dayStatuses, month, year) ??
    null

  return {
    user_id: resolveEmployeeUserId(raw, userRecord, summaryRecord),
    user_name: name,
    telegram_username:
      findFirstString(raw, ['telegram_username', 'telegram_id']) ??
      findFirstString(userRecord ?? {}, ['telegram_username', 'telegram_id']) ??
      null,
    profile_image: resolveProfileImage(raw, userRecord, summaryRecord),
    submitted_count: submitted,
    missing_count: resolvedMissing,
    completion_percentage: completion,
    last_update_date: lastDate,
    daily_statuses: dayStatuses,
  }
}

function parseAllUsersUpdates(
  data: unknown,
  month: number,
  year: number,
): EmployeeMonthlyStats[] {
  return extractEmployeeRecords(data).map((entry) => normalizeEmployee(entry, month, year))
}

function parseTrackingMonthlyEmployees(
  data: unknown,
  month: number,
  year: number,
): EmployeeMonthlyStats[] {
  return extractEmployeeRecords(data).map((entry) => {
    const userRecord =
      findFirstRecord(entry, ['user', 'employee', 'member']) ??
      findFirstRecord(entry, ['member_data', 'user_data']) ??
      null
    const summaryRecord =
      findFirstRecord(entry, ['summary', 'statistics', 'monthly_stats', 'update_stats', 'salary_update']) ??
      null
    const updates = findFirstArray(entry, ['updates', 'entries', 'reports', 'items']) ?? []
    const dayStatuses = parseDayStatuses(updates, month, year)
    const derivedSubmitted = dayStatuses ? dayStatuses.filter((day) => day.status === 'submitted').length : 0
    const derivedMissing = dayStatuses ? dayStatuses.filter((day) => day.status === 'missing').length : 0
    const submitted = findFirstNumber(entry, ['update_days', 'submitted_count', 'updates_count', 'total_submitted']) ?? derivedSubmitted
    const workingDays = findFirstNumber(entry, ['working_days', 'work_days', 'expected_updates', 'expected_working_days'])
    const missing =
      findFirstNumber(entry, ['missing_days', 'missing_count', 'total_missing', 'missed_count']) ??
      (typeof workingDays === 'number' ? Math.max(workingDays - submitted, 0) : derivedMissing)
    const rawPercentage = findFirstNumber(entry, ['percentage', 'completion_percentage', 'completion_rate', 'percent'])
    const completion =
      typeof rawPercentage === 'number'
        ? rawPercentage <= 1 ? rawPercentage * 100 : rawPercentage
        : submitted + missing > 0
          ? Math.round((submitted / (submitted + missing)) * 1000) / 10
          : 0

    return {
      user_id: resolveEmployeeUserId(entry, userRecord, summaryRecord),
      user_name: resolveDisplayName(entry, userRecord, summaryRecord) ?? `User #${resolveEmployeeUserId(entry, userRecord, summaryRecord)}`,
      telegram_username:
        findFirstString(entry, ['telegram_username', 'telegram_id']) ??
        findFirstString(userRecord ?? {}, ['telegram_username', 'telegram_id']) ??
        null,
      profile_image: resolveProfileImage(entry, userRecord, summaryRecord),
      submitted_count: submitted,
      missing_count: missing,
      completion_percentage: completion,
      last_update_date:
        getLatestDateFromEntries(updates) ??
        getLatestDateFromDayStatuses(dayStatuses, month, year) ??
        null,
      daily_statuses: dayStatuses,
    }
  })
}

function buildEmployeesFromRoster(memberOptions: WorkdayOverrideMemberOption[]): EmployeeMonthlyStats[] {
  return memberOptions.map((member) => ({
    user_id: member.id,
    user_name: member.full_name?.trim() || `${member.name ?? ''} ${member.surname ?? ''}`.trim() || `User #${member.id}`,
    telegram_username: member.telegram_id ?? null,
    profile_image: member.profile_image ?? null,
    submitted_count: 0,
    missing_count: 0,
    completion_percentage: 0,
    last_update_date: null,
    daily_statuses: null,
    base_salary: null,
    estimated_salary: null,
    final_salary: null,
    deduction_amount: null,
    bonus_amount: null,
    penalty_points: null,
    penalties_count: null,
    bonuses_count: null,
  }))
}

function normalizePercentage(value: unknown) {
  const rawValue = toNumber(value)

  if (rawValue === null) {
    return null
  }

  return rawValue <= 1 ? rawValue * 100 : rawValue
}

function getEmployeePeriods(raw: unknown) {
  if (!isRecord(raw) || !Array.isArray(raw.periods)) {
    return [] as UnknownRecord[]
  }

  return raw.periods.filter(isRecord)
}

function getSelectedPeriod(periods: UnknownRecord[], month: number, year: number) {
  return periods.find((period) => (
    toNumber(period.year) === year &&
    toNumber(period.month) === month
  )) ?? null
}

function getLatestReportDate(periods: UnknownRecord[]) {
  const datedPeriods = periods
    .map((period) => findFirstString(period, ['latest_report_date', 'last_update_date', 'last_report_date', 'updated_at']))
    .filter((value): value is string => Boolean(value))

  if (datedPeriods.length === 0) {
    return null
  }

  return datedPeriods.reduce<string | null>((latest, current) => {
    if (!latest) {
      return current
    }

    const latestDate = new Date(latest)
    const currentDate = new Date(current)

    if (Number.isNaN(currentDate.getTime())) {
      return latest
    }

    if (Number.isNaN(latestDate.getTime()) || currentDate > latestDate) {
      return current
    }

    return latest
  }, null)
}

function buildMonthlyActivityFromPeriods(periods: UnknownRecord[], year: number): EmployeeDayStatus[] {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  return Array.from({ length: 12 }, (_, index) => {
    const value = index + 1
    const label = getMonthName(value)
    const period = getSelectedPeriod(periods, value, year)
    const reportsCount = toNumber(period?.reports_count ?? period?.total_reports ?? period?.submitted_count) ?? 0
    const averagePercentage = normalizePercentage(
      period?.average_update_percentage ??
      period?.completion_percentage ??
      period?.percentage,
    ) ?? 0
    const latestReportDate = findFirstString(period ?? {}, ['latest_report_date', 'last_update_date', 'last_report_date', 'updated_at'])

    let status: DayStatus = 'neutral'

    if (year > currentYear || (year === currentYear && value > currentMonth)) {
      status = 'future'
    } else if (period) {
      status = reportsCount > 0 || averagePercentage > 0 || Boolean(latestReportDate)
        ? 'submitted'
        : 'missing'
    }

    return {
      day: value,
      label: label.slice(0, 3),
      status,
    }
  })
}

function mergeEmployeeHistory(
  fallbackEmployee: EmployeeMonthlyStats,
  rawHistory: unknown,
  month: number,
  year: number,
): EmployeeMonthlyStats {
  if (!isRecord(rawHistory)) {
    return fallbackEmployee
  }

  const normalizedHistory = normalizeEmployee(rawHistory, month, year)
  const periods = getEmployeePeriods(rawHistory)
  const selectedPeriod = getSelectedPeriod(periods, month, year)
  const historySubmittedCount = normalizedHistory.submitted_count
  const historyMissingCount = normalizedHistory.missing_count
  const historyCompletion = normalizedHistory.completion_percentage
  const lastUpdateDate =
    normalizedHistory.last_update_date ??
    findFirstString(selectedPeriod ?? {}, ['latest_report_date', 'last_update_date', 'last_report_date', 'updated_at']) ??
    getLatestReportDate(periods) ??
    fallbackEmployee.last_update_date
  const fallbackHasLiveStats =
    fallbackEmployee.submitted_count > 0 ||
    fallbackEmployee.missing_count > 0 ||
    fallbackEmployee.completion_percentage > 0
  const fallbackHasDayStatuses = Boolean(fallbackEmployee.daily_statuses?.length)
  const historyHasUsefulNumericStats =
    historySubmittedCount > 0 ||
    historyMissingCount > 0 ||
    historyCompletion > 0
  const historyHasUsefulStats =
    historyHasUsefulNumericStats ||
    Boolean(normalizedHistory.last_update_date) ||
    Boolean(normalizedHistory.daily_statuses?.length)
  const shouldUseHistoryNumericStats = historyHasUsefulNumericStats || !fallbackHasLiveStats
  const historyActivity = buildMonthlyActivityFromPeriods(periods, year)

  return {
    user_id: normalizedHistory.user_id || fallbackEmployee.user_id,
    user_name: normalizedHistory.user_name || fallbackEmployee.user_name,
    telegram_username:
      normalizedHistory.telegram_username ??
      fallbackEmployee.telegram_username,
    profile_image:
      normalizedHistory.profile_image ??
      fallbackEmployee.profile_image ??
      null,
    submitted_count: shouldUseHistoryNumericStats ? historySubmittedCount : fallbackEmployee.submitted_count,
    missing_count: shouldUseHistoryNumericStats ? historyMissingCount : fallbackEmployee.missing_count,
    completion_percentage: shouldUseHistoryNumericStats ? historyCompletion : fallbackEmployee.completion_percentage,
    last_update_date:
      fallbackEmployee.last_update_date && fallbackHasLiveStats
        ? fallbackEmployee.last_update_date
        : lastUpdateDate,
    daily_statuses:
      !fallbackHasDayStatuses && historyHasUsefulStats && normalizedHistory.daily_statuses && normalizedHistory.daily_statuses.length > 0
        ? normalizedHistory.daily_statuses
        : fallbackHasDayStatuses || fallbackHasLiveStats
          ? fallbackEmployee.daily_statuses
          : historyActivity,
    base_salary: fallbackEmployee.base_salary ?? null,
    estimated_salary: fallbackEmployee.estimated_salary ?? null,
    final_salary: fallbackEmployee.final_salary ?? null,
    deduction_amount: fallbackEmployee.deduction_amount ?? null,
    bonus_amount: fallbackEmployee.bonus_amount ?? null,
    penalty_points: fallbackEmployee.penalty_points ?? null,
    penalties_count: fallbackEmployee.penalties_count ?? null,
    bonuses_count: fallbackEmployee.bonuses_count ?? null,
  }
}

function parseUpdatesAllByEmployee(data: unknown) {
  return new Map(
    extractEmployeeRecords(data)
      .map((employee) => {
        const userRecord =
          findFirstRecord(employee, ['user', 'employee', 'member']) ??
          findFirstRecord(employee, ['member_data', 'user_data']) ??
          null
        const summaryRecord =
          findFirstRecord(employee, ['summary', 'statistics', 'monthly_stats', 'update_stats', 'salary_update']) ??
          null
        const userId = resolveEmployeeUserId(employee, userRecord, summaryRecord)
        return userId > 0 ? [userId, employee] : null
      })
      .filter((entry): entry is [number, UnknownRecord] => Boolean(entry)),
  )
}

function buildEmployeesFromHistoryRecords(
  historyByEmployee: Map<number, UnknownRecord>,
  month: number,
  year: number,
): EmployeeMonthlyStats[] {
  return Array.from(historyByEmployee.values()).map((record) => {
    const userRecord =
      findFirstRecord(record, ['user', 'employee', 'member']) ??
      findFirstRecord(record, ['member_data', 'user_data']) ??
      null
    const summaryRecord =
      findFirstRecord(record, ['summary', 'statistics', 'monthly_stats', 'update_stats', 'salary_update']) ??
      null
    const userId = resolveEmployeeUserId(record, userRecord, summaryRecord)

    return mergeEmployeeHistory(
      {
        user_id: userId,
        user_name:
          resolveDisplayName(record, userRecord, summaryRecord) ??
          `Member #${userId}`,
        telegram_username:
          findFirstString(record, ['telegram_username', 'telegram_id']) ??
          findFirstString(userRecord ?? {}, ['telegram_username', 'telegram_id']) ??
          null,
        profile_image: resolveProfileImage(record, userRecord, summaryRecord),
        submitted_count: 0,
        missing_count: 0,
        completion_percentage: 0,
        last_update_date: null,
        daily_statuses: null,
        base_salary: null,
        estimated_salary: null,
        final_salary: null,
        deduction_amount: null,
        bonus_amount: null,
        penalty_points: null,
        penalties_count: null,
        bonuses_count: null,
      },
      record,
      month,
      year,
    )
  }).filter((employee) => employee.user_id > 0)
}

function parseTeamUpdatesSummary(data: unknown): TeamUpdatesSummary | null {
  const parsed = parsePayload(data)

  if (!isRecord(parsed)) {
    return null
  }

  const summary = isRecord(parsed.summary) ? parsed.summary : parsed
  const rawAverage =
    toNumber(
      summary.average_update_percentage ??
      summary.avg_completion_percentage ??
      summary.completion_percentage ??
      summary.update_percentage,
    ) ?? 0

  return {
    totalEmployees:
      toNumber(summary.total_employees ?? summary.employees_count ?? summary.employee_count) ?? 0,
    totalReports:
      toNumber(summary.total_reports ?? summary.updates_count ?? summary.submitted_count) ?? 0,
    averageCompletion:
      rawAverage <= 1 ? rawAverage * 100 : rawAverage,
  }
}


function parseSalarySummary(data: unknown): TeamSalarySummary | null {
  const parsed = parsePayload(data)

  if (!isRecord(parsed)) {
    return null
  }

  const summary = isRecord(parsed.summary) ? parsed.summary : parsed

  return {
    employeesCount: toNumber(summary.employees_count ?? summary.total_employees ?? summary.employee_count) ?? 0,
    totalBaseSalary: toNumber(summary.total_base_salary ?? summary.base_salary_total) ?? 0,
    totalDeductionAmount: toNumber(summary.total_applied_deduction_amount ?? summary.total_deduction_amount ?? summary.deduction_amount_total) ?? 0,
    totalBonusAmount: toNumber(summary.total_bonus_amount ?? summary.bonus_amount_total) ?? 0,
    totalFinalSalary: toNumber(summary.total_final_salary ?? summary.final_salary_total) ?? 0,
    totalEstimatedSalary: toNumber(summary.total_estimated_salary ?? summary.estimated_salary_total ?? summary.salary_estimate_total) ?? 0,
  }
}

function parseSalaryEntry(raw: unknown): TeamSalaryEntry | null {
  if (!isRecord(raw)) {
    return null
  }

  const salaryEstimate = isRecord(raw.salary_estimate)
    ? raw.salary_estimate
    : isRecord(raw.salaryEstimate)
      ? raw.salaryEstimate
      : null
  const policy = isRecord(raw.policy) ? raw.policy : null

  const userId = toNumber(raw.user_id ?? raw.id ?? raw.employee_id ?? raw.member_id)

  if (!userId) {
    return null
  }

  return {
    userId,
    baseSalary: toNumber(salaryEstimate?.base_salary ?? policy?.salary_base ?? raw.base_salary ?? raw.default_salary),
    deductionAmount: toNumber(salaryEstimate?.applied_deduction_amount ?? salaryEstimate?.raw_deduction_amount ?? salaryEstimate?.deduction_amount ?? raw.deduction_amount),
    bonusAmount: toNumber(salaryEstimate?.total_bonus_amount ?? salaryEstimate?.bonus_amount ?? raw.total_bonus_amount ?? raw.bonus_amount),
    finalSalary: toNumber(salaryEstimate?.final_salary ?? raw.final_salary),
    estimatedSalary: toNumber(salaryEstimate?.estimated_salary ?? raw.estimated_salary),
    penaltyPoints: toNumber(salaryEstimate?.total_penalty_points ?? raw.total_penalty_points ?? raw.penalty_points),
    penaltiesCount: toNumber(raw.penalties_count ?? raw.penalty_count ?? raw.mistakes_count),
    bonusesCount: toNumber(raw.bonuses_count ?? raw.bonus_count ?? raw.delivery_bonus_count),
  }
}

function parseSalaryEstimatesByEmployee(data: unknown) {
  const parsed = parsePayload(data)

  if (!isRecord(parsed) || !Array.isArray(parsed.employees)) {
    return new Map<number, TeamSalaryEntry>()
  }

  return new Map(
    parsed.employees
      .map((entry) => parseSalaryEntry(entry))
      .filter((entry): entry is TeamSalaryEntry => Boolean(entry))
      .map((entry) => [entry.userId, entry] satisfies [number, TeamSalaryEntry]),
  )
}

function mergeEmployeeSalary(
  employee: EmployeeMonthlyStats,
  salaryEntry: TeamSalaryEntry | undefined,
): EmployeeMonthlyStats {
  if (!salaryEntry) {
    return employee
  }

  return {
    ...employee,
    base_salary: salaryEntry.baseSalary,
    estimated_salary: salaryEntry.estimatedSalary,
    final_salary: salaryEntry.finalSalary,
    deduction_amount: salaryEntry.deductionAmount,
    bonus_amount: salaryEntry.bonusAmount,
    penalty_points: salaryEntry.penaltyPoints,
    penalties_count: salaryEntry.penaltiesCount,
    bonuses_count: salaryEntry.bonusesCount,
  }
}

function mergeEmployeeStats(
  employee: EmployeeMonthlyStats,
  statsEntry: EmployeeMonthlyStats | undefined,
): EmployeeMonthlyStats {
  if (!statsEntry) {
    return employee
  }

  const statsHasUsefulNumericValues = hasUsefulMonthlyNumericStats(statsEntry)
  const employeeHasUsefulNumericValues = hasUsefulMonthlyNumericStats(employee)
  const shouldUseStatsNumericValues = statsHasUsefulNumericValues && !employeeHasUsefulNumericValues
  const shouldUseStatsDailyStatuses = Boolean(statsEntry.daily_statuses?.length) && !employee.daily_statuses?.length

  return {
    ...employee,
    user_id: statsEntry.user_id || employee.user_id,
    user_name: statsEntry.user_name || employee.user_name,
    telegram_username: statsEntry.telegram_username ?? employee.telegram_username,
    profile_image: employee.profile_image ?? statsEntry.profile_image ?? null,
    submitted_count: shouldUseStatsNumericValues ? statsEntry.submitted_count : employee.submitted_count,
    missing_count: shouldUseStatsNumericValues ? statsEntry.missing_count : employee.missing_count,
    completion_percentage: shouldUseStatsNumericValues ? statsEntry.completion_percentage : employee.completion_percentage,
    last_update_date: employee.last_update_date ?? statsEntry.last_update_date ?? null,
    daily_statuses:
      shouldUseStatsDailyStatuses && statsEntry.daily_statuses && statsEntry.daily_statuses.length > 0
        ? statsEntry.daily_statuses
        : employee.daily_statuses,
  }
}

type EmployeeStatsLookup = {
  byId: Map<number, EmployeeMonthlyStats>
  byName: Map<string, EmployeeMonthlyStats>
}

function buildEmployeeStatsLookup(employees: EmployeeMonthlyStats[]): EmployeeStatsLookup {
  const byId = new Map<number, EmployeeMonthlyStats>()
  const byName = new Map<string, EmployeeMonthlyStats>()

  employees.forEach((employee) => {
    if (employee.user_id > 0 && !byId.has(employee.user_id)) {
      byId.set(employee.user_id, employee)
    }

    const nameKey = normalizeLookupKey(employee.user_name)

    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, employee)
    }
  })

  return { byId, byName }
}

function matchEmployeeFromLookup(lookup: EmployeeStatsLookup, employee: EmployeeMonthlyStats) {
  return lookup.byId.get(employee.user_id) ?? lookup.byName.get(normalizeLookupKey(employee.user_name))
}

function buildRecordLookupByName(records: Iterable<UnknownRecord>) {
  const byName = new Map<string, UnknownRecord>()

  for (const record of records) {
    const userRecord =
      findFirstRecord(record, ['user', 'employee', 'member']) ??
      findFirstRecord(record, ['member_data', 'user_data']) ??
      null
    const summaryRecord =
      findFirstRecord(record, ['summary', 'statistics', 'monthly_stats', 'update_stats', 'salary_update']) ??
      null
    const nameKey = normalizeLookupKey(resolveDisplayName(record, userRecord, summaryRecord))

    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, record)
    }
  }

  return byName
}

/* Sort and Filter */
type SortKey = 'submitted' | 'missing' | 'completion' | 'name'
type StatusFilter = 'all' | 'on_track' | 'needs_attention'

const SORT_OPTIONS = [
  { value: 'submitted', label: 'Most updates' },
  { value: 'missing', label: 'Most missing' },
  { value: 'completion', label: 'Completion rate' },
  { value: 'name', label: 'Name A-Z' },
] as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'on_track', label: 'On Track' },
  { value: 'needs_attention', label: 'Needs Attention' },
] as const

function filterAndSort(
  employees: EmployeeMonthlyStats[],
  search: string,
  sortKey: SortKey,
  statusFilter: StatusFilter,
) {
  let list = [...employees]

  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter((e) => e.user_name.toLowerCase().includes(q))
  }

  if (statusFilter === 'on_track') {
    list = list.filter((e) => e.completion_percentage >= COMPLETION_ON_TRACK)
  } else if (statusFilter === 'needs_attention') {
    list = list.filter((e) => e.completion_percentage < COMPLETION_ON_TRACK)
  }

  list.sort((a, b) => {
    if (sortKey === 'submitted')  return b.submitted_count - a.submitted_count
    if (sortKey === 'missing')    return b.missing_count - a.missing_count
    if (sortKey === 'completion') return b.completion_percentage - a.completion_percentage
    return a.user_name.localeCompare(b.user_name)
  })

  return list
}

/* Page */
export function CeoTeamUpdatesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [search, setSearch]             = useState('')
  const [sortKey, setSortKey]           = useState<SortKey>('submitted')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const memberOptionsQuery = useAsyncData(() => updateTrackingService.workdayOverrideMemberOptions(), [])
  const rosterEmployees = useMemo(
    () => buildEmployeesFromRoster(memberOptionsQuery.data ?? []),
    [memberOptionsQuery.data],
  )
  const rosterEmployeeIds = useMemo(
    () => rosterEmployees.map((member) => member.user_id),
    [rosterEmployees],
  )

  const historyQuery = useAsyncData(
    () => membersService.updatesAll({
      year,
      month,
      employeeIds: rosterEmployeeIds.length > 0 ? rosterEmployeeIds : undefined,
    }),
    [year, month, rosterEmployeeIds.join(',')],
  )
  const historyByEmployee = useMemo(
    () => parseUpdatesAllByEmployee(historyQuery.data),
    [historyQuery.data],
  )
  const historyByName = useMemo(
    () => buildRecordLookupByName(historyByEmployee.values()),
    [historyByEmployee],
  )
  const historyEmployees = useMemo(
    () => buildEmployeesFromHistoryRecords(historyByEmployee, month, year),
    [historyByEmployee, month, year],
  )
  const employeeIds = useMemo(
    () => (rosterEmployeeIds.length > 0 ? rosterEmployeeIds : historyEmployees.map((member) => member.user_id)),
    [historyEmployees, rosterEmployeeIds],
  )

  const trackingMonthlyQuery = useAsyncData(
    () => updateTrackingService.teamMonthly(month, year),
    [month, year],
  )
  const missingTodayQuery = useAsyncData(
    () => updateTrackingService.missing(currentDateKey),
    [],
  )
  const teamQuery    = useAsyncData(
    () => membersService.updatesStatistics({ month, year, employeeIds }),
    [month, year, employeeIds.join(',')],
    { enabled: employeeIds.length > 0 },
  )
  const salaryQuery = useAsyncData(
    () => membersService.salaryEstimates({ year, month, employeeIds }),
    [month, year, employeeIds.join(',')],
    { enabled: employeeIds.length > 0 },
  )
  const workdayOverridesQuery = useAsyncData(
    () => updateTrackingService.workdayOverrides({ month, year }),
    [month, year],
  )
  const teamSummary = useMemo(
    () => parseTeamUpdatesSummary(teamQuery.data),
    [teamQuery.data],
  )
  const teamEmployees = useMemo(
    () => parseAllUsersUpdates(teamQuery.data, month, year),
    [teamQuery.data, month, year],
  )
  const reconciledTeamEmployees = useMemo(
    () => teamEmployees.map((employee: EmployeeMonthlyStats) => reconcileEmployeeMonthlyStats(employee, month, year)),
    [month, teamEmployees, year],
  )
  const teamEmployeesLookup = useMemo(
    () => buildEmployeeStatsLookup(reconciledTeamEmployees),
    [reconciledTeamEmployees],
  )
  const salarySummary = useMemo(
    () => parseSalarySummary(salaryQuery.data),
    [salaryQuery.data],
  )
  const trackingEmployees = useMemo(
    () => parseTrackingMonthlyEmployees(trackingMonthlyQuery.data, month, year),
    [month, trackingMonthlyQuery.data, year],
  )
  const reconciledTrackingEmployees = useMemo(
    () => trackingEmployees.map((employee: EmployeeMonthlyStats) => reconcileEmployeeMonthlyStats(employee, month, year)),
    [month, trackingEmployees, year],
  )
  const trackingEmployeesLookup = useMemo(
    () => buildEmployeeStatsLookup(reconciledTrackingEmployees),
    [reconciledTrackingEmployees],
  )
  const rawEmployees = useMemo(
    () => {
      if (reconciledTrackingEmployees.length === 0) {
        return rosterEmployees.length > 0 ? rosterEmployees : historyEmployees
      }

      const fallbackEmployees = rosterEmployees.length > 0 ? rosterEmployees : historyEmployees

      const fallbackIds = new Set(
        fallbackEmployees
          .map((employee) => employee.user_id)
          .filter((userId: number) => userId > 0),
      )
      const fallbackNames = new Set(
        fallbackEmployees
          .map((employee) => normalizeLookupKey(employee.user_name))
          .filter(Boolean),
      )
      const merged = fallbackEmployees.map((employee) => (
        matchEmployeeFromLookup(trackingEmployeesLookup, employee) ?? employee
      ))
      const extras = reconciledTrackingEmployees.filter((employee: EmployeeMonthlyStats) => {
        if (employee.user_id > 0 && fallbackIds.has(employee.user_id)) {
          return false
        }

        const nameKey = normalizeLookupKey(employee.user_name)
        return !nameKey || !fallbackNames.has(nameKey)
      })

      return [...merged, ...extras]
    },
    [historyEmployees, reconciledTrackingEmployees, rosterEmployees, trackingEmployeesLookup],
  )
  const salaryByEmployee = useMemo(
    () => parseSalaryEstimatesByEmployee(salaryQuery.data),
    [salaryQuery.data],
  )
  const mergedEmployees = useMemo(
    () => rawEmployees.map((employee) => (
      mergeEmployeeSalary(
        mergeEmployeeStats(
          mergeEmployeeHistory(
            employee,
            historyByEmployee.get(employee.user_id) ?? historyByName.get(normalizeLookupKey(employee.user_name)),
            month,
            year,
          ),
          matchEmployeeFromLookup(teamEmployeesLookup, employee),
        ),
        salaryByEmployee.get(employee.user_id),
      )
    )),
    [historyByEmployee, historyByName, month, rawEmployees, salaryByEmployee, teamEmployeesLookup, year],
  )
  const sourceEmployees = useMemo(() => {
    if (reconciledTrackingEmployees.length > 0) {
      const trackedIds = new Set(
        reconciledTrackingEmployees
          .map((employee: EmployeeMonthlyStats) => employee.user_id)
          .filter((userId: number) => userId > 0),
      )
      const trackedNames = new Set(
        reconciledTrackingEmployees
          .map((employee: EmployeeMonthlyStats) => normalizeLookupKey(employee.user_name))
          .filter(Boolean),
      )
      const trackedEmployees = reconciledTrackingEmployees.map((employee: EmployeeMonthlyStats) => (
        reconcileEmployeeMonthlyStats(
          mergeEmployeeSalary(employee, salaryByEmployee.get(employee.user_id)),
          month,
          year,
        )
      ))
      const extras = mergedEmployees
        .filter((employee) => {
          if (employee.user_id > 0 && trackedIds.has(employee.user_id)) {
            return false
          }

          const nameKey = normalizeLookupKey(employee.user_name)
          return !nameKey || !trackedNames.has(nameKey)
        })
        .map((employee) => reconcileEmployeeMonthlyStats(employee, month, year))

      return [...trackedEmployees, ...extras]
    }

    return (mergedEmployees.length > 0 ? mergedEmployees : rawEmployees).map((employee) => reconcileEmployeeMonthlyStats(employee, month, year))
  }, [mergedEmployees, month, rawEmployees, reconciledTrackingEmployees, salaryByEmployee, year])

  async function handleRefresh() {
    const results = await Promise.allSettled([
      memberOptionsQuery.refetch(),
      trackingMonthlyQuery.refetch(),
      missingTodayQuery.refetch(),
      teamQuery.refetch(),
      historyQuery.refetch(),
      salaryQuery.refetch(),
      workdayOverridesQuery.refetch(),
    ])

    const failed = results.find((result) => result.status === 'rejected')

    if (failed?.status === 'rejected') {
      showToast({
        title: translateCurrentLiteral('Refresh failed'),
        description: getApiErrorMessage(failed.reason),
        tone: 'error',
      })
      return
    }

    showToast({
      title: translateCurrentLiteral('Refreshed'),
      description: translateCurrentLiteral('Team monthly data reloaded.'),
      tone: 'success',
    })
  }

  function openMemberDetail(employee: EmployeeMonthlyStats) {
    if (!Number.isFinite(employee.user_id) || employee.user_id <= 0) {
      showToast({
        title: translateCurrentLiteral('Member detail unavailable'),
        description: translateCurrentLiteral('This employee row does not include a valid member ID.'),
        tone: 'error',
      })
      return
    }

    navigate(`/faults/members/${employee.user_id}?year=${year}&month=${month}`)
  }

  function canOpenMemberDetail(employee: EmployeeMonthlyStats) {
    return Number.isFinite(employee.user_id) && employee.user_id > 0
  }

  const employees = useMemo(
    () => filterAndSort(sourceEmployees, search, sortKey, statusFilter),
    [sourceEmployees, search, sortKey, statusFilter],
  )

  const hasRosterData = rosterEmployees.length > 0 || historyEmployees.length > 0
  const lt = translateCurrentLiteral
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: getMonthName(index + 1),
    })),
    [],
  )

  if (
    (memberOptionsQuery.isLoading && historyQuery.isLoading && !hasRosterData) ||
    ((teamQuery.isLoading || trackingMonthlyQuery.isLoading) && !teamQuery.data && !trackingMonthlyQuery.data && !hasRosterData)
  ) {
    return (
      <LoadingStateBlock
        eyebrow={lt('CEO / Team Updates')}
        title={lt('Loading team monthly data')}
        description={lt('Fetching employee update statistics for the selected period.')}
      />
    )
  }

  if (
    (memberOptionsQuery.isError && historyQuery.isError && !hasRosterData) ||
    (teamQuery.isError && trackingMonthlyQuery.isError && !teamQuery.data && !trackingMonthlyQuery.data && !hasRosterData)
  ) {
    return (
      <ErrorStateBlock
        eyebrow={lt('CEO / Team Updates')}
        title={lt('Team data unavailable')}
        description={lt('Could not load monthly team update statistics.')}
        actionLabel={lt('Retry')}
        onAction={() => void handleRefresh()}
      />
    )
  }

  const totalEmployees =
    (typeof teamSummary?.totalEmployees === 'number' && teamSummary.totalEmployees > 0
      ? teamSummary.totalEmployees
      : 0) ||
    employees.length ||
    sourceEmployees.length ||
    rosterEmployees.length ||
    salarySummary?.employeesCount ||
    0
  const selectedMonthName = getMonthName(month)

  return (
    <section className="space-y-4 page-enter">
      <Card variant="glass" noPadding className="overflow-hidden rounded-xl border-white/8">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
                {lt('Team Monthly Updates')}
              </h1>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-(--muted-strong)">
                {lt('Showing')} {employees.length} {lt('of')} {totalEmployees} {lt('Employees')}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 h-10 cursor-default">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-(--muted) cursor-default">{lt('Year')}</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2050"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
                    className="h-7 w-16 border-transparent bg-transparent text-sm font-semibold text-[var(--foreground)] cursor-default hover:border-transparent hover:bg-transparent"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 h-10 cursor-default">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-(--muted) cursor-default">{lt('Month')}</Label>
                  <SelectField
                    value={String(month)}
                    options={monthOptions}
                    onValueChange={(value) => setMonth(Number(value))}
                    className="h-7 min-w-[100px] border-transparent bg-transparent text-sm font-semibold text-[var(--foreground)] cursor-default hover:border-transparent hover:bg-transparent"
                  />
                </div>

                <Button
                  variant="secondary"
                  className="h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[11px]"
                  onClick={() => void handleRefresh()}
                >
                  {lt('Refresh')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card noPadding className="border-[var(--border)] overflow-hidden">
        <CardContent className="pt-6">
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
                {translateCurrentLiteral('Search employee')}
              </Label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--muted)" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5l3 3" />
                </svg>
                <Input
                  placeholder={translateCurrentLiteral('Search by name')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
                {translateCurrentLiteral('Sort by')}
              </Label>
              <SelectField
                value={sortKey}
                options={[...SORT_OPTIONS].map((option) => ({ ...option, label: translateCurrentLiteral(option.label) }))}
                onValueChange={(value) => setSortKey(value as SortKey)}
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
                {translateCurrentLiteral('Status')}
              </Label>
              <SelectField
                value={statusFilter}
                options={[...STATUS_OPTIONS].map((option) => ({ ...option, label: translateCurrentLiteral(option.label) }))}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              />
            </div>
          </div>

          <DataTable
            caption={lt('Team Monthly Updates')}
            rows={employees}
            getRowKey={(emp) => String(emp.user_id)}
            onRowClick={openMemberDetail}
            zebra
            emptyState={
              <EmptyStateBlock
                title={search || statusFilter !== 'all'
                  ? translateCurrentLiteral('No employees match the current filters.')
                  : `${translateCurrentLiteral('No data for')} ${selectedMonthName} ${year}.`} eyebrow={''}              />
            }
            columns={[
              {
                key: 'identity',
                header: lt('Employee'),
                render: (emp) => (
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar name={emp.user_name} imageUrl={emp.profile_image} />
                    <span className="text-sm font-semibold text-[var(--foreground)]">{emp.user_name}</span>
                  </div>
                ),
              },
              {
                key: 'submitted',
                header: lt('Submitted'),
                render: (emp) => (
                  <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums" data-ui-number="true">
                    {emp.submitted_count}
                  </span>
                ),
              },
              {
                key: 'missing',
                header: lt('Missing'),
                render: (emp) => (
                  <span className="text-sm font-semibold tabular-nums text-rose-300" data-ui-number="true" data-keep-color="true">
                    {emp.missing_count}
                  </span>
                ),
              },
              {
                key: 'completion',
                header: lt('Completion'),
                render: (emp) => <CompletionPill pct={emp.completion_percentage} />,
              },
              {
                key: 'last_update',
                header: lt('Last Update'),
                render: (emp) => (
                  <span className="whitespace-nowrap text-sm text-(--muted-strong)">
                    {emp.last_update_date ? formatShortDate(emp.last_update_date) : '-'}
                  </span>
                ),
              },
              {
                key: 'activity',
                header: lt('Monthly Activity'),
                render: (emp) => (
                  <div className="w-[18rem]">
                    <ActivityStrip employee={emp} month={month} year={year} />
                  </div>
                ),
              },
              {
                key: 'status',
                header: lt('Status'),
                render: (emp) => <TrackBadge pct={emp.completion_percentage} />,
              },
              {
                key: 'actions',
                header: lt('Action'),
                render: (emp) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="whitespace-nowrap rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation()
                      openMemberDetail(emp)
                    }}
                    disabled={!canOpenMemberDetail(emp)}
                  >
                    {translateCurrentLiteral('View Details')}
                  </Button>
                ),
              },
            ]}
          />
        </CardContent>

        {employees.length > 0 && (
          <CardFooter className="flex items-center justify-between bg-(--muted-surface) px-4 py-2.5">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-(--muted)" data-i18n-skip="true" data-activity-legend="true">
              <ActivityLegendItem status="submitted" label="Active month" />
              <ActivityLegendItem status="missing" label="No reports" />
              <ActivityLegendItem status="sunday" label="Weekend / off day" />
              <ActivityLegendItem status="neutral" label="No data" />
              <ActivityLegendItem status="future" label="Future month" />
            </div>
            <p className="text-[11px] text-(--muted)">
              {selectedMonthName} {year}
            </p>
          </CardFooter>
        )}
      </Card>
    </section>
  )
}
