import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { updateTrackingService, type WorkdayOverrideRecord } from '../../../shared/api/services/updateTracking.service'
import type { DayStatus, UpdateTrackingStats } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { getLocalizedMonthName } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { SectionTitle } from '../../../shared/ui/section-title'
import { ErrorStateBlock } from '../../../shared/ui/state-block'

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

function getCalendarDaySurfaceClass(day: CalendarDay) {
  if (isHolidayCalendarDay(day)) {
    return 'cal-day-holiday'
  }

  return dayStyle[day.status]
}

function getCalendarDayAccentClass(day: CalendarDay) {
  if (isHolidayCalendarDay(day)) {
    return 'cal-accent-holiday'
  }

  return dayAccentStyle[day.status]
}

function getCalendarDayPillClass(day: CalendarDay) {
  if (isHolidayCalendarDay(day)) {
    return 'cal-pill-holiday'
  }

  return dayPillStyle[day.status]
}

function getCalendarDayDotClass(day: CalendarDay) {
  if (isHolidayCalendarDay(day)) {
    return 'cal-dot-holiday'
  }

  return dayDotStyle[day.status]
}

function getCalendarDayTextClass(day: CalendarDay) {
  if (isHolidayCalendarDay(day)) {
    return 'cal-text-holiday'
  }

  return dayStatusTextStyle[day.status]
}

function getCalendarDayFocusClass(day: CalendarDay | null) {
  if (!day) {
    return dayFocusStyle.neutral
  }

  if (isHolidayCalendarDay(day)) {
    return 'cal-focus-holiday'
  }

  return dayFocusStyle[day.status]
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

type AccentKey = 'default' | 'success' | 'warning' | 'blue' | 'violet'

const cardBorder: Record<AccentKey, string> = {
  default: 'border-white/8',
  success: 'border-emerald-500/20',
  warning: 'border-amber-500/20',
  blue: 'border-blue-500/20',
  violet: 'border-violet-500/20',
}

const cardIcon: Record<AccentKey, string> = {
  default: 'border-white/10 bg-white/6 text-(--muted-strong)',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-400/10 text-amber-300',
  blue: 'border-blue-500/20 bg-blue-600/10 text-blue-300',
  violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
}

function SummaryCard({ icon, label, value, accent = 'default' }: {
  icon: ReactNode
  label: string
  value: ReactNode
  accent?: AccentKey
}) {
  const localizedLabel = translateCurrentLiteral(label)

  return (
    <div className={cn('card-base flex items-center gap-4 px-5 py-4', cardBorder[accent])}>
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', cardIcon[accent])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--muted)">{localizedLabel}</p>
        <p className="mt-1 truncate text-xl font-semibold leading-none text-white">{value}</p>
      </div>
    </div>
  )
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-rose-500'

  return (
    <div className="h-1.5 w-full rounded-full bg-white/8">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
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

  return (
    <section className="space-y-4 page-enter">
      <Card variant="glass" noPadding className="page-header-card overflow-hidden rounded-xl">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="page-header-decor pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_72%)]" />
          <div className="page-header-decor pointer-events-none absolute -left-12 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="page-header-decor pointer-events-none absolute -right-10 top-6 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--blue-text)]">
                {tr('Personal', 'Shaxsiy', 'Lichnoye')}
              </p>
              <h1 className="page-header-title mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                {tr('My Updates', 'Mening update larim', 'Moi obnovleniya')}
              </h1>
              <p className="mt-1.5 text-[13px] text-(--muted)">
                {tr(
                  'Track your daily update submissions and performance.',
                  'Kunlik update yuborishlaringiz va samaradorligingizni kuzating.',
                  'Otslezhivayte ezhednevnye otpravki obnovleniy i effektivnost.',
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="cal-control flex items-center gap-2 rounded-xl border px-3 py-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)">{tr('Year', 'Yil', 'God')}</label>
                <Input
                  type="number"
                  min="2020"
                  max="2035"
                  value={yearInput}
                  onChange={(event) => setYearInput(event.target.value)}
                  onBlur={applyYearInput}
                  onKeyDown={handleYearKeyDown}
                  className="h-7 w-18 border-(--border) bg-transparent px-2 text-sm text-(--foreground)"
                />
              </div>

              <div className="cal-control flex items-center gap-2 rounded-xl border px-3 py-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)">{tr('Month', 'Oy', 'Mesyats')}</label>
                <select
                  value={month}
                  onChange={(event) => handleMonthChange(Number(event.target.value))}
                  className="h-7 rounded-lg border border-(--border) bg-(--surface) px-2 text-sm text-(--foreground) focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                >
                  {monthOptions.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRefresh()}
                className="min-h-9 gap-1.5 rounded-xl"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1.5 8a6.5 6.5 0 1 1 1.2 3.8" />
                  <path d="M1.5 12.5V8.5h4" />
                </svg>
                {tr('Refresh', 'Yangilash', 'Obnovit')}
              </Button>
            </div>
          </div>

          {pageQuery.data?.errors.stats ? (
            <div className="relative z-10 mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/82">
              {tr(
                'Stats API unavailable. Calendar and other sections continue loading independently.',
                'Stats API mavjud emas. Kalendar va boshqa bolimlar mustaqil yuklanishda davom etadi.',
                'Stats API nedostupen. Kalendar i drugie razdely prodolzhayut zagruzhatsya otdelno.',
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <SummaryCard
          accent="violet"
          label={tr('Monthly Completion', 'Oylik bajarilish', 'Mesyachnoe vypolnenie')}
          value={`${monthlyPct.toFixed(1)}%`}
          icon={(
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10a8 8 0 1 1 16 0" />
              <path d="M10 10V4" />
              <path d="M10 10l4 2.5" />
            </svg>
          )}
        />
        <SummaryCard
          accent={weeklyPct >= 80 ? 'success' : weeklyPct >= 50 ? 'warning' : 'default'}
          label={tr('Weekly Completion', 'Haftalik bajarilish', 'Nedelnoye vypolnenie')}
          value={`${weeklyPct.toFixed(1)}%`}
          icon={(
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="16" height="14" rx="2" />
              <path d="M7 3v14M13 3v14M2 9h16M2 13h16" />
            </svg>
          )}
        />
        <SummaryCard
          accent="blue"
          label={tr('Updates This Month', 'Bu oydagi update lar', 'Obnovleniya za etot mesyats')}
          value={stats?.updates_this_month ?? 0}
          icon={(
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <path d="m6.5 10 2.5 2.5 4.5-4.5" />
            </svg>
          )}
        />
        <SummaryCard
          accent="default"
          label={tr('Updates This Week', 'Bu haftadagi update lar', 'Obnovleniya za etu nedelyu')}
          value={stats?.updates_this_week ?? 0}
          icon={(
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 15 7 8 11 12 15 6 18 9" />
            </svg>
          )}
        />
      </div>

      {trends.length > 0 && (
        <Card variant="glass" className="overflow-hidden p-0">
          <div className="border-b border-(--border) px-5 py-4">
            <SectionTitle title={tr('Performance Trends', 'Samaradorlik trendlari', 'Trendy effektivnosti')} />
          </div>
          <div className="space-y-3 px-5 py-4">
            {trends.slice(-6).map((trend) => {
              const pct = trend.completion_percentage ?? 0
              const label = trend.month_name ?? `${getMonthName(trend.month)} ${trend.year}`

              return (
                <div key={`${trend.year}-${trend.month}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-(--muted-strong)">{label}</span>
                    <span className={cn('font-bold tabular-nums', pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <CompletionBar pct={pct} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="grid items-stretch gap-4">
        <div className="flex min-h-full flex-col gap-4">
          <Card variant="glass" className="overflow-hidden p-0">
          <div className="border-b border-(--border) px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <SectionTitle
                title={`${selectedMonthName} ${year} ${tr('Calendar', 'Kalendar', 'Kalendary')}`}
                description={tr(
                  'Reference-driven monthly board with dense day cards, week rails, and one-click inspection.',
                  'Referensga asoslangan oylik taxta: zich kun kartalari, hafta yolaklari va bir bosishda korish.',
                  'Mesyachnaya doska po referensu s plotnymi kartami dnei, liniyami nedel i proverkoj v odin klik.',
                )}
              />
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
            </div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            {pageQuery.isLoading && !calendar ? (
              <div className="py-10 text-center text-sm text-(--muted)">{tr('Loading calendar...', 'Kalendar yuklanmoqda...', 'Kalendar zagruzhaetsya...')}</div>
            ) : !calendar ? (
              <div className="py-10 text-center text-sm text-(--muted)">{tr('No calendar data for this period.', 'Bu davr uchun kalendar malumoti yoq.', 'Dlya etogo perioda net dannykh kalendarya.')}</div>
            ) : (
              <>
                <div className="cal-container rounded-xl border p-2.5 sm:p-4">
                  <div className="cal-inner overflow-hidden rounded-xl border p-3.5 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div className="max-w-xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#3D9460] dark:text-emerald-300/72">
                          {tr('Calendar System', 'Kalendar tizimi', 'Sistema kalendarya')}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <h3 className="cal-heading text-[1.45rem] font-semibold tracking-tight sm:text-[1.65rem]">
                            {selectedMonthName} {year}
                          </h3>
                          <Badge
                            variant="violet"
                            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                          >
                            {monthProgressPct.toFixed(0)}{tr('% pace', '% temp', '% temp')}
                          </Badge>
                        </div>
                        <p className="mt-2 text-[12px] leading-5 text-(--muted)">
                          {tr(
                            'Dense monthly board for fast scanning, modeled after the reference calendar layout.',
                            'Tez korib chiqish uchun zich oylik taxta, referens kalendar asosida tuzilgan.',
                            'Plotnaya mesyachnaya doska dlya bystrogo prosmotra, postroennaya po etalonnomu kalendaryu.',
                          )}
                        </p>
                      </div>

                      <div className="grid w-fit grid-cols-[44px_auto_44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-[0_10px_24px_rgba(148,163,184,0.14)] dark:border-white/10 dark:bg-black/18 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMonthShift(-1)}
                          className="min-h-11 min-w-11 rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] px-0 text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10 3.5 5.5 8 10 12.5" />
                          </svg>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleJumpToToday}
                          data-keep-color="true"
                          style={{
                            color: '#14532D',
                            WebkitTextFillColor: '#14532D',
                            borderColor: '#9ED6B2',
                            background: 'linear-gradient(180deg, #ECFDF3, #DDF7E8)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 8px 20px rgba(22,101,52,0.08)',
                          }}
                          className="min-h-11 rounded-xl px-5 hover:border-[#79C797] hover:bg-[linear-gradient(180deg,#E1FAEB,#CEF2DE)] dark:border-emerald-400/18 dark:bg-emerald-400/10 dark:text-emerald-50 dark:hover:border-emerald-300/30 dark:hover:bg-emerald-400/14"
                        >
                          <span
                            className="relative z-[1] font-semibold tracking-[0.01em]"
                            style={{ color: '#14532D', WebkitTextFillColor: '#14532D' }}
                          >
                            {selectedMonthName} {year}
                          </span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMonthShift(1)}
                          className="min-h-11 min-w-11 rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] px-0 text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 3.5 10.5 8 6 12.5" />
                          </svg>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,330px)] lg:items-start">
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                      <Badge variant="success" dot className="w-full justify-start rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                        {calendarCounts.submitted} {tr('updated', 'yangilandi', 'obnovleno')}
                      </Badge>
                      <Badge variant="danger" dot className="w-full justify-start rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                        {calendarCounts.missing} {tr('missed', 'otkazib yuborildi', 'propushcheno')}
                      </Badge>
                      <Badge variant="secondary" className="w-full justify-start rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] sm:w-auto">
                        {attentionDaysCount} {tr('attention', 'etibor', 'vnimanie')}
                      </Badge>
                      <Badge variant="secondary" className="col-span-2 w-full justify-start rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] sm:col-span-1 sm:w-auto">
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
                      <div className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/18 bg-emerald-50 px-3 py-2 sm:min-w-[250px] dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="min-w-0 flex-1">
                          <p className="ui-card-label text-emerald-700/70 dark:text-white/36">
                            {tr('Completion To Date', 'Shu kungacha bajarilish', 'Vypolnenie na segodnyashniy den')}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--muted-strong)] dark:text-white/72">
                            {elapsedWorkingDays > 0
                              ? `${calendarCounts.submitted} ${tr('of', 'dan', 'iz')} ${elapsedWorkingDays} ${tr('completed workdays updated.', 'bajarilgan ish kunlari yangilandi.', 'zavershennykh rabochikh dney obnovleno.')}`
                              : tr('No completed workdays yet.', 'Hali bajarilgan ish kunlari yoq.', 'Zavershennykh rabochikh dney poka net.')}
                          </p>
                        </div>
                        <div className="w-22 shrink-0">
                          <div className="mb-1 flex items-center justify-between text-[10px] text-emerald-700/70 dark:text-white/68">
                            <span>{calendarCounts.submitted}/{elapsedWorkingDays || 0}</span>
                            <span>{monthProgressPct.toFixed(0)}%</span>
                          </div>
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
                            className="cal-weekday-header rounded-full border px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.26em] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                          >
                            {getLocalizedWeekdayLabel(label)}
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

                              const entryCount = getCalendarEntryCount(day)
                              const isSelected = selectedCalendarDay?.date === day.date
                              const isToday = day.date === todayKey

                              return (
                                <button
                                  key={day.date ?? `${weekIndex}-${dayIndex}`}
                                  type="button"
                                  onClick={() => setSelectedDate(day.date ?? null)}
                                  aria-pressed={isSelected}
                                  className={cn(
                                    'group relative flex min-h-[152px] min-w-0 flex-col overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
                                    getCalendarDaySurfaceClass(day),
                                    isSelected
                                      ? 'border-violet-400/65 ring-2 ring-violet-400/55 ring-offset-2 ring-offset-[var(--background)] shadow-[0_0_0_1px_rgba(167,139,250,0.20),0_18px_40px_rgba(8,8,12,0.34)]'
                                      : 'hover:-translate-y-[1px] hover:border-(--border-hover)',
                                    isToday && !isSelected && 'shadow-[inset_0_0_0_1px_rgba(125,211,252,0.24)]',
                                  )}
                                  title={`${isSelected ? `${tr('Selected', 'Tanlangan', 'Vybran')}: ` : ''}${formatCalendarDayLabel(day) || `${tr('Day', 'Kun', 'Den')} ${day.day}`}: ${getCalendarStatusLabel(day.status, day)}`}
                                >
                                  <span className={cn('absolute inset-x-3.5 top-0 h-[2px] rounded-full', getCalendarDayAccentClass(day))} />
                                  <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_42%)] opacity-0 transition group-hover:opacity-100" />

                                  <div className="relative flex items-start justify-between gap-3">
                                    <div>
                                      <p className={cn('text-[10px] font-bold uppercase tracking-[0.24em] opacity-40', getCalendarDayTextClass(day))}>
                                        {getCalendarBoardWeekday(day)}
                                      </p>
                                      <p
                                        className={cn(
                                          'mt-1.5 text-[1.5rem] font-semibold leading-none tabular-nums tracking-tight',
                                          day.status === 'submitted' || day.status === 'missing' ? 'text-[var(--foreground)] dark:text-white' : 'text-[var(--foreground)]/82 dark:text-white/82',
                                        )}
                                      >
                                        {day.day}
                                      </p>
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5">
                                      {entryCount > 0 ? (
                                        <span className="ui-card-label inline-flex min-w-7 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 px-2 py-0.75 tabular-nums text-[var(--muted-strong)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/72">
                                          {entryCount}x
                                        </span>
                                      ) : null}
                                      {isToday ? (
                                        <span className="grid h-6 w-6 place-items-center rounded-full border border-sky-400/30 bg-sky-500/10">
                                          <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.70)]" />
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {shouldShowCalendarTimePanel(day) ? (
                                    <div className="relative mt-2.5 space-y-1.5">
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div className="rounded-xl border border-[var(--border)] bg-white/85 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                                          <p className="ui-card-label text-[var(--muted)] dark:text-white/44">
                                            {tr('In', 'Kirish', 'Vkhod')}
                                          </p>
                                          <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)] dark:text-white">
                                            {formatCalendarWorkTime(day.checkInTime)}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-[var(--border)] bg-white/85 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                                          <p className="ui-card-label text-[var(--muted)] dark:text-white/44">
                                            {tr('Out', 'Chiqish', 'Vykhod')}
                                          </p>
                                          <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--foreground)] dark:text-white">
                                            {formatCalendarWorkTime(day.checkOutTime)}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="ui-helper font-medium uppercase tracking-[0.12em] text-[var(--muted-strong)] dark:text-white/76">
                                        {getCalendarWorkedDurationLabel(day)}
                                      </p>
                                    </div>
                                  ) : null}

                                  <div className="relative mt-auto">
                                    <span className={cn(
                                      'ui-card-label inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.75 tracking-[0.14em]',
                                      getCalendarDayPillClass(day),
                                    )}>
                                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', getCalendarDayDotClass(day))} />
                                      {getCalendarCellStatusLabel(day.status, day)}
                                    </span>
                                    <p className="ui-table-meta mt-1.5 text-[var(--muted-strong)] dark:text-white/76">
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

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-(--muted)">
                      <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.55)]" />
                      {tr('Selected', 'Tanlangan', 'Vybran')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.55)]" />
                      {tr('Today', 'Bugun', 'Segodnya')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm border border-emerald-500/35 bg-emerald-500/25" />
                      {tr('Updated', 'Yangilangan', 'Obnovleno')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm border border-rose-500/30 bg-rose-500/20" />
                      {tr('Missed', 'Otib yuborilgan', 'Propushcheno')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm border border-[var(--border)] bg-white dark:border-white/10 dark:bg-white/4" />
                      {tr('Open or upcoming', 'Ochiq yoki yaqinlashayotgan', 'Otkryto ili skoro')}
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'grid h-18 w-18 shrink-0 place-items-center rounded-xl border text-[1.75rem] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                            getCalendarDayFocusClass(selectedCalendarDay),
                          )}
                        >
                          {selectedCalendarDay?.day ?? '--'}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300/72">
                            {tr('Focus Day', 'Fokus kuni', 'Fokusnyy den')}
                          </p>
                          <h4 className="mt-2 text-lg font-semibold tracking-tight text-(--foreground)">
                            {selectedCalendarDayLabel || tr('No date selected', 'Sana tanlanmagan', 'Data ne vybrana')}
                          </h4>
                          <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-(--muted)">
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
                        <div className="rounded-xl border border-(--border) bg-(--muted-surface) px-3 py-3 text-[12px] text-(--muted)">
                          <p>{tr('Status', 'Holat', 'Status')}</p>
                          <p className="mt-1 font-medium text-(--foreground)">
                            {selectedCalendarDay ? getCalendarStatusLabel(selectedCalendarDay.status, selectedCalendarDay) : tr('N/A', 'Mavjud emas', 'N/A')}
                          </p>
                        </div>
                        <div className="rounded-xl border border-(--border) bg-(--muted-surface) px-3 py-3 text-[12px] text-(--muted)">
                          <p>{tr('Submission', 'Yuborish', 'Otpravka')}</p>
                          <p className="mt-1 font-medium text-(--foreground)">
                            {selectedCalendarDay?.hasUpdate ? tr('Available', 'Mavjud', 'Dostupno') : tr('None', 'Yoq', 'Net')}
                          </p>
                        </div>
                        <div className="rounded-xl border border-(--border) bg-(--muted-surface) px-3 py-3 text-[12px] text-(--muted)">
                          <p>{tr('Validation', 'Validatsiya', 'Validatsiya')}</p>
                          <p className={cn(
                            'mt-1 font-medium',
                            selectedCalendarDay?.isValid === false
                              ? 'text-amber-300'
                              : selectedCalendarDay?.isValid === true
                                ? 'text-emerald-300'
                                : 'text-(--foreground)',
                          )}>
                            {selectedCalendarDay?.isValid === false ? tr('Needs review', 'Korib chiqish kerak', 'Trebuet proverki') : selectedCalendarDay?.isValid === true ? tr('Valid', 'Valid', 'Validno') : tr('N/A', 'Mavjud emas', 'N/A')}
                          </p>
                        </div>
                        <div className="rounded-xl border border-(--border) bg-(--muted-surface) px-3 py-3 text-[12px] text-(--muted)">
                          <p>{tr('Entries', 'Yozuvlar', 'Zapisi')}</p>
                          <p className="mt-1 font-medium text-(--foreground)">
                            {selectedCalendarDay ? getCalendarEntryCount(selectedCalendarDay) : 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {shouldShowFocusContent ? (
                      <div className="mt-4 rounded-xl border border-(--border) bg-(--surface) p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--muted)">
                              {selectedCalendarDay?.hasUpdate
                                ? tr('Update Content', 'Update kontenti', 'Kontent obnovleniya')
                                : tr('Special Day', 'Maxsus kun', 'Osobyy den')}
                            </p>
                            <h4 className="mt-2 text-base font-semibold tracking-tight text-(--foreground)">
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

                        <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-(--border) bg-(--muted-surface) p-4">
                          <p className="whitespace-pre-wrap text-[13px] leading-6 text-(--foreground)">
                            {getCalendarDetailText(selectedCalendarDay)}
                          </p>
                        </div>

                        {selectedCalendarDay?.isValid === false ? (
                          <p className="mt-3 text-xs text-amber-300">
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
                </div>
              </>
            )}
          </div>
          </Card>

          <Card variant="glass" className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
              <SectionTitle title={tr('Recent Updates', 'Songgi update lar', 'Poslednie obnovleniya')} />
              <Badge variant="blue">{recent.length}</Badge>
            </div>
            <div className="divide-y divide-(--border)">
              {recent.length === 0 ? (
                <div className="py-10 text-center text-sm text-(--muted)">{tr('No recent updates.', 'Songgi update lar yoq.', 'Poslednikh obnovleniy net.')}</div>
              ) : (
                recent.slice(0, 10).map((item, index) => {
                  const dateLabel = formatRecentDate(item.update_date ?? item.date)
                  const text = item.update_text ?? item.message ?? item.text ?? ''
                  const ownerName =
                    typeof item.owner_name === 'string' && item.owner_name.trim()
                      ? item.owner_name.trim()
                      : null

                  return (
                    <div key={String(item.id ?? index)} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[13px] text-(--foreground)">{text || tr('No description returned by API.', 'API tavsif qaytarmadi.', 'API ne vernulo opisanie.')}</p>
                          {ownerName ? (
                            <p className="mt-1 text-xs text-(--muted-strong)">
                              {ownerName}
                            </p>
                          ) : null}
                        </div>
                        {dateLabel && (
                          <span className="shrink-0 text-[11px] tabular-nums text-(--muted)">
                            {dateLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

      </div>

    </section>
  )
}
