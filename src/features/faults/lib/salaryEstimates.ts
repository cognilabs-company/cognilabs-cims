import type {
  DayStatus,
  MemberDeliveryBonusRecord,
  MemberMistakeRecord,
} from '../../../shared/api/types'
import type { CeoUserRecord } from '../../../shared/api/services/ceo.service'
import type { WorkdayOverrideRecord } from '../../../shared/api/services/updateTracking.service'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { formatShortDate, getLocalizedMonthName } from '../../../shared/lib/format'

export type UnknownRecord = Record<string, unknown>

const parsedJsonStringCache = new Map<string, unknown>()
const estimateEntriesCache = new WeakMap<object, UnknownRecord[]>()
const normalizedEstimateEntryCache = new WeakMap<UnknownRecord, SalaryEstimateSnapshot>()

function translateSalaryEstimateText(en: string, uz: string, ru: string) {
  const translated = translateCurrentLiteral(en)

  if (translated !== en) {
    return translated
  }

  const locale = getIntlLocale()

  if (locale.startsWith('ru')) {
    return ru
  }

  if (locale.startsWith('en')) {
    return en
  }

  return uz
}

export type SalaryEstimateSnapshot = {
  userId: number | null
  userLabel?: string
  userName?: string
  roleLabel?: string
  baseSalary?: number
  estimatedSalary?: number
  penaltyPoints?: number
  penaltyEntries?: number
  penaltyPercentage?: number
  mistakesCount?: number
  deductionAmount?: number
  rawDeductionAmount?: number
  appliedDeductionAmount?: number
  afterPenalty?: number
  bonusEntries?: number
  deliveryBonusCount?: number
  bonusAmount?: number
  totalBonusPercent?: number
  finalSalary?: number
  workingDays?: number
  updateDays?: number
  productivityPercentage?: number
  qualifiesProductivityBonus?: boolean
  formulaText?: string
  calculationBreakdown?: {
    base_salary: number
    bonus_lines: Array<{
      type: string
      label: string
      applied: boolean
      percent: number
      amount: number
      reason?: string
    }>
    deduction_lines: Array<{
      type: string
      label: string
      applied: boolean
      percent: number
      amount: number
      reason?: string
    }>
    formula_text?: string
  }
}

export type EmployeeSalaryReport = {
  id: number
  label: string
  fullName: string
  roleLabel: string
  baseSalary: number
  estimatedSalary: number
  deductionAmount: number
  bonusAmount: number
  afterPenalty: number
  finalSalary: number
  penaltyPoints: number
  penaltyEntries: number
  bonusEntries: number
  penaltyPercentage: number
  mistakesCount: number
  deliveryBonusCount: number
  totalBonusPercent: number
  workingDays: number
  updateDays: number
  productivityPercentage: number
  qualifiesProductivityBonus: boolean
  hasPenalty: boolean
  hasBonus: boolean
  formulaText?: string
  calculationBreakdown?: SalaryEstimateSnapshot['calculationBreakdown']
}

export type SalaryLedgerItem = {
  id: string
  title: string
  description?: string
  amount: number
  points?: number
  percentage?: number
  createdAt?: string
}

export type EmployeeCompensationPolicy = {
  employeeId: number | null
  employeeName?: string | null
  salaryBase?: number
  monthlyDeductionCapPercent?: number
  monthlyDeductionCapAmount?: number
  responsibilitySplit: {
    developerPercent?: number
    reviewerPercent?: number
  }
  deductionRates: Array<{
    severity: string
    percent?: number
    amount?: number
  }>
  bonusRates: Array<{
    key: string
    label: string
    percent?: number
  }>
  mistakeCategories: Array<{
    key: string
    value: string
    label: string
  }>
  severities: string[]
  decisionTree: Array<{
    step: number
    question: string
    ifYes?: string
    ifNo?: string
  }>
}

export type MemberUpdateSummary = {
  totalUpdates: number
  submittedCount: number
  missingCount: number
  completionPercentage: number
  updatePercentage?: number
  salaryAmount?: number
  nextPaymentDate?: string
  note?: string
  lastUpdateDate?: string
}

export type MemberMonthlyUpdateEntry = {
  id: string
  date: string
  createdAt?: string
  title?: string
  text?: string
}

export type MemberMonthlyUpdateDay = {
  day: number
  date: string
  status: DayStatus
  weekdayShort: string
  weekdayLabel: string
  isToday: boolean
  isFuture: boolean
  isWeekend: boolean
  isDayOff?: boolean | null
  checkInTime?: string | null
  checkOutTime?: string | null
  hasUpdate: boolean
  updatesCount: number
  entries: MemberMonthlyUpdateEntry[]
  note?: string | null
  isValid?: boolean | null
  workdayOverride?: WorkdayOverrideRecord | null
}

export type MemberMonthlyUpdateCalendar = {
  month: number
  year: number
  days: MemberMonthlyUpdateDay[]
  submittedCount: number
  missingCount: number
  sundayCount: number
  futureCount: number
  totalUpdates: number
}

export type EmployeeSalaryDetail = {
  memberId: number
  year: number
  month: number
  report: EmployeeSalaryReport
  compensationPolicy: EmployeeCompensationPolicy | null
  penalties: SalaryLedgerItem[]
  bonuses: SalaryLedgerItem[]
  mistakes: MemberMistakeRecord[]
  deliveryBonuses: MemberDeliveryBonusRecord[]
  updatesSummary: MemberUpdateSummary | null
  updateCalendar: MemberMonthlyUpdateCalendar | null
  estimateSource: 'live' | 'fallback'
  estimateError?: string | null
  updatesError?: string | null
  calendarError?: string | null
  mistakesError?: string | null
  deliveryBonusesError?: string | null
  policyError?: string | null
}

export const now = new Date()
export const defaultYear = now.getFullYear()
export const defaultMonth = now.getMonth() + 1
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const missingMetricValue = Number.NaN
const unknownNameLabels = new Set([
  'unknown',
  'unknown member',
  'unknown user',
  'member unknown',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
])
const monthlyDayCollectionKeys = [
  'daily_statuses',
  'day_statuses',
  'daily_updates',
  'statuses',
  'days',
  'calendar',
  'monthly_activity',
  'activity',
] as const
const monthlyUpdateCollectionKeys = [
  'updates',
  'recent_updates',
  'recent',
  'items',
  'results',
  'entries',
  'rows',
] as const
const updateTextKeys = [
  'update_content',
  'update_text',
  'message',
  'text',
  'summary',
  'description',
  'content',
  'body',
  'note',
  'comment',
  'remarks',
  'title',
] as const
const updateTitleKeys = ['title', 'subject', 'label', 'type', 'status'] as const
const updateDateKeys = [
  'update_date',
  'date',
  'created_at',
  'submitted_at',
  'updated_at',
  'timestamp',
] as const

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return value
  }

  if (parsedJsonStringCache.has(trimmed)) {
    return parsedJsonStringCache.get(trimmed)
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    parsedJsonStringCache.set(trimmed, parsed)
    return parsed
  } catch {
    parsedJsonStringCache.set(trimmed, value)
    return value
  }
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.replace(/\s+/g, '').replace(/,/g, '')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)

  if (!match) {
    return null
  }

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function toBoolean(value: unknown): boolean | null {
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

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function parseDateValue(value: string) {
  if (isDateKey(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isValidDateString(value: string) {
  return !Number.isNaN(parseDateValue(value).getTime())
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
    id: findFirstNumber(rawOverride, ['id']) ?? 0,
    special_date: findFirstString(rawOverride, ['special_date', 'date']) ?? '',
    day_type: normalizeOverrideDayType(rawOverride.day_type ?? rawOverride.type),
    title: findFirstString(rawOverride, ['title', 'label', 'name']) ?? 'Workday override',
    note: findFirstString(rawOverride, ['note', 'description', 'remarks']) ?? null,
    target_type: findFirstString(rawOverride, ['target_type']) ?? 'all',
    member_id: findFirstNumber(rawOverride, ['member_id', 'user_id']) ?? null,
    member_name: findFirstString(rawOverride, ['member_name', 'member', 'user_name']) ?? null,
    workday_hours:
      typeof rawOverride.workday_hours === 'string'
        ? rawOverride.workday_hours
        : typeof rawOverride.workday_hours === 'number' && Number.isFinite(rawOverride.workday_hours)
          ? String(rawOverride.workday_hours)
          : null,
    update_required: toBoolean(rawOverride.update_required) ?? false,
    created_by: findFirstNumber(rawOverride, ['created_by']) ?? 0,
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

export function findFirstString(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function joinNameParts(...parts: Array<string | undefined>) {
  const value = parts.filter(Boolean).join(' ').trim()
  return value || undefined
}

function isUnknownName(value?: string | null) {
  if (typeof value !== 'string') {
    return false
  }

  return unknownNameLabels.has(value.trim().toLowerCase())
}

export function resolveRecordDisplayName(...sources: Array<UnknownRecord | null | undefined>) {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const directName = findFirstString(source, [
      'full_name',
      'user_name',
      'employee_name',
      'member_name',
      'display_name',
    ])

    if (directName && !isUnknownName(directName)) {
      return directName
    }

    const composedName = joinNameParts(
      findFirstString(source, ['first_name', 'firstName', 'name']),
      findFirstString(source, ['surname', 'last_name', 'lastName']),
    )

    if (composedName && !isUnknownName(composedName)) {
      return composedName
    }

    const plainName = findFirstString(source, ['name'])

    if (plainName && !isUnknownName(plainName)) {
      return plainName
    }
  }

  return undefined
}

export function findFirstNumber(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(source[key])

    if (value !== null) {
      return value
    }
  }

  return undefined
}

export function findFirstRecord(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (isRecord(value)) {
      return value
    }
  }

  return undefined
}

export function findFirstArray(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
    }
  }

  return undefined
}

function humanizePolicyKey(value: string) {
  return value
    .replace(/_percent$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function looksLikeCompensationPolicy(source: UnknownRecord) {
  return [
    'salary_base',
    'monthly_deduction_cap_percent',
    'monthly_deduction_cap_amount',
    'deduction_rates',
    'bonus_rates',
    'mistake_categories',
    'severities',
    'decision_tree',
  ].some((key) => key in source)
}

function findCompensationPolicyEntry(
  payload: unknown,
  memberId?: number | null,
  memberName?: string | null,
) {
  const parsedPayload = parseMaybeJson(payload)

  if (Array.isArray(parsedPayload)) {
    const arrayEntries = parsedPayload.filter(isRecord)
    return arrayEntries.find((entry) => matchesCompensationPolicyEntry(entry, memberId, memberName)) ?? arrayEntries[0] ?? null
  }

  if (!isRecord(parsedPayload)) {
    return null
  }

  const directEntries = findFirstArray(parsedPayload, ['items', 'employees', 'members', 'results', 'data'])

  if (directEntries) {
    const normalizedEntries = directEntries.filter(isRecord)
    return normalizedEntries.find((entry) => matchesCompensationPolicyEntry(entry, memberId, memberName)) ?? normalizedEntries[0] ?? null
  }

  if (looksLikeCompensationPolicy(parsedPayload) || isRecord(parsedPayload.policy)) {
    return parsedPayload
  }

  const nestedEntries = Object.values(parsedPayload).filter(isRecord)
  return nestedEntries.find((entry) => matchesCompensationPolicyEntry(entry, memberId, memberName)) ?? nestedEntries[0] ?? null
}

function matchesCompensationPolicyEntry(
  entry: UnknownRecord,
  memberId?: number | null,
  memberName?: string | null,
) {
  if (!Number.isFinite(memberId ?? Number.NaN) || (memberId ?? 0) <= 0) {
    return true
  }

  const employeeRecord = findFirstRecord(entry, ['employee', 'member', 'user'])
  const entryEmployeeId =
    findFirstNumber(entry, ['employee_id', 'member_id', 'user_id', 'id']) ??
    findFirstNumber(employeeRecord ?? {}, ['id', 'employee_id', 'member_id', 'user_id'])

  if (entryEmployeeId !== undefined) {
    return entryEmployeeId === memberId
  }

  if (!memberName) {
    return false
  }

  const entryEmployeeName =
    resolveRecordDisplayName(entry, employeeRecord ?? null)?.toLowerCase().trim()

  return entryEmployeeName === memberName.toLowerCase().trim()
}

function normalizePolicyCategory(source: unknown, index: number): EmployeeCompensationPolicy['mistakeCategories'][number] | null {
  if (!isRecord(source)) {
    return null
  }

  const value = findFirstString(source, ['value', 'label', 'name'])

  if (!value) {
    return null
  }

  return {
    key: findFirstString(source, ['key']) ?? `category-${index + 1}`,
    value,
    label: findFirstString(source, ['label', 'value', 'name']) ?? value,
  }
}

function normalizePolicyDeductionRate(source: unknown): EmployeeCompensationPolicy['deductionRates'][number] | null {
  if (!isRecord(source)) {
    return null
  }

  const severity = findFirstString(source, ['severity', 'label', 'name'])

  if (!severity) {
    return null
  }

  return {
    severity,
    percent: findFirstNumber(source, ['percent', 'percentage']),
    amount: findFirstNumber(source, ['amount', 'value']),
  }
}

function normalizePolicyDecisionStep(source: unknown): EmployeeCompensationPolicy['decisionTree'][number] | null {
  if (!isRecord(source)) {
    return null
  }

  const question = findFirstString(source, ['question', 'title', 'label'])

  if (!question) {
    return null
  }

  return {
    step: findFirstNumber(source, ['step', 'order']) ?? 0,
    question,
    ifYes: findFirstString(source, ['if_yes']) ?? undefined,
    ifNo: findFirstString(source, ['if_no']) ?? undefined,
  }
}

export function buildEmployeeCompensationPolicy(
  payload: unknown,
  memberId?: number | null,
  memberName?: string | null,
): EmployeeCompensationPolicy | null {
  const matchedEntry = findCompensationPolicyEntry(payload, memberId, memberName)

  if (!matchedEntry) {
    return null
  }

  const employeeRecord = findFirstRecord(matchedEntry, ['employee', 'member', 'user'])
  const policyRecord = findFirstRecord(matchedEntry, ['policy']) ?? (looksLikeCompensationPolicy(matchedEntry) ? matchedEntry : null)

  if (!policyRecord) {
    return null
  }

  const deductionRates = (findFirstArray(policyRecord, ['deduction_rates']) ?? [])
    .map((entry) => normalizePolicyDeductionRate(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const bonusRatesRecord = findFirstRecord(policyRecord, ['bonus_rates'])
  const bonusRates = bonusRatesRecord
    ? Object.entries(bonusRatesRecord)
      .map(([key, value]) => {
        const percent = toNumber(value)

        if (percent === null) {
          return null
        }

        return {
          key,
          label: humanizePolicyKey(key),
          percent,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : []
  const mistakeCategories = (findFirstArray(policyRecord, ['mistake_categories']) ?? [])
    .map((entry, index) => normalizePolicyCategory(entry, index))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const severities = (findFirstArray(policyRecord, ['severities']) ?? [])
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
  const decisionTree = (findFirstArray(policyRecord, ['decision_tree']) ?? [])
    .map((entry) => normalizePolicyDecisionStep(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => left.step - right.step)

  return {
    employeeId:
      findFirstNumber(matchedEntry, ['employee_id', 'member_id', 'user_id', 'id']) ??
      findFirstNumber(employeeRecord ?? {}, ['id', 'employee_id', 'member_id', 'user_id']) ??
      null,
    employeeName: resolveRecordDisplayName(matchedEntry, employeeRecord ?? null) ?? null,
    salaryBase: findFirstNumber(policyRecord, ['salary_base']) ?? undefined,
    monthlyDeductionCapPercent: findFirstNumber(policyRecord, ['monthly_deduction_cap_percent']) ?? undefined,
    monthlyDeductionCapAmount: findFirstNumber(policyRecord, ['monthly_deduction_cap_amount']) ?? undefined,
    responsibilitySplit: {
      developerPercent: findFirstNumber(findFirstRecord(policyRecord, ['responsibility_split']) ?? {}, ['developer_percent']) ?? undefined,
      reviewerPercent: findFirstNumber(findFirstRecord(policyRecord, ['responsibility_split']) ?? {}, ['reviewer_percent']) ?? undefined,
    },
    deductionRates,
    bonusRates,
    mistakeCategories,
    severities,
    decisionTree,
  }
}

export function getCompensationPolicyCategoryOptions(policy: EmployeeCompensationPolicy | null) {
  return policy?.mistakeCategories.map((category) => ({
    value: category.value,
    label: category.label,
  })) ?? []
}

export function getCompensationPolicySeverityOptions(policy: EmployeeCompensationPolicy | null) {
  return policy?.severities.map((severity) => ({
    value: severity,
    label: severity,
  })) ?? []
}

export function getCompensationPolicyDeliveryBonusOptions(policy: EmployeeCompensationPolicy | null) {
  const options = policy?.bonusRates
    .filter((rate) => rate.key.toLowerCase().includes('delivery'))
    .map((rate) => ({
      value: rate.key.replace(/_percent$/i, ''),
      label: rate.label,
    })) ?? []

  if (options.length > 0) {
    return options
  }

  return [
    { value: 'early_delivery', label: 'Early Delivery' },
    { value: 'major_early_delivery', label: 'Major Early Delivery' },
  ]
}

export function sumByKeys(items: unknown[], keys: string[]): number {
  return items.reduce<number>((total, item) => {
    if (!isRecord(item)) {
      return total
    }

    return total + (findFirstNumber(item, keys) ?? 0)
  }, 0)
}

export function getMonthName(month: number) {
  return getLocalizedMonthName(month)
}

export function getMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: getMonthName(index + 1),
  }))
}

export function formatAmount(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return new Intl.NumberFormat(getIntlLocale(), {
    maximumFractionDigits: 0,
  }).format(Math.round(value)).replace(/\u00A0/g, ' ')
}

export function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return `${value.toFixed(1)}%`
}

export function formatCount(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return String(Math.round(value))
}

export function formatDetailDate(value?: string | null) {
  if (!value) {
    return translateSalaryEstimateText('Not provided', 'Ko\'rsatilmagan', 'Не указано')
  }

  const formatted = formatShortDate(value)
  return formatted === '-' ? value : formatted
}

export function normalizePercentageValue(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return value <= 1 ? value * 100 : value
}

export function normalizeRoleLabel(user?: CeoUserRecord | null, snapshot?: SalaryEstimateSnapshot | null) {
  if (snapshot?.roleLabel?.trim()) {
    return snapshot.roleLabel
  }

  if (typeof user?.job_title === 'string' && user.job_title.trim()) {
    return user.job_title
  }

  if (typeof user?.role === 'string' && user.role.trim()) {
    return user.role
  }

  return 'Member'
}

export function getUserFullName(user?: CeoUserRecord | null, snapshot?: SalaryEstimateSnapshot | null) {
  if (snapshot?.userName?.trim() && !isUnknownName(snapshot.userName)) {
    return snapshot.userName
  }

  const name = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim()

  if (name) {
    return name
  }

  if (snapshot?.userLabel?.trim()) {
    return snapshot.userLabel
  }

  if (typeof snapshot?.userId === 'number' && snapshot.userId > 0) {
    return `Member #${snapshot.userId}`
  }

  return 'Unknown member'
}

export function getPenaltyPercentage(baseSalary: number, deductionAmount: number, explicitPercentage?: number) {
  if (typeof explicitPercentage === 'number' && Number.isFinite(explicitPercentage)) {
    return explicitPercentage
  }

  if (baseSalary <= 0 || deductionAmount <= 0) {
    return 0
  }

  return (deductionAmount / baseSalary) * 100
}

function getOptionalMetric(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : missingMetricValue
}

function getOptionalCount(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : missingMetricValue
}

function isFiniteMetric(value: number) {
  return Number.isFinite(value)
}

function areAmountsEquivalent(left: number, right: number) {
  return isFiniteMetric(left) && isFiniteMetric(right) && Math.abs(left - right) < 0.5
}

function resolveSalaryMetrics(snapshot?: SalaryEstimateSnapshot | null) {
  const baseSalary = getOptionalMetric(snapshot?.baseSalary)
  const deductionAmount = getOptionalMetric(snapshot?.appliedDeductionAmount ?? snapshot?.deductionAmount ?? snapshot?.rawDeductionAmount)
  const bonusAmount = getOptionalMetric(snapshot?.bonusAmount)
  const snapshotAfterPenalty = getOptionalMetric(snapshot?.afterPenalty)
  const snapshotFinalSalary = getOptionalMetric(snapshot?.finalSalary)
  const snapshotEstimatedSalary = getOptionalMetric(snapshot?.estimatedSalary)

  const computedAfterPenalty =
    isFiniteMetric(baseSalary) && isFiniteMetric(deductionAmount)
      ? Math.max(0, baseSalary - deductionAmount)
      : missingMetricValue
  const afterPenalty =
    isFiniteMetric(computedAfterPenalty)
      ? computedAfterPenalty
      : snapshotAfterPenalty
  const computedFinalSalary =
    isFiniteMetric(afterPenalty) && isFiniteMetric(bonusAmount)
      ? Math.max(0, afterPenalty + bonusAmount)
      : missingMetricValue
  const finalSalary =
    isFiniteMetric(computedFinalSalary)
      ? computedFinalSalary
      : snapshotFinalSalary

  let estimatedSalary = snapshotEstimatedSalary

  if (!isFiniteMetric(estimatedSalary) && isFiniteMetric(finalSalary)) {
    estimatedSalary = finalSalary
  } else if (
    isFiniteMetric(snapshotEstimatedSalary) &&
    isFiniteMetric(snapshotFinalSalary) &&
    isFiniteMetric(finalSalary) &&
    areAmountsEquivalent(snapshotEstimatedSalary, snapshotFinalSalary) &&
    !areAmountsEquivalent(snapshotFinalSalary, finalSalary)
  ) {
    estimatedSalary = finalSalary
  }

  return {
    baseSalary,
    deductionAmount,
    bonusAmount,
    afterPenalty,
    finalSalary,
    estimatedSalary,
  }
}

function looksLikeEstimateEntry(value: UnknownRecord) {
  return [
    'user_id',
    'employee_id',
    'member_id',
    'base_salary',
    'salary_amount',
    'estimated_salary',
    'final_salary',
    'bonus_amount',
    'deduction_amount',
    'penalty_points',
  ].some((key) => key in value)
}

export function extractEstimateEntries(payload: unknown): UnknownRecord[] {
  const data = parseMaybeJson(payload)

  if (data && typeof data === 'object') {
    const cachedEntries = estimateEntriesCache.get(data as object)

    if (cachedEntries) {
      return cachedEntries
    }
  }

  let resolvedEntries: UnknownRecord[] = []

  if (Array.isArray(data)) {
    resolvedEntries = data.filter(isRecord)
  } else if (isRecord(data)) {
    for (const key of [
      'employees',
      'members',
      'items',
      'results',
      'data',
      'salary_estimates',
      'salaryEstimates',
      'estimates',
      'rows',
    ]) {
      const candidate = data[key]

      if (Array.isArray(candidate)) {
        resolvedEntries = candidate.filter(isRecord)
        break
      }

      if (isRecord(candidate)) {
        const nestedItems = Object.values(candidate).filter(isRecord)

        if (nestedItems.length > 0) {
          resolvedEntries = nestedItems
          break
        }
      }
    }

    if (resolvedEntries.length === 0) {
      resolvedEntries = looksLikeEstimateEntry(data)
        ? [data]
        : Object.values(data).filter(isRecord).filter(looksLikeEstimateEntry)
    }
  }

  if (data && typeof data === 'object') {
    estimateEntriesCache.set(data as object, resolvedEntries)
  }

  return resolvedEntries
}

export function normalizeEstimateEntry(entry: UnknownRecord): SalaryEstimateSnapshot {
  const cachedSnapshot = normalizedEstimateEntryCache.get(entry)

  if (cachedSnapshot) {
    return cachedSnapshot
  }

  const parsedEntry = parseMaybeJson(entry)

  if (!isRecord(parsedEntry)) {
    return { userId: null }
  }

  const userRecord =
    findFirstRecord(parsedEntry, ['user', 'employee', 'member']) ??
    findFirstRecord(parsedEntry, ['member_data', 'user_data'])
  const salaryRecord = findFirstRecord(parsedEntry, ['salary', 'estimate', 'salary_estimate', 'summary'])
  const policyRecord = findFirstRecord(parsedEntry, ['policy'])
  const productivityRecord = findFirstRecord(parsedEntry, ['update_productivity', 'updateProductivity', 'productivity'])
  const sources = [parsedEntry, userRecord, salaryRecord, policyRecord].filter(Boolean) as UnknownRecord[]

  const penalties =
    findFirstArray(parsedEntry, ['penalties', 'penalty_entries', 'deductions']) ??
    findFirstArray(salaryRecord ?? {}, ['penalties', 'penalty_entries', 'deductions']) ??
    []
  const bonuses =
    findFirstArray(parsedEntry, ['bonuses', 'bonus_entries']) ??
    findFirstArray(salaryRecord ?? {}, ['bonuses', 'bonus_entries']) ??
    []

  const userId =
    sources.map((source) => findFirstNumber(source, ['user_id', 'employee_id', 'member_id', 'id'])).find((value) => value !== undefined) ?? null
  const baseSalary =
    sources.map((source) => findFirstNumber(source, ['base_salary', 'salary_base', 'default_salary', 'salary_amount', 'base'])).find((value) => value !== undefined)
  const rawDeductionAmount =
    sources.map((source) => findFirstNumber(source, ['raw_deduction_amount'])).find((value) => value !== undefined)
  const appliedDeductionAmount =
    sources.map((source) => findFirstNumber(source, ['applied_deduction_amount', 'total_applied_deduction_amount', 'deduction_amount', 'deduction', 'total_deduction', 'penalty_amount'])).find((value) => value !== undefined)
  const deductionAmount =
    appliedDeductionAmount ??
    rawDeductionAmount ??
    sumByKeys(penalties, ['deduction_amount', 'deduction', 'amount', 'penalty_amount'])
  const bonusAmount =
    sources.map((source) => findFirstNumber(source, ['total_bonus_amount', 'bonus_amount', 'total_bonus', 'bonus'])).find((value) => value !== undefined) ??
    sumByKeys(bonuses, ['bonus_amount', 'amount', 'bonus'])
  const mistakesCount =
    sources.map((source) => findFirstNumber(source, ['mistakes_count', 'mistake_count'])).find((value) => value !== undefined)
  const penaltyPoints =
    sources.map((source) => findFirstNumber(source, ['penalty_points', 'points', 'total_penalty_points'])).find((value) => value !== undefined) ??
    sumByKeys(penalties, ['penalty_points', 'points', 'value'])
  const penaltyEntries =
    sources.map((source) => findFirstNumber(source, ['penalty_entries', 'penalties_count', 'penalty_count'])).find((value) => value !== undefined) ??
    mistakesCount ??
    penalties.length
  const deliveryBonusCount =
    sources.map((source) => findFirstNumber(source, ['delivery_bonus_count', 'delivery_bonuses_count'])).find((value) => value !== undefined)
  const bonusEntries =
    sources.map((source) => findFirstNumber(source, ['bonus_entries', 'bonuses_count', 'bonus_count'])).find((value) => value !== undefined) ??
    deliveryBonusCount ??
    bonuses.length
  const totalBonusPercent =
    sources.map((source) => findFirstNumber(source, ['total_bonus_percent', 'bonus_percent'])).find((value) => value !== undefined)
  const penaltyPercentage =
    sources.map((source) => findFirstNumber(source, ['penalty_percentage', 'deduction_percentage'])).find((value) => value !== undefined)
  const afterPenalty =
    sources.map((source) => findFirstNumber(source, ['after_penalty', 'salary_after_penalty'])).find((value) => value !== undefined)
  const finalSalary =
    sources.map((source) => findFirstNumber(source, ['final_salary', 'final_amount', 'payable_salary'])).find((value) => value !== undefined)
  const estimatedSalary =
    sources.map((source) => findFirstNumber(source, ['estimated_salary', 'salary_estimate', 'salary_amount'])).find((value) => value !== undefined)
  const workingDays =
    productivityRecord ? findFirstNumber(productivityRecord, ['working_days']) : undefined
  const updateDays =
    productivityRecord ? findFirstNumber(productivityRecord, ['update_days']) : undefined
  const productivityPercentage =
    productivityRecord ? findFirstNumber(productivityRecord, ['percentage', 'update_percentage', 'completion_percentage']) : undefined
  const qualifiesProductivityBonus =
    productivityRecord ? toBoolean(productivityRecord.qualifies_productivity_bonus ?? productivityRecord.qualifiesBonus) : null
  const formulaText = findFirstString(salaryRecord ?? parsedEntry, ['formula_text', 'formula'])
  const calculationBreakdown = findFirstRecord(salaryRecord ?? parsedEntry, ['calculation_breakdown', 'calculationBreakdown']) as SalaryEstimateSnapshot['calculationBreakdown']

  const userName = resolveRecordDisplayName(...sources)
  const roleLabel =
    sources.map((source) => findFirstString(source, ['job_title', 'role_name', 'role'])).find(Boolean)
  const userLabel =
    typeof userId === 'number' && Number.isFinite(userId) ? `User #${userId}` : undefined

  const normalizedSnapshot = {
    userId,
    userLabel,
    userName,
    roleLabel,
    baseSalary,
    estimatedSalary,
    penaltyPoints,
    penaltyEntries,
    penaltyPercentage,
    mistakesCount,
    deductionAmount,
    rawDeductionAmount,
    appliedDeductionAmount,
    afterPenalty,
    bonusEntries,
    deliveryBonusCount,
    bonusAmount,
    totalBonusPercent,
    finalSalary,
    workingDays,
    updateDays,
    productivityPercentage,
    qualifiesProductivityBonus: qualifiesProductivityBonus ?? undefined,
    formulaText,
    calculationBreakdown,
  }

  normalizedEstimateEntryCache.set(entry, normalizedSnapshot)

  if (parsedEntry !== entry) {
    normalizedEstimateEntryCache.set(parsedEntry, normalizedSnapshot)
  }

  return normalizedSnapshot
}

export function isEmployeeUser(user: CeoUserRecord) {
  const roleLabel = String(user.role ?? '').toLowerCase()
  return Boolean(user.is_active) && roleLabel !== 'customer'
}

export function buildReportFromUser(user: CeoUserRecord, snapshot?: SalaryEstimateSnapshot | null): EmployeeSalaryReport {
  const {
    baseSalary,
    deductionAmount,
    bonusAmount,
    afterPenalty,
    finalSalary,
    estimatedSalary,
  } = resolveSalaryMetrics(snapshot)
  const penaltyPoints = getOptionalCount(snapshot?.penaltyPoints)
  const mistakesCount = getOptionalCount(snapshot?.mistakesCount)
  const deliveryBonusCount = getOptionalCount(snapshot?.deliveryBonusCount)
  const penaltyEntries = Number.isFinite(getOptionalCount(snapshot?.penaltyEntries))
    ? getOptionalCount(snapshot?.penaltyEntries)
    : mistakesCount
  const bonusEntries = Number.isFinite(getOptionalCount(snapshot?.bonusEntries))
    ? getOptionalCount(snapshot?.bonusEntries)
    : deliveryBonusCount
  const penaltyPercentage = getOptionalMetric(normalizePercentageValue(snapshot?.penaltyPercentage))
  const totalBonusPercent = getOptionalMetric(normalizePercentageValue(snapshot?.totalBonusPercent))
  const workingDays = getOptionalCount(snapshot?.workingDays)
  const updateDays = getOptionalCount(snapshot?.updateDays)
  const productivityPercentage = getOptionalMetric(normalizePercentageValue(snapshot?.productivityPercentage))
  const qualifiesProductivityBonus = snapshot?.qualifiesProductivityBonus === true

  return {
    id: user.id,
    label: snapshot?.userLabel ?? `User #${user.id}`,
    fullName: getUserFullName(user, snapshot),
    roleLabel: normalizeRoleLabel(user, snapshot),
    baseSalary,
    estimatedSalary,
    deductionAmount,
    bonusAmount,
    afterPenalty,
    finalSalary,
    penaltyPoints,
    penaltyEntries,
    bonusEntries,
    penaltyPercentage,
    mistakesCount,
    deliveryBonusCount,
    totalBonusPercent,
    workingDays,
    updateDays,
    productivityPercentage,
    qualifiesProductivityBonus,
    hasPenalty:
      (Number.isFinite(deductionAmount) && deductionAmount > 0) ||
      (Number.isFinite(mistakesCount) && mistakesCount > 0) ||
      (Number.isFinite(penaltyPoints) && penaltyPoints > 0) ||
      (Number.isFinite(penaltyEntries) && penaltyEntries > 0) ||
      (Number.isFinite(penaltyPercentage) && penaltyPercentage > 0),
    hasBonus:
      (Number.isFinite(bonusAmount) && bonusAmount > 0) ||
      (Number.isFinite(bonusEntries) && bonusEntries > 0) ||
      (Number.isFinite(totalBonusPercent) && totalBonusPercent > 0) ||
      qualifiesProductivityBonus,
    formulaText: snapshot?.formulaText,
    calculationBreakdown: snapshot?.calculationBreakdown,
  }
}

export function createVirtualUser(snapshot: SalaryEstimateSnapshot): CeoUserRecord {
  const fullName =
    (snapshot.userName?.trim() && !isUnknownName(snapshot.userName)
      ? snapshot.userName.trim()
      : undefined) ??
    snapshot.userLabel?.trim() ??
    (typeof snapshot.userId === 'number' && snapshot.userId > 0
      ? `Member #${snapshot.userId}`
      : 'Unknown member')
  const parts = fullName.split(/\s+/)
  const name = parts.shift() ?? 'Unknown'

  return {
    id: snapshot.userId ?? 0,
    email: '',
    name,
    surname: parts.join(' '),
    company_code: '',
    telegram_id: null,
    default_salary: snapshot.baseSalary ?? 0,
    role: snapshot.roleLabel ?? 'Member',
    job_title: snapshot.roleLabel ?? null,
    is_active: true,
  }
}

export function buildEmployeeReports(
  users: CeoUserRecord[],
  payload: unknown,
  options?: {
    includeFallbackUsers?: boolean
  },
) {
  const snapshots = extractEstimateEntries(payload).map(normalizeEstimateEntry)
  const includeFallbackUsers = options?.includeFallbackUsers ?? snapshots.length === 0
  const snapshotsById = new Map<number, SalaryEstimateSnapshot>()
  const snapshotsByName = new Map<string, SalaryEstimateSnapshot>()
  const matchedSnapshotKeys = new Set<string>()
  const usersById = new Map<number, CeoUserRecord>()
  const usersByName = new Map<string, CeoUserRecord>()

  for (const snapshot of snapshots) {
    if (typeof snapshot.userId === 'number' && snapshot.userId > 0) {
      snapshotsById.set(snapshot.userId, snapshot)
    }

    if (snapshot.userName?.trim()) {
      snapshotsByName.set(snapshot.userName.trim().toLowerCase(), snapshot)
    }
  }

  for (const user of users) {
    usersById.set(user.id, user)
    usersByName.set(`${user.name} ${user.surname}`.trim().toLowerCase(), user)
  }

  if (!includeFallbackUsers) {
    return snapshots
      .map((snapshot) => {
        const matchedUser =
          (typeof snapshot.userId === 'number' && snapshot.userId > 0
            ? usersById.get(snapshot.userId)
            : undefined) ??
          (snapshot.userName?.trim()
            ? usersByName.get(snapshot.userName.trim().toLowerCase())
            : undefined) ??
          null

        return buildReportFromUser(matchedUser ?? createVirtualUser(snapshot), snapshot)
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
  }

  const reports = users
    .map((user) => {
      const fullName = `${user.name} ${user.surname}`.trim().toLowerCase()
      const snapshot = snapshotsById.get(user.id) ?? snapshotsByName.get(fullName) ?? null

      if (snapshot) {
        matchedSnapshotKeys.add(`${snapshot.userId ?? 0}:${snapshot.userName ?? ''}`)
      }

      return buildReportFromUser(user, snapshot)
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName))

  const extraReports = snapshots
    .filter((snapshot) => !matchedSnapshotKeys.has(`${snapshot.userId ?? 0}:${snapshot.userName ?? ''}`))
    .map((snapshot) => buildReportFromUser(createVirtualUser(snapshot), snapshot))

  return [...reports, ...extraReports].sort((left, right) => left.fullName.localeCompare(right.fullName))
}

export function mergeReportWithSnapshot(
  report: EmployeeSalaryReport,
  user: CeoUserRecord | null,
  snapshot?: SalaryEstimateSnapshot | null,
) {
  const resolvedSalaryMetrics = snapshot ? resolveSalaryMetrics(snapshot) : null
  const baseSalary = resolvedSalaryMetrics?.baseSalary ?? report.baseSalary
  const deductionAmount = resolvedSalaryMetrics?.deductionAmount ?? report.deductionAmount
  const bonusAmount = resolvedSalaryMetrics?.bonusAmount ?? report.bonusAmount
  const mistakesCount = snapshot ? getOptionalCount(snapshot.mistakesCount) : report.mistakesCount
  const deliveryBonusCount = snapshot ? getOptionalCount(snapshot.deliveryBonusCount) : report.deliveryBonusCount
  const penaltyPoints = snapshot ? getOptionalCount(snapshot.penaltyPoints) : report.penaltyPoints
  const penaltyEntries = snapshot
    ? (
      Number.isFinite(getOptionalCount(snapshot.penaltyEntries))
        ? getOptionalCount(snapshot.penaltyEntries)
        : mistakesCount
    )
    : report.penaltyEntries
  const bonusEntries = snapshot
    ? (
      Number.isFinite(getOptionalCount(snapshot.bonusEntries))
        ? getOptionalCount(snapshot.bonusEntries)
        : deliveryBonusCount
    )
    : report.bonusEntries
  const penaltyPercentage = snapshot
    ? getOptionalMetric(normalizePercentageValue(snapshot.penaltyPercentage))
    : report.penaltyPercentage
  const totalBonusPercent = snapshot
    ? getOptionalMetric(normalizePercentageValue(snapshot.totalBonusPercent))
    : report.totalBonusPercent
  const workingDays = snapshot ? getOptionalCount(snapshot.workingDays) : report.workingDays
  const updateDays = snapshot ? getOptionalCount(snapshot.updateDays) : report.updateDays
  const productivityPercentage = snapshot
    ? getOptionalMetric(normalizePercentageValue(snapshot.productivityPercentage))
    : report.productivityPercentage
  const qualifiesProductivityBonus = snapshot ? snapshot.qualifiesProductivityBonus === true : report.qualifiesProductivityBonus
  const afterPenalty = resolvedSalaryMetrics?.afterPenalty ?? report.afterPenalty
  const finalSalary = resolvedSalaryMetrics?.finalSalary ?? report.finalSalary
  const estimatedSalary = resolvedSalaryMetrics?.estimatedSalary ?? report.estimatedSalary
  const formulaText = snapshot?.formulaText ?? report.formulaText
  const calculationBreakdown = snapshot?.calculationBreakdown ?? report.calculationBreakdown

  return {
    ...report,
    label: snapshot?.userLabel ?? report.label,
    fullName: getUserFullName(user, snapshot) || report.fullName,
    roleLabel: normalizeRoleLabel(user, snapshot) || report.roleLabel,
    baseSalary,
    estimatedSalary,
    deductionAmount,
    bonusAmount,
    afterPenalty,
    finalSalary,
    mistakesCount,
    penaltyPoints,
    penaltyEntries,
    deliveryBonusCount,
    bonusEntries,
    penaltyPercentage,
    totalBonusPercent,
    workingDays,
    updateDays,
    productivityPercentage,
    qualifiesProductivityBonus,
    hasPenalty:
      (Number.isFinite(deductionAmount) && deductionAmount > 0) ||
      (Number.isFinite(mistakesCount) && mistakesCount > 0) ||
      (Number.isFinite(penaltyPoints) && penaltyPoints > 0) ||
      (Number.isFinite(penaltyEntries) && penaltyEntries > 0) ||
      (Number.isFinite(penaltyPercentage) && penaltyPercentage > 0),
    hasBonus:
      (Number.isFinite(bonusAmount) && bonusAmount > 0) ||
      (Number.isFinite(bonusEntries) && bonusEntries > 0) ||
      (Number.isFinite(totalBonusPercent) && totalBonusPercent > 0) ||
      qualifiesProductivityBonus,
    formulaText,
    calculationBreakdown,
  } satisfies EmployeeSalaryReport
}

export function getPrimaryEstimateRecord(payload: unknown) {
  const parsedPayload = parseMaybeJson(payload)
  const entries = extractEstimateEntries(parsedPayload)

  if (entries.length > 0) {
    return entries[0]
  }

  return isRecord(parsedPayload) ? parsedPayload : null
}

export function getEstimateRecordForMember(
  payload: unknown,
  memberId?: number | null,
  memberName?: string | null,
) {
  const parsedPayload = parseMaybeJson(payload)
  const entries = extractEstimateEntries(parsedPayload)

  if (entries.length === 0) {
    return isRecord(parsedPayload) ? parsedPayload : null
  }

  const normalizedMemberName = memberName?.trim().toLowerCase()
  const hasMemberId = typeof memberId === 'number' && Number.isFinite(memberId) && memberId > 0
  let matchedByName: UnknownRecord | null = null

  for (const entry of entries) {
    const normalizedEntry = normalizeEstimateEntry(entry)

    if (hasMemberId && normalizedEntry.userId === memberId) {
      return entry
    }

    if (!matchedByName && normalizedMemberName && normalizedEntry.userName?.trim().toLowerCase() === normalizedMemberName) {
      matchedByName = entry
    }
  }

  return matchedByName ?? entries[0]
}

export function buildSalaryLedgerItems(
  payload: unknown,
  kind: 'penalty' | 'bonus',
  report: EmployeeSalaryReport,
) {
  const root = getEstimateRecordForMember(payload, report.id, report.fullName)

  if (!root) {
    return []
  }

  const nestedSummary = findFirstRecord(root, ['salary', 'estimate', 'salary_estimate', 'summary'])
  const candidateItems =
    findFirstArray(root, kind === 'penalty' ? ['penalties', 'penalty_entries', 'deductions'] : ['bonuses', 'bonus_entries']) ??
    findFirstArray(nestedSummary ?? {}, kind === 'penalty' ? ['penalties', 'penalty_entries', 'deductions'] : ['bonuses', 'bonus_entries']) ??
    []

  const items = candidateItems
    .filter(isRecord)
    .map((item, index) => {
      const title =
        findFirstString(item, ['reason', 'title', 'label', 'name', 'note', 'description']) ??
        `${kind === 'penalty' ? 'Penalty' : 'Bonus'} #${index + 1}`
      const description = findFirstString(item, ['description', 'note', 'remarks', 'comment'])
      const amount = Math.max(
        0,
        findFirstNumber(
          item,
          kind === 'penalty'
            ? ['deduction_amount', 'deduction', 'amount', 'penalty_amount', 'value']
            : ['bonus_amount', 'amount', 'bonus', 'value'],
        ) ?? 0,
      )
      const points =
        kind === 'penalty'
          ? Math.max(0, findFirstNumber(item, ['penalty_points', 'points', 'score', 'value']) ?? 0)
          : undefined
      const percentage = normalizePercentageValue(findFirstNumber(item, ['penalty_percentage', 'deduction_percentage', 'percentage', 'percent']))
      const createdAt = findFirstString(item, ['created_at', 'date', 'added_at', 'issued_at', 'updated_at'])

      return {
        id: `${kind}-${index}-${title}`,
        title,
        description: description && description !== title ? description : undefined,
        amount,
        points: points && points > 0 ? points : undefined,
        percentage,
        createdAt,
      } satisfies SalaryLedgerItem
    })
    .filter((item) => item.amount > 0 || (item.points ?? 0) > 0)

  if (items.length > 0) {
    return items
  }

  const normalizedRoot = normalizeEstimateEntry(root)

  if (kind === 'penalty') {
    if ((report.deductionAmount ?? 0) <= 0 && (report.mistakesCount ?? 0) <= 0 && (report.penaltyPoints ?? 0) <= 0) {
      return []
    }

    const penaltyNotes = [
      report.mistakesCount > 0
        ? translateSalaryEstimateText(
          `${report.mistakesCount} client-facing mistake${report.mistakesCount === 1 ? '' : 's'} recorded.`,
          `${report.mistakesCount} ta mijozga ta'sir qilgan xato qayd etildi.`,
          `Зафиксировано ${report.mistakesCount} ошибок, повлиявших на клиента.`,
        )
        : null,
      report.penaltyPoints > 0
        ? translateSalaryEstimateText(
          `${report.penaltyPoints} penalty points applied.`,
          `${report.penaltyPoints} ta penalty ball qo'llandi.`,
          `Применено ${report.penaltyPoints} штрафных баллов.`,
        )
        : null,
    ].filter(Boolean)

    return [
      {
        id: `penalty-derived-${report.id}`,
        title: report.deductionAmount > 0
          ? translateSalaryEstimateText('Calculated monthly deduction', 'Hisoblangan oylik ayirma', 'Рассчитанное месячное удержание')
          : translateSalaryEstimateText('Penalty activity recorded', 'Ayirma faolligi qayd etildi', 'Штрафная активность зафиксирована'),
        description: penaltyNotes.join(' ') || translateSalaryEstimateText(
          'Penalty information was inferred from the salary estimate summary.',
          'Ayirma ma\'lumotlari maosh hisobi xulosasidan aniqlandi.',
          'Информация об удержании была выведена из сводки оценки зарплаты.',
        ),
        amount: Math.max(0, report.deductionAmount),
        points: report.penaltyPoints > 0 ? report.penaltyPoints : undefined,
        percentage: report.penaltyPercentage > 0 ? report.penaltyPercentage : undefined,
      } satisfies SalaryLedgerItem,
    ].filter((item) => item.amount > 0 || (item.points ?? 0) > 0)
  }

  if ((report.bonusAmount ?? 0) <= 0 && (report.totalBonusPercent ?? 0) <= 0 && !report.qualifiesProductivityBonus) {
    return []
  }

  const productivityText =
    report.updateDays >= 0 && report.workingDays >= 0 && Number.isFinite(report.productivityPercentage)
      ? translateSalaryEstimateText(
        `${report.updateDays}/${report.workingDays} update days (${report.productivityPercentage.toFixed(report.productivityPercentage % 1 === 0 ? 0 : 2)}%).`,
        `${report.updateDays}/${report.workingDays} update kuni (${report.productivityPercentage.toFixed(report.productivityPercentage % 1 === 0 ? 0 : 2)}%).`,
        `${report.updateDays}/${report.workingDays} дней с обновлениями (${report.productivityPercentage.toFixed(report.productivityPercentage % 1 === 0 ? 0 : 2)}%).`,
      )
      : null
  const bonusNotes = [
    report.qualifiesProductivityBonus
      ? translateSalaryEstimateText(
        'Full update productivity bonus qualified.',
        'To\'liq update mahsuldorlik bonusi tasdiqlandi.',
        'Бонус за полную продуктивность обновлений подтвержден.',
      )
      : null,
    report.deliveryBonusCount > 0
      ? translateSalaryEstimateText(
        `${report.deliveryBonusCount} delivery bonus trigger${report.deliveryBonusCount === 1 ? '' : 's'} recorded.`,
        `${report.deliveryBonusCount} ta topshirish bonusi triggeri qayd etildi.`,
        `Зафиксировано ${report.deliveryBonusCount} триггеров бонуса за сдачу.`,
      )
      : null,
    productivityText,
  ].filter(Boolean)

  return items
    .concat({
      id: `bonus-derived-${report.id}`,
      title: report.totalBonusPercent > 0
        ? translateSalaryEstimateText(
          `Calculated monthly bonus (${report.totalBonusPercent.toFixed(report.totalBonusPercent % 1 === 0 ? 0 : 2)}%)`,
          `Hisoblangan oylik bonus (${report.totalBonusPercent.toFixed(report.totalBonusPercent % 1 === 0 ? 0 : 2)}%)`,
          `Рассчитанный месячный бонус (${report.totalBonusPercent.toFixed(report.totalBonusPercent % 1 === 0 ? 0 : 2)}%)`,
        )
        : translateSalaryEstimateText('Calculated monthly bonus', 'Hisoblangan oylik bonus', 'Рассчитанный месячный бонус'),
      description: bonusNotes.join(' ') || translateSalaryEstimateText(
        'Bonus information was inferred from the salary estimate summary.',
        'Bonus ma\'lumotlari maosh hisobi xulosasidan aniqlandi.',
        'Информация о бонусе была выведена из сводки оценки зарплаты.',
      ),
      amount: Math.max(0, report.bonusAmount),
      points: undefined,
      percentage: report.totalBonusPercent > 0 ? report.totalBonusPercent : normalizedRoot.totalBonusPercent,
      createdAt: undefined,
    } satisfies SalaryLedgerItem)
    .filter((item) => item.amount > 0 || (item.points ?? 0) > 0)
}

function collectNestedRecords(value: unknown, depth = 0): UnknownRecord[] {
  if (depth > 3) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNestedRecords(item, depth + 1))
  }

  if (!isRecord(value)) {
    return []
  }

  return [
    value,
    ...Object.values(value).flatMap((entry) => (
      Array.isArray(entry) || isRecord(entry)
        ? collectNestedRecords(entry, depth + 1)
        : []
    )),
  ]
}

function looksLikeMistakeRecord(source: UnknownRecord) {
  return [
    'reviewer_id',
    'incident_date',
    'reached_client',
    'unclear_task',
    'severity',
    'category',
  ].some((key) => key in source)
}

function looksLikeDeliveryBonusRecord(source: UnknownRecord) {
  return [
    'bonus_type',
    'award_date',
    'project_id',
    'delivery_bonus_id',
  ].some((key) => key in source)
}

function extractCompensationEntries(
  payload: unknown,
  looksLike: (source: UnknownRecord) => boolean,
) {
  const parsedPayload = parseMaybeJson(payload)
  return collectNestedRecords(parsedPayload).filter(looksLike)
}

function matchesEmployeeRecord(source: UnknownRecord, memberId: number) {
  const sourceMemberId = findFirstNumber(source, ['employee_id', 'user_id', 'member_id'])

  if (!Number.isFinite(memberId) || memberId <= 0 || sourceMemberId === undefined) {
    return true
  }

  return sourceMemberId === memberId
}

function resolveProjectName(source: UnknownRecord) {
  const projectRecord = findFirstRecord(source, ['project'])

  return (
    findFirstString(source, ['project_name']) ??
    findFirstString(projectRecord ?? {}, ['project_name', 'name', 'title'])
  )
}

function resolveReviewerName(source: UnknownRecord) {
  const reviewerRecord = findFirstRecord(source, ['reviewer', 'reviewed_by', 'reviewer_user'])

  return (
    findFirstString(source, ['reviewer_name']) ??
    resolveRecordDisplayName(reviewerRecord ?? null)
  )
}

function normalizeMistakeRecord(source: UnknownRecord, index: number): MemberMistakeRecord {
  const employeeRecord = findFirstRecord(source, ['employee', 'member', 'user'])

  return {
    id: findFirstNumber(source, ['id', 'mistake_id']) ?? index + 1,
    employee_id: findFirstNumber(source, ['employee_id', 'user_id', 'member_id']) ?? 0,
    employee_name: resolveRecordDisplayName(source, employeeRecord ?? null) ?? null,
    reviewer_id: findFirstNumber(source, ['reviewer_id', 'reviewed_by_id']) ?? null,
    reviewer_name: resolveReviewerName(source) ?? null,
    project_id: findFirstNumber(source, ['project_id']) ?? null,
    project_name: resolveProjectName(source) ?? null,
    category: findFirstString(source, ['category']) ?? 'Mistake',
    severity: findFirstString(source, ['severity']) ?? 'Unspecified',
    title: findFirstString(source, ['title', 'name', 'label']) ?? `Mistake #${index + 1}`,
    description: findFirstString(source, ['description', 'note', 'remarks', 'comment']) ?? null,
    incident_date: findFirstString(source, ['incident_date', 'date', 'created_at']) ?? null,
    reached_client: toBoolean(source.reached_client) ?? false,
    unclear_task: toBoolean(source.unclear_task) ?? false,
    created_at: findFirstString(source, ['created_at']) ?? null,
    updated_at: findFirstString(source, ['updated_at']) ?? null,
  }
}

function normalizeDeliveryBonusRecord(source: UnknownRecord, index: number): MemberDeliveryBonusRecord {
  const employeeRecord = findFirstRecord(source, ['employee', 'member', 'user'])

  return {
    id: findFirstNumber(source, ['id', 'bonus_id', 'delivery_bonus_id']) ?? index + 1,
    employee_id: findFirstNumber(source, ['employee_id', 'user_id', 'member_id']) ?? 0,
    employee_name: resolveRecordDisplayName(source, employeeRecord ?? null) ?? null,
    project_id: findFirstNumber(source, ['project_id']) ?? null,
    project_name: resolveProjectName(source) ?? null,
    bonus_type: findFirstString(source, ['bonus_type', 'type', 'category']) ?? 'delivery_bonus',
    title: findFirstString(source, ['title', 'name', 'label']) ?? `Delivery bonus #${index + 1}`,
    description: findFirstString(source, ['description', 'note', 'remarks', 'comment']) ?? null,
    award_date: findFirstString(source, ['award_date', 'date', 'created_at']) ?? null,
    created_at: findFirstString(source, ['created_at']) ?? null,
    updated_at: findFirstString(source, ['updated_at']) ?? null,
  }
}

function buildMistakeRecords(payload: unknown, memberId: number) {
  return extractCompensationEntries(payload, looksLikeMistakeRecord)
    .filter((entry) => matchesEmployeeRecord(entry, memberId))
    .map((entry, index) => normalizeMistakeRecord(entry, index))
    .sort((left, right) => (
      new Date(right.incident_date ?? right.created_at ?? 0).getTime() -
      new Date(left.incident_date ?? left.created_at ?? 0).getTime()
    ))
}

function buildDeliveryBonusRecords(payload: unknown, memberId: number) {
  return extractCompensationEntries(payload, looksLikeDeliveryBonusRecord)
    .filter((entry) => matchesEmployeeRecord(entry, memberId))
    .map((entry, index) => normalizeDeliveryBonusRecord(entry, index))
    .sort((left, right) => (
      new Date(right.award_date ?? right.created_at ?? 0).getTime() -
      new Date(left.award_date ?? left.created_at ?? 0).getTime()
    ))
}

function getPrimaryUpdateRecord(payload: unknown) {
  const parsedPayload = parseMaybeJson(payload)

  if (Array.isArray(parsedPayload)) {
    return parsedPayload.find(isRecord) ?? null
  }

  if (!isRecord(parsedPayload)) {
    return null
  }

  for (const key of ['employees', 'members', 'items', 'results', 'data', 'statistics', 'rows', 'updates']) {
    const candidate = parsedPayload[key]

    if (Array.isArray(candidate)) {
      const firstRecord = candidate.find(isRecord)

      if (firstRecord) {
        return firstRecord
      }
    }

    if (isRecord(candidate)) {
      return candidate
    }
  }

  const nestedRecords = Object.values(parsedPayload).filter(isRecord)

  return nestedRecords[0] ?? parsedPayload
}

function getMonthlyDayFallbackStatus(date: Date): DayStatus {
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

function normalizeMonthlyDayStatus(
  value: unknown,
  date: Date,
  options?: { isDayOff?: boolean | null },
): DayStatus {
  if (date.getDay() === 0 || options?.isDayOff) {
    return 'sunday'
  }

  const fallback = getMonthlyDayFallbackStatus(date)
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

    return normalizeMonthlyDayStatus(
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

function extractArrayFromRecord(source: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function objectDateEntriesToArray(source: UnknownRecord) {
  return Object.entries(source)
    .filter(([key]) => isDateKey(key) || /^\d{1,2}$/.test(key))
    .map(([key, value]) => (
      isDateKey(key)
        ? { date: key, status: value }
        : { day: Number(key), status: value }
    ))
}

function extractMonthlyDayEntries(payload: unknown): UnknownRecord[] {
  const parsedPayload = parseMaybeJson(payload)

  if (!isRecord(parsedPayload)) {
    return []
  }

  const directEntries = extractArrayFromRecord(parsedPayload, monthlyDayCollectionKeys)

  if (directEntries.length > 0) {
    return directEntries.filter(isRecord)
  }

  for (const key of ['data', 'summary', 'statistics', 'calendar', 'monthly_summary']) {
    const nestedRecord = parsedPayload[key]

    if (!isRecord(nestedRecord)) {
      continue
    }

    const nestedEntries = extractArrayFromRecord(nestedRecord, monthlyDayCollectionKeys)

    if (nestedEntries.length > 0) {
      return nestedEntries.filter(isRecord)
    }

    const keyedEntries = objectDateEntriesToArray(nestedRecord)

    if (keyedEntries.length > 0) {
      return keyedEntries.filter(isRecord)
    }
  }

  return objectDateEntriesToArray(parsedPayload).filter(isRecord)
}

function extractMonthlyUpdateItems(payload: unknown): UnknownRecord[] {
  const parsedPayload = parseMaybeJson(payload)

  if (Array.isArray(parsedPayload)) {
    return parsedPayload.filter(isRecord)
  }

  if (!isRecord(parsedPayload)) {
    return []
  }

  const directEntries = extractArrayFromRecord(parsedPayload, monthlyUpdateCollectionKeys)

  if (directEntries.length > 0) {
    return directEntries.filter(isRecord)
  }

  if (Array.isArray(parsedPayload.data)) {
    return parsedPayload.data.filter(isRecord)
  }

  for (const key of ['data', 'summary', 'statistics', 'employee', 'member']) {
    const nestedRecord = parsedPayload[key]

    if (!isRecord(nestedRecord)) {
      continue
    }

    const nestedEntries = extractArrayFromRecord(nestedRecord, monthlyUpdateCollectionKeys)

    if (nestedEntries.length > 0) {
      return nestedEntries.filter(isRecord)
    }
  }

  return []
}

function extractUpdateEntryText(source: UnknownRecord) {
  const directText = findFirstString(source, [...updateTextKeys])

  if (directText) {
    return directText
  }

  const fallbackEntry = Object.entries(source).find(([key, value]) => (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !updateDateKeys.includes(key as (typeof updateDateKeys)[number]) &&
    !isValidDateString(value)
  ))

  return typeof fallbackEntry?.[1] === 'string' ? fallbackEntry[1].trim() : undefined
}

function parseMonthlyUpdateEntry(
  source: UnknownRecord,
  index: number,
  month: number,
  year: number,
): MemberMonthlyUpdateEntry | null {
  const dateValue = findFirstString(source, [...updateDateKeys])

  if (!dateValue) {
    return null
  }

  const parsedDate = parseDateValue(dateValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() + 1 !== month) {
    return null
  }

  const dateKey = formatDateKey(parsedDate)
  const rawId = source.id ?? source.update_id ?? source.uuid
  const title = findFirstString(source, [...updateTitleKeys])
  const text = extractUpdateEntryText(source)

  return {
    id:
      typeof rawId === 'number' || typeof rawId === 'string'
        ? String(rawId)
        : `${dateKey}-${index}`,
    date: dateKey,
    createdAt: dateValue,
    title,
    text,
  }
}

function parseMonthlyDaySeed(
  source: UnknownRecord,
  month: number,
  year: number,
) {
  const dateValue = findFirstString(source, ['date', 'full_date', 'calendar_date', 'day_date'])
  const numericDay = toNumber(source.day ?? source.day_of_month ?? source.day_number)
  const date = dateValue
    ? parseDateValue(dateValue)
    : numericDay
      ? new Date(year, month - 1, numericDay)
      : null

  if (!date || Number.isNaN(date.getTime())) {
    return null
  }

  if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
    return null
  }

  const workdayOverride = extractWorkdayOverride(source)
  const isDayOff = toBoolean(source.is_day_off ?? source.day_off) ?? isWorkdayOverrideOffDay(workdayOverride)
  const explicitHasUpdate = toBoolean(source.has_update ?? source.has_updates ?? source.is_submitted ?? source.submitted)
  const updatesCount = toNumber(source.updates_count ?? source.count ?? source.total_updates ?? source.submitted_count)
  const checkInTime = findFirstString(source, ['check_in_time', 'checkInTime', 'check_in', 'checkIn'])
  const checkOutTime = findFirstString(source, ['check_out_time', 'checkOutTime', 'check_out', 'checkOut'])
  const note = extractUpdateEntryText(source) ?? null
  const normalizedStatus = normalizeMonthlyDayStatus(
    source.status ??
      source.day_status ??
      source.submission_status ??
      source.type ??
      source.is_submitted ??
      source.submitted ??
      source.is_missing ??
      source.missing ??
      source.is_sunday ??
      source.sunday ??
      source.value,
    date,
    { isDayOff },
  )
  const hasUpdate = explicitHasUpdate === true || (updatesCount !== null && updatesCount > 0)

  return {
    day: date.getDate(),
    date: formatDateKey(date),
    status: hasUpdate && normalizedStatus !== 'sunday' ? 'submitted' as const : normalizedStatus,
    isDayOff,
    checkInTime,
    checkOutTime,
    hasUpdate,
    updatesCount: updatesCount ?? (hasUpdate ? 1 : 0),
    note,
    isValid: toBoolean(source.is_valid ?? source.valid),
    workdayOverride,
  }
}

export function buildMemberMonthlyUpdateCalendar(
  payload: unknown,
  month: number,
  year: number,
  includeFallback = false,
): MemberMonthlyUpdateCalendar | null {
  const daySeeds = extractMonthlyDayEntries(payload)
    .map((entry) => parseMonthlyDaySeed(entry, month, year))
    .filter((entry): entry is NonNullable<ReturnType<typeof parseMonthlyDaySeed>> => Boolean(entry))
  const daySeedMap = new Map(daySeeds.map((entry) => [entry.day, entry]))

  const updatesByDate = new Map<string, MemberMonthlyUpdateEntry[]>()

  extractMonthlyUpdateItems(payload)
    .map((entry, index) => parseMonthlyUpdateEntry(entry, index, month, year))
    .filter((entry): entry is MemberMonthlyUpdateEntry => Boolean(entry))
    .forEach((entry) => {
      const bucket = updatesByDate.get(entry.date)

      if (bucket) {
        bucket.push(entry)
        return
      }

      updatesByDate.set(entry.date, [entry])
    })

  if (!includeFallback && daySeedMap.size === 0 && updatesByDate.size === 0) {
    return null
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const currentDate = new Date(year, month - 1, day)
    const dateKey = formatDateKey(currentDate)
    const daySeed = daySeedMap.get(day)
    const entries = updatesByDate.get(dateKey) ?? []
    const hasUpdate = daySeed?.hasUpdate === true || entries.length > 0
    const resolvedStatus = daySeed?.status ?? getMonthlyDayFallbackStatus(currentDate)
    const status = hasUpdate && resolvedStatus !== 'sunday' ? 'submitted' : resolvedStatus
    const updatesCount = Math.max(daySeed?.updatesCount ?? 0, entries.length)

    return {
      day,
      date: dateKey,
      status,
      weekdayShort: new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'short' }).format(currentDate),
      weekdayLabel: new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'long' }).format(currentDate),
      isToday: dateKey === formatDateKey(todayStart),
      isFuture: currentDate > todayStart,
      isWeekend: currentDate.getDay() === 0,
      isDayOff: daySeed?.isDayOff ?? null,
      checkInTime: daySeed?.checkInTime ?? null,
      checkOutTime: daySeed?.checkOutTime ?? null,
      hasUpdate,
      updatesCount,
      entries,
      note: daySeed?.note ?? entries[0]?.text ?? null,
      isValid: daySeed?.isValid ?? null,
      workdayOverride: daySeed?.workdayOverride ?? null,
    } satisfies MemberMonthlyUpdateDay
  })

  return {
    month,
    year,
    days,
    submittedCount: days.filter((day) => day.status === 'submitted').length,
    missingCount: days.filter((day) => day.status === 'missing').length,
    sundayCount: days.filter((day) => day.status === 'sunday').length,
    futureCount: days.filter((day) => day.status === 'future').length,
    totalUpdates: days.reduce((total, day) => total + day.updatesCount, 0),
  }
}

export function parseMemberUpdateSummary(
  payload: unknown,
  calendar?: MemberMonthlyUpdateCalendar | null,
): MemberUpdateSummary | null {
  const primaryRecord = getPrimaryUpdateRecord(payload)

  if (!primaryRecord && !calendar) {
    return null
  }

  const nestedSummary = primaryRecord
    ? findFirstRecord(primaryRecord, ['summary', 'statistics', 'update_stats', 'monthly_stats', 'salary_update'])
    : null
  const sources = [primaryRecord, nestedSummary].filter(Boolean) as UnknownRecord[]

  const submittedCount =
    sources.map((source) => findFirstNumber(source, ['submitted_count', 'updates_count', 'total_submitted', 'logged_count', 'submitted'])).find((value) => value !== undefined)
  const missingCount =
    sources.map((source) => findFirstNumber(source, ['missing_count', 'total_missing', 'missing_days', 'missed_count', 'absent_count', 'missing'])).find((value) => value !== undefined)
  const totalUpdates =
    sources.map((source) => findFirstNumber(source, ['total_updates', 'updates_count', 'submitted_count', 'updates_this_month'])).find((value) => value !== undefined)
  const completionPercentage =
    normalizePercentageValue(
      sources.map((source) => findFirstNumber(source, ['completion_percentage', 'completion_rate', 'percentage', 'percent', 'avg_percentage'])).find((value) => value !== undefined),
    )
  const updatePercentage = normalizePercentageValue(
    sources.map((source) => findFirstNumber(source, ['update_percentage', 'salary_update_percentage'])).find((value) => value !== undefined),
  )
  const salaryAmount = sources.map((source) => findFirstNumber(source, ['salary_amount', 'estimated_salary', 'final_salary', 'payable_salary'])).find((value) => value !== undefined)
  const nextPaymentDate = sources.map((source) => findFirstString(source, ['next_payment_date', 'payment_date'])).find(Boolean)
  const note = sources.map((source) => findFirstString(source, ['note', 'summary', 'description', 'remarks'])).find(Boolean)
  const lastUpdateDate = sources.map((source) => findFirstString(source, ['last_update_date', 'last_update', 'updated_at', 'submitted_at'])).find(Boolean)
  const isCurrentPeriod = calendar !== null && calendar !== undefined && calendar.month === defaultMonth && calendar.year === defaultYear
  const calendarSummary = calendar
    ? (() => {
        const activeCalendar = calendar
        const completedDays = activeCalendar.days.filter((day) => day.status === 'submitted' || day.status === 'missing')
        const lastSubmittedDay = [...activeCalendar.days]
          .reverse()
          .find((day) => day.status === 'submitted' || day.entries.length > 0 || day.hasUpdate)
        const latestEntryTimestamp = lastSubmittedDay?.entries
          ?.map((entry) => entry.createdAt)
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]

        return {
          submittedCount: activeCalendar.submittedCount,
          missingCount: activeCalendar.missingCount,
          totalUpdates: activeCalendar.totalUpdates,
          completionPercentage:
            completedDays.length > 0
              ? (activeCalendar.submittedCount / completedDays.length) * 100
              : 0,
          lastUpdateDate: latestEntryTimestamp ?? lastSubmittedDay?.date,
        }
      })()
    : null
  const shouldUseCalendarSummary =
    Boolean(calendarSummary) && (
      isCurrentPeriod ||
      submittedCount === undefined ||
      missingCount === undefined ||
      totalUpdates === undefined ||
      completionPercentage === undefined
    )

  if (
    submittedCount === undefined &&
    missingCount === undefined &&
    totalUpdates === undefined &&
    completionPercentage === undefined &&
    updatePercentage === undefined &&
    salaryAmount === undefined &&
    !nextPaymentDate &&
    !note &&
    !lastUpdateDate &&
    !calendarSummary
  ) {
    return null
  }

  return {
    totalUpdates: shouldUseCalendarSummary ? calendarSummary!.totalUpdates : totalUpdates ?? missingMetricValue,
    submittedCount: shouldUseCalendarSummary ? calendarSummary!.submittedCount : submittedCount ?? missingMetricValue,
    missingCount: shouldUseCalendarSummary ? calendarSummary!.missingCount : missingCount ?? missingMetricValue,
    completionPercentage: shouldUseCalendarSummary ? calendarSummary!.completionPercentage : completionPercentage ?? missingMetricValue,
    updatePercentage: updatePercentage ?? (shouldUseCalendarSummary ? calendarSummary!.completionPercentage : undefined),
    salaryAmount,
    nextPaymentDate,
    note,
    lastUpdateDate: lastUpdateDate ?? calendarSummary?.lastUpdateDate,
  }
}

export function buildEmployeeSalaryDetail({
  report,
  user,
  estimatePayload,
  policyPayload,
  mistakesPayload,
  deliveryBonusesPayload,
  updatesPayload,
  calendarPayload,
  estimateError,
  policyError,
  mistakesError,
  deliveryBonusesError,
  updatesError,
  calendarError,
  year,
  month,
}: {
  report: EmployeeSalaryReport
  user: CeoUserRecord | null
  estimatePayload: unknown
  policyPayload: unknown
  mistakesPayload: unknown
  deliveryBonusesPayload: unknown
  updatesPayload: unknown
  calendarPayload: unknown
  estimateError?: string | null
  policyError?: string | null
  mistakesError?: string | null
  deliveryBonusesError?: string | null
  updatesError?: string | null
  calendarError?: string | null
  year: number
  month: number
}): EmployeeSalaryDetail {
  const estimateRecord = getEstimateRecordForMember(estimatePayload, report.id, report.fullName)
  const snapshot = estimateRecord ? normalizeEstimateEntry(estimateRecord) : null
  const policy =
    buildEmployeeCompensationPolicy(policyPayload, report.id, report.fullName) ??
    buildEmployeeCompensationPolicy(estimatePayload, report.id, report.fullName)
  const mergedReport = mergeReportWithSnapshot(report, user, snapshot)
  const mergedReportWithPolicy =
    policy && Number.isFinite(policy.salaryBase) && (mergedReport.baseSalary <= 0 || !Number.isFinite(mergedReport.baseSalary))
      ? {
          ...mergedReport,
          baseSalary: policy.salaryBase!,
        }
      : mergedReport
  const updateCalendar = calendarError
    ? null
    : buildMemberMonthlyUpdateCalendar(calendarPayload, month, year, true)

  return {
    memberId: mergedReportWithPolicy.id,
    year,
    month,
    report: mergedReportWithPolicy,
    compensationPolicy: policy,
    penalties: buildSalaryLedgerItems(estimatePayload, 'penalty', mergedReportWithPolicy),
    bonuses: buildSalaryLedgerItems(estimatePayload, 'bonus', mergedReportWithPolicy),
    mistakes: buildMistakeRecords(mistakesPayload, mergedReportWithPolicy.id),
    deliveryBonuses: buildDeliveryBonusRecords(deliveryBonusesPayload, mergedReportWithPolicy.id),
    updatesSummary: parseMemberUpdateSummary(updatesPayload, updateCalendar),
    updateCalendar,
    estimateSource: estimateRecord ? 'live' : 'fallback',
    estimateError,
    policyError,
    mistakesError,
    deliveryBonusesError,
    updatesError,
    calendarError,
  }
}

export function getSuccessMessage(payload: unknown, fallback: string) {
  const data = parseMaybeJson(payload)

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (isRecord(data)) {
    return findFirstString(data, ['message', 'detail', 'status']) ?? fallback
  }

  return fallback
}
