import { Suspense, type ReactNode, lazy, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { cn } from '../../../shared/lib/cn'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import type {
  MemberDeliveryBonusPayload,
  MemberDeliveryBonusRecord,
  MemberMistakePayload,
  MemberMistakeRecord,
  SimpleBonusRecord,
  SimplePenaltyRecord,
} from '../../../shared/api/types'
import { attendanceService } from '../../../shared/api/services/attendance.service'
import { membersService } from '../../../shared/api/services/members.service'
import { developerKpiService, type SalaryEstimate, type Feature } from '../../../shared/api/services/developer-kpi.service'
import { updateTrackingService } from '../../../shared/api/services/updateTracking.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardMetric, CardSection } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { SelectField } from '../../../shared/ui/select-field'
import { AsyncContentLoader } from '../../../shared/ui/async-content-loader'
import { ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  DeliveryBonusSection,
  MistakeIncidentSection,
  SimpleBonusSection,
  SimplePenaltySection,
} from '../components/CompensationRecordPanels'
import { MemberMonthlyUpdateCalendarBoard } from '../components/MemberMonthlyUpdateCalendar'
import SalaryAttendanceDonut from '../components/SalaryAttendanceDonut'
import { RefreshIcon } from '../components/SalaryEstimatePrimitives'
import {
  buildEmployeeSalaryDetail,
  buildEmployeeReports,
  buildReportFromUser,
  createVirtualUser,
  defaultMonth,
  defaultYear,
  findFirstRecord,
  formatAmount,
  formatCount,
  formatDetailDate,
  formatPercent,
  getCompensationPolicyCategoryOptions,
  getCompensationPolicyDeliveryBonusOptions,
  getCompensationPolicySeverityOptions,
  getEstimateRecordForMember,
  getMonthOptions,
  getMonthName,
  getSuccessMessage,
  isRecord,
  normalizeEstimateEntry,
  parseMaybeJson,
  resolveRecordDisplayName,
} from '../lib/salaryEstimates'

const CompensationPolicyDrawer = lazy(async () => {
  const module = await import('../components/CompensationPolicyDrawer')

  return {
    default: module.CompensationPolicyDrawer,
  }
})

type FaultsMemberDetailPageMode = 'salary-detail' | 'member-updates'

type FaultsMemberDetailPageProps = {
  memberIdOverride?: number
  mode?: FaultsMemberDetailPageMode
}

type MistakeFormState = {
  reviewerId: string
  projectId: string
  category: string
  severity: string
  title: string
  description: string
  incidentDate: string
  reachedClient: boolean
  unclearTask: boolean
}

type DeliveryBonusFormState = {
  projectId: string
  bonusType: string
  title: string
  description: string
  awardDate: string
}

type SimpleBonusPenaltyFormState = {
  amount: string
  reason: string
}

type CompensationDeleteTarget =
  | {
      kind: 'mistake'
      record: MemberMistakeRecord
    }
  | {
      kind: 'delivery-bonus'
      record: MemberDeliveryBonusRecord
    }
  | {
      kind: 'simple-bonus'
      record: SimpleBonusRecord
    }
  | {
      kind: 'simple-penalty'
      record: SimplePenaltyRecord
    }

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parsePeriodNumber(value: string | null, fallback: number, min: number, max: number) {
  if (!value?.trim()) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return clampNumber(parsed, min, max)
}

function getTodayDateInput() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDateInput(value?: string | null) {
  if (!value) {
    return getTodayDateInput()
  }

  const normalized = value.slice(0, 10)

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return getTodayDateInput()
  }

  return parsed.toISOString().slice(0, 10)
}

function createMistakeFormState(defaultReviewerId = '', defaultCategory = 'AI Integration', defaultSeverity = 'Minor'): MistakeFormState {
  return {
    reviewerId: defaultReviewerId,
    projectId: '0',
    category: defaultCategory,
    severity: defaultSeverity,
    title: '',
    description: '',
    incidentDate: getTodayDateInput(),
    reachedClient: false,
    unclearTask: false,
  }
}

function createDeliveryBonusFormState(defaultBonusType = 'early_delivery'): DeliveryBonusFormState {
  return {
    projectId: '0',
    bonusType: defaultBonusType,
    title: '',
    description: '',
    awardDate: getTodayDateInput(),
  }
}

function parsePositiveId(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function findHistoryEmployeeRecord(payload: unknown, memberId: number) {
  const parsed = parseMaybeJson(payload)

  if (!isRecord(parsed) || !Array.isArray(parsed.employees)) {
    return null
  }

  return parsed.employees.find((item) => (
    isRecord(item) &&
    Number(item.user_id ?? item.id ?? item.employee_id ?? item.member_id) === memberId
  )) ?? null
}

function findHistoryPeriodRecord(historyEmployeeRecord: Record<string, unknown> | null, year: number, month: number) {
  if (!historyEmployeeRecord || !Array.isArray(historyEmployeeRecord.periods)) {
    return null
  }

  return historyEmployeeRecord.periods.find((item) => (
    isRecord(item) &&
    Number(item.year) === year &&
    Number(item.month) === month
  )) ?? null
}

function resolveMemberDisplayName(...sources: Array<unknown>) {
  for (const source of sources) {
    const parsed = parseMaybeJson(source)
    const candidateRecords: Record<string, unknown>[] = []

    if (Array.isArray(parsed)) {
      const firstRecord = parsed.find(isRecord)

      if (firstRecord) {
        candidateRecords.push(firstRecord)
      }
    } else if (isRecord(parsed)) {
      candidateRecords.push(parsed)

      for (const key of ['user', 'employee', 'member', 'user_data', 'member_data', 'summary', 'statistics', 'salary_update', 'monthly_stats']) {
        const nestedRecord = findFirstRecord(parsed, [key])

        if (nestedRecord) {
          candidateRecords.push(nestedRecord)
        }
      }

      for (const key of ['employees', 'members', 'items', 'results', 'rows', 'updates', 'data']) {
        const collection = parsed[key]

        if (!Array.isArray(collection)) {
          continue
        }

        const firstRecord = collection.find(isRecord)

        if (firstRecord) {
          candidateRecords.push(firstRecord)
        }
      }
    }

    const resolvedName = resolveRecordDisplayName(...candidateRecords)

    if (resolvedName) {
      return resolvedName
    }
  }

  return null
}

type SnapshotCardProps = {
  label: string
  value: string
  accent?: 'default' | 'danger' | 'blue' | 'success' | 'warning'
  secondaryValue?: string
  icon?: ReactNode
}

function SnapshotCard({
  label,
  value,
  accent = 'default',
  secondaryValue,
  icon,
}: SnapshotCardProps) {
  const iconClasses = {
    default: 'border-(--border) bg-(--muted-surface) text-(--muted-strong)',
    danger: 'border-(--danger-border) bg-(--danger-dim) text-(--danger-text)',
    blue: 'border-(--blue-border) bg-(--blue-dim) text-(--blue-text)',
    success: 'border-(--success-border) bg-(--success-dim) text-(--success-text)',
    warning: 'border-(--warning-border) bg-(--warning-dim) text-(--warning-text)',
  } as const

  const valueClasses = {
    default: 'text-(--foreground)',
    danger: 'text-(--danger-text)',
    blue: 'text-(--blue-text)',
    success: 'text-(--success-text)',
    warning: 'text-(--warning-text)',
  } as const

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-(--border) bg-(--surface-elevated) p-4 shadow-sm transition-all hover:border-(--blue-border) hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors', iconClasses[accent])}>
          {icon || (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          )}
        </div>
        {secondaryValue ? (
          <span className="rounded-full border border-(--border) bg-(--muted-surface) px-2 py-0.5 text-[10px] font-bold tabular-nums text-(--muted-strong)">
            {secondaryValue}
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
          {label}
        </p>
        <p className={cn('mt-1.5 text-lg font-bold tabular-nums tracking-tight', valueClasses[accent])}>
          {value}
        </p>
      </div>
    </div>
  )
}

export function FaultsMemberDetailPage({
  memberIdOverride,
  mode = 'salary-detail',
}: FaultsMemberDetailPageProps = {}) {
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [mistakeDraft, setMistakeDraft] = useState<MistakeFormState>(() => createMistakeFormState())
  const [deliveryBonusDraft, setDeliveryBonusDraft] = useState<DeliveryBonusFormState>(() => createDeliveryBonusFormState())
  const [editingMistake, setEditingMistake] = useState<MemberMistakeRecord | null>(null)
  const [editingDeliveryBonus, setEditingDeliveryBonus] = useState<MemberDeliveryBonusRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompensationDeleteTarget | null>(null)
  const [isMistakeDialogOpen, setIsMistakeDialogOpen] = useState(false)
  const [isDeliveryBonusDialogOpen, setIsDeliveryBonusDialogOpen] = useState(false)
  const [isCompensationPolicyDrawerOpen, setIsCompensationPolicyDrawerOpen] = useState(false)
  const [isMistakeSubmitting, setIsMistakeSubmitting] = useState(false)
  const [isDeliveryBonusSubmitting, setIsDeliveryBonusSubmitting] = useState(false)
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [simpleBonusDraft, setSimpleBonusDraft] = useState<SimpleBonusPenaltyFormState>({ amount: '', reason: '' })
  const [simplePenaltyDraft, setSimplePenaltyDraft] = useState<SimpleBonusPenaltyFormState>({ amount: '', reason: '' })
  const [isSimpleBonusDialogOpen, setIsSimpleBonusDialogOpen] = useState(false)
  const [isSimplePenaltyDialogOpen, setIsSimplePenaltyDialogOpen] = useState(false)
  const [isSimpleBonusSubmitting, setIsSimpleBonusSubmitting] = useState(false)
  const [isSimplePenaltySubmitting, setIsSimplePenaltySubmitting] = useState(false)
  const lt = translateCurrentLiteral
  const locale = getIntlLocale()
  const tr = (key: string, uzFallback: string, ruFallback: string) => {
    const value = lt(key)

    if (value !== key) {
      return value
    }

    if (locale.startsWith('ru')) {
      return ruFallback
    }

    if (locale.startsWith('en')) {
      return key
    }

    return uzFallback
  }

  const isMemberUpdatesMode = mode === 'member-updates'
  const memberId = memberIdOverride ?? Number(params.memberId)
  const year = parsePeriodNumber(searchParams.get('year'), defaultYear, 2020, 2035)
  const month = parsePeriodNumber(searchParams.get('month'), defaultMonth, 1, 12)
  const pageEyebrow = isMemberUpdatesMode ? lt('Updates / My Detail') : lt('CEO / Salary / Detail')
  const loadingTitle = isMemberUpdatesMode ? lt('Loading your update detail') : lt('Loading member salary detail')
  const loadingDescription = isMemberUpdatesMode
    ? lt('Retrieving your monthly update context, estimate snapshot and activity details.')
    : lt('Retrieving member estimate, penalties, bonuses, and monthly update context.')
  const errorActionLabel = isMemberUpdatesMode ? lt('Back to dashboard') : lt('Back to salary estimates')
  const backTarget = isMemberUpdatesMode ? '/member/dashboard' : `/faults?year=${year}&month=${month}`
  const topHeaderEyebrow = isMemberUpdatesMode ? lt('My Update Detail') : lt('CEO Salary Detail')
  const showCompensationActions = !isMemberUpdatesMode
  const needsMistakeSupportData = showCompensationActions && isMistakeDialogOpen
  const needsDeliveryBonusSupportData = showCompensationActions && isDeliveryBonusDialogOpen
  const needsProjectSupportData = needsMistakeSupportData || needsDeliveryBonusSupportData

  const reviewerOptionsQuery = useAsyncData(
    () => updateTrackingService.workdayOverrideMemberOptions(),
    [],
    { enabled: needsMistakeSupportData },
  )
  const projectsQuery = useAsyncData(
    async () => {
      const { projectsService } = await import('../../../shared/api/services/projects.service')
      return projectsService.listProjects()
    },
    [],
    { enabled: needsProjectSupportData },
  )
  const allUsersQuery = useAsyncData(
    async () => {
      const { projectsService } = await import('../../../shared/api/services/projects.service')
      return projectsService.getAllUsers()
    },
    [],
    { enabled: needsMistakeSupportData },
  )
  const reviewerOptionsRaw = (allUsersQuery.data?.length
    ? allUsersQuery.data.map((user) => ({
        value: String(user.id),
        label: `${user.name} ${user.surname}`.trim() || user.email || `${tr('Reviewer', "Ko'rib chiquvchi", 'Проверяющий')} #${user.id}`,
      }))
    : (reviewerOptionsQuery.data ?? []).map((member) => ({
        value: String(member.id),
        label: member.full_name || `${member.name} ${member.surname}`.trim() || `${tr('Reviewer', "Ko'rib chiquvchi", 'Проверяющий')} #${member.id}`,
      })))
  const projectOptionsRaw = [
    { value: '0', label: tr('No project', "Loyiha yo'q", 'Без проекта') },
    ...((projectsQuery.data?.projects ?? []).map((project) => ({
      value: String(project.id),
      label: project.project_name,
    }))),
  ]
  const defaultReviewerIdRaw =
    reviewerOptionsRaw.find((option) => Number(option.value) === currentUser?.id)?.value ??
    reviewerOptionsRaw[0]?.value ??
    ''
  const reviewerOptions = useMemo(() => reviewerOptionsRaw, [reviewerOptionsRaw])
  const projectOptions = useMemo(() => projectOptionsRaw, [projectOptionsRaw])
  const defaultReviewerId = useMemo(() => defaultReviewerIdRaw, [defaultReviewerIdRaw])

  const detailQuery = useAsyncData(
    async () => {
      const [estimateResult, policyResult, mistakesResult, deliveryBonusesResult, updatesResult, calendarResult, historyResult] = await Promise.allSettled([
        membersService.salaryEstimates({ year, month, employeeIds: [memberId] }),
        membersService.compensationPolicy({ employeeIds: [memberId] }),
        membersService.listMistakes({ year, month, employeeId: memberId }),
        membersService.listDeliveryBonuses({ year, month, employeeId: memberId }),
        membersService.updatesStatistics({ year, month, employeeIds: [memberId] }),
        updateTrackingService.employeeMonthlyUpdates(year, month, memberId),
        membersService.updatesAll({ year, month, employeeIds: [memberId] }),
      ])

      const estimatePayload = estimateResult.status === 'fulfilled' ? estimateResult.value : null
      const policyPayload = policyResult.status === 'fulfilled' ? policyResult.value : null
      const mistakesPayload = mistakesResult.status === 'fulfilled' ? mistakesResult.value : null
      const deliveryBonusesPayload = deliveryBonusesResult.status === 'fulfilled' ? deliveryBonusesResult.value : null
      const updatesPayload = updatesResult.status === 'fulfilled' ? updatesResult.value : null
      const calendarPayload = calendarResult.status === 'fulfilled' ? calendarResult.value : null
      const historyPayload = historyResult.status === 'fulfilled' ? historyResult.value : null
      const historyEmployeeRecord = findHistoryEmployeeRecord(historyPayload, memberId)
      const historyPeriodRecord = findHistoryPeriodRecord(historyEmployeeRecord, year, month)
      const effectiveEstimatePayload = estimatePayload ?? historyPeriodRecord ?? historyEmployeeRecord
      const estimateRecord = getEstimateRecordForMember(effectiveEstimatePayload, memberId)
      const snapshot = estimateRecord ? normalizeEstimateEntry(estimateRecord) : null
      const historyReport = historyPayload
        ? buildEmployeeReports([], historyPayload, { includeFallbackUsers: false }).find((entry) => entry.id === memberId) ?? null
        : null
      const historyReportBaseSalary = historyReport?.baseSalary
      const resolvedUserName =
        resolveMemberDisplayName(
          estimatePayload,
          effectiveEstimatePayload,
          historyPeriodRecord,
          historyEmployeeRecord,
          updatesPayload,
          calendarPayload,
        ) ??
        historyReport?.fullName ??
        `Member #${memberId}`
      const resolvedSnapshot = snapshot
        ? {
            ...snapshot,
            userId: snapshot.userId ?? memberId,
            userName: snapshot.userName?.trim() || resolvedUserName,
          }
        : null
      const apiUser = resolvedSnapshot
        ? {
            ...createVirtualUser(resolvedSnapshot),
            id: resolvedSnapshot.userId ?? memberId,
          }
        : historyEmployeeRecord || historyReport || resolvedUserName
          ? {
              ...createVirtualUser({
                userId: memberId,
                userName: resolvedUserName,
                roleLabel: historyReport?.roleLabel ?? lt('Member'),
                baseSalary:
                  typeof historyEmployeeRecord?.default_salary === 'number'
                    ? historyEmployeeRecord.default_salary
                    : typeof historyReportBaseSalary === 'number' && Number.isFinite(historyReportBaseSalary)
                      ? historyReportBaseSalary
                      : undefined,
              }),
              id: memberId,
            }
          : null
      const fallbackReport =
        resolvedSnapshot && apiUser
          ? buildReportFromUser(apiUser, resolvedSnapshot)
          : historyReport ?? (apiUser ? buildReportFromUser(apiUser) : null)

      if (!fallbackReport) {
        throw new Error('Could not resolve this member from the Employees API salary estimate response.')
      }

      return buildEmployeeSalaryDetail({
        report: fallbackReport,
        user: apiUser,
        estimatePayload: effectiveEstimatePayload,
        policyPayload,
        mistakesPayload,
        deliveryBonusesPayload,
        updatesPayload,
        calendarPayload,
        estimateError: estimateResult.status === 'rejected' ? getApiErrorMessage(estimateResult.reason) : null,
        policyError: policyResult.status === 'rejected' ? getApiErrorMessage(policyResult.reason) : null,
        mistakesError: mistakesResult.status === 'rejected' ? getApiErrorMessage(mistakesResult.reason) : null,
        deliveryBonusesError: deliveryBonusesResult.status === 'rejected' ? getApiErrorMessage(deliveryBonusesResult.reason) : null,
        updatesError: updatesResult.status === 'rejected' ? getApiErrorMessage(updatesResult.reason) : null,
        calendarError: calendarResult.status === 'rejected' ? getApiErrorMessage(calendarResult.reason) : null,
        year,
        month,
      })
    },
    [memberId, year, month],
    {
      enabled: Number.isFinite(memberId) && memberId > 0,
    },
  )

  const simpleBonusesQuery = useAsyncData(
    async () => {
      const raw = await membersService.listSimpleBonuses({ user_id: memberId, year, month })
      if (Array.isArray(raw)) return raw as SimpleBonusRecord[]
      if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items)) {
        return (raw as Record<string, unknown>).items as SimpleBonusRecord[]
      }
      return [] as SimpleBonusRecord[]
    },
    [memberId, year, month],
    { enabled: Number.isFinite(memberId) && memberId > 0 && showCompensationActions },
  )

  const simplePenaltiesQuery = useAsyncData(
    async () => {
      const raw = await membersService.listSimplePenalties({ user_id: memberId, year, month })
      if (Array.isArray(raw)) return raw as SimplePenaltyRecord[]
      if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items)) {
        return (raw as Record<string, unknown>).items as SimplePenaltyRecord[]
      }
      return [] as SimplePenaltyRecord[]
    },
    [memberId, year, month],
    { enabled: Number.isFinite(memberId) && memberId > 0 && showCompensationActions },
  )

  const simpleBonuses = simpleBonusesQuery.data ?? []
  const simplePenalties = simplePenaltiesQuery.data ?? []

  const attendanceQuery = useAsyncData(
    () => attendanceService.getPublicUser(memberId, { year, month, page_size: 100 }),
    [memberId, year, month],
    { enabled: Number.isFinite(memberId) && memberId > 0 },
  )

  const attendanceRecords = useMemo(() => {
    const sessions = attendanceQuery.data?.employees?.[0]?.attendance_records ?? []
    const byDate = new Map<string, { checkIn: string | null; checkOut: string | null; workedMinutes: number }>()
    for (const s of sessions) {
      const date = s.session_date
      const existing = byDate.get(date)
      if (existing) {
        if (s.came_at && (!existing.checkIn || s.came_at < existing.checkIn)) existing.checkIn = s.came_at
        if (s.gone_at && (!existing.checkOut || s.gone_at > existing.checkOut)) existing.checkOut = s.gone_at
        existing.workedMinutes += s.worked_minutes
      } else {
        byDate.set(date, { checkIn: s.came_at, checkOut: s.gone_at, workedMinutes: s.worked_minutes })
      }
    }
    return Array.from(byDate.entries()).map(([date, d]) => ({
      employee_id: memberId,
      attendance_date: date,
      check_in_time: d.checkIn,
      check_out_time: d.checkOut,
      worked_minutes: d.workedMinutes,
      worked_hours_decimal: d.workedMinutes / 60,
      status: d.checkIn ? 'present' : 'absent',
      shift_name: null,
      source_system: 'cloudflare' as const,
      source_session_id: null,
      is_manual: false,
      note: null,
      source_updated_at: null,
    }))
  }, [attendanceQuery.data, memberId])

  const kpiQuery = useAsyncData(
    async () => {
      if (memberId <= 0) throw new Error('Invalid member')
      return developerKpiService.getSalaryEstimate(memberId, year, month)
    },
    [memberId, year, month],
    { enabled: Number.isFinite(memberId) && memberId > 0 },
  )
  const kpiEstimate: SalaryEstimate | undefined = kpiQuery.data

  const kpiFeaturesQuery = useAsyncData(
    async () => {
      if (memberId <= 0) throw new Error('Invalid member')
      return developerKpiService.listFeatures({ owner_id: memberId, year, month })
    },
    [memberId, year, month],
    { enabled: Number.isFinite(memberId) && memberId > 0 },
  )
  const kpiFeatures: Feature[] = Array.isArray(kpiFeaturesQuery.data) ? kpiFeaturesQuery.data : []

  const detail = detailQuery.data
  const compensationPolicy = detail?.compensationPolicy ?? null
  const mistakeCategoryOptions = getCompensationPolicyCategoryOptions(compensationPolicy).map((option) => ({
    ...option,
    label: lt(option.label),
  }))
  const severityOptions = getCompensationPolicySeverityOptions(compensationPolicy).map((option) => ({
    ...option,
    label: lt(option.label),
  }))
  const deliveryBonusTypeOptions = getCompensationPolicyDeliveryBonusOptions(compensationPolicy).map((option) => ({
    ...option,
    label: lt(option.label),
  }))
  const defaultCategory = mistakeCategoryOptions[0]?.value ?? 'AI Integration'
  const defaultSeverity = severityOptions[0]?.value ?? 'Minor'
  const defaultDeliveryBonusType = deliveryBonusTypeOptions[0]?.value ?? 'early_delivery'

  function updatePeriod(next: { year?: number; month?: number }) {
    const nextYear = next.year ?? year
    const nextMonth = next.month ?? month
    setSearchParams({
      year: String(nextYear),
      month: String(nextMonth),
    }, { replace: true })
  }

  function handleCalendarMonthShift(delta: number) {
    const shifted = new Date(year, month - 1 + delta, 1)
    updatePeriod({
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
    })
  }

  function handleCalendarTodayJump() {
    updatePeriod({
      year: defaultYear,
      month: defaultMonth,
    })
  }

  async function handleRefresh() {
    try {
      await Promise.all([
        detailQuery.refetch(),
        showCompensationActions ? allUsersQuery.refetch() : Promise.resolve(undefined),
        showCompensationActions ? simpleBonusesQuery.refetch() : Promise.resolve(undefined),
        showCompensationActions ? simplePenaltiesQuery.refetch() : Promise.resolve(undefined),
      ])
      showToast({
        title: lt('Member detail refreshed'),
        description: `${detail?.report.fullName ?? lt('Member')} ${lt('synced for')} ${getMonthName(month)} ${year}.`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Member detail refresh failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  function openMistakeDialog(record?: MemberMistakeRecord) {
    setEditingMistake(record ?? null)
    setMistakeDraft(
      record
        ? {
            reviewerId: String(record.reviewer_id ?? defaultReviewerId),
            projectId: String(record.project_id ?? 0),
            category: record.category,
            severity: record.severity,
            title: record.title,
            description: record.description ?? '',
            incidentDate: normalizeDateInput(record.incident_date ?? record.created_at),
            reachedClient: record.reached_client,
            unclearTask: record.unclear_task,
          }
        : createMistakeFormState(defaultReviewerId, defaultCategory, defaultSeverity),
    )
    setIsMistakeDialogOpen(true)
  }

  function openDeliveryBonusDialog(record?: MemberDeliveryBonusRecord) {
    setEditingDeliveryBonus(record ?? null)
    setDeliveryBonusDraft(
      record
        ? {
            projectId: String(record.project_id ?? 0),
            bonusType: record.bonus_type,
            title: record.title,
            description: record.description ?? '',
            awardDate: normalizeDateInput(record.award_date ?? record.created_at),
          }
        : createDeliveryBonusFormState(defaultDeliveryBonusType),
    )
    setIsDeliveryBonusDialogOpen(true)
  }

  function closeMistakeDialog() {
    setIsMistakeDialogOpen(false)
    setEditingMistake(null)
    setMistakeDraft(createMistakeFormState(defaultReviewerId, defaultCategory, defaultSeverity))
  }

  function closeDeliveryBonusDialog() {
    setIsDeliveryBonusDialogOpen(false)
    setEditingDeliveryBonus(null)
    setDeliveryBonusDraft(createDeliveryBonusFormState(defaultDeliveryBonusType))
  }

  function buildMistakePayload(): MemberMistakePayload | null {
    if (!detail) {
      return null
    }

    const reviewerId = parsePositiveId(mistakeDraft.reviewerId)

    if (!reviewerId) {
      showToast({
        title: lt('Reviewer is required'),
        description: lt('Select a valid reviewer before saving this mistake incident.'),
        tone: 'error',
      })
      return null
    }

    if (!mistakeDraft.title.trim() || !mistakeDraft.category.trim() || !mistakeDraft.severity.trim()) {
      showToast({
        title: lt('Mistake details incomplete'),
        description: lt('Title, category, and severity are required.'),
        tone: 'error',
      })
      return null
    }

    return {
      employee_id: detail.report.id,
      reviewer_id: reviewerId,
      project_id: parsePositiveId(mistakeDraft.projectId) ?? 0,
      category: mistakeDraft.category.trim(),
      severity: mistakeDraft.severity.trim(),
      title: mistakeDraft.title.trim(),
      description: mistakeDraft.description.trim() || undefined,
      incident_date: mistakeDraft.incidentDate,
      reached_client: mistakeDraft.reachedClient,
      unclear_task: mistakeDraft.unclearTask,
    }
  }

  function buildDeliveryBonusPayload(): MemberDeliveryBonusPayload | null {
    if (!detail) {
      return null
    }

    if (!deliveryBonusDraft.title.trim() || !deliveryBonusDraft.bonusType.trim()) {
      showToast({
        title: lt('Delivery bonus details incomplete'),
        description: lt('Title and bonus type are required.'),
        tone: 'error',
      })
      return null
    }

    return {
      employee_id: detail.report.id,
      bonus_type: deliveryBonusDraft.bonusType.trim(),
      title: deliveryBonusDraft.title.trim(),
      description: deliveryBonusDraft.description.trim() || undefined,
      award_date: deliveryBonusDraft.awardDate,
      project_id: parsePositiveId(deliveryBonusDraft.projectId) ?? 0,
    }
  }

  async function handleSubmitMistake() {
    const payload = buildMistakePayload()

    if (!payload || !detail) {
      return
    }

    setIsMistakeSubmitting(true)

    try {
      const response = editingMistake
        ? await membersService.updateMistake(editingMistake.id, payload)
        : await membersService.createMistake(payload)

      await detailQuery.refetch()
      closeMistakeDialog()
      showToast({
        title: editingMistake ? lt('Mistake updated') : lt('Mistake added'),
        description: getSuccessMessage(response, `${detail.report.fullName} ${lt('updated.')}`),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: editingMistake ? lt('Mistake not updated') : lt('Mistake not added'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsMistakeSubmitting(false)
    }
  }

  async function handleSubmitDeliveryBonus() {
    const payload = buildDeliveryBonusPayload()

    if (!payload || !detail) {
      return
    }

    setIsDeliveryBonusSubmitting(true)

    try {
      const response = editingDeliveryBonus
        ? await membersService.updateDeliveryBonus(editingDeliveryBonus.id, payload)
        : await membersService.createDeliveryBonus(payload)

      await detailQuery.refetch()
      closeDeliveryBonusDialog()
      showToast({
        title: editingDeliveryBonus ? lt('Delivery bonus updated') : lt('Delivery bonus added'),
        description: getSuccessMessage(response, `${detail.report.fullName} ${lt('updated.')}`),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: editingDeliveryBonus ? lt('Delivery bonus not updated') : lt('Delivery bonus not added'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsDeliveryBonusSubmitting(false)
    }
  }

  async function handleDeleteCompensationRecord() {
    if (!deleteTarget) {
      return
    }

    setIsDeleteSubmitting(true)

    try {
      let response: unknown

      if (deleteTarget.kind === 'mistake') {
        response = await membersService.deleteMistake(deleteTarget.record.id)
        await detailQuery.refetch()
      } else if (deleteTarget.kind === 'delivery-bonus') {
        response = await membersService.deleteDeliveryBonus(deleteTarget.record.id)
        await detailQuery.refetch()
      } else if (deleteTarget.kind === 'simple-bonus') {
        response = await membersService.deleteSimpleBonus(deleteTarget.record.id)
        await simpleBonusesQuery.refetch()
      } else {
        response = await membersService.deleteSimplePenalty(deleteTarget.record.id)
        await simplePenaltiesQuery.refetch()
      }

      const recordTitle = 'title' in deleteTarget.record ? deleteTarget.record.title : deleteTarget.record.reason
      const successTitle =
        deleteTarget.kind === 'mistake' ? lt('Mistake deleted') :
        deleteTarget.kind === 'delivery-bonus' ? lt('Delivery bonus deleted') :
        deleteTarget.kind === 'simple-bonus' ? tr('Simple bonus deleted', 'Oddiy bonus o\'chirildi', 'Простой бонус удалён') :
        tr('Simple penalty deleted', 'Oddiy jarima o\'chirildi', 'Простой штраф удалён')
      showToast({
        title: successTitle,
        description: getSuccessMessage(response, `${recordTitle} ${lt('removed.')}`),
        tone: 'success',
      })
      setDeleteTarget(null)
    } catch (error) {
      const errorTitle =
        deleteTarget.kind === 'mistake' ? lt('Mistake not deleted') :
        deleteTarget.kind === 'delivery-bonus' ? lt('Delivery bonus not deleted') :
        deleteTarget.kind === 'simple-bonus' ? tr('Simple bonus not deleted', 'Oddiy bonus o\'chirilmadi', 'Простой бонус не удалён') :
        tr('Simple penalty not deleted', 'Oddiy jarima o\'chirilmadi', 'Простой штраф не удалён')
      showToast({
        title: errorTitle,
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsDeleteSubmitting(false)
    }
  }

  async function handleSubmitSimpleBonus() {
    if (!detail) return

    const amount = Number(simpleBonusDraft.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ title: tr('Invalid amount', 'Noto\'g\'ri summa', 'Неверная сумма'), description: tr('Amount must be a positive number.', 'Summa musbat son bo\'lishi kerak.', 'Сумма должна быть положительным числом.'), tone: 'error' })
      return
    }

    if (!simpleBonusDraft.reason.trim()) {
      showToast({ title: tr('Reason required', 'Sabab kiritilmagan', 'Причина обязательна'), description: tr('Enter a reason for the bonus.', 'Bonus uchun sabab kiriting.', 'Введите причину для бонуса.'), tone: 'error' })
      return
    }

    setIsSimpleBonusSubmitting(true)

    try {
      await membersService.createSimpleBonus({
        user_id: detail.report.id,
        year,
        month,
        amount,
        reason: simpleBonusDraft.reason.trim(),
      })
      await simpleBonusesQuery.refetch()
      setIsSimpleBonusDialogOpen(false)
      setSimpleBonusDraft({ amount: '', reason: '' })
      showToast({ title: tr('Simple bonus added', 'Oddiy bonus qo\'shildi', 'Простой бонус добавлен'), description: `${detail.report.fullName} ${lt('updated.')}`, tone: 'success' })
    } catch (error) {
      showToast({ title: tr('Simple bonus not added', 'Oddiy bonus qo\'shilmadi', 'Простой бонус не добавлен'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSimpleBonusSubmitting(false)
    }
  }

  async function handleSubmitSimplePenalty() {
    if (!detail) return

    const amount = Number(simplePenaltyDraft.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ title: tr('Invalid amount', 'Noto\'g\'ri summa', 'Неверная сумма'), description: tr('Amount must be a positive number.', 'Summa musbat son bo\'lishi kerak.', 'Сумма должна быть положительным числом.'), tone: 'error' })
      return
    }

    if (!simplePenaltyDraft.reason.trim()) {
      showToast({ title: tr('Reason required', 'Sabab kiritilmagan', 'Причина обязательна'), description: tr('Enter a reason for the penalty.', 'Jarima uchun sabab kiriting.', 'Введите причину для штрафа.'), tone: 'error' })
      return
    }

    setIsSimplePenaltySubmitting(true)

    try {
      await membersService.createSimplePenalty({
        user_id: detail.report.id,
        year,
        month,
        amount,
        reason: simplePenaltyDraft.reason.trim(),
      })
      await simplePenaltiesQuery.refetch()
      setIsSimplePenaltyDialogOpen(false)
      setSimplePenaltyDraft({ amount: '', reason: '' })
      showToast({ title: tr('Simple penalty added', 'Oddiy jarima qo\'shildi', 'Простой штраф добавлен'), description: `${detail.report.fullName} ${lt('updated.')}`, tone: 'success' })
    } catch (error) {
      showToast({ title: tr('Simple penalty not added', 'Oddiy jarima qo\'shilmadi', 'Простой штраф не добавлен'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSimplePenaltySubmitting(false)
    }
  }

  if (!Number.isFinite(memberId) || memberId <= 0) {
    return (
      <ErrorStateBlock
        eyebrow={pageEyebrow}
        title={lt('Invalid member ID')}
        description={lt('The member identifier in the route is invalid.')}
        actionLabel={errorActionLabel}
        onAction={() => navigate(backTarget)}
      />
    )
  }

  if (detailQuery.isLoading && !detail) {
    return (
      <LoadingStateBlock
        eyebrow={pageEyebrow}
        title={loadingTitle}
        description={loadingDescription}
      />
    )
  }

  if (detailQuery.isError || !detail) {
    return (
      <ErrorStateBlock
        eyebrow={pageEyebrow}
        title={lt('Member detail unavailable')}
        description={lt('Could not build a salary detail page for this member.')}
        actionLabel={errorActionLabel}
        onAction={() => navigate(backTarget)}
      />
    )
  }

  const updatesSummary = detail.updatesSummary
  const updatesCompletion =
    Number.isFinite(updatesSummary?.updatePercentage)
      ? updatesSummary!.updatePercentage
      : updatesSummary?.completionPercentage

  return (
    <section className="page-enter space-y-4 px-4 pb-6 sm:px-6 lg:px-8">
      {!isMemberUpdatesMode ? (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backTarget)}
            className="min-h-8 rounded-xl border border-[var(--border)] bg-white px-3 text-[11px] text-[var(--foreground)] hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)] dark:border-white/8 dark:bg-white/[0.03] dark:text-white/78 dark:hover:border-white/12 dark:hover:bg-white/[0.05] dark:hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3.5 5.5 8 10 12.5" />
            </svg>
            {errorActionLabel}
          </Button>
        </div>
      ) : null}

      <Card variant="glass" noPadding className="page-header-card overflow-hidden rounded-xl border-[var(--blue-border)]">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="page-header-decor pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_right,rgba(34,211,238,0.12),transparent_26%)]" />

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.02em] text-[var(--blue-text)]">
                  {topHeaderEyebrow}
                </p>
                <h1 className="ui-page-title mt-2 text-[var(--foreground)]">
                  {detail.report.fullName}
                </h1>
                <p className="mt-2 text-sm text-[var(--muted-strong)]">
                  {detail.report.roleLabel ? lt(detail.report.roleLabel) : lt('Member')}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="blue">{lt('Employee API detail')}</Badge>
                  <Badge variant={detail.report.hasPenalty ? 'danger' : 'outline'}>
                    {detail.report.hasPenalty ? lt('Penalty applied') : lt('No penalties')}
                  </Badge>
                  <Badge variant={detail.report.hasBonus ? 'blue' : 'outline'}>
                    {detail.report.hasBonus ? lt('Bonus applied') : lt('No bonuses')}
                  </Badge>
                  <Badge variant="outline">{detail.report.label}</Badge>
                </div>

                {detail.estimateError ? (
                  <p className="mt-4 text-xs leading-5 text-amber-300">
                    {lt('Estimate API unavailable')}: {detail.estimateError}
                  </p>
                ) : null}
                {detail.policyError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {lt('Compensation policy unavailable')}: {detail.policyError}
                  </p>
                ) : null}
                {detail.mistakesError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {lt('Mistake incidents unavailable')}: {detail.mistakesError}
                  </p>
                ) : null}
                {detail.deliveryBonusesError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {lt('Delivery bonuses unavailable')}: {detail.deliveryBonusesError}
                  </p>
                ) : null}
                {detail.updatesError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {lt('Update statistics unavailable')}: {detail.updatesError}
                  </p>
                ) : null}
                {detail.calendarError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {lt('Daily update calendar unavailable')}: {detail.calendarError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {showCompensationActions ? (
                  <Button variant="ghost" size="sm" onClick={() => openMistakeDialog()} className="rounded-xl">
                    {tr('Add mistake', "Xato qo'shish", 'Добавить ошибку')}
                  </Button>
                ) : null}
                {showCompensationActions ? (
                  <Button variant="success" size="sm" onClick={() => openDeliveryBonusDialog()} className="rounded-xl">
                    {tr('Add delivery bonus', "Topshirish bonusini qo'shish", 'Добавить бонус за сдачу')}
                  </Button>
                ) : null}
                {showCompensationActions ? (
                  <Button variant="success" size="sm" onClick={() => { setSimpleBonusDraft({ amount: '', reason: '' }); setIsSimpleBonusDialogOpen(true) }} className="rounded-xl">
                    {tr('Add simple bonus', "Oddiy bonus qo'shish", 'Добавить простой бонус')}
                  </Button>
                ) : null}
                {showCompensationActions ? (
                  <Button variant="danger" size="sm" onClick={() => { setSimplePenaltyDraft({ amount: '', reason: '' }); setIsSimplePenaltyDialogOpen(true) }} className="rounded-xl">
                    {tr('Add simple penalty', "Oddiy jarima qo'shish", 'Добавить простой штраф')}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshIcon />}
                  onClick={() => void handleRefresh()}
                  loading={detailQuery.isLoading}
                  className="rounded-xl"
                >
                  {tr('Refresh details', 'Tafsilotlarni yangilash', 'Обновить детали')}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{lt('Year')}</Label>
                <Input
                  type="number"
                  min="2020"
                  max="2035"
                  value={year}
                  onChange={(event) => updatePeriod({ year: clampNumber(Number(event.target.value) || defaultYear, 2020, 2035) })}
                  className="rounded-xl border-[var(--border)] bg-white dark:border-white/10 dark:bg-white/[0.03]"
                />
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{lt('Month')}</Label>
                <SelectField
                  value={String(month)}
                  options={monthOptions}
                  onValueChange={(value) => updatePeriod({ month: clampNumber(Number(value), 1, 12) })}
                  className="rounded-xl border-[var(--border)] bg-white dark:border-white/10 dark:bg-white/[0.03]"
                />
              </div>

              <div className="grid gap-3 md:self-end md:justify-items-end">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {getMonthName(month)} {year}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card noPadding className="overflow-hidden rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]">
        <CardSection eyebrow={lt('Snapshot')} title={tr('Salary at a glance', 'Maosh umumiy ko\'rinishi', 'Зарплата кратко')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SnapshotCard
              label={tr('Final salary', 'Yakuniy maosh', 'Итоговая зарплата')}
              value={formatAmount(detail.report.finalSalary)}
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>}
            />
            <SnapshotCard
              label={tr('Bonus amount', 'Bonus summasi', 'Сумма бонуса')}
              value={formatAmount(detail.report.bonusAmount)}
              accent="blue"
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 15 2 2 4-4"/><rect width="20" height="14" x="2" y="6" rx="2"/><path d="M12 10V6"/><path d="M12 21v-2"/></svg>}
            />
            <SnapshotCard
              label={tr('Bonus %', 'Bonus %', 'Бонус %')}
              value={formatPercent(detail.report.totalBonusPercent)}
              accent="blue"
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21 21 3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="7" r="3"/></svg>}
            />
            <SnapshotCard
              label={tr('Productivity', 'Mahsuldorlik', 'Продуктивность')}
              value={Number.isFinite(detail.report.productivityPercentage)
                ? `${formatCount(detail.report.updateDays)}/${formatCount(detail.report.workingDays)}`
                : '-'}
              secondaryValue={Number.isFinite(detail.report.productivityPercentage)
                ? formatPercent(detail.report.productivityPercentage)
                : undefined}
              accent="success"
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
            />
          </div>
        </CardSection>

            <Card noPadding className="overflow-hidden rounded-xl">
              <CardSection
                title={tr('Salary details breakdown', 'Maosh tafsilotlari taqsimoti', 'Распределение деталей зарплаты')}
                headerAction={
                  <>
                    <Badge variant={(detail.report.penaltyPercentage ?? 0) > 0 ? 'danger' : 'outline'}>
                      {formatPercent(detail.report.penaltyPercentage)} {tr('deduction impact', 'ayirma ta\'siri', 'влияние удержания')}
                    </Badge>
                    <Badge variant={updatesSummary ? 'blue' : 'outline'}>
                      {updatesSummary
                        ? `${formatPercent(updatesSummary.completionPercentage)} ${lt('completion')}`
                        : tr('No update stats', "Update statistikasi yo'q", 'Нет статистики обновлений')}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-[var(--blue-text)] hover:text-[var(--blue-text)]"
                      onClick={() => setIsCompensationPolicyDrawerOpen(true)}
                    >
                      {tr('Open compensation policy', 'Kompensatsiya siyosatini ochish', 'Открыть политику компенсации')}
                    </Button>
                  </>
                }
              >
                <div className="space-y-4">
                  {/* Salary Composition Group */}
                  <div>
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">
                      {tr('Salary Composition', 'Maosh tarkibi', 'Состав зарплаты')}
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <SnapshotCard
                        label={lt('Base salary')}
                        value={formatAmount(detail.report.baseSalary)}
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                      />
                      <SnapshotCard
                        label={tr('After deduction', 'Ayirmadan keyin', 'После удержания')}
                        value={formatAmount(detail.report.afterPenalty)}
                        accent="warning"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18M3 15h18"/></svg>}
                      />
                      <SnapshotCard
                        label={lt('Mistakes')}
                        value={formatCount(detail.report.mistakesCount)}
                        accent="danger"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>}
                      />
                      <SnapshotCard
                        label={tr('Delivery bonuses', 'Topshirish bonuslari', 'Бонусы за сдачу')}
                        value={formatCount(detail.report.deliveryBonusCount)}
                        accent="success"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>}
                      />
                    </div>
                  </div>

                  {/* Update Performance Group */}
                  <div>
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">
                      {tr('Update Performance', 'Update ko\'rsatkichlari', 'Показатели обновлений')}
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <SnapshotCard
                        label={lt('Logged updates')}
                        value={updatesSummary ? formatCount(updatesSummary.submittedCount) : '-'}
                        accent="success"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                      />
                      <SnapshotCard
                        label={lt('Missing days')}
                        value={updatesSummary ? formatCount(updatesSummary.missingCount) : '-'}
                        accent="danger"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>}
                      />
                      <SnapshotCard
                        label={lt('Update percentage')}
                        value={updatesSummary ? formatPercent(updatesCompletion) : '-'}
                        accent="blue"
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21 21 3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="7" r="3"/></svg>}
                      />
                      <SnapshotCard
                        label={tr('Salary in update', 'Yangilanishdagi maosh', 'Зарплата в обновлении')}
                        value={typeof updatesSummary?.salaryAmount === 'number' ? formatAmount(updatesSummary.salaryAmount) : '-'}
                        icon={<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>}
                      />
                    </div>
                    
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <div className="text-(--muted)">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-(--muted)">{tr('Last update', 'Oxirgi yangilanish', 'Последнее обновление')}</p>
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {updatesSummary?.lastUpdateDate ? formatDetailDate(updatesSummary.lastUpdateDate) : tr('Not provided', 'Kiritilmagan', 'Не указано')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <div className="text-(--muted)">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-(--muted)">{tr('Next payment date', "Keyingi to'lov sanasi", 'Дата следующей выплаты')}</p>
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {updatesSummary?.nextPaymentDate ? formatDetailDate(updatesSummary.nextPaymentDate) : tr('Not provided', 'Kiritilmagan', 'Не указано')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {updatesSummary?.note ? (
                    <div className="rounded-xl bg-[var(--blue-surface)]/5 px-6 py-5 border border-[var(--blue-border)]/20">
                      <div className="flex items-center gap-2 mb-3">
                         <div className="text-[var(--blue-text)]">
                           <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                         </div>
                         <h5 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue-text)]">
                           {lt('Manager note')}
                         </h5>
                      </div>
                      <p className="text-sm leading-6 text-[var(--foreground)]">
                        {updatesSummary.note}
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardSection>

              <div className="hidden">
              <CardSection
          title={tr('How the final salary is built', 'Yakuniy maosh qanday shakllanadi', 'Как формируется итоговая зарплата')}
          headerAction={
            <>
              <Badge variant={(detail.report.penaltyPercentage ?? 0) > 0 ? 'danger' : 'outline'}>
                {formatPercent(detail.report.penaltyPercentage)} {tr('deduction impact', 'ayirma ta\'siri', 'влияние удержания')}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-[var(--blue-text)] hover:text-[var(--blue-text)]"
                onClick={() => setIsCompensationPolicyDrawerOpen(true)}
              >
                {tr('Open compensation policy', 'Kompensatsiya siyosatini ochish', 'Открыть политику компенсации')}
              </Button>
            </>
          }
        >
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <CardMetric label={lt('Base salary')} value={formatAmount(detail.report.baseSalary)} />
            <CardMetric label={tr('After deduction', 'Ayirmadan keyin', 'После удержания')} value={formatAmount(detail.report.afterPenalty)} />
            <CardMetric label={lt('Mistakes')} value={formatCount(detail.report.mistakesCount)} tone="danger" />
            <CardMetric label={tr('Delivery bonuses', 'Topshirish bonuslari', 'Бонусы за сдачу')} value={formatCount(detail.report.deliveryBonusCount)} tone="success" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-[var(--foreground)]">{formatAmount(detail.report.baseSalary)}</span>
            <span className="text-[var(--muted)]">−</span>
            <span className="font-semibold text-[var(--danger-text)]">{formatAmount(detail.report.deductionAmount)}</span>
            <span className="text-[var(--muted)]">+</span>
            <span className="font-semibold text-[var(--blue-text)]">{formatAmount(detail.report.bonusAmount)}</span>
            <span className="text-[var(--muted)]">=</span>
            <span className="text-base font-semibold tracking-tight text-[var(--foreground)]">
              {formatAmount(detail.report.finalSalary)}
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
            <div
              className="h-full rounded-full bg-[var(--danger-text)] transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(detail.report.penaltyPercentage) ? detail.report.penaltyPercentage : 0))}%` }}
            />
          </div>
              </CardSection>
              </div>
            </Card>

      {/* Developer KPI Section */}
      <Card className="rounded-xl border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--blue-text)]">{lt('Developer KPI')}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--foreground)]">{getMonthName(month)} {year} — {lt('KPI Score')}</h2>
          </div>
          {kpiEstimate ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">{lt('Final KPI')}</p>
              <p className="text-2xl font-black text-[var(--blue-text)]">{kpiEstimate.scores.final_kpi.toFixed(1)}%</p>
            </div>
          ) : null}
        </div>

        {kpiQuery.isLoading || kpiQuery.status === 'idle' ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 animate-pulse rounded-xl bg-[var(--surface-elevated)]" />)}
          </div>
        ) : kpiQuery.isError ? (
          <p className="text-sm text-[var(--muted-strong)]">{lt('KPI data unavailable for this period.')}</p>
        ) : kpiEstimate ? (
          <>
            <div className="space-y-3">
              {([
                { key: 'delivery', label: lt('Delivery'), color: 'bg-blue-500', weight: '35%' },
                { key: 'deadline', label: lt('Deadline'), color: 'bg-violet-500', weight: '20%' },
                { key: 'quality', label: lt('Quality'), color: 'bg-emerald-500', weight: '20%' },
                { key: 'team', label: lt('Team'), color: 'bg-amber-500', weight: '15%' },
                { key: 'discipline', label: lt('Discipline'), color: 'bg-cyan-500', weight: '10%' },
              ] as const).map(({ key, label, color, weight }) => {
                const score = kpiEstimate.scores[key]
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--muted-strong)] uppercase tracking-wider">{label}</span>
                        <span className="rounded bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[9px] font-black text-[var(--muted)] uppercase">{weight}</span>
                      </div>
                      <span className="text-xs font-black text-[var(--foreground)]">{score.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('Expected Salary')}</p>
                <p className="mt-1 text-base font-black text-[var(--foreground)]">{kpiEstimate.salary.expected_salary.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('Base Salary')}</p>
                <p className="mt-1 text-base font-black text-[var(--foreground)]">{kpiEstimate.salary.base_salary.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('KPI Bonus')}</p>
                <p className="mt-1 text-base font-black text-blue-400">+{kpiEstimate.salary.kpi_bonus.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('Deductions')}</p>
                <p className="mt-1 text-base font-black text-rose-400">-{kpiEstimate.salary.approved_deductions.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('Features this period')}</p>
                <Badge variant="blue">{kpiFeatures.length}</Badge>
              </div>
              {kpiFeaturesQuery.isLoading || kpiFeaturesQuery.status === 'idle' ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-elevated)]" />)}
                </div>
              ) : kpiFeatures.length === 0 ? (
                <p className="text-sm text-[var(--muted-strong)]">{lt('No features assigned for this period.')}</p>
              ) : (
                <div className="space-y-2">
                  {kpiFeatures.map(feature => (
                    <div key={feature.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{feature.title}</p>
                        <p className="text-xs text-[var(--muted-strong)]">{feature.status}{feature.due_date ? ` · due ${feature.due_date.slice(0, 10)}` : ''}</p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <Badge variant={feature.status === 'accepted' ? 'success' : feature.status === 'completed' ? 'blue' : 'outline'}>
                          {feature.points}pts
                        </Badge>
                        {feature.is_mandatory ? <Badge variant="warning">mandatory</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted-strong)]">{lt('No KPI data available for this period.')}</p>
        )}
      </Card>

        <CardSection bleed>
          <div className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6">

            <Card noPadding className="overflow-hidden rounded-xl">
              <CardSection
          title={tr('Deduction records for this month', 'Bu oy uchun ayirma yozuvlari', 'Записи удержаний за этот месяц')}
          headerAction={
            <Badge variant={detail.penalties.length > 0 ? 'danger' : 'outline'}>
              {detail.penalties.length} {lt('entries')}
            </Badge>
          }
        >
          {detail.penalties.length > 0 ? (
            <DataTable
              zebra
              className="rounded-none border-x-0 border-b-0"
              caption={tr('Deduction records table', 'Ayirma yozuvlari jadvali', 'Tablitsa zapisey uderzhaniy')}
              rows={detail.penalties}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  key: 'title',
                  header: tr('Title', 'Nomi', 'Nazvanie'),
                  render: (row) => <span className="font-semibold text-[var(--foreground)]">{row.title}</span>,
                },
                {
                  key: 'description',
                  header: tr('Description', 'Tavsif', 'Opisanie'),
                  render: (row) => <span className="text-[var(--muted-strong)]">{row.description || '-'}</span>,
                },
                {
                  key: 'percentage',
                  header: tr('Percent', 'Foiz', 'Protsent'),
                  render: (row) => row.percentage ? formatPercent(row.percentage) : '-',
                },
                {
                  key: 'date',
                  header: tr('Date', 'Sana', 'Data'),
                  render: (row) => row.createdAt ? formatDetailDate(row.createdAt) : '-',
                },
                {
                  key: 'amount',
                  header: tr('Amount', 'Summa', 'Summa'),
                  align: 'right',
                  render: (row) => <span className="font-semibold text-[var(--danger-text)]">{formatAmount(row.amount)}</span>,
                },
              ]}
            />
          ) : (
            <p className="text-sm text-[var(--muted-strong)]">
              {tr('No deduction line-items were returned for this member in the selected month.', 'Tanlangan oy uchun bu xodim bo‘yicha ayirma yozuvlari qaytmadi.', 'За выбранный месяц для этого сотрудника не вернулись записи удержаний.')}
            </p>
          )}
              </CardSection>
            </Card>

            <Card noPadding className="overflow-hidden rounded-xl">
              <CardSection
          title={tr('Bonuses for this month', 'Bu oy uchun bonuslar', 'Бонусы за этот месяц')}
          headerAction={
            <Badge variant={detail.bonuses.length > 0 ? 'success' : 'outline'}>
              {detail.bonuses.length} {lt('entries')}
            </Badge>
          }
        >
          {detail.bonuses.length > 0 ? (
            <DataTable
              zebra
              className="rounded-none border-x-0 border-b-0"
              caption={tr('Bonus records table', 'Bonus yozuvlari jadvali', 'Tablitsa zapisey bonusov')}
              rows={detail.bonuses}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  key: 'title',
                  header: tr('Title', 'Nomi', 'Nazvanie'),
                  render: (row) => <span className="font-semibold text-[var(--success-text)]">{row.title}</span>,
                },
                {
                  key: 'description',
                  header: tr('Description', 'Tavsif', 'Opisanie'),
                  render: (row) => <span className="text-[var(--muted-strong)]">{row.description || '-'}</span>,
                },
                {
                  key: 'date',
                  header: tr('Date', 'Sana', 'Data'),
                  render: (row) => row.createdAt ? formatDetailDate(row.createdAt) : '-',
                },
                {
                  key: 'amount',
                  header: tr('Amount', 'Summa', 'Summa'),
                  align: 'right',
                  render: (row) => <span className="font-semibold text-[var(--success-text)]">{formatAmount(row.amount)}</span>,
                },
              ]}
            />
          ) : (
            <p className="text-sm text-[var(--muted-strong)]">
              {lt('No bonus line-items were returned for this member in the selected month.')}
            </p>
          )}
              </CardSection>
            </Card>

            <Card noPadding className="overflow-hidden rounded-xl">
              <MistakeIncidentSection
          items={detail.mistakes}
          editable={showCompensationActions}
          onAdd={showCompensationActions ? () => openMistakeDialog() : undefined}
          onEdit={showCompensationActions ? (item) => openMistakeDialog(item) : undefined}
          onDelete={showCompensationActions ? (item) => setDeleteTarget({ kind: 'mistake', record: item }) : undefined}
              />
            </Card>
            <Card noPadding className="overflow-hidden rounded-xl">
              <DeliveryBonusSection
          items={detail.deliveryBonuses}
          editable={showCompensationActions}
          onAdd={showCompensationActions ? () => openDeliveryBonusDialog() : undefined}
          onEdit={showCompensationActions ? (item) => openDeliveryBonusDialog(item) : undefined}
          onDelete={showCompensationActions ? (item) => setDeleteTarget({ kind: 'delivery-bonus', record: item }) : undefined}
              />
            </Card>
            {showCompensationActions ? (
              <Card noPadding className="overflow-hidden rounded-xl">
                <SimpleBonusSection
                  items={simpleBonuses}
                  editable
                  onAdd={() => { setSimpleBonusDraft({ amount: '', reason: '' }); setIsSimpleBonusDialogOpen(true) }}
                  onDelete={(item) => setDeleteTarget({ kind: 'simple-bonus', record: item })}
                />
              </Card>
            ) : null}
            {showCompensationActions ? (
              <Card noPadding className="overflow-hidden rounded-xl">
                <SimplePenaltySection
                  items={simplePenalties}
                  editable
                  onAdd={() => { setSimplePenaltyDraft({ amount: '', reason: '' }); setIsSimplePenaltyDialogOpen(true) }}
                  onDelete={(item) => setDeleteTarget({ kind: 'simple-penalty', record: item })}
                />
              </Card>
            ) : null}
          </div>
        </CardSection>
      </Card>

      {detail.updateCalendar ? (
        <Card noPadding className="overflow-hidden rounded-xl">
          <CardSection bleed>
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <MemberMonthlyUpdateCalendarBoard
                calendar={detail.updateCalendar}
                onMonthShift={handleCalendarMonthShift}
                onJumpToToday={handleCalendarTodayJump}
                attendanceRecords={attendanceRecords}
              />
              {/* Salary attendance donut and recent 7-day stats */}
              <div className="mt-4">
                <SalaryAttendanceDonut employeeId={detail.report.id} year={year} month={month} monthRecords={attendanceRecords} />
              </div>
            </div>
          </CardSection>
        </Card>
      ) : detail.calendarError ? (
        <Card noPadding className="overflow-hidden rounded-xl">
          <CardSection>
            <p className="text-sm text-amber-600 dark:text-amber-300">
              {lt('Monthly calendar could not be loaded from the CEO employee updates endpoint.')}
            </p>
          </CardSection>
        </Card>
      ) : null}

      {isCompensationPolicyDrawerOpen ? (
        <Suspense fallback={<AsyncContentLoader variant="dialog" />}>
          <CompensationPolicyDrawer
            open={isCompensationPolicyDrawerOpen}
            policy={detail.compensationPolicy}
            memberName={detail.report.fullName}
            month={month}
            year={year}
            onClose={() => setIsCompensationPolicyDrawerOpen(false)}
          />
        </Suspense>
      ) : null}

      {showCompensationActions ? (
        <Dialog
          open={isMistakeDialogOpen}
          onClose={closeMistakeDialog}
          eyebrow={tr('Workspace dialog', 'Ish maydoni dialogi', 'Диалог рабочего пространства')}
          title={`${editingMistake
            ? tr('Edit mistake for', 'Xatoni tahrirlash:', 'Редактировать ошибку для')
            : tr('Add mistake for', "Xato qo'shish:", 'Добавить ошибку для')} ${detail.report.fullName}`}
          description={`${getMonthName(month)} ${year} ${tr('compensation mistake incident.', 'uchun kompensatsiya xatosi yozuvi.', 'компенсационная запись об ошибке.')}`}
          footer={
            <>
              <Button variant="secondary" onClick={closeMistakeDialog} disabled={isMistakeSubmitting}>
                {tr('Cancel', 'Bekor qilish', 'Отмена')}
              </Button>
              <Button variant="danger" onClick={() => void handleSubmitMistake()} loading={isMistakeSubmitting}>
                {editingMistake
                  ? tr('Update mistake', 'Xatoni yangilash', 'Обновить ошибку')
                  : tr('Save mistake', 'Xatoni saqlash', 'Сохранить ошибку')}
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-[var(--muted-strong)]">{tr('Employee', 'Xodim', 'Сотрудник')}</p>
              <p className="mt-2 text-base font-semibold text-[var(--foreground)] dark:text-white">{detail.report.fullName}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Reviewer', "Ko'rib chiquvchi", 'Проверяющий')}</Label>
                {reviewerOptions.length > 0 ? (
                  <SelectField
                    value={mistakeDraft.reviewerId}
                    options={reviewerOptions}
                    onValueChange={(value) => setMistakeDraft((current) => ({ ...current, reviewerId: value }))}
                    className="rounded-xl"
                  />
                ) : (
                  <Input
                    type="number"
                    min="1"
                    value={mistakeDraft.reviewerId}
                    onChange={(event) => setMistakeDraft((current) => ({ ...current, reviewerId: event.target.value }))}
                    placeholder={tr('Reviewer ID', "Ko'rib chiquvchi ID", 'ID проверяющего')}
                  />
                )}
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Project', 'Loyiha', 'Проект')}</Label>
                {projectOptions.length > 1 ? (
                  <SelectField
                    value={mistakeDraft.projectId}
                    options={projectOptions}
                    onValueChange={(value) => setMistakeDraft((current) => ({ ...current, projectId: value }))}
                    className="rounded-xl"
                  />
                ) : (
                  <Input
                    type="number"
                    min="0"
                    value={mistakeDraft.projectId}
                    onChange={(event) => setMistakeDraft((current) => ({ ...current, projectId: event.target.value }))}
                    placeholder={tr('0 for no project', "Loyiha bo'lmasa 0", '0 если проекта нет')}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Category', 'Kategoriya', 'Категория')}</Label>
                {mistakeCategoryOptions.length > 0 ? (
                  <SelectField
                    value={mistakeDraft.category}
                    options={mistakeCategoryOptions}
                    onValueChange={(value) => setMistakeDraft((current) => ({ ...current, category: value }))}
                    className="rounded-xl"
                  />
                ) : (
                  <Input
                    value={mistakeDraft.category}
                    onChange={(event) => setMistakeDraft((current) => ({ ...current, category: event.target.value }))}
                    placeholder={tr('AI Integration', 'AI integratsiyasi', 'AI интеграция')}
                  />
                )}
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Severity', 'Daraja', 'Степень')}</Label>
                {severityOptions.length > 0 ? (
                  <SelectField
                    value={mistakeDraft.severity}
                    options={severityOptions}
                    onValueChange={(value) => setMistakeDraft((current) => ({ ...current, severity: value }))}
                    className="rounded-xl"
                  />
                ) : (
                  <Input
                    value={mistakeDraft.severity}
                    onChange={(event) => setMistakeDraft((current) => ({ ...current, severity: event.target.value }))}
                    placeholder={tr('Minor', 'Yengil', 'Незначительная')}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Title', 'Sarlavha', 'Название')}</Label>
                <Input
                  value={mistakeDraft.title}
                  onChange={(event) => setMistakeDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={tr('Short mistake title', 'Qisqa xato sarlavhasi', 'Короткое название ошибки')}
                />
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Incident date', "Sodir bo'lgan sana", 'Дата инцидента')}</Label>
                <Input
                  type="date"
                  value={mistakeDraft.incidentDate}
                  onChange={(event) => setMistakeDraft((current) => ({ ...current, incidentDate: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Description', 'Tavsif', 'Описание')}</Label>
              <Textarea
                value={mistakeDraft.description}
                onChange={(event) => setMistakeDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder={tr('Describe what happened', "Nima bo'lganini yozing", 'Опишите, что произошло')}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white/84">
                <input
                  type="checkbox"
                  checked={mistakeDraft.reachedClient}
                  onChange={(event) => setMistakeDraft((current) => ({ ...current, reachedClient: event.target.checked }))}
                  className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--input-surface)] accent-blue-500 dark:border-white/15 dark:bg-transparent"
                />
                {tr('Reached client', 'Mijozga yetib borgan', 'Дошло до клиента')}
              </Label>

              <Label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white/84">
                <input
                  type="checkbox"
                  checked={mistakeDraft.unclearTask}
                  onChange={(event) => setMistakeDraft((current) => ({ ...current, unclearTask: event.target.checked }))}
                  className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--input-surface)] accent-blue-500 dark:border-white/15 dark:bg-transparent"
                />
                {tr('Unclear task', 'Vazifa noaniq', 'Неясная задача')}
              </Label>
            </div>
          </div>
        </Dialog>
      ) : null}

      {showCompensationActions ? (
        <Dialog
          open={isDeliveryBonusDialogOpen}
          onClose={closeDeliveryBonusDialog}
          eyebrow={tr('Workspace dialog', 'Ish maydoni dialogi', 'Диалог рабочего пространства')}
          title={`${editingDeliveryBonus
            ? tr('Edit delivery bonus for', 'Topshirish bonusini tahrirlash:', 'Редактировать бонус за сдачу для')
            : tr('Add delivery bonus for', "Topshirish bonusini qo'shish:", 'Добавить бонус за сдачу для')} ${detail.report.fullName}`}
          description={`${getMonthName(month)} ${year} ${tr('delivery bonus record.', 'uchun topshirish bonusi yozuvi.', 'запись о бонусе за сдачу.')}`}
          footer={
            <>
              <Button variant="secondary" onClick={closeDeliveryBonusDialog} disabled={isDeliveryBonusSubmitting}>
                {tr('Cancel', 'Bekor qilish', 'Отмена')}
              </Button>
              <Button variant="success" onClick={() => void handleSubmitDeliveryBonus()} loading={isDeliveryBonusSubmitting}>
                {editingDeliveryBonus
                  ? tr('Update delivery bonus', 'Topshirish bonusini yangilash', 'Обновить бонус за сдачу')
                  : tr('Save delivery bonus', 'Topshirish bonusini saqlash', 'Сохранить бонус за сдачу')}
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-[var(--muted-strong)]">{tr('Employee', 'Xodim', 'Сотрудник')}</p>
              <p className="mt-2 text-base font-semibold text-[var(--foreground)] dark:text-white">{detail.report.fullName}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Bonus type', 'Bonus turi', 'Тип бонуса')}</Label>
                {deliveryBonusTypeOptions.length > 0 ? (
                  <SelectField
                    value={deliveryBonusDraft.bonusType}
                    options={deliveryBonusTypeOptions}
                    onValueChange={(value) => setDeliveryBonusDraft((current) => ({ ...current, bonusType: value }))}
                    className="rounded-xl"
                  />
                ) : (
                  <Input
                    value={deliveryBonusDraft.bonusType}
                    onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, bonusType: event.target.value }))}
                    placeholder={tr('early_delivery', 'Erta topshirish', 'Ранняя сдача')}
                  />
                )}
              </div>

              <div>
                <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Award date', 'Berilgan sana', 'Дата выдачи')}</Label>
                <Input
                  type="date"
                  value={deliveryBonusDraft.awardDate}
                  onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, awardDate: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Title', 'Sarlavha', 'Название')}</Label>
              <Input
                value={deliveryBonusDraft.title}
                onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={tr('Short bonus title', 'Qisqa bonus sarlavhasi', 'Короткое название бонуса')}
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Project', 'Loyiha', 'Проект')}</Label>
              {projectOptions.length > 1 ? (
                <SelectField
                  value={deliveryBonusDraft.projectId}
                  options={projectOptions}
                  onValueChange={(value) => setDeliveryBonusDraft((current) => ({ ...current, projectId: value }))}
                  className="rounded-xl"
                />
              ) : (
                <Input
                  type="number"
                  min="0"
                  value={deliveryBonusDraft.projectId}
                  onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, projectId: event.target.value }))}
                  placeholder={tr('0 for no project', "Loyiha bo'lmasa 0", '0 если проекта нет')}
                />
              )}
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">{tr('Description', 'Tavsif', 'Описание')}</Label>
              <Textarea
                value={deliveryBonusDraft.description}
                onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder={tr('Describe why this delivery bonus was awarded', 'Nega bu bonus berilganini yozing', 'Опишите, почему был выдан этот бонус')}
              />
            </div>
          </div>
        </Dialog>
      ) : null}

      {showCompensationActions ? (
        <Dialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title={
            deleteTarget?.kind === 'mistake' ? lt('Delete mistake incident') :
            deleteTarget?.kind === 'delivery-bonus' ? lt('Delete delivery bonus') :
            deleteTarget?.kind === 'simple-bonus' ? tr('Delete simple bonus', 'Oddiy bonusni o\'chirish', 'Удалить простой бонус') :
            tr('Delete simple penalty', 'Oddiy jarimani o\'chirish', 'Удалить простой штраф')
          }
          description={deleteTarget ? `${lt('This will remove')} "${('title' in deleteTarget.record ? deleteTarget.record.title : deleteTarget.record.reason)}" ${lt('from the selected month.')}` : undefined}
          tone="danger"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleteSubmitting}>
                {lt('Cancel')}
              </Button>
              <Button variant="danger" onClick={() => void handleDeleteCompensationRecord()} loading={isDeleteSubmitting}>
                {lt('Delete record')}
              </Button>
            </>
          }
        >
          <div className="rounded-xl border border-red-500/20 bg-red-50 px-4 py-4 text-sm text-[var(--muted-strong)] dark:bg-red-500/8 dark:text-white/84">
            <p className="font-semibold text-[var(--foreground)] dark:text-white">
              {'title' in (deleteTarget?.record ?? {}) ? (deleteTarget?.record as { title: string }).title : (deleteTarget?.record as { reason: string } | undefined)?.reason}
            </p>
            <p className="mt-2 text-sm text-[var(--muted-strong)] dark:text-white/72">
              {deleteTarget?.kind === 'mistake'
                ? lt('The mistake incident entry will be permanently removed from this employee history.')
                : deleteTarget?.kind === 'delivery-bonus'
                ? lt('The delivery bonus record will be permanently removed from this employee history.')
                : deleteTarget?.kind === 'simple-bonus'
                ? tr('The simple bonus will be permanently removed.', 'Oddiy bonus butunlay o\'chiriladi.', 'Простой бонус будет удалён навсегда.')
                : tr('The simple penalty will be permanently removed.', 'Oddiy jarima butunlay o\'chiriladi.', 'Простой штраф будет удалён навсегда.')}
            </p>
          </div>
        </Dialog>
      ) : null}

      {showCompensationActions ? (
        <Dialog
          open={isSimpleBonusDialogOpen}
          onClose={() => setIsSimpleBonusDialogOpen(false)}
          eyebrow={tr('Workspace dialog', 'Ish maydoni dialogi', 'Диалог рабочего пространства')}
          title={`${tr('Add simple bonus for', "Oddiy bonus qo'shish:", 'Добавить простой бонус для')} ${detail?.report.fullName ?? ''}`}
          description={`${getMonthName(month)} ${year}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsSimpleBonusDialogOpen(false)} disabled={isSimpleBonusSubmitting}>
                {tr('Cancel', 'Bekor qilish', 'Отмена')}
              </Button>
              <Button variant="success" onClick={() => void handleSubmitSimpleBonus()} loading={isSimpleBonusSubmitting}>
                {tr('Save bonus', 'Bonusni saqlash', 'Сохранить бонус')}
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">
                {tr('Amount', 'Summa', 'Сумма')}
              </Label>
              <Input
                type="number"
                min="1"
                value={simpleBonusDraft.amount}
                onChange={(event) => setSimpleBonusDraft((s) => ({ ...s, amount: event.target.value }))}
                placeholder="100000"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">
                {tr('Reason', 'Sabab', 'Причина')}
              </Label>
              <Textarea
                value={simpleBonusDraft.reason}
                onChange={(event) => setSimpleBonusDraft((s) => ({ ...s, reason: event.target.value }))}
                placeholder={tr('Reason for the bonus', 'Bonus uchun sabab', 'Причина бонуса')}
              />
            </div>
          </div>
        </Dialog>
      ) : null}

      {showCompensationActions ? (
        <Dialog
          open={isSimplePenaltyDialogOpen}
          onClose={() => setIsSimplePenaltyDialogOpen(false)}
          eyebrow={tr('Workspace dialog', 'Ish maydoni dialogi', 'Диалог рабочего пространства')}
          title={`${tr('Add simple penalty for', "Oddiy jarima qo'shish:", 'Добавить простой штраф для')} ${detail?.report.fullName ?? ''}`}
          description={`${getMonthName(month)} ${year}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsSimplePenaltyDialogOpen(false)} disabled={isSimplePenaltySubmitting}>
                {tr('Cancel', 'Bekor qilish', 'Отмена')}
              </Button>
              <Button variant="danger" onClick={() => void handleSubmitSimplePenalty()} loading={isSimplePenaltySubmitting}>
                {tr('Save penalty', 'Jarimani saqlash', 'Сохранить штраф')}
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">
                {tr('Amount', 'Summa', 'Сумма')}
              </Label>
              <Input
                type="number"
                min="1"
                value={simplePenaltyDraft.amount}
                onChange={(event) => setSimplePenaltyDraft((s) => ({ ...s, amount: event.target.value }))}
                placeholder="100000"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-semibold text-[var(--foreground)] dark:text-white">
                {tr('Reason', 'Sabab', 'Причина')}
              </Label>
              <Textarea
                value={simplePenaltyDraft.reason}
                onChange={(event) => setSimplePenaltyDraft((s) => ({ ...s, reason: event.target.value }))}
                placeholder={tr('Reason for the penalty', 'Jarima uchun sabab', 'Причина штрафа')}
              />
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
