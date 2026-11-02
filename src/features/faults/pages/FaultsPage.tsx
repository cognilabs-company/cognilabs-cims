import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { MemberDeliveryBonusPayload, MemberMistakePayload } from '../../../shared/api/types'
import type { CeoUserRecord } from '../../../shared/api/services/ceo.service'
import { membersService } from '../../../shared/api/services/members.service'
import { updateTrackingService, type WorkdayOverrideMemberOption } from '../../../shared/api/services/updateTracking.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Checkbox } from '../../../shared/ui/checkbox'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { SelectField } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'
import { tonePill } from '../../../shared/ui/tone'
import { AsyncContentLoader } from '../../../shared/ui/async-content-loader'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { useAuth } from '../../auth/hooks/useAuth'
import { RefreshIcon } from '../components/SalaryEstimatePrimitives'
import {
  buildEmployeeCompensationPolicy,
  buildEmployeeReports,
  defaultMonth,
  defaultYear,
  type EmployeeSalaryReport,
  formatCount,
  findFirstNumber,
  findFirstRecord,
  formatAmount,
  formatPercent,
  getCompensationPolicyCategoryOptions,
  getCompensationPolicyDeliveryBonusOptions,
  getCompensationPolicySeverityOptions,
  getMonthName,
  getSuccessMessage,
  isRecord,
  parseMaybeJson,
} from '../lib/salaryEstimates'

const SalaryEstimateDrawer = lazy(async () => {
  const module = await import('../components/SalaryEstimateDrawer')

  return {
    default: module.SalaryEstimateDrawer,
  }
})

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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const numberPillClassName = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold'

const successPillClassName = cn(numberPillClassName, tonePill('success'))

const neutralPillClassName = cn(numberPillClassName, tonePill('neutral'))

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.5 19.5V18a3.8 3.8 0 0 0-3.8-3.8H6.3A3.8 3.8 0 0 0 2.5 18v1.5" />
      <circle cx="9" cy="7.2" r="3.3" />
      <path d="M21.5 19.5V18a3.8 3.8 0 0 0-2.9-3.7" />
      <path d="M16.2 4.3a3.3 3.3 0 0 1 0 5.8" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.2" />
      <path d="M2.5 10.5h19" />
      <path d="M16.5 14.8h2" />
    </svg>
  )
}

function DeductionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 7.5 12 16l-4-4-4.5 4.5" />
      <path d="M14.5 7.5h6v6" />
    </svg>
  )
}

function BonusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="9" width="18" height="11.5" rx="2.4" />
      <path d="M3 13.2h18M12 9v11.5" />
      <path d="M8.6 9a2.6 2.6 0 1 1 1.9-4.4L12 6.1l1.5-1.5A2.6 2.6 0 1 1 15.4 9" />
    </svg>
  )
}

function EstimateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="2.8" width="15" height="18.4" rx="3" />
      <path d="M8.5 7.2h7" />
      <path d="M8.8 11.8h.01M12 11.8h.01M15.2 11.8h.01M8.8 16.2h.01M12 16.2h.01M15.2 16.2h.01" strokeWidth="2.4" />
    </svg>
  )
}

function PayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M14.6 9.1a2.9 2.9 0 0 0-2.6-1.4c-1.6 0-2.7.9-2.7 2.1 0 1.3 1.1 1.8 2.7 2.1 1.6.3 2.8.8 2.8 2.2 0 1.3-1.2 2.2-2.8 2.2a3 3 0 0 1-2.7-1.5" />
      <path d="M12 6v12" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function PlusCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
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

type EmployeeApiSummary = {
  totalEmployees?: number
  totalReports?: number
  averageUpdatePercentage?: number
  totalSalaryAmount?: number
  totalBaseSalary?: number
  totalDeductionAmount?: number
  totalBonusAmount?: number
  totalFinalSalary?: number
  totalEstimatedSalary?: number
  employeesWithPenalties?: number
  employeesWithBonuses?: number
}

function createRosterUsers(memberOptions: WorkdayOverrideMemberOption[]): CeoUserRecord[] {
  return memberOptions.map((member) => ({
    id: member.id,
    email: '',
    name: member.name,
    surname: member.surname,
    company_code: '',
    telegram_id: member.telegram_id ?? null,
    default_salary: null,
    role: member.role,
    job_title: member.role,
    is_active: true,
    profile_image: member.profile_image ?? null,
  }))
}

function getTodayDateInput() {
  return new Date().toISOString().slice(0, 10)
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

function extractEmployeeApiSummary(payload: unknown): EmployeeApiSummary {
  const parsed = parseMaybeJson(payload)
  const root = isRecord(parsed) ? parsed : null
  const nestedData = root && isRecord(root.data) ? root.data : null
  const summary =
    root && isRecord(root.summary)
      ? root.summary
      : nestedData && isRecord(nestedData.summary)
        ? nestedData.summary
        : null
  const salarySummary = summary
    ? findFirstRecord(summary, ['salary_estimate_summary', 'salary_summary', 'salary_estimates_summary'])
    : null

  return {
    totalEmployees: summary ? findFirstNumber(summary, ['total_employees', 'employees_count', 'employee_count']) : undefined,
    totalReports: summary ? findFirstNumber(summary, ['total_reports']) : undefined,
    averageUpdatePercentage: summary ? findFirstNumber(summary, ['average_update_percentage']) : undefined,
    totalSalaryAmount:
      (summary ? findFirstNumber(summary, ['total_salary_amount', 'total_final_salary', 'final_salary_total']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_salary_amount', 'total_final_salary', 'final_salary_total']) : undefined),
    totalBaseSalary:
      (summary ? findFirstNumber(summary, ['total_base_salary', 'base_salary_total', 'base_salary']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_base_salary', 'base_salary_total', 'base_salary']) : undefined),
    totalDeductionAmount:
      (summary ? findFirstNumber(summary, ['total_applied_deduction_amount', 'total_deduction_amount', 'deduction_amount_total', 'deduction_total']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_applied_deduction_amount', 'total_deduction_amount', 'deduction_amount_total', 'deduction_total']) : undefined),
    totalBonusAmount:
      (summary ? findFirstNumber(summary, ['total_bonus_amount', 'bonus_amount_total', 'bonus_total']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_bonus_amount', 'bonus_amount_total', 'bonus_total']) : undefined),
    totalFinalSalary:
      (summary ? findFirstNumber(summary, ['total_final_salary', 'final_salary_total']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_final_salary', 'final_salary_total']) : undefined),
    totalEstimatedSalary:
      (summary ? findFirstNumber(summary, ['total_estimated_salary', 'estimated_salary_total', 'salary_estimate_total']) : undefined) ??
      (salarySummary ? findFirstNumber(salarySummary, ['total_estimated_salary', 'estimated_salary_total', 'salary_estimate_total']) : undefined),
    employeesWithPenalties:
      (salarySummary ? findFirstNumber(salarySummary, ['employees_with_penalties', 'penalty_employee_count', 'employees_with_deductions']) : undefined),
    employeesWithBonuses:
      (salarySummary ? findFirstNumber(salarySummary, ['employees_with_bonuses', 'bonus_employee_count']) : undefined),
  }
}

export function FaultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const lt = translateCurrentLiteral
  const locale = getIntlLocale()
  const tl = (en: string, uz: string, ru: string) => {
    if (locale.startsWith('ru')) {
      return ru
    }

    if (locale.startsWith('en')) {
      return en
    }

    return uz
  }
  const tr = (key: string, uzFallback: string, ruFallback: string) => {
    const value = lt(key)

    if (value !== key) {
      return value
    }

    return tl(key, uzFallback, ruFallback)
  }
  const [mistakeTarget, setMistakeTarget] = useState<EmployeeSalaryReport | null>(null)
  const [mistakeDraft, setMistakeDraft] = useState<MistakeFormState>(() => createMistakeFormState())
  const [deliveryBonusTarget, setDeliveryBonusTarget] = useState<EmployeeSalaryReport | null>(null)
  const [deliveryBonusDraft, setDeliveryBonusDraft] = useState<DeliveryBonusFormState>(() => createDeliveryBonusFormState())
  const [activeReportId, setActiveReportId] = useState<number | null>(null)
  const [isMistakeSubmitting, setIsMistakeSubmitting] = useState(false)
  const [isDeliveryBonusSubmitting, setIsDeliveryBonusSubmitting] = useState(false)
  const needsMistakeSupportData = mistakeTarget !== null
  const needsDeliveryBonusSupportData = deliveryBonusTarget !== null || activeReportId !== null
  const needsProjectSupportData = needsMistakeSupportData || needsDeliveryBonusSupportData
  const year = parsePeriodNumber(searchParams.get('year'), defaultYear, 2020, 2050)
  const month = parsePeriodNumber(searchParams.get('month'), defaultMonth, 1, 12)
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const monthValue = index + 1

        return {
          value: String(monthValue),
          label: getMonthName(monthValue),
        }
      }),
    [locale],
  )
  const memberOptionsQuery = useAsyncData(
    () => updateTrackingService.workdayOverrideMemberOptions(),
    [],
  )
  const projectsQuery = useAsyncData(
    async () => {
      const { projectsService } = await import('../../../shared/api/services/projects.service')
      return projectsService.listProjects()
    },
    [],
    { enabled: needsProjectSupportData },
  )
  const reviewersQuery = useAsyncData(
    async () => {
      const { projectsService } = await import('../../../shared/api/services/projects.service')
      return projectsService.getAllUsers()
    },
    [],
    { enabled: needsMistakeSupportData },
  )
  const rosterUsers = useMemo(
    () => createRosterUsers(memberOptionsQuery.data ?? []),
    [memberOptionsQuery.data],
  )
  const rosterUsersById = useMemo(
    () => new Map(rosterUsers.map((user) => [user.id, user] satisfies [number, CeoUserRecord])),
    [rosterUsers],
  )
  const employeeIds = useMemo(
    () => rosterUsers.map((user) => user.id),
    [rosterUsers],
  )
  const compensationPolicyQuery = useAsyncData(
    () => membersService.compensationPolicy({ employeeIds }),
    [employeeIds.join(',')],
    {
      enabled: employeeIds.length > 0,
      onError: (error) => {
        showToast({
          title: tr('Compensation policy API failed', 'Kompensatsiya siyosati API muvaffaqiyatsiz tugadi', 'Ошибка API политики компенсации'),
          description: getApiErrorMessage(error),
          tone: 'error',
        })
      },
    },
  )
  const reviewerOptions = useMemo(
    () => {
      const allUsers = reviewersQuery.data ?? []

      if (allUsers.length > 0) {
        return allUsers.map((user) => ({
          value: String(user.id),
          label: `${user.name} ${user.surname}`.trim() || user.email || `Reviewer #${user.id}`,
        }))
      }

      return (memberOptionsQuery.data ?? []).map((member) => ({
        value: String(member.id),
        label: member.full_name || `${member.name} ${member.surname}`.trim() || `Reviewer #${member.id}`,
      }))
    },
    [memberOptionsQuery.data, reviewersQuery.data],
  )
  const projectOptions = useMemo(
    () => [
      { value: '0', label: tr('No project', 'Loyihasiz', 'Без проекта') },
      ...((projectsQuery.data?.projects ?? []).map((project) => ({
        value: String(project.id),
        label: project.project_name,
      }))),
    ],
    [locale, projectsQuery.data],
  )
  const defaultReviewerId = useMemo(
    () => reviewerOptions.find((option) => Number(option.value) === currentUser?.id)?.value ?? reviewerOptions[0]?.value ?? '',
    [currentUser?.id, reviewerOptions],
  )
  const mistakePolicy = useMemo(
    () => mistakeTarget ? buildEmployeeCompensationPolicy(compensationPolicyQuery.data, mistakeTarget.id, mistakeTarget.fullName) : null,
    [compensationPolicyQuery.data, mistakeTarget],
  )
  const deliveryBonusPolicy = useMemo(
    () => deliveryBonusTarget ? buildEmployeeCompensationPolicy(compensationPolicyQuery.data, deliveryBonusTarget.id, deliveryBonusTarget.fullName) : null,
    [compensationPolicyQuery.data, deliveryBonusTarget],
  )
  const mistakeCategoryOptions = useMemo(
    () => getCompensationPolicyCategoryOptions(mistakePolicy).map((option) => ({
      ...option,
      label: lt(option.label),
    })),
    [mistakePolicy, locale],
  )
  const severityOptions = useMemo(
    () => getCompensationPolicySeverityOptions(mistakePolicy).map((option) => ({
      ...option,
      label: lt(option.label),
    })),
    [mistakePolicy, locale],
  )
  const deliveryBonusTypeOptions = useMemo(
    () => getCompensationPolicyDeliveryBonusOptions(deliveryBonusPolicy).map((option) => ({
      ...option,
      label:
        option.value === 'early_delivery'
          ? tr('Early Delivery', 'Erta topshirish', 'Ранняя сдача')
          : option.value === 'major_early_delivery'
            ? tr('Major Early Delivery', 'Juda erta topshirish', 'Досрочная сдача')
            : option.label,
    })),
    [deliveryBonusPolicy, locale],
  )

  const updatesAllQuery = useAsyncData(
    () => membersService.updatesAll({ year, month }),
    [year, month],
    {
      onError: (error) => {
        showToast({
          title: lt('Employee updates API failed'),
          description: getApiErrorMessage(error),
          tone: 'error',
        })
      },
    },
  )

  const statisticsQuery = useAsyncData(
    () => membersService.updatesStatistics({ year, month }),
    [year, month],
    {
      onError: (error) => {
        showToast({
          title: lt('Employee summary API failed'),
          description: getApiErrorMessage(error),
          tone: 'error',
        })
      },
    },
  )
  const salaryEstimatesQuery = useAsyncData(
    () => membersService.salaryEstimates({ year, month, employeeIds }),
    [year, month, employeeIds.join(',')],
    {
      enabled: employeeIds.length > 0,
      onError: (error) => {
        showToast({
          title: lt('Employee salary estimates API failed'),
          description: getApiErrorMessage(error),
          tone: 'error',
        })
      },
    },
  )

  const reports = useMemo(
    () => buildEmployeeReports(rosterUsers, salaryEstimatesQuery.data ?? updatesAllQuery.data, { includeFallbackUsers: true }),
    [rosterUsers, salaryEstimatesQuery.data, updatesAllQuery.data],
  )
  const apiSummary = useMemo(
    () => {
      const statisticsSummary = extractEmployeeApiSummary(statisticsQuery.data)
      const salarySummary = extractEmployeeApiSummary(salaryEstimatesQuery.data)
      const derivedEmployeesWithPenalties = reports.filter((report) => report.hasPenalty).length
      const derivedEmployeesWithBonuses = reports.filter((report) => report.hasBonus).length

      return {
        totalEmployees: salarySummary.totalEmployees ?? statisticsSummary.totalEmployees ?? reports.length,
        totalReports: statisticsSummary.totalReports,
        averageUpdatePercentage: statisticsSummary.averageUpdatePercentage,
        totalSalaryAmount: salarySummary.totalSalaryAmount ?? statisticsSummary.totalSalaryAmount,
        totalBaseSalary: salarySummary.totalBaseSalary ?? statisticsSummary.totalBaseSalary,
        totalDeductionAmount: salarySummary.totalDeductionAmount ?? statisticsSummary.totalDeductionAmount,
        totalBonusAmount: salarySummary.totalBonusAmount ?? statisticsSummary.totalBonusAmount,
        totalFinalSalary: salarySummary.totalFinalSalary ?? statisticsSummary.totalFinalSalary,
        totalEstimatedSalary: salarySummary.totalEstimatedSalary ?? statisticsSummary.totalEstimatedSalary,
        employeesWithPenalties: statisticsSummary.employeesWithPenalties ?? derivedEmployeesWithPenalties,
        employeesWithBonuses: statisticsSummary.employeesWithBonuses ?? derivedEmployeesWithBonuses,
      } satisfies EmployeeApiSummary
    },
    [reports, salaryEstimatesQuery.data, statisticsQuery.data],
  )

  function updateMonth(nextMonth: string) {
    const normalizedMonth = clampNumber(Number(nextMonth) || defaultMonth, 1, 12)

    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      nextParams.set('year', String(year))
      nextParams.set('month', String(normalizedMonth))
      return nextParams
    })
  }
  const activeDrawerReport = useMemo(
    () => reports.find((report) => report.id === activeReportId) ?? null,
    [activeReportId, reports],
  )
  const hasReports = reports.length > 0

  async function handleRefresh() {
    const [membersResult, reviewersResult, policyResult, updatesResult, statisticsResult, salaryResult] = await Promise.allSettled([
      memberOptionsQuery.refetch(),
      reviewersQuery.refetch(),
      employeeIds.length > 0 ? compensationPolicyQuery.refetch() : Promise.resolve(undefined),
      updatesAllQuery.refetch(),
      statisticsQuery.refetch(),
      employeeIds.length > 0 ? salaryEstimatesQuery.refetch() : Promise.resolve(undefined),
    ])

    if (
      membersResult.status === 'rejected' &&
      reviewersResult.status === 'rejected' &&
      policyResult.status === 'rejected' &&
      updatesResult.status === 'rejected' &&
      statisticsResult.status === 'rejected' &&
      salaryResult.status === 'rejected'
    ) {
      showToast({
        title: lt('Refresh failed'),
        description: getApiErrorMessage(
          membersResult.reason ?? reviewersResult.reason ?? policyResult.reason ?? updatesResult.reason ?? statisticsResult.reason ?? salaryResult.reason,
        ),
        tone: 'error',
      })
      return
    }

    showToast({
      title: lt('Salary report refreshed'),
      description: tl(
        `${getMonthName(month)} ${year} report updated.`,
        `${getMonthName(month)} ${year} hisobot yangilandi.`,
        `Отчет за ${getMonthName(month)} ${year} обновлен.`,
      ),
      tone: 'success',
    })
  }

  function openMistakeDialog(report: EmployeeSalaryReport) {
    const reportPolicy = buildEmployeeCompensationPolicy(compensationPolicyQuery.data, report.id, report.fullName)
    const defaultCategory = getCompensationPolicyCategoryOptions(reportPolicy)[0]?.value ?? 'AI Integration'
    const defaultSeverity = getCompensationPolicySeverityOptions(reportPolicy)[0]?.value ?? 'Minor'

    setMistakeTarget(report)
    setMistakeDraft(createMistakeFormState(defaultReviewerId, defaultCategory, defaultSeverity))
  }

  function openDeliveryBonusDialog(report: EmployeeSalaryReport) {
    const reportPolicy = buildEmployeeCompensationPolicy(compensationPolicyQuery.data, report.id, report.fullName)
    const defaultBonusType = getCompensationPolicyDeliveryBonusOptions(reportPolicy)[0]?.value ?? 'early_delivery'

    setDeliveryBonusTarget(report)
    setDeliveryBonusDraft(createDeliveryBonusFormState(defaultBonusType))
  }

  function closeMistakeDialog() {
    setMistakeTarget(null)
    setMistakeDraft(createMistakeFormState(defaultReviewerId))
  }

  function closeDeliveryBonusDialog() {
    setDeliveryBonusTarget(null)
    setDeliveryBonusDraft(createDeliveryBonusFormState())
  }

  function openReportDrawer(report: EmployeeSalaryReport) {
    setActiveReportId(report.id)
  }

  function openDetailPage(report: EmployeeSalaryReport) {
    navigate(`/faults/members/${report.id}?year=${year}&month=${month}`)
  }

  function buildMistakePayload(): MemberMistakePayload | null {
    if (!mistakeTarget) {
      return null
    }

    const reviewerId = parsePositiveId(mistakeDraft.reviewerId)

    if (!reviewerId) {
      showToast({
        title: tr('Reviewer is required', "Ko'rib chiquvchi majburiy", 'Нужно выбрать проверяющего'),
        description: tr(
          'Select a valid reviewer before saving this mistake incident.',
          "Bu xato yozuvini saqlashdan oldin to'g'ri ko'rib chiquvchini tanlang.",
          'Перед сохранением этой ошибки выберите корректного проверяющего.',
        ),
        tone: 'error',
      })
      return null
    }

    if (!mistakeDraft.title.trim() || !mistakeDraft.category.trim() || !mistakeDraft.severity.trim()) {
      showToast({
        title: tr('Mistake details incomplete', "Xato tafsilotlari to'liq emas", 'Данные ошибки заполнены не полностью'),
        description: tr('Title, category, and severity are required.', 'Sarlavha, kategoriya va daraja majburiy.', 'Название, категория и степень обязательны.'),
        tone: 'error',
      })
      return null
    }

    return {
      employee_id: mistakeTarget.id,
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
    if (!deliveryBonusTarget) {
      return null
    }

    if (!deliveryBonusDraft.title.trim() || !deliveryBonusDraft.bonusType.trim()) {
      showToast({
        title: tr(
          'Delivery bonus details incomplete',
          "Topshirish bonusi tafsilotlari to'liq emas",
          'Данные бонуса за сдачу заполнены не полностью',
        ),
        description: tr('Title and bonus type are required.', 'Sarlavha va bonus turi majburiy.', 'Название и тип бонуса обязательны.'),
        tone: 'error',
      })
      return null
    }

    return {
      employee_id: deliveryBonusTarget.id,
      bonus_type: deliveryBonusDraft.bonusType.trim(),
      title: deliveryBonusDraft.title.trim(),
      description: deliveryBonusDraft.description.trim() || undefined,
      award_date: deliveryBonusDraft.awardDate,
      project_id: parsePositiveId(deliveryBonusDraft.projectId) ?? 0,
    }
  }

  async function handleSubmitMistake() {
    const payload = buildMistakePayload()

    if (!payload || !mistakeTarget) {
      return
    }

    setIsMistakeSubmitting(true)

    try {
      const response = await membersService.createMistake(payload)

      await Promise.all([updatesAllQuery.refetch(), statisticsQuery.refetch(), salaryEstimatesQuery.refetch()])
      closeMistakeDialog()
      showToast({
        title: tr('Mistake added', "Xato qo'shildi", 'Ошибка добавлена'),
        description: getSuccessMessage(response, `${mistakeTarget.fullName} updated.`),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: tr('Mistake not added', "Xato qo'shilmadi", 'Ошибка не добавлена'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsMistakeSubmitting(false)
    }
  }

  async function handleSubmitDeliveryBonus() {
    const payload = buildDeliveryBonusPayload()

    if (!payload || !deliveryBonusTarget) {
      return
    }

    setIsDeliveryBonusSubmitting(true)

    try {
      const response = await membersService.createDeliveryBonus(payload)

      await Promise.all([updatesAllQuery.refetch(), statisticsQuery.refetch(), salaryEstimatesQuery.refetch()])
      closeDeliveryBonusDialog()
      showToast({
        title: tr('Delivery bonus added', "Topshirish bonusi qo'shildi", 'Бонус за сдачу добавлен'),
        description: getSuccessMessage(response, `${deliveryBonusTarget.fullName} updated.`),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: tr('Delivery bonus not added', "Topshirish bonusi qo'shilmadi", 'Бонус за сдачу не добавлен'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsDeliveryBonusSubmitting(false)
    }
  }

  if (!hasReports && (memberOptionsQuery.isLoading || updatesAllQuery.isLoading || statisticsQuery.isLoading || salaryEstimatesQuery.isLoading)) {
    return (
      <LoadingStateBlock
        eyebrow={tr('CEO / Salary', 'CEO / Maosh', 'CEO / Зарплата')}
        title={tr('Loading employee salary report', 'Xodimlar maosh hisoboti yuklanmoqda', 'Загрузка отчета по зарплате сотрудников')}
        description={lt('Fetching employee monthly salary and update statistics from the Employees API.')}
      />
    )
  }

  if (!hasReports && updatesAllQuery.isError && salaryEstimatesQuery.isError) {
    return (
      <ErrorStateBlock
        eyebrow={tr('CEO / Salary', 'CEO / Maosh', 'CEO / Зарплата')}
        title={lt('Salary report unavailable')}
        description={lt('Could not fetch employee monthly salary data from the Employees API.')}
        actionLabel={lt('Retry')}
        onAction={() => {
          void handleRefresh()
        }}
      />
    )
  }

  if (!hasReports) {
    return (
      <EmptyStateBlock
        eyebrow={tr('CEO / Salary', 'CEO / Maosh', 'CEO / Зарплата')}
        title={tr('No salary estimates returned', 'Maosh hisobi topilmadi', 'Оценки зарплаты не получены')}
        description={lt('The Employees API did not return any salary estimates for the selected period.')}
      />
    )
  }

  return (
    <section className="space-y-[18px] page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SelectField
            value={String(month)}
            options={monthOptions}
            onValueChange={updateMonth}
            placeholder={lt('Month')}
            className="w-45"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<RefreshIcon />}
            onClick={() => void handleRefresh()}
          >
            {lt('Refresh')}
          </Button>
        </div>
      </div>

      <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={tr('Employees', 'Xodimlar', 'Сотрудники')}
          value={formatCount(apiSummary.totalEmployees)}
          icon={<TeamIcon />}
          iconTone="blue"
        />
        <StatCard
          label={tr('Base salary total', 'Jami asosiy maosh', 'Сумма базовой зарплаты')}
          value={formatAmount(apiSummary.totalBaseSalary ?? 0)}
          icon={<WalletIcon />}
          iconTone="neutral"
        />
        <StatCard
          label={tr('Applied deductions', "Qo'llangan ayirmalar", 'Примененные удержания')}
          value={formatAmount(apiSummary.totalDeductionAmount ?? 0)}
          icon={<DeductionIcon />}
          iconTone="danger"
        />
        <StatCard
          label={tr('Bonus total', 'Jami bonus', 'Сумма бонусов')}
          value={formatAmount(apiSummary.totalBonusAmount ?? 0)}
          icon={<BonusIcon />}
          iconTone="success"
        />
        <StatCard
          label={tr('Estimated total', 'Jami taxminiy maosh', 'Сумма оценки')}
          value={formatAmount(apiSummary.totalEstimatedSalary ?? 0)}
          icon={<EstimateIcon />}
          iconTone="violet"
        />
        <StatCard
          solid
          label={tr('Final salary total', 'Jami yakuniy maosh', 'Итоговая сумма зарплаты')}
          value={formatAmount(apiSummary.totalFinalSalary ?? apiSummary.totalSalaryAmount ?? 0)}
          icon={<PayoutIcon />}
        />
      </div>

      <Card>
        <DataTable
          caption={lt('Salary estimate breakdown')}
          rows={reports}
          pageSize={75}
          compact
          zebra
          onRowClick={openReportDrawer}
          getRowKey={(row) => `${row.id}-${row.fullName}`}
          columns={[
            {
              key: 'user',
              header: tr('User', 'Xodim', 'Сотрудник'),
              width: '280px',
              render: (row) => {
                const rosterUser = rosterUsersById.get(row.id)

                return (
                  <button
                    type="button"
                    onClick={() => openReportDrawer(row)}
                    className="group flex items-center gap-3 text-left"
                  >
                    <MemberAvatar
                      name={rosterUser?.name ?? row.fullName}
                      surname={rosterUser?.surname ?? ''}
                      imageUrl={rosterUser?.profile_image}
                      size="sm"
                      title={row.fullName}
                    />
                    <span className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--blue-text)]">{row.fullName}</p>
                      <p className="truncate text-[12.5px] text-[var(--muted)]">{row.label}</p>
                    </span>
                  </button>
                )
              },
              minWidth: '260px',
            },
            {
              key: 'base',
              header: tr('Base', 'Asosiy', 'База'),
              align: 'right',
              minWidth: '120px',
              render: (row) => <span data-ui-number="true">{formatAmount(row.baseSalary)}</span>,
            },
            {
              key: 'afterPenalty',
              header: lt('After penalty'),
              align: 'right',
              minWidth: '140px',
              render: (row) => <span data-ui-number="true">{formatAmount(row.afterPenalty)}</span>,
            },
            {
              key: 'bonusAmount',
              header: lt('Bonus amount'),
              align: 'right',
              minWidth: '130px',
              render: (row) => (
                <span className={successPillClassName} data-ui-number="true">
                  {formatAmount(row.bonusAmount)}
                </span>
              ),
            },
            {
              key: 'bonusPercent',
              header: tr('Bonus %', 'Bonus %', 'Бонус %'),
              align: 'right',
              minWidth: '110px',
              render: (row) => (
                <span
                  className={row.totalBonusPercent > 0 ? successPillClassName : neutralPillClassName}
                  data-ui-number="true"
                >
                  {formatPercent(row.totalBonusPercent)}
                </span>
              ),
            },
            {
              key: 'productivity',
              header: lt('Productivity'),
              align: 'right',
              minWidth: '180px',
              render: (row) => (
                <span
                  className={row.qualifiesProductivityBonus ? successPillClassName : neutralPillClassName}
                  data-ui-number="true"
                >
                  {Number.isFinite(row.productivityPercentage)
                    ? `${formatCount(row.updateDays)}/${formatCount(row.workingDays)} / ${formatPercent(row.productivityPercentage)}`
                    : '-'}
                </span>
              ),
            },
            {
              key: 'finalSalary',
              header: lt('Final salary'),
              align: 'right',
              minWidth: '130px',
              render: (row) => (
                <span
                  className={cn('font-semibold', row.finalSalary > row.afterPenalty ? 'text-[var(--success-text)]' : 'text-[var(--foreground)]')}
                  data-ui-number="true"
                >
                  {formatAmount(row.finalSalary)}
                </span>
              ),
            },
            {
              key: 'actions',
              header: tr('Actions', 'Amallar', 'Действия'),
              align: 'right',
              minWidth: '124px',
              render: (row) => (
                <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                  <IconButton size="sm" label={lt('View details')} onClick={() => openDetailPage(row)}>
                    <EyeIcon />
                  </IconButton>
                  <IconButton
                    size="sm"
                    tone="danger"
                    label={tr('Add mistake', "Xato qo'shish", 'Добавить ошибку')}
                    onClick={() => openMistakeDialog(row)}
                  >
                    <AlertIcon />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={tr('Add delivery bonus', "Topshirish bonusini qo'shish", 'Добавить бонус за сдачу')}
                    onClick={() => openDeliveryBonusDialog(row)}
                    className="text-[var(--success-text)] hover:bg-[var(--success-dim)] hover:text-[var(--success-text)]"
                  >
                    <PlusCircleIcon />
                  </IconButton>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {activeDrawerReport ? (
        <Suspense fallback={<AsyncContentLoader variant="dialog" />}>
          <SalaryEstimateDrawer
            open={Boolean(activeDrawerReport)}
            report={activeDrawerReport}
            month={month}
            year={year}
            onClose={() => setActiveReportId(null)}
            onOpenDetail={() => {
              if (!activeDrawerReport) {
                return
              }

              setActiveReportId(null)
              openDetailPage(activeDrawerReport)
            }}
            onAddDeliveryBonus={() => {
              if (!activeDrawerReport) {
                return
              }

              setActiveReportId(null)
              openDeliveryBonusDialog(activeDrawerReport)
            }}
          />
        </Suspense>
      ) : null}

      <Dialog
        open={Boolean(mistakeTarget)}
        onClose={closeMistakeDialog}
        title={mistakeTarget
          ? tl(`Add mistake for ${mistakeTarget.fullName}`, `${mistakeTarget.fullName} uchun xato qo'shish`, `Добавить ошибку для ${mistakeTarget.fullName}`)
          : tr('Add mistake', "Xato qo'shish", 'Добавить ошибку')}
        description={mistakeTarget
          ? tl(
            `${getMonthName(month)} ${year} compensation mistake entry.`,
            `${getMonthName(month)} ${year} uchun kompensatsiya xatosi yozuvi.`,
            `Запись ошибки компенсации за ${getMonthName(month)} ${year}.`,
          )
          : undefined}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeMistakeDialog}
              disabled={isMistakeSubmitting}
            >
              {lt('Cancel')}
            </Button>
            <Button variant="danger" onClick={() => void handleSubmitMistake()} loading={isMistakeSubmitting}>
              {tr('Save mistake', 'Xatoni saqlash', 'Сохранить ошибку')}
            </Button>
          </>
        }
      >
        <div className="grid gap-[18px]">
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
            <p className="text-xs font-medium text-[var(--muted)]">{tr('Employee', 'Xodim', 'Сотрудник')}</p>
            <p className="mt-1.5 text-[15px] font-semibold text-[var(--foreground)]">{mistakeTarget?.fullName ?? '-'}</p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-2">
            <div>
              <Label className="mb-2 block">{tr('Reviewer', "Ko'rib chiquvchi", 'Проверяющий')}</Label>
              {reviewerOptions.length > 0 ? (
                <SelectField
                  value={mistakeDraft.reviewerId}
                  options={reviewerOptions}
                  onValueChange={(value) => setMistakeDraft((current) => ({ ...current, reviewerId: value }))}
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
              <Label className="mb-2 block">{tr('Project', 'Loyiha', 'Проект')}</Label>
              {projectOptions.length > 1 ? (
                <SelectField
                  value={mistakeDraft.projectId}
                  options={projectOptions}
                  onValueChange={(value) => setMistakeDraft((current) => ({ ...current, projectId: value }))}
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

          <div className="grid gap-[18px] md:grid-cols-2">
            <div>
              <Label className="mb-2 block">{tr('Category', 'Kategoriya', 'Категория')}</Label>
              {mistakeCategoryOptions.length > 0 ? (
                <SelectField
                  value={mistakeDraft.category}
                  options={mistakeCategoryOptions}
                  onValueChange={(value) => setMistakeDraft((current) => ({ ...current, category: value }))}
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
              <Label className="mb-2 block">{tr('Severity', 'Daraja', 'Степень')}</Label>
              {severityOptions.length > 0 ? (
                <SelectField
                  value={mistakeDraft.severity}
                  options={severityOptions}
                  onValueChange={(value) => setMistakeDraft((current) => ({ ...current, severity: value }))}
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

          <div className="grid gap-[18px] md:grid-cols-[1fr_180px]">
            <div>
              <Label className="mb-2 block">{tr('Title', 'Sarlavha', 'Название')}</Label>
              <Input
                value={mistakeDraft.title}
                onChange={(event) => setMistakeDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={tr('Short mistake title', 'Qisqa xato sarlavhasi', 'Короткое название ошибки')}
              />
            </div>

            <div>
              <Label className="mb-2 block">{tr('Incident date', "Sodir bo'lgan sana", 'Дата инцидента')}</Label>
              <Input
                type="date"
                value={mistakeDraft.incidentDate}
                onChange={(event) => setMistakeDraft((current) => ({ ...current, incidentDate: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{tr('Description', 'Tavsif', 'Описание')}</Label>
            <Textarea
              value={mistakeDraft.description}
              onChange={(event) => setMistakeDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={tr('Describe what happened', "Nima bo'lganini yozing", 'Опишите, что произошло')}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-11 items-center gap-3 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
              <Checkbox
                size="sm"
                checked={mistakeDraft.reachedClient}
                onChange={(event) => setMistakeDraft((current) => ({ ...current, reachedClient: event.target.checked }))}
              />
              {tr('Reached client', 'Mijozga yetib borgan', 'Дошло до клиента')}
            </label>

            <label className="flex min-h-11 items-center gap-3 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
              <Checkbox
                size="sm"
                checked={mistakeDraft.unclearTask}
                onChange={(event) => setMistakeDraft((current) => ({ ...current, unclearTask: event.target.checked }))}
              />
              {tr('Unclear task', 'Vazifa noaniq', 'Неясная задача')}
            </label>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deliveryBonusTarget)}
        onClose={closeDeliveryBonusDialog}
        title={deliveryBonusTarget
          ? tl(
            `Add delivery bonus for ${deliveryBonusTarget.fullName}`,
            `${deliveryBonusTarget.fullName} uchun topshirish bonusini qo'shish`,
            `Добавить бонус за сдачу для ${deliveryBonusTarget.fullName}`,
          )
          : tr('Add delivery bonus', "Topshirish bonusini qo'shish", 'Добавить бонус за сдачу')}
        description={deliveryBonusTarget
          ? tl(
            `${getMonthName(month)} ${year} delivery bonus entry.`,
            `${getMonthName(month)} ${year} uchun topshirish bonusi yozuvi.`,
            `Запись бонуса за сдачу за ${getMonthName(month)} ${year}.`,
          )
          : undefined}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeDeliveryBonusDialog}
              disabled={isDeliveryBonusSubmitting}
            >
              {lt('Cancel')}
            </Button>
            <Button variant="success" onClick={() => void handleSubmitDeliveryBonus()} loading={isDeliveryBonusSubmitting}>
              {tr('Save delivery bonus', "Topshirish bonusini saqlash", 'Сохранить бонус за сдачу')}
            </Button>
          </>
        }
      >
        <div className="grid gap-[18px]">
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
            <p className="text-xs font-medium text-[var(--muted)]">{tr('Employee', 'Xodim', 'Сотрудник')}</p>
            <p className="mt-1.5 text-[15px] font-semibold text-[var(--foreground)]">{deliveryBonusTarget?.fullName ?? '-'}</p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-2">
            <div>
              <Label className="mb-2 block">{tr('Bonus type', 'Bonus turi', 'Тип бонуса')}</Label>
              {deliveryBonusTypeOptions.length > 0 ? (
                <SelectField
                  value={deliveryBonusDraft.bonusType}
                  options={deliveryBonusTypeOptions}
                  onValueChange={(value) => setDeliveryBonusDraft((current) => ({ ...current, bonusType: value }))}
                />
              ) : (
                <Input
                  value={deliveryBonusDraft.bonusType}
                  onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, bonusType: event.target.value }))}
                  placeholder="early_delivery"
                />
              )}
            </div>

            <div>
              <Label className="mb-2 block">{tr('Award date', 'Berilgan sana', 'Дата выдачи')}</Label>
              <Input
                type="date"
                value={deliveryBonusDraft.awardDate}
                onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, awardDate: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{tr('Title', 'Sarlavha', 'Название')}</Label>
            <Input
              value={deliveryBonusDraft.title}
              onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder={tr('Short bonus title', 'Qisqa bonus sarlavhasi', 'Короткое название бонуса')}
            />
          </div>

          <div>
            <Label className="mb-2 block">{tr('Project', 'Loyiha', 'Проект')}</Label>
            {projectOptions.length > 1 ? (
              <SelectField
                value={deliveryBonusDraft.projectId}
                options={projectOptions}
                onValueChange={(value) => setDeliveryBonusDraft((current) => ({ ...current, projectId: value }))}
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
            <Label className="mb-2 block">{tr('Description', 'Tavsif', 'Описание')}</Label>
            <Textarea
              value={deliveryBonusDraft.description}
              onChange={(event) => setDeliveryBonusDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={tr('Describe why this delivery bonus was awarded', "Bu topshirish bonusi nega berilganini yozing", 'Опишите, почему был выдан этот бонус за сдачу')}
            />
          </div>
        </div>
      </Dialog>
    </section>
  )
}
