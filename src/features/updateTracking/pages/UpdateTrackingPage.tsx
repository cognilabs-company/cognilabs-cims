import { useMemo, useState, type KeyboardEvent } from 'react'
import { updateTrackingService, type WorkdayOverrideRecord } from '../../../shared/api/services/updateTracking.service'
import type { DayStatus, UpdateTrackingStats } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { getLocalizedMonthName } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader } from '../../../shared/ui/page-header'
import { Progress } from '../../../shared/ui/progress'
import { SectionTitle } from '../../../shared/ui/section-title'
import { SelectField } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'
import { ErrorStateBlock } from '../../../shared/ui/state-block'
import { toneDot, toneSurface, toneText, type Tone } from '../../../shared/ui/tone'

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekdayLongLabelByShortKey: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}
const weekdayFallbacks: Record<string, { uz: string; ru: string }> = {
  Mon: { uz: 'Dus', ru: 'Pn' },
  Tue: { uz: 'Ses', ru: 'Vt' },
  Wed: { uz: 'Cho', ru: 'Sr' },
  Thu: { uz: 'Pay', ru: 'Cht' },
  Fri: { uz: 'Jum', ru: 'Pt' },
  Sat: { uz: 'Sha', ru: 'Sb' },
  Sun: { uz: 'Yak', ru: 'Vs' },
  Monday: { uz: 'Dushanba', ru: 'Ponedelnik' },
  Tuesday: { uz: 'Seshanba', ru: 'Vtornik' },
  Wednesday: { uz: 'Chorshanba', ru: 'Sreda' },
  Thursday: { uz: 'Payshanba', ru: 'Chetverg' },
  Friday: { uz: 'Juma', ru: 'Pyatnitsa' },
  Saturday: { uz: 'Shanba', ru: 'Subbota' },
  Sunday: { uz: 'Yakshanba', ru: 'Voskresenye' },
}
const calendarCollectionKeys = ['calendar', 'days', 'entries', 'items', 'data', 'results']
const recentCollectionKeys = ['updates', 'items', 'results', 'data', 'recent', 'recent_updates', 'entries', 'rows']
const trendCollectionKeys = ['trends', 'months', 'items', 'data', 'results']
const recentTextKeys = ['update_content', 'update_text', 'message', 'text', 'summary', 'description', 'content', 'body', 'note', 'comment', 'remarks', 'title']
const recentDateKeys = ['update_date', 'date', 'created_at', 'submitted_at', 'updated_at', 'timestamp']
const recentIgnoredTextKeys = new Set([
  'id',
  'user_id',
  'user_name',
  'telegram_username',
  'email',
  'status',
  'role',
  'month_name',
])
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

type UnknownRecord = Record<string, unknown>

type CalendarDay = {
  day: number
  date?: string
  status: DayStatus
  updates_count?: number | null
  weekday?: string
  isDayOff?: boolean | null
  hasUpdate?: boolean | null
  updateContent?: string | null
  isValid?: boolean | null
  checkInTime?: string | null
  checkOutTime?: string | null
  workdayOverride?: WorkdayOverrideRecord | null
}

type CalendarData = {
  month: number
  year: number
  days: CalendarDay[]
}

type RecentUpdate = {
  id?: number | string
  update_date?: string
  date?: string
  message?: string
  text?: string
  update_text?: string
  owner_name?: string
  [key: string]: unknown
}

type TrendMonth = {
  month: number
  year: number
  month_name?: string
  submitted_count?: number
  missing_count?: number
  completion_percentage?: number
}

const emptyStats: UpdateTrackingStats = {
  user_id: 0,
  user_name: '',
  total_updates: 0,
  updates_this_week: 0,
  updates_last_week: 0,
  updates_this_month: 0,
  updates_last_month: 0,
  updates_last_3_months: 0,
  percentage_this_week: 0,
  percentage_last_week: 0,
  percentage_this_month: 0,
  percentage_last_3_months: 0,
  expected_updates_per_week: 0,
}

type UpdateTrackingPageData = {
  stats: UpdateTrackingStats
  calendarPayload: unknown
  trendsPayload: unknown
  recentPayload: unknown
  errors: {
    stats: string | null
    calendar: string | null
    trends: string | null
    recent: string | null
  }
}

const updateTrackingPageCache = new Map<string, UpdateTrackingPageData>()

function getUpdateTrackingCacheKey(month: number, year: number) {
  return `${year}-${month}`
}

async function loadUpdateTrackingPageData(month: number, year: number, force = false): Promise<UpdateTrackingPageData> {
  const cacheKey = getUpdateTrackingCacheKey(month, year)

  if (!force) {
    const cached = updateTrackingPageCache.get(cacheKey)

    if (cached) {
      return cached
    }
  }

  const [statsResult, calendarResult, trendsResult, recentResult] = await Promise.allSettled([
    updateTrackingService.myStats(),
    updateTrackingService.calendar(month, year),
    updateTrackingService.trends(),
    updateTrackingService.recent(20),
  ])

  if (
    statsResult.status === 'rejected' &&
    calendarResult.status === 'rejected' &&
    trendsResult.status === 'rejected' &&
    recentResult.status === 'rejected'
  ) {
    throw new Error(getApiErrorMessage(calendarResult.reason))
  }

  const result: UpdateTrackingPageData = {
    stats: statsResult.status === 'fulfilled' ? statsResult.value : emptyStats,
    calendarPayload: calendarResult.status === 'fulfilled' ? calendarResult.value : null,
    trendsPayload: trendsResult.status === 'fulfilled' ? trendsResult.value : null,
    recentPayload: recentResult.status === 'fulfilled' ? recentResult.value : null,
    errors: {
      stats: statsResult.status === 'rejected' ? getApiErrorMessage(statsResult.reason) : null,
      calendar: calendarResult.status === 'rejected' ? getApiErrorMessage(calendarResult.reason) : null,
      trends: trendsResult.status === 'rejected' ? getApiErrorMessage(trendsResult.reason) : null,
      recent: recentResult.status === 'rejected' ? getApiErrorMessage(recentResult.reason) : null,
    },
  }

  updateTrackingPageCache.set(cacheKey, result)
  return result
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

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime())
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateValue(value: string) {
  if (isDateKey(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function formatCalendarWorkTime(value?: string | null) {
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

function getMinutesFromCalendarTime(value?: string | null) {
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

function normalizeOverrideDayType(value: unknown): WorkdayOverrideRecord['day_type'] {
  if (typeof value !== 'string') {
    return 'holiday'
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  return normalized === 'short_day' ? 'short_day' : 'holiday'
}

function findFirstString(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      return source[key] as string
    }
  }

  return undefined
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

function getFirstArray(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[]
    }
  }

  const fallback = Object.values(source).find((value) => Array.isArray(value))
  return Array.isArray(fallback) ? fallback : []
}

function getMonthName(month: number): string {
  return getLocalizedMonthName(month)
}

function getLocalizedWeekdayLabel(key: string) {
  const fallback = weekdayFallbacks[key]

  if (!fallback) {
    return key
  }

  return tr(key, fallback.uz, fallback.ru)
}

function getWeekdayShortKeyFromValue(value?: string | null) {
  const normalized = value?.trim().slice(0, 3).toLowerCase()

  if (!normalized) {
    return null
  }

  const mapping: Record<string, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
    dus: 'Mon',
    ses: 'Tue',
    cho: 'Wed',
    pay: 'Thu',
    jum: 'Fri',
    sha: 'Sat',
    yak: 'Sun',
  }

  return mapping[normalized] ?? null
}

function monthNameToNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]
  const shortMonths = months.map((monthName) => monthName.slice(0, 3))
  const combined = [...months, ...shortMonths]
  const index = combined.findIndex((monthName) => normalized.startsWith(monthName))

  if (index >= 0) {
    return (index % 12) + 1
  }

  return null
}

function getFallbackDayStatus(date: Date): DayStatus {
  if (date.getDay() === 0) {
    return 'sunday'
  }

  if (date > todayStart) {
    return 'future'
  }

  if (date < todayStart) {
    return 'missing'
  }

  return 'neutral'
}

function normalizeDayStatus(
  value: unknown,
  date: Date,
  options?: { isDayOff?: boolean | null },
): DayStatus {
  if (date.getDay() === 0 || options?.isDayOff) {
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
      normalized.includes('sent')
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

    if (normalized.includes('sunday') || normalized.includes('weekend')) {
      return 'sunday'
    }

    if (normalized.includes('future') || normalized.includes('upcoming')) {
      return 'future'
    }

    return fallback
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

function extractCalendarEntries(payload: unknown) {
  const parsed = parsePayload(payload)

  if (Array.isArray(parsed)) {
    return {
      entries: parsed,
      month: undefined as number | undefined,
      year: undefined as number | undefined,
    }
  }

  if (!isRecord(parsed)) {
    return {
      entries: [] as unknown[],
      month: undefined as number | undefined,
      year: undefined as number | undefined,
    }
  }

  const month = toNumber(parsed.month) ?? undefined
  const year = toNumber(parsed.year) ?? undefined
  const entries = getFirstArray(parsed, calendarCollectionKeys)

  if (entries.length > 0) {
    return { entries, month, year }
  }

  return {
    entries: Object.entries(parsed)
      .filter(([key]) => isDateKey(key) || /^\d{1,2}$/.test(key))
      .map(([key, value]) => (isDateKey(key) ? { date: key, status: value } : { day: Number(key), status: value })),
    month,
    year,
  }
}

function toCalendarDay(entry: unknown, selectedMonth: number, selectedYear: number): CalendarDay | null {
  if (!isRecord(entry)) {
    return null
  }

  const dateValue = findFirstString(entry, ['date', 'full_date', 'calendar_date', 'day_date'])
  const numericDay = toNumber(entry.day ?? entry.day_of_month ?? entry.day_number)
  const date = dateValue
    ? new Date(dateValue)
    : numericDay
      ? new Date(selectedYear, selectedMonth - 1, numericDay)
      : null

  if (!date || Number.isNaN(date.getTime())) {
    return null
  }

  if (date.getMonth() + 1 !== selectedMonth || date.getFullYear() !== selectedYear) {
    return null
  }

  const workdayOverride = extractWorkdayOverride(entry)
  const isDayOff = toBoolean(entry.is_day_off ?? entry.day_off) ?? isWorkdayOverrideOffDay(workdayOverride)
  const explicitHasUpdate = toBoolean(entry.has_update ?? entry.has_updates ?? entry.is_submitted ?? entry.submitted)
  const updateContent = findFirstString(entry, recentTextKeys) ?? null
  const updatesCount =
    toNumber(entry.updates_count ?? entry.count ?? entry.total_updates ?? entry.submitted_count) ??
    (explicitHasUpdate === true || Boolean(updateContent) ? 1 : null)
  const normalizedStatus = normalizeDayStatus(
    entry.status ??
      entry.day_status ??
      entry.submission_status ??
      entry.type ??
      entry.is_submitted ??
      entry.submitted ??
      entry.is_missing ??
      entry.missing ??
      entry.is_sunday ??
      entry.sunday ??
      entry.value,
    date,
    { isDayOff },
  )
  const hasUpdate = explicitHasUpdate === true || (updatesCount !== null && updatesCount > 0) || Boolean(updateContent)
  const status = hasUpdate && normalizedStatus !== 'sunday' ? 'submitted' : normalizedStatus

  return {
    day: date.getDate(),
    date: formatDateKey(date),
    status,
    updates_count: updatesCount,
    weekday: findFirstString(entry, ['weekday', 'weekday_name', 'day_name']),
    isDayOff,
    hasUpdate: explicitHasUpdate ?? hasUpdate,
    updateContent,
    isValid: toBoolean(entry.is_valid ?? entry.valid),
    checkInTime: findFirstString(entry, ['check_in_time', 'check_in', 'checkInTime']) ?? null,
    checkOutTime: findFirstString(entry, ['check_out_time', 'check_out', 'checkOutTime']) ?? null,
    workdayOverride,
  }
}

function parseCalendar(data: unknown, selectedMonth: number, selectedYear: number): CalendarData | null {
  const { entries, month, year } = extractCalendarEntries(data)
  const resolvedMonth = month ?? selectedMonth
  const resolvedYear = year ?? selectedYear
  const daysInMonth = new Date(resolvedYear, resolvedMonth, 0).getDate()

  if (entries.length === 0) {
    return null
  }

  const entryMap = new Map(
    entries
      .map((entry) => toCalendarDay(entry, resolvedMonth, resolvedYear))
      .filter((entry): entry is CalendarDay => Boolean(entry))
      .map((entry) => [entry.day, entry]),
  )

  if (entryMap.size === 0) {
    return null
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const currentDate = new Date(resolvedYear, resolvedMonth - 1, day)

    return entryMap.get(day) ?? {
      day,
      date: formatDateKey(currentDate),
      status: getFallbackDayStatus(currentDate),
      updates_count: null,
      weekday: undefined,
      isDayOff: null,
      hasUpdate: null,
      updateContent: null,
      isValid: null,
      checkInTime: null,
      checkOutTime: null,
      workdayOverride: null,
    }
  })

  return {
    month: resolvedMonth,
    year: resolvedYear,
    days,
  }
}

function extractRecentDate(source: UnknownRecord) {
  const directDate = findFirstString(source, recentDateKeys)

  if (directDate && isValidDateString(directDate)) {
    return directDate
  }

  const fallbackDate = Object.values(source).find(
    (value): value is string => typeof value === 'string' && isValidDateString(value),
  )

  return fallbackDate
}

function extractRecentText(source: UnknownRecord) {
  const directText = findFirstString(source, recentTextKeys)

  if (directText) {
    return directText
  }

  const fallbackText = Object.entries(source).find(
    ([key, value]) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !recentIgnoredTextKeys.has(key) &&
      !recentDateKeys.includes(key) &&
      !isValidDateString(value),
  )

  return typeof fallbackText?.[1] === 'string' ? fallbackText[1] : ''
}

function joinRecentNameParts(...parts: Array<string | undefined>) {
  const value = parts.filter(Boolean).join(' ').trim()
  return value || undefined
}

function extractRecentOwner(source: UnknownRecord) {
  const directName = findFirstString(source, [
    'full_name',
    'user_name',
    'employee_name',
    'member_name',
    'display_name',
    'owner_name',
    'author_name',
  ])

  if (directName) {
    return directName
  }

  const nestedSources = [
    isRecord(source.user) ? source.user : null,
    isRecord(source.member) ? source.member : null,
    isRecord(source.employee) ? source.employee : null,
    isRecord(source.author) ? source.author : null,
    isRecord(source.created_by_user) ? source.created_by_user : null,
  ].filter((entry): entry is UnknownRecord => Boolean(entry))

  for (const nestedSource of nestedSources) {
    const nestedName =
      findFirstString(nestedSource, ['full_name', 'user_name', 'employee_name', 'member_name', 'display_name']) ??
      joinRecentNameParts(
        findFirstString(nestedSource, ['name', 'first_name', 'firstName']),
        findFirstString(nestedSource, ['surname', 'last_name', 'lastName']),
      ) ??
      findFirstString(nestedSource, ['telegram_username', 'email'])

    if (nestedName) {
      return nestedName
    }
  }

  return (
    joinRecentNameParts(
      findFirstString(source, ['name', 'first_name', 'firstName']),
      findFirstString(source, ['surname', 'last_name', 'lastName']),
    ) ??
    findFirstString(source, ['telegram_username', 'email'])
  )
}

function normalizeRecentUpdate(source: UnknownRecord, index: number): RecentUpdate {
  return {
    ...source,
    id:
      (typeof source.id === 'number' || typeof source.id === 'string' ? source.id : undefined) ??
      (typeof source.update_id === 'number' || typeof source.update_id === 'string' ? source.update_id : undefined) ??
      (typeof source.uuid === 'string' ? source.uuid : undefined) ??
      index,
    update_date: extractRecentDate(source),
    update_text: extractRecentText(source),
    owner_name: extractRecentOwner(source),
  }
}

function parseRecent(data: unknown): RecentUpdate[] {
  const parsed = parsePayload(data)

  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord).map(normalizeRecentUpdate)
  }

  if (isRecord(parsed)) {
    return getFirstArray(parsed, recentCollectionKeys).filter(isRecord).map(normalizeRecentUpdate)
  }

  return []
}

function normalizeTrend(entry: unknown): TrendMonth | null {
  if (!isRecord(entry)) {
    return null
  }

  const month =
    toNumber(entry.month ?? entry.month_number ?? entry.month_index) ??
    (typeof entry.month_name === 'string' ? monthNameToNumber(entry.month_name) : null)
  const year = toNumber(entry.year ?? entry.trend_year) ?? now.getFullYear()
  const submittedCount = toNumber(entry.submitted_count ?? entry.submitted ?? entry.total_submitted ?? entry.updates_count)
  const missingCount = toNumber(entry.missing_count ?? entry.missing ?? entry.total_missing)
  const rawCompletion =
    toNumber(entry.completion_percentage ?? entry.completion_rate ?? entry.percentage ?? entry.percent ?? entry.avg_percentage)
  const completion =
    rawCompletion !== null
      ? rawCompletion <= 1 ? rawCompletion * 100 : rawCompletion
      : submittedCount !== null && missingCount !== null && submittedCount + missingCount > 0
        ? (submittedCount / (submittedCount + missingCount)) * 100
        : 0

  if (!month || month < 1 || month > 12) {
    return null
  }

  return {
    month,
    year,
    month_name: typeof entry.month_name === 'string' ? entry.month_name : undefined,
    submitted_count: submittedCount ?? undefined,
    missing_count: missingCount ?? undefined,
    completion_percentage: completion,
  }
}

function parseTrends(data: unknown): TrendMonth[] {
  const parsed = parsePayload(data)
  const entries = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? getFirstArray(parsed, trendCollectionKeys)
      : []

  return entries
    .map(normalizeTrend)
    .filter((entry): entry is TrendMonth => Boolean(entry))
    .sort((left, right) => left.year - right.year || left.month - right.month)
}

function formatRecentDate(value?: string) {
  if (!value || !isValidDateString(value)) {
    return ''
  }

  const parsed = new Date(value)

  return `${getMonthName(parsed.getMonth() + 1)} ${parsed.getDate()}`
}

function getCalendarCounts(calendar: CalendarData | null) {
  if (!calendar) {
    return { submitted: 0, missing: 0, offDay: 0, holiday: 0, upcoming: 0, open: 0 }
  }

  return calendar.days.reduce(
    (counts, day) => {
      if (day.status === 'submitted') {
        counts.submitted += 1
      } else if (day.status === 'missing') {
        counts.missing += 1
      } else if (day.status === 'sunday') {
        if (isHolidayCalendarDay(day)) {
          counts.holiday += 1
        } else {
          counts.offDay += 1
        }
      } else if (day.status === 'future') {
        counts.upcoming += 1
      } else if (day.status === 'neutral') {
        counts.open += 1
      }

      return counts
    },
    { submitted: 0, missing: 0, offDay: 0, holiday: 0, upcoming: 0, open: 0 },
  )
}

function getSelectedCalendarDay(calendar: CalendarData | null, selectedDate: string | null) {
  if (!calendar || calendar.days.length === 0) {
    return null
  }

  if (selectedDate) {
    const matchedDay = calendar.days.find((day) => day.date === selectedDate)
    if (matchedDay) {
      return matchedDay
    }
  }

  const todayKey = formatDateKey(todayStart)

  return (
    calendar.days.find((day) => day.date === todayKey) ??
    calendar.days.find((day) => day.updateContent?.trim()) ??
    calendar.days.find((day) => day.status === 'submitted') ??
    calendar.days.find((day) => day.status === 'missing') ??
    calendar.days[0] ??
    null
  )
}

function formatCalendarDayLabel(day: CalendarDay | null) {
  if (!day?.date) {
    return ''
  }

  const parsedDate = parseDateValue(day.date)

  if (Number.isNaN(parsedDate.getTime())) {
    return day.date
  }

  const weekdayName = getLocalizedWeekdayLabel(weekdayLongLabelByShortKey[weekdayLabels[(parsedDate.getDay() + 6) % 7]] ?? 'Monday')
  const monthName = getMonthName(parsedDate.getMonth() + 1)
  const dateLabel = `${parsedDate.getDate()} ${monthName} ${parsedDate.getFullYear()}`

  if (getIntlLocale().startsWith('en')) {
    return `${weekdayName}, ${monthName} ${parsedDate.getDate()}, ${parsedDate.getFullYear()}`
  }

  return `${dateLabel}, ${weekdayName}`
}

function getSpecialDayLabel(day: CalendarDay | null | undefined) {
  if (!day?.workdayOverride) {
    return null
  }

  return day.workdayOverride.day_type === 'short_day'
    ? tr('Short Day', 'Qisqa kun', 'Korotkiy den')
    : tr('Holiday', 'Bayram', 'Prazdnik')
}

function isHolidayCalendarDay(day: CalendarDay | null | undefined) {
  return day?.status === 'sunday' && day.workdayOverride?.day_type === 'holiday'
}

function getCalendarDayTone(day: CalendarDay | null | undefined): Tone {
  if (!day) {
    return 'neutral'
  }

  if (isHolidayCalendarDay(day)) {
    return 'blue'
  }

  return dayStatusTone[day.status]
}

function getCalendarStatusLabel(status: DayStatus, day?: CalendarDay | null) {
  const specialLabel = getSpecialDayLabel(day)

  if (status === 'submitted') return tr('Submitted', 'Topshirildi', 'Otpravleno')
  if (status === 'missing') return tr('Missing', 'Yetishmaydi', 'Propushcheno')
  if (status === 'sunday') return specialLabel ?? tr('Off Day', 'Dam olish kuni', 'Vyhodnoi den')
  if (status === 'future') return tr('Upcoming', 'Yaqinlashmoqda', 'Skoro')
  return tr('No status', 'Holat yoq', 'Statusa net')
}

function getCalendarStatusVariant(status: DayStatus, day?: CalendarDay | null) {
  if (status === 'submitted') return 'success'
  if (status === 'missing') return 'danger'
  if (isHolidayCalendarDay(day)) return 'blue'
  if (status === 'sunday') return 'warning'
  return 'secondary'
}

function getCalendarDetailText(day: CalendarDay | null) {
  const content = day?.updateContent?.trim()

  if (content) {
    return content
  }

  if (!day) {
    return tr(
      'Select a calendar day to inspect the update returned by the API.',
      'API qaytargan update ni korish uchun kalendardan bir kunni tanlang.',
      'Vyberite den v kalendare, chtoby proverit obnovlenie, vozvrashchennoe API.',
    )
  }

  if (day.workdayOverride) {
    const specialLabel = getSpecialDayLabel(day)
    return day.workdayOverride.note?.trim() || day.workdayOverride.title?.trim() || `${specialLabel ?? tr('Special day', 'Maxsus kun', 'Osobyy den')} ${tr('is configured for this date.', 'bu sana uchun sozlangan.', 'nastroen dlya etoy daty.')}`
  }

  if (day.status === 'missing') {
    return tr('No update was submitted for this working day.', 'Bu ish kuni uchun update yuborilmagan.', 'Dlya etogo rabochego dnya obnovlenie ne bylo otpravleno.')
  }

  if (day.status === 'sunday') {
    return isHolidayCalendarDay(day)
      ? tr('This date is marked as a holiday.', 'Bu sana bayram kuni deb belgilangan.', 'Eta data otmechena kak prazdnichnyy den.')
      : tr('This date is an off day.', 'Bu sana dam olish kuni.', 'Eta data yavlyaetsya vyhodnym dnem.')
  }

  if (day.status === 'future') {
    return tr('This date is still in the future.', 'Bu sana hali kelajakda.', 'Eta data vse eshche v budushchem.')
  }

  return tr(
    'No update content was returned by the API for this date.',
    'Bu sana uchun API update kontentini qaytarmadi.',
    'API ne vernulo soderzhimoe obnovleniya dlya etoy daty.',
  )
}

function getCalendarCellStatusLabel(status: DayStatus, day?: CalendarDay | null) {
  const specialLabel = getSpecialDayLabel(day)

  if (status === 'submitted') return tr('Updated', 'Yangilangan', 'Obnovleno')
  if (status === 'missing') return tr('Missed', 'Otib yuborilgan', 'Propushcheno')
  if (status === 'sunday') return specialLabel ?? tr('Off Day', 'Dam olish kuni', 'Vyhodnoi den')
  if (status === 'future') return tr('Soon', 'Yaqinda', 'Skoro')
  return tr('Open', 'Ochiq', 'Otkryto')
}

function getCalendarShortWeekday(day: CalendarDay) {
  const parsedDate = day.date ? parseDateValue(day.date) : null
  const weekdayKey = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? weekdayLabels[(parsedDate.getDay() + 6) % 7]
    : getWeekdayShortKeyFromValue(day.weekday)

  return weekdayKey ? getLocalizedWeekdayLabel(weekdayKey) : ''
}

function getCalendarBoardWeekday(day: CalendarDay) {
  return getCalendarShortWeekday(day).toUpperCase()
}

function getCalendarLongWeekday(day: CalendarDay) {
  const parsedDate = day.date ? parseDateValue(day.date) : null
  const weekdayKey = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? weekdayLabels[(parsedDate.getDay() + 6) % 7]
    : getWeekdayShortKeyFromValue(day.weekday)

  if (!weekdayKey) {
    return day.weekday?.trim() ?? ''
  }

  return getLocalizedWeekdayLabel(weekdayLongLabelByShortKey[weekdayKey] ?? weekdayKey)
}

function getCalendarEntryCount(day: CalendarDay) {
  return day.updates_count ?? (day.hasUpdate ? 1 : 0)
}

function getCalendarCellHint(day: CalendarDay) {
  if (day.hasUpdate) {
    if ((day.updates_count ?? 0) > 1) {
      return `${day.updates_count} ${tr('updates captured', 'ta yangilanish qayd etildi', 'obnovleniy zafiksirovano')}`
    }

    return tr('Update captured', 'Yangilanish qayd etilgan', 'Obnovlenie zafiksirovano')
  }

  if (day.workdayOverride) {
    return day.workdayOverride.note?.trim() || day.workdayOverride.title?.trim() || getSpecialDayLabel(day) || tr('Special day', 'Maxsus kun', 'Osobyy den')
  }

  if (day.status === 'missing') {
    return tr('Needs submission', 'Yuborish kerak', 'Nuzhna otpravka')
  }

  if (day.status === 'sunday') {
    return isHolidayCalendarDay(day)
      ? tr('Holiday schedule', 'Bayram jadvali', 'Prazdnichnyy grafik')
      : tr('Weekend / off day', 'Dam olish / ish bolmagan kun', 'Vyhodnoy / nerabochiy den')
  }

  if (day.status === 'future') {
    return tr('Awaiting date', 'Sana kutilmoqda', 'Ozhidanie daty')
  }

  return tr('No update yet', 'Hali update yoq', 'Obnovleniya poka net')
}

function shouldShowCalendarTimePanel(day: CalendarDay) {
  return day.hasUpdate || Boolean(day.checkInTime) || Boolean(day.checkOutTime)
}

function getCalendarWorkedDurationLabel(day: CalendarDay) {
  const checkInMinutes = getMinutesFromCalendarTime(day.checkInTime)
  const checkOutMinutes = getMinutesFromCalendarTime(day.checkOutTime)

  if (checkInMinutes === null || checkOutMinutes === null || checkOutMinutes < checkInMinutes) {
    return tr('Hours not returned', 'Ish soatlari qaytmadi', 'Chasy raboty ne vernulis')
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

function shiftCalendarMonth(month: number, year: number, delta: number) {
  const nextDate = new Date(year, month - 1 + delta, 1)

  return {
    month: nextDate.getMonth() + 1,
    year: nextDate.getFullYear(),
  }
}

const dayStatusTone: Record<DayStatus, Tone> = {
  submitted: 'success',
  missing:   'danger',
  sunday:    'warning',
  future:    'neutral',
  neutral:   'neutral',
}

function getCompletionTone(pct: number): Tone {
  if (pct >= 90) {
    return 'success'
  }

  if (pct >= 75) {
    return 'warning'
  }

  return 'danger'
}

function clampYear(value: number) {
  if (!Number.isFinite(value)) {
    return now.getFullYear()
  }

  return Math.min(2035, Math.max(2020, Math.round(value)))
}

export function UpdateTrackingPage() {
  const locale = getIntlLocale()
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: getMonthName(index + 1),
    })),
    [locale],
  )
  const { showToast } = useToast()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [yearInput, setYearInput] = useState(String(now.getFullYear()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const todayKey = formatDateKey(todayStart)
  const cacheKey = getUpdateTrackingCacheKey(month, year)
  const cachedPageData = updateTrackingPageCache.get(cacheKey)
  const pageQuery = useAsyncData(
    () => loadUpdateTrackingPageData(month, year),
    [month, year],
    { initialData: cachedPageData },
  )

  const stats = pageQuery.data?.stats ?? emptyStats
  const calendar = useMemo(
    () => parseCalendar(pageQuery.data?.calendarPayload, month, year),
    [month, pageQuery.data?.calendarPayload, year],
  )
  const trends = useMemo(() => parseTrends(pageQuery.data?.trendsPayload), [pageQuery.data?.trendsPayload])
  const recent = useMemo(() => parseRecent(pageQuery.data?.recentPayload), [pageQuery.data?.recentPayload])
  const calendarCounts = useMemo(() => getCalendarCounts(calendar), [calendar])
  const selectedCalendarDay = useMemo(() => getSelectedCalendarDay(calendar, selectedDate), [calendar, selectedDate])
  const selectedCalendarDayLabel = useMemo(() => formatCalendarDayLabel(selectedCalendarDay), [selectedCalendarDay])
  const latestSubmittedDay = useMemo(() => (
    calendar?.days
      .slice()
      .reverse()
      .find((day) => day.status === 'submitted') ?? null
  ), [calendar])
  const nextUpcomingDay = useMemo(() => calendar?.days.find((day) => day.status === 'future') ?? null, [calendar])

  async function handleRefresh() {
    try {
      const nextData = await loadUpdateTrackingPageData(month, year, true)
      pageQuery.setData(nextData)
      showToast({
        title: tr('Refreshed', 'Yangilandi', 'Obnovleno'),
        description: tr('Your update data has been reloaded.', 'Update malumotlaringiz qayta yuklandi.', 'Vashi dannye obnovleniy byli perezagruzheny.'),
        tone: 'success',
      })
    } catch (error) {
      showToast({ title: tr('Refresh failed', 'Yangilash muvaffaqiyatsiz tugadi', 'Obnovlenie ne udalos'), description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  function applyYearInput() {
    const nextYear = clampYear(Number(yearInput))
    setYearInput(String(nextYear))

    if (nextYear !== year) {
      setYear(nextYear)
      setSelectedDate(null)
    }
  }

  function handleYearKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      applyYearInput()
    }
  }

  function handleMonthChange(nextMonth: number) {
    if (nextMonth === month) {
      return
    }

    setMonth(nextMonth)
    setSelectedDate(null)
  }

  function handleMonthShift(delta: number) {
    const nextPeriod = shiftCalendarMonth(month, year, delta)
    setMonth(nextPeriod.month)
    setYear(nextPeriod.year)
    setYearInput(String(nextPeriod.year))
    setSelectedDate(null)
  }

  function handleJumpToToday() {
    setMonth(todayStart.getMonth() + 1)
    setYear(todayStart.getFullYear())
    setYearInput(String(todayStart.getFullYear()))
    setSelectedDate(todayKey)
  }

  if (pageQuery.isError && !pageQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={tr('Updates', 'Yangilanishlar', 'Obnovleniya')}
        title={tr('Updates unavailable', 'Yangilanishlar mavjud emas', 'Obnovleniya nedostupny')}
        description={tr('Could not load your update statistics.', 'Update statistikangizni yuklab bolmadi.', 'Ne udalos zagruzit statistiku obnovleniy.')}
        actionLabel={tr('Retry', 'Qayta urinish', 'Povtorit')}
        onAction={() => void pageQuery.refetch()}
      />
    )
  }

  const monthlyPct = stats?.percentage_this_month ?? 0
  const weeklyPct = stats?.percentage_this_week ?? 0
  const selectedMonthName = getMonthName(month)
  const firstDayOffset = calendar
    ? (new Date(calendar.year, calendar.month - 1, 1).getDay() + 6) % 7
    : 0
  const calendarCells = calendar
    ? [...Array.from<null>({ length: firstDayOffset }).fill(null), ...calendar.days]
    : []
  const calendarWeeks = Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, index) => (
    calendarCells.slice(index * 7, index * 7 + 7)
  ))
  const elapsedWorkingDays = calendarCounts.submitted + calendarCounts.missing
  const attentionDaysCount = calendarCounts.missing + calendarCounts.open
  const monthProgressPct = elapsedWorkingDays > 0
    ? (calendarCounts.submitted / elapsedWorkingDays) * 100
    : 0
  const shouldShowFocusContent = Boolean(
    selectedCalendarDay?.hasUpdate ||
    selectedCalendarDay?.updateContent?.trim() ||
    selectedCalendarDay?.workdayOverride,
  )
  const focusDayTone = getCalendarDayTone(selectedCalendarDay)

  return (
    <section className="page-enter space-y-[18px]">
      <PageHeader
        eyebrow={tr('Personal', 'Shaxsiy', 'Lichnoye')}
        title={tr('My Updates', 'Mening update larim', 'Moi obnovleniya')}
        description={tr(
          'Track your daily update submissions and performance.',
          'Kunlik update yuborishlaringiz va samaradorligingizni kuzating.',
          'Otslezhivayte ezhednevnye otpravki obnovleniy i effektivnost.',
        )}
        actions={(
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12.5px] text-[var(--muted)]">{tr('Year', 'Yil', 'God')}</Label>
              <Input
                type="number"
                min="2020"
                max="2035"
                value={yearInput}
                onChange={(event) => setYearInput(event.target.value)}
                onBlur={applyYearInput}
                onKeyDown={handleYearKeyDown}
                className="w-[108px] tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[12.5px] text-[var(--muted)]">{tr('Month', 'Oy', 'Mesyats')}</Label>
              <SelectField
                value={String(month)}
                options={monthOptions.map(({ value, label }) => ({ value: String(value), label }))}
                onValueChange={(nextMonth) => handleMonthChange(Number(nextMonth))}
                className="w-[168px]"
              />
            </div>

            <Button
              variant="secondary"
              onClick={() => void handleRefresh()}
              leftIcon={(
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1.5 8a6.5 6.5 0 1 1 1.2 3.8" />
                  <path d="M1.5 12.5V8.5h4" />
                </svg>
              )}
            >
              {tr('Refresh', 'Yangilash', 'Obnovit')}
            </Button>
          </div>
        )}
      />

      {pageQuery.data?.errors.stats ? (
        <Alert tone="warning">
          {tr(
            'Stats API unavailable. Calendar and other sections continue loading independently.',
            'Stats API mavjud emas. Kalendar va boshqa bolimlar mustaqil yuklanishda davom etadi.',
            'Stats API nedostupen. Kalendar i drugie razdely prodolzhayut zagruzhatsya otdelno.',
          )}
        </Alert>
      ) : null}

      <div className="stagger-children grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          solid
          iconTone="violet"
          label={tr('Monthly Completion', 'Oylik bajarilish', 'Mesyachnoe vypolnenie')}
          value={`${monthlyPct.toFixed(1)}%`}
          footer={<Progress value={monthlyPct} tone="lime" size="xs" onInverse className="mt-1" />}
          icon={(
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10a8 8 0 1 1 16 0" />
              <path d="M10 10V4" />
              <path d="M10 10l4 2.5" />
            </svg>
          )}
        />
        <StatCard
          iconTone={weeklyPct >= 80 ? 'success' : weeklyPct >= 50 ? 'warning' : 'neutral'}
          label={tr('Weekly Completion', 'Haftalik bajarilish', 'Nedelnoye vypolnenie')}
          value={`${weeklyPct.toFixed(1)}%`}
          footer={<Progress value={weeklyPct} tone={getCompletionTone(weeklyPct)} size="xs" className="mt-1" />}
          icon={(
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="16" height="14" rx="2" />
              <path d="M7 3v14M13 3v14M2 9h16M2 13h16" />
            </svg>
          )}
        />
        <StatCard
          iconTone="blue"
          label={tr('Updates This Month', 'Bu oydagi update lar', 'Obnovleniya za etot mesyats')}
          value={stats?.updates_this_month ?? 0}
          icon={(
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <path d="m6.5 10 2.5 2.5 4.5-4.5" />
            </svg>
          )}
        />
        <StatCard
          iconTone="lime"
          label={tr('Updates This Week', 'Bu haftadagi update lar', 'Obnovleniya za etu nedelyu')}
          value={stats?.updates_this_week ?? 0}
          icon={(
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 15 7 8 11 12 15 6 18 9" />
            </svg>
          )}
        />
      </div>

      {trends.length > 0 && (
        <Card className="space-y-4">
          <SectionTitle title={tr('Performance Trends', 'Samaradorlik trendlari', 'Trendy effektivnosti')} />
          <div className="space-y-3.5">
            {trends.slice(-6).map((trend) => {
              const pct = trend.completion_percentage ?? 0
              const label = trend.month_name ?? `${getMonthName(trend.month)} ${trend.year}`
              const trendTone = getCompletionTone(pct)

              return (
                <div key={`${trend.year}-${trend.month}`} className="space-y-2">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium text-[var(--muted-strong)]">{label}</span>
                    <span className={cn('font-semibold tabular-nums', toneText[trendTone])}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={pct} tone={trendTone} size="xs" />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="space-y-[18px]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionTitle
            title={`${selectedMonthName} ${year} ${tr('Calendar', 'Kalendar', 'Kalendary')}`}
            description={tr(
              'Reference-driven monthly board with dense day cards, week rails, and one-click inspection.',
              'Referensga asoslangan oylik taxta: zich kun kartalari, hafta yolaklari va bir bosishda korish.',
              'Mesyachnaya doska po referensu s plotnymi kartami dnei, liniyami nedel i proverkoj v odin klik.',
            )}
          />

          <div className="grid w-fit shrink-0 grid-cols-[44px_auto_44px] items-center gap-1.5 rounded-[18px] bg-[var(--accent-soft)] p-1.5">
            <Button
              variant="ghost"
              onClick={() => handleMonthShift(-1)}
              className="w-11 rounded-[14px] px-0 hover:bg-[var(--card)]"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3.5 5.5 8 10 12.5" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              onClick={handleJumpToToday}
              className="rounded-[14px] px-5 text-[var(--foreground)] hover:bg-[var(--card)]"
            >
              {selectedMonthName} {year}
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleMonthShift(1)}
              className="w-11 rounded-[14px] px-0 hover:bg-[var(--card)]"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </Button>
          </div>
        </div>

        {calendar ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" dot>{calendarCounts.submitted} {tr('submitted', 'topshirildi', 'otpravleno')}</Badge>
            <Badge variant="danger" dot>{calendarCounts.missing} {tr('missing', 'yetishmadi', 'propushcheno')}</Badge>
            {calendarCounts.open > 0 ? (
              <Badge variant="secondary">{calendarCounts.open} {tr('open', 'ochiq', 'otkryto')}</Badge>
            ) : null}
            {calendarCounts.holiday > 0 ? (
              <Badge variant="blue" dot>{calendarCounts.holiday} {tr('holidays', 'bayramlar', 'prazdniki')}</Badge>
            ) : null}
            <Badge variant="warning" dot>{calendarCounts.offDay} {tr('off days', 'dam olish kunlari', 'vyhodnye dni')}</Badge>
            {calendarCounts.upcoming > 0 ? (
              <Badge variant="secondary">{calendarCounts.upcoming} {tr('upcoming', 'yaqinlashmoqda', 'skoro')}</Badge>
            ) : null}
          </div>
        ) : null}

        {pageQuery.isLoading && !calendar ? (
          <div className="rounded-[18px] bg-[var(--muted-surface)] py-12 text-center text-sm text-[var(--muted)]">
            {tr('Loading calendar...', 'Kalendar yuklanmoqda...', 'Kalendar zagruzhaetsya...')}
          </div>
        ) : !calendar ? (
          <div className="rounded-[18px] bg-[var(--muted-surface)] py-12 text-center text-sm text-[var(--muted)]">
            {tr('No calendar data for this period.', 'Bu davr uchun kalendar malumoti yoq.', 'Dlya etogo perioda net dannykh kalendarya.')}
          </div>
        ) : (
          <>
            <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-xl">
                  <p className="ui-eyebrow">
                    {tr('Calendar System', 'Kalendar tizimi', 'Sistema kalendarya')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--foreground)]">
                      {selectedMonthName} {year}
                    </h3>
                    <Badge variant="violet">
                      {monthProgressPct.toFixed(0)}{tr('% pace', '% temp', '% temp')}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--muted)]">
                    {tr(
                      'Dense monthly board for fast scanning, modeled after the reference calendar layout.',
                      'Tez korib chiqish uchun zich oylik taxta, referens kalendar asosida tuzilgan.',
                      'Plotnaya mesyachnaya doska dlya bystrogo prosmotra, postroennaya po etalonnomu kalendaryu.',
                    )}
                  </p>
                </div>

                <div className="w-full shrink-0 rounded-[14px] bg-[var(--success-dim)] p-3.5 xl:max-w-[290px]">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--success-text)] uppercase">
                    {tr('Completion To Date', 'Shu kungacha bajarilish', 'Vypolnenie na segodnyashniy den')}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--muted-strong)]">
                    {elapsedWorkingDays > 0
                      ? `${calendarCounts.submitted} ${tr('of', 'dan', 'iz')} ${elapsedWorkingDays} ${tr('completed workdays updated.', 'bajarilgan ish kunlari yangilandi.', 'zavershennykh rabochikh dney obnovleno.')}`
                      : tr('No completed workdays yet.', 'Hali bajarilgan ish kunlari yoq.', 'Zavershennykh rabochikh dney poka net.')}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11.5px] font-semibold text-[var(--success-text)] tabular-nums">
                    <span>{calendarCounts.submitted}/{elapsedWorkingDays || 0}</span>
                    <span>{monthProgressPct.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={monthProgressPct}
                    tone={getCompletionTone(monthProgressPct)}
                    size="xs"
                    className="mt-1.5 bg-[var(--card)]"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Badge variant="success" dot className="w-full justify-start sm:w-auto">
                  {calendarCounts.submitted} {tr('updated', 'yangilandi', 'obnovleno')}
                </Badge>
                <Badge variant="danger" dot className="w-full justify-start sm:w-auto">
                  {calendarCounts.missing} {tr('missed', 'otkazib yuborildi', 'propushcheno')}
                </Badge>
                <Badge variant="secondary" className="w-full justify-start sm:w-auto">
                  {attentionDaysCount} {tr('attention', 'etibor', 'vnimanie')}
                </Badge>
                <Badge variant="secondary" className="col-span-2 w-full justify-start sm:col-span-1 sm:w-auto">
                  <span className="truncate">
                    {tr('Next', 'Keyingi', 'Sleduyushchiy')}:{' '}
                    {nextUpcomingDay
                      ? `${getCalendarShortWeekday(nextUpcomingDay)} ${nextUpcomingDay.day}`
                      : latestSubmittedDay
                        ? `${getCalendarShortWeekday(latestSubmittedDay)} ${latestSubmittedDay.day}`
                        : tr('None', 'Yoq', 'Net')}
                  </span>
                </Badge>
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
                      {getLocalizedWeekdayLabel(label)}
                    </div>
                  ))}
                </div>

                <div className="mt-2 space-y-2">
                  {calendarWeeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex + 1}`} className="grid grid-cols-7 gap-2">
                      {week.map((day, dayIndex) => {
                        if (!day) {
                          return (
                            <div
                              key={`empty-${weekIndex}-${dayIndex}`}
                              className="min-h-[148px] rounded-[18px] bg-[var(--border-subtle)]"
                              aria-hidden="true"
                            />
                          )
                        }

                        const entryCount = getCalendarEntryCount(day)
                        const isSelected = selectedCalendarDay?.date === day.date
                        const isToday = day.date === todayKey
                        const dayTone = getCalendarDayTone(day)

                        return (
                          <button
                            key={day.date ?? `${weekIndex}-${dayIndex}`}
                            type="button"
                            onClick={() => setSelectedDate(day.date ?? null)}
                            aria-pressed={isSelected}
                            className={cn(
                              'relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-[18px] p-3 text-left transition-shadow duration-200',
                              toneSurface[dayTone],
                              isSelected
                                ? 'ring-2 ring-[var(--violet-text)] ring-offset-2 ring-offset-[var(--card)]'
                                : 'ring-1 ring-transparent hover:ring-[var(--border-hover)]',
                              isToday && !isSelected && 'ring-[var(--blue-border)]',
                            )}
                            title={`${isSelected ? `${tr('Selected', 'Tanlangan', 'Vybran')}: ` : ''}${formatCalendarDayLabel(day) || `${tr('Day', 'Kun', 'Den')} ${day.day}`}: ${getCalendarStatusLabel(day.status, day)}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--muted)]">
                                  {getCalendarBoardWeekday(day)}
                                </p>
                                <p className="mt-1 text-[26px] leading-none font-bold tracking-[-0.03em] text-[var(--foreground)] tabular-nums">
                                  {day.day}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5">
                                {entryCount > 0 ? (
                                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted-strong)] tabular-nums">
                                    {entryCount}x
                                  </span>
                                ) : null}
                                {isToday ? (
                                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--blue-dim)]">
                                    <span className="h-2 w-2 rounded-full bg-[var(--blue-text)]" />
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {shouldShowCalendarTimePanel(day) ? (
                              <div className="mt-2.5 space-y-1.5">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="rounded-[11px] bg-[var(--card)] px-2 py-1.5">
                                    <p className="text-[10.5px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">
                                      {tr('In', 'Kirish', 'Vkhod')}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--foreground)] tabular-nums">
                                      {formatCalendarWorkTime(day.checkInTime)}
                                    </p>
                                  </div>
                                  <div className="rounded-[11px] bg-[var(--card)] px-2 py-1.5">
                                    <p className="text-[10.5px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">
                                      {tr('Out', 'Chiqish', 'Vykhod')}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--foreground)] tabular-nums">
                                      {formatCalendarWorkTime(day.checkOutTime)}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-[11px] font-medium text-[var(--muted-strong)]">
                                  {getCalendarWorkedDurationLabel(day)}
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-auto pt-2.5">
                              <span className={cn(
                                'inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold',
                                toneText[dayTone],
                              )}>
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[dayTone])} />
                                {getCalendarCellStatusLabel(day.status, day)}
                              </span>
                              <p className="mt-1.5 text-[11.5px] leading-[1.35] text-[var(--muted-strong)]">
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

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--violet-text)]" />
                {tr('Selected', 'Tanlangan', 'Vybran')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--blue-text)]" />
                {tr('Today', 'Bugun', 'Segodnya')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px] bg-[var(--success-text)]" />
                {tr('Updated', 'Yangilangan', 'Obnovleno')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px] bg-[var(--danger-text)]" />
                {tr('Missed', 'Otib yuborilgan', 'Propushcheno')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px] bg-[var(--border-hover)]" />
                {tr('Open or upcoming', 'Ochiq yoki yaqinlashayotgan', 'Otkryto ili skoro')}
              </span>
            </div>

            <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'grid h-16 w-16 shrink-0 place-items-center rounded-[18px] text-[26px] font-bold tracking-[-0.03em] tabular-nums',
                      toneSurface[focusDayTone],
                      toneText[focusDayTone],
                    )}
                  >
                    {selectedCalendarDay?.day ?? '--'}
                  </div>

                  <div className="min-w-0">
                    <p className="ui-eyebrow">
                      {tr('Focus Day', 'Fokus kuni', 'Fokusnyy den')}
                    </p>
                    <h4 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                      {selectedCalendarDayLabel || tr('No date selected', 'Sana tanlanmagan', 'Data ne vybrana')}
                    </h4>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-[1.6] text-[var(--muted)]">
                      {selectedCalendarDay ? getCalendarCellHint(selectedCalendarDay) : tr('Pick a date from the month grid to inspect details.', 'Tafsilotlarni korish uchun oy setkasidan sana tanlang.', 'Vyberite datu iz setki mesyatsa, chtoby posmotret detali.')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCalendarDay ? (
                        <Badge variant={getCalendarStatusVariant(selectedCalendarDay.status, selectedCalendarDay)} dot>
                          {getCalendarStatusLabel(selectedCalendarDay.status, selectedCalendarDay)}
                        </Badge>
                      ) : null}
                      {selectedCalendarDay ? (
                        <Badge variant="secondary">{getCalendarLongWeekday(selectedCalendarDay)}</Badge>
                      ) : null}
                      {selectedCalendarDay?.date === todayKey ? (
                        <Badge variant="blue">{tr('Today', 'Bugun', 'Segodnya')}</Badge>
                      ) : null}
                      {selectedCalendarDay?.hasUpdate ? (
                        <Badge variant="violet">{tr('Payload available', 'Payload mavjud', 'Payload dostupen')}</Badge>
                      ) : null}
                      {isHolidayCalendarDay(selectedCalendarDay) ? (
                        <Badge variant="blue">{tr('Holiday', 'Bayram', 'Prazdnik')}</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[420px] xl:max-w-[480px]">
                  <div className="rounded-[14px] bg-[var(--card)] px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">
                      {tr('Status', 'Holat', 'Status')}
                    </p>
                    <p className="mt-1.5 text-[13px] font-semibold text-[var(--foreground)]">
                      {selectedCalendarDay ? getCalendarStatusLabel(selectedCalendarDay.status, selectedCalendarDay) : tr('N/A', 'Mavjud emas', 'N/A')}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[var(--card)] px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">
                      {tr('Submission', 'Yuborish', 'Otpravka')}
                    </p>
                    <p className="mt-1.5 text-[13px] font-semibold text-[var(--foreground)]">
                      {selectedCalendarDay?.hasUpdate ? tr('Available', 'Mavjud', 'Dostupno') : tr('None', 'Yoq', 'Net')}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[var(--card)] px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">
                      {tr('Validation', 'Validatsiya', 'Validatsiya')}
                    </p>
                    <p className={cn(
                      'mt-1.5 text-[13px] font-semibold',
                      selectedCalendarDay?.isValid === false
                        ? 'text-[var(--warning-text)]'
                        : selectedCalendarDay?.isValid === true
                          ? 'text-[var(--success-text)]'
                          : 'text-[var(--foreground)]',
                    )}>
                      {selectedCalendarDay?.isValid === false ? tr('Needs review', 'Korib chiqish kerak', 'Trebuet proverki') : selectedCalendarDay?.isValid === true ? tr('Valid', 'Valid', 'Validno') : tr('N/A', 'Mavjud emas', 'N/A')}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[var(--card)] px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--caption)] uppercase">
                      {tr('Entries', 'Yozuvlar', 'Zapisi')}
                    </p>
                    <p className="mt-1.5 text-[13px] font-semibold text-[var(--foreground)] tabular-nums">
                      {selectedCalendarDay ? getCalendarEntryCount(selectedCalendarDay) : 0}
                    </p>
                  </div>
                </div>
              </div>

              {shouldShowFocusContent ? (
                <div className="mt-[18px] rounded-[18px] bg-[var(--card)] p-[18px]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="ui-eyebrow">
                        {selectedCalendarDay?.hasUpdate
                          ? tr('Update Content', 'Update kontenti', 'Kontent obnovleniya')
                          : tr('Special Day', 'Maxsus kun', 'Osobyy den')}
                      </p>
                      <h4 className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                        {selectedCalendarDay?.hasUpdate
                          ? tr('Returned content for this date', 'Bu sana uchun qaytgan kontent', 'Vozvrashchennyy kontent dlya etoy daty')
                          : tr('Details for this date', 'Bu sana uchun tafsilotlar', 'Detali dlya etoy daty')}
                      </h4>
                    </div>
                    {selectedCalendarDay?.hasUpdate ? (
                      <Badge variant="blue">{tr('API payload', 'API payload', 'API payload')}</Badge>
                    ) : selectedCalendarDay?.workdayOverride ? (
                      <Badge variant={isHolidayCalendarDay(selectedCalendarDay) ? 'blue' : 'warning'}>
                        {getSpecialDayLabel(selectedCalendarDay) ?? tr('Special day', 'Maxsus kun', 'Osobyy den')}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 max-h-[320px] overflow-y-auto rounded-[14px] bg-[var(--muted-surface)] p-4">
                    <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-[var(--foreground)]">
                      {getCalendarDetailText(selectedCalendarDay)}
                    </p>
                  </div>

                  {selectedCalendarDay?.isValid === false ? (
                    <p className="mt-3 text-xs text-[var(--warning-text)]">
                      {tr(
                        'This update was returned with an invalid flag by the API.',
                        'Bu update API tomonidan notogri flag bilan qaytarilgan.',
                        'Eto obnovlenie bylo vozvrashcheno API s nekorrektnym flagom.',
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </Card>

      <Card noPadding className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-[22px] pb-4">
          <SectionTitle title={tr('Recent Updates', 'Songgi update lar', 'Poslednie obnovleniya')} />
          <Badge variant="blue">{recent.length}</Badge>
        </div>

        {recent.length === 0 ? (
          <div className="mx-[22px] mb-[22px] rounded-[18px] bg-[var(--muted-surface)] py-12 text-center text-sm text-[var(--muted)]">
            {tr('No recent updates.', 'Songgi update lar yoq.', 'Poslednikh obnovleniy net.')}
          </div>
        ) : (
          <div className="px-[22px] pb-[22px]">
            {recent.slice(0, 10).map((item, index) => {
              const dateLabel = formatRecentDate(item.update_date ?? item.date)
              const text = item.update_text ?? item.message ?? item.text ?? ''
              const ownerName =
                typeof item.owner_name === 'string' && item.owner_name.trim()
                  ? item.owner_name.trim()
                  : null

              return (
                <div
                  key={String(item.id ?? index)}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm leading-[1.5] text-[var(--foreground)]">{text || tr('No description returned by API.', 'API tavsif qaytarmadi.', 'API ne vernulo opisanie.')}</p>
                    {ownerName ? (
                      <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                        {ownerName}
                      </p>
                    ) : null}
                  </div>
                  {dateLabel && (
                    <span className="shrink-0 text-[12.5px] text-[var(--muted)] tabular-nums">
                      {dateLabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </section>
  )
}
