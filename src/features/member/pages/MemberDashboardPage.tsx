import { useMemo, useState } from 'react'
import { developerKpiService, type SalaryEstimate } from '../../../shared/api/services/developer-kpi.service'
import { useSearchParams } from 'react-router-dom'
import type { CurrentUser } from '../../../shared/api/types'
import type { CeoUserRecord } from '../../../shared/api/services/ceo.service'
import { membersService } from '../../../shared/api/services/members.service'
import { updateTrackingService } from '../../../shared/api/services/updateTracking.service'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useToast } from '../../../shared/toast/useToast'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { Sparkline } from '../../../shared/ui/charts/sparkline'
import { TaskList, type TaskRow } from '../../../shared/ui/charts/task-list'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Progress } from '../../../shared/ui/progress'
import { SelectField } from '../../../shared/ui/select-field'
import { SectionTitle } from '../../../shared/ui/section-title'
import { Skeleton } from '../../../shared/ui/skeleton'
import { StatCard } from '../../../shared/ui/stat-card'
import { ErrorStateBlock } from '../../../shared/ui/state-block'
import { useAuth } from '../../auth/hooks/useAuth'
import { CompensationPolicyPanel } from '../../faults/components/CompensationPolicyPanel'
import {
  DeliveryBonusSection,
  MistakeIncidentSection,
} from '../../faults/components/CompensationRecordPanels'
import { DetailStatTile, RefreshIcon } from '../../faults/components/SalaryEstimatePrimitives'
import {
  buildEmployeeSalaryDetail,
  buildReportFromUser,
  defaultMonth,
  defaultYear,
  formatAmount,
  formatCount,
  formatDetailDate,
  formatPercent,
  getMonthOptions,
  getMonthName,
} from '../../faults/lib/salaryEstimates'

type ChartMode = 'count' | 'rate'

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

function safeNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function scrollToSection(sectionId: string) {
  if (typeof document === 'undefined') {
    return
  }

  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function createMemberUser(user: CurrentUser): CeoUserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    company_code: user.company_code,
    telegram_id: null,
    default_salary: null,
    job_title: user.job_title,
    role: user.role,
    is_active: user.is_active,
  }
}

type MemberDashboardData = {
  detail: ReturnType<typeof buildEmployeeSalaryDetail>
  stats: Awaited<ReturnType<typeof updateTrackingService.myStats>> | null
  statsError: string | null
}

const MEMBER_DASHBOARD_CACHE_PREFIX = 'cims:member-dashboard:'
const memberDashboardCache = new Map<string, MemberDashboardData>()

function getMemberDashboardCacheKey(userId: number, year: number, month: number) {
  return `${userId}:${year}:${month}`
}

function getMemberDashboardStorageKey(cacheKey: string) {
  return `${MEMBER_DASHBOARD_CACHE_PREFIX}${cacheKey}`
}

function readMemberDashboardCache(cacheKey: string) {
  const cached = memberDashboardCache.get(cacheKey)

  if (cached) {
    return cached
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const rawValue = window.sessionStorage.getItem(getMemberDashboardStorageKey(cacheKey))

    if (!rawValue) {
      return undefined
    }

    const parsed = JSON.parse(rawValue) as MemberDashboardData
    memberDashboardCache.set(cacheKey, parsed)
    return parsed
  } catch {
    return undefined
  }
}

function writeMemberDashboardCache(cacheKey: string, data: MemberDashboardData) {
  memberDashboardCache.set(cacheKey, data)

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(getMemberDashboardStorageKey(cacheKey), JSON.stringify(data))
  } catch {
    // Ignore sessionStorage quota or serialization issues and keep in-memory cache.
  }
}

async function loadMemberDashboardData(memberUser: CeoUserRecord, year: number, month: number, force = false): Promise<MemberDashboardData> {
  const cacheKey = getMemberDashboardCacheKey(memberUser.id, year, month)

  if (!force) {
    const cached = readMemberDashboardCache(cacheKey)

    if (cached) {
      return cached
    }
  }

  const [estimateResult, policyResult, mistakesResult, deliveryBonusesResult, calendarResult, statsResult] = await Promise.allSettled([
    membersService.mySalaryEstimate(year, month),
    membersService.compensationPolicy({ employeeIds: [memberUser.id] }),
    membersService.listMistakes({ year, month, employeeId: memberUser.id }),
    membersService.listDeliveryBonuses({ year, month, employeeId: memberUser.id }),
    updateTrackingService.employeeMonthlyUpdates(year, month, memberUser.id),
    updateTrackingService.myStats(),
  ])

  const result: MemberDashboardData = {
    detail: buildEmployeeSalaryDetail({
      report: buildReportFromUser(memberUser),
      user: memberUser,
      estimatePayload: estimateResult.status === 'fulfilled' ? estimateResult.value : null,
      policyPayload: policyResult.status === 'fulfilled' ? policyResult.value : null,
      mistakesPayload: mistakesResult.status === 'fulfilled' ? mistakesResult.value : null,
      deliveryBonusesPayload: deliveryBonusesResult.status === 'fulfilled' ? deliveryBonusesResult.value : null,
      updatesPayload: null,
      calendarPayload: calendarResult.status === 'fulfilled' ? calendarResult.value : null,
      estimateError: estimateResult.status === 'rejected' ? getApiErrorMessage(estimateResult.reason) : null,
      policyError: policyResult.status === 'rejected' ? getApiErrorMessage(policyResult.reason) : null,
      mistakesError: mistakesResult.status === 'rejected' ? getApiErrorMessage(mistakesResult.reason) : null,
      deliveryBonusesError: deliveryBonusesResult.status === 'rejected' ? getApiErrorMessage(deliveryBonusesResult.reason) : null,
      updatesError: null,
      calendarError: calendarResult.status === 'rejected' ? getApiErrorMessage(calendarResult.reason) : null,
      year,
      month,
    }),
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    statsError: statsResult.status === 'rejected' ? getApiErrorMessage(statsResult.reason) : null,
  }

  writeMemberDashboardCache(cacheKey, result)
  return result
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12h.01" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z" />
      <path d="M3 8.5V7a2 2 0 0 1 2-2h11M16.5 12.5h.01" />
    </svg>
  )
}

function BaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="12" rx="3" />
      <path d="M8 7V5h8v2M3 12h18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

export function MemberDashboardPage() {
  const monthOptions = useMemo(() => getMonthOptions(), [])
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
  const { t } = useLocale()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [chartMode, setChartMode] = useState<ChartMode>('count')
  const year = parsePeriodNumber(searchParams.get('year'), defaultYear, 2020, 2035)
  const month = parsePeriodNumber(searchParams.get('month'), defaultMonth, 1, 12)
  const memberUser = user ? createMemberUser(user) : null
  const cacheKey = memberUser ? getMemberDashboardCacheKey(memberUser.id, year, month) : null
  const cachedDashboardData = cacheKey ? readMemberDashboardCache(cacheKey) : undefined
  const shouldFetchDashboard = Boolean(memberUser) && !cachedDashboardData

  const dashboardQuery = useAsyncData(
    async () => {
      if (!memberUser) {
        throw new Error('Authenticated member not found.')
      }

      return loadMemberDashboardData(memberUser, year, month)
    },
    [memberUser?.id, month, year],
    { enabled: shouldFetchDashboard, initialData: cachedDashboardData },
  )

  const kpiQuery = useAsyncData(
    async () => {
      if (!user) throw new Error('No user')
      return developerKpiService.getSalaryEstimate(user.id, year, month)
    },
    [user?.id, year, month],
    { enabled: Boolean(user) },
  )
  const kpiEstimate: SalaryEstimate | undefined = kpiQuery.data

  const hasLiveDashboardDataForPeriod =
    dashboardQuery.data?.detail.memberId === memberUser?.id &&
    dashboardQuery.data?.detail.year === year &&
    dashboardQuery.data?.detail.month === month
  const data = cachedDashboardData ?? (hasLiveDashboardDataForPeriod ? dashboardQuery.data : undefined)
  const isDashboardPending = Boolean(memberUser) && !data && !dashboardQuery.isError

  const calendarCounts = useMemo(() => {
    const days = data?.detail.updateCalendar?.days ?? []

    return days.reduce(
      (counts, day) => {
        if (day.status === 'submitted') counts.submitted += 1
        else if (day.status === 'missing') counts.missing += 1
        else if (day.status === 'future') counts.future += 1
        else if (day.status === 'neutral') counts.open += 1
        else if (day.status === 'sunday') counts.off += 1

        return counts
      },
      { submitted: 0, missing: 0, future: 0, open: 0, off: 0 },
    )
  }, [data?.detail.updateCalendar?.days])

  const weeklyBuckets = useMemo(() => {
    const days = data?.detail.updateCalendar?.days ?? []
    const buckets = new Map<number, { submitted: number; elapsed: number }>()

    for (const day of days) {
      if (day.status === 'future' || day.status === 'sunday') {
        continue
      }

      const index = Math.max(1, Math.ceil(day.day / 7))
      const bucket = buckets.get(index) ?? { submitted: 0, elapsed: 0 }

      bucket.elapsed += 1

      if (day.status === 'submitted') {
        bucket.submitted += 1
      }

      buckets.set(index, bucket)
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, bucket]) => ({
        index,
        submitted: bucket.submitted,
        elapsed: bucket.elapsed,
        percent: bucket.elapsed > 0 ? Math.round((bucket.submitted / bucket.elapsed) * 100) : 0,
      }))
  }, [data?.detail.updateCalendar?.days])

  const weeklyBars = useMemo<BarDatum[]>(
    () =>
      weeklyBuckets.map((bucket) => ({
        key: `week-${bucket.index}`,
        label: t('member.overview.week', 'Week {{index}}', { index: bucket.index }),
        value: chartMode === 'rate' ? bucket.percent : bucket.submitted,
        amount: chartMode === 'rate' ? `${bucket.percent}%` : `${bucket.submitted}/${bucket.elapsed}`,
        delta: chartMode === 'rate' ? formatCount(bucket.submitted) : `${bucket.percent}%`,
      })),
    [chartMode, t, weeklyBuckets],
  )

  const updatesTrend = useMemo(() => {
    const days = data?.detail.updateCalendar?.days ?? []
    const points: number[] = []
    let running = 0

    for (const day of days) {
      if (day.status === 'future' || day.status === 'sunday') {
        continue
      }

      if (day.status === 'submitted') {
        running += 1
      }

      points.push(running)
    }

    return points
  }, [data?.detail.updateCalendar?.days])

  const gaugeSegments = useMemo<GaugeSegment[]>(
    () =>
      [
        { key: 'submitted', label: t('member.overview.submitted', 'Submitted'), value: calendarCounts.submitted, color: '#A6E83B' },
        { key: 'missing', label: t('member.overview.missing', 'Missing'), value: calendarCounts.missing, color: '#FFB86B' },
        { key: 'open', label: t('member.overview.open', 'Still open'), value: calendarCounts.open, color: '#C6D4FF' },
        { key: 'off', label: t('member.overview.days_off', 'Days off'), value: calendarCounts.off, color: '#B7D3C6' },
      ].filter((segment) => segment.value > 0),
    [calendarCounts.missing, calendarCounts.off, calendarCounts.open, calendarCounts.submitted, t],
  )

  const salaryStages = useMemo<FunnelStage[]>(() => {
    const report = data?.detail.report

    if (!report) {
      return []
    }

    const base = safeNumber(report.baseSalary)
    const bonus = safeNumber(report.bonusAmount)
    const deduction = safeNumber(report.deductionAmount)
    const final = safeNumber(report.finalSalary)
    const share = (value: number) => (base > 0 ? clampNumber(Math.round((value / base) * 100), 0, 100) : 0)

    return [
      {
        key: 'base',
        label: translateCurrentLiteral('Base salary'),
        count: 100,
        value: formatAmount(report.baseSalary),
        percent: 100,
        icon: <BaseIcon />,
      },
      {
        key: 'bonus',
        label: translateCurrentLiteral('Bonus amount'),
        count: Math.round(safeNumber(report.totalBonusPercent)),
        value: formatAmount(report.bonusAmount),
        percent: share(bonus),
        icon: <PlusIcon />,
      },
      {
        key: 'deduction',
        label: translateCurrentLiteral('Deduction amount'),
        count: Math.round(safeNumber(report.penaltyPercentage)),
        value: formatAmount(report.deductionAmount),
        percent: share(deduction),
        icon: <MinusIcon />,
      },
      {
        key: 'final',
        label: translateCurrentLiteral('Final salary'),
        count: share(final),
        value: formatAmount(report.finalSalary),
        percent: share(final),
        icon: <TrophyIcon />,
        hero: true,
      },
    ]
  }, [data?.detail.report])

  const checklistTasks = useMemo<TaskRow[]>(() => {
    const days = data?.detail.updateCalendar?.days ?? []

    return days
      .filter((day) => day.status === 'submitted' || day.status === 'missing' || day.status === 'neutral')
      .sort((left, right) => right.day - left.day)
      .slice(0, 6)
      .map((day) => {
        const isSubmitted = day.status === 'submitted'
        const isMissing = day.status === 'missing'

        return {
          key: day.date,
          title: formatDetailDate(day.date),
          meta: day.weekdayLabel,
          tag: isSubmitted
            ? t('member.overview.tag_logged', 'logged')
            : isMissing
              ? t('member.overview.tag_missing', 'missing')
              : t('member.overview.tag_open', 'open'),
          tone: isSubmitted ? 'success' : isMissing ? 'danger' : 'warning',
          done: isSubmitted,
        }
      })
  }, [data?.detail.updateCalendar?.days, t])

  const kpiDimensions = useMemo(
    () => [
      { key: 'delivery' as const, label: t('member.kpi.delivery', 'Delivery'), tone: 'blue' as const },
      { key: 'deadline' as const, label: t('member.kpi.deadline', 'Deadline'), tone: 'violet' as const },
      { key: 'quality' as const, label: t('member.kpi.quality', 'Quality'), tone: 'success' as const },
      { key: 'team' as const, label: t('member.kpi.team', 'Team'), tone: 'warning' as const },
      { key: 'discipline' as const, label: t('member.kpi.discipline', 'Discipline'), tone: 'lime' as const },
    ],
    [t],
  )

  const kpiRanking = useMemo<LeaderboardEntry[]>(() => {
    const scores = kpiQuery.data?.scores

    if (!scores) {
      return []
    }

    return kpiDimensions
      .map((dimension) => ({ dimension, score: safeNumber(scores[dimension.key]) }))
      .sort((left, right) => right.score - left.score)
      .map(({ dimension, score }) => ({
        key: dimension.key,
        name: dimension.label,
        initials: dimension.label.slice(0, 2).toUpperCase(),
        amount: `${score.toFixed(1)}%`,
        percent: score,
      }))
  }, [kpiDimensions, kpiQuery.data?.scores])

  const elapsedWorkingDays = calendarCounts.submitted + calendarCounts.missing + calendarCounts.open
  const stats = data?.stats
  const expectedWeeklyUpdates = typeof stats?.expected_updates_per_week === 'number' ? stats.expected_updates_per_week : undefined
  const updatesThisWeek = typeof stats?.updates_this_week === 'number' ? stats.updates_this_week : undefined
  const weeklyRemaining =
    typeof expectedWeeklyUpdates === 'number' && typeof updatesThisWeek === 'number'
      ? Math.max(0, expectedWeeklyUpdates - updatesThisWeek)
      : undefined
  const weeklyCompletion = typeof stats?.percentage_this_week === 'number' ? Math.max(0, stats.percentage_this_week) : undefined
  const monthlyCompletion =
    typeof data?.detail.updatesSummary?.completionPercentage === 'number' && Number.isFinite(data.detail.updatesSummary.completionPercentage)
      ? data.detail.updatesSummary.completionPercentage
      : typeof stats?.percentage_this_month === 'number'
        ? stats.percentage_this_month
        : undefined
  const targetReached =
    (typeof weeklyCompletion === 'number' && weeklyCompletion >= 100) ||
    (typeof expectedWeeklyUpdates === 'number' && expectedWeeklyUpdates > 0 && typeof updatesThisWeek === 'number' && updatesThisWeek >= expectedWeeklyUpdates)
  const submittedRate = elapsedWorkingDays > 0 ? (calendarCounts.submitted / elapsedWorkingDays) * 100 : 0
  const highlightWeekKey = weeklyBars.length > 0 ? weeklyBars[weeklyBars.length - 1].key : undefined

  function updatePeriod(next: { year?: number; month?: number }) {
    const nextYear = next.year ?? year
    const nextMonth = next.month ?? month

    setSearchParams(
      {
        year: String(nextYear),
        month: String(nextMonth),
      },
      { replace: true },
    )
  }

  async function handleRefresh() {
    try {
      if (!memberUser) {
        return
      }

      const nextData = await loadMemberDashboardData(memberUser, year, month, true)
      dashboardQuery.setData(nextData)
      showToast({
        title: tr('Member dashboard refreshed', 'Xodim paneli yangilandi', 'Панель сотрудника обновлена'),
        description: tr(
          `Dashboard synced for ${getMonthName(month)} ${year}.`,
          `${getMonthName(month)} ${year} uchun panel sinxronlandi.`,
          `Панель синхронизирована за ${getMonthName(month)} ${year}.`,
        ),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Refresh failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  if (!memberUser) {
    return (
      <ErrorStateBlock
        eyebrow={lt('Member')}
        title={tr('Member session unavailable', 'Xodim sessiyasi mavjud emas', 'Сессия сотрудника недоступна')}
        description={lt('The current authenticated user could not be resolved.')}
      />
    )
  }

  const detail = data?.detail

  if (isDashboardPending && !detail) {
    return (
      <ErrorStateBlock
        eyebrow={lt('Member')}
        title={lt('Dashboard loading')}
        description={tr('Member dashboard API data is still loading.', 'Xodim paneli API ma\'lumotlari hali yuklanmoqda.', 'Данные API панели сотрудника все еще загружаются.')}
      />
    )
  }

  if (!detail) {
    return (
      <ErrorStateBlock
        eyebrow={lt('Member')}
        title={lt('Dashboard unavailable')}
        description={lt('The dashboard payload did not return a valid member snapshot.')}
        actionLabel={lt('Retry')}
        onAction={() => void dashboardQuery.refetch()}
      />
    )
  }

  const expectedUpdatesHint = tr(
    `${calendarCounts.submitted} updated, ${calendarCounts.missing} missing, ${calendarCounts.open} still open.`,
    `${calendarCounts.submitted} ta yangilangan, ${calendarCounts.missing} ta yetishmayotgan, ${calendarCounts.open} tasi hali ochiq.`,
    `${calendarCounts.submitted} обновлено, ${calendarCounts.missing} отсутствует, ${calendarCounts.open} все еще открыто.`,
  )
  const weeklyProgressHint =
    typeof expectedWeeklyUpdates === 'number' && typeof weeklyRemaining === 'number'
      ? tr(
        `${formatCount(weeklyRemaining)} remaining from ${formatCount(expectedWeeklyUpdates)} expected.`,
        `${formatCount(expectedWeeklyUpdates)} tadan ${formatCount(weeklyRemaining)} tasi qoldi.`,
        `Из ${formatCount(expectedWeeklyUpdates)} ожидаемых осталось ${formatCount(weeklyRemaining)}.`,
      )
      : lt('Weekly target not returned by the API.')
  const weeklyCompletionHint = targetReached
    ? lt('Current weekly target has been reached.')
    : tr(
      'Keep logging updates to stay on track.',
      'Rejada qolish uchun update kiritishda davom eting.',
      'Продолжайте вносить обновления, чтобы идти по плану.',
    )
  const salaryEstimateLabel = `${lt('Salary estimate for')} ${month}/${year}`
  const userBadgeLabel = tr(`User #${detail.report.id}`, `Xodim #${detail.report.id}`, `Сотрудник #${detail.report.id}`)
  const emptyHint = (
    <p className="py-10 text-center text-[13px] text-[var(--muted)]">
      {t('member.overview.no_data', 'No data for this period yet.')}
    </p>
  )

  return (
    <section className="page-enter flex flex-col gap-[18px]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="ui-page-title text-[var(--foreground)]">{detail.report.fullName}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t('member.overview.subtitle', 'Weekly updates, salary snapshot and KPI for the selected month.')}
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:w-auto xl:min-w-[430px]">
          <div className="min-w-0">
            <Label className="mb-1.5 block">{lt('Year')}</Label>
            <Input
              type="number"
              min="2020"
              max="2035"
              value={year}
              onChange={(event) => updatePeriod({ year: clampNumber(Number(event.target.value) || defaultYear, 2020, 2035) })}
            />
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5 block">{lt('Month')}</Label>
            <SelectField
              value={String(month)}
              options={monthOptions}
              onValueChange={(value) => updatePeriod({ month: clampNumber(Number(value), 1, 12) })}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              leftIcon={<RefreshIcon />}
              onClick={() => void handleRefresh()}
              loading={dashboardQuery.isLoading}
            >
              {lt('Refresh')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{userBadgeLabel}</Badge>
        <Badge variant="blue">{detail.report.roleLabel}</Badge>
        <Badge variant={targetReached ? 'success' : 'warning'} dot>
          {targetReached ? lt('Target reached') : lt('Need follow-up')}
        </Badge>
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <StatCard
          solid
          label={lt('Weekly completion')}
          value={formatPercent(weeklyCompletion)}
          hint={weeklyCompletionHint}
          icon={<TargetIcon />}
          footer={
            <Progress
              className="mt-1"
              value={typeof weeklyCompletion === 'number' ? weeklyCompletion : 0}
              tone={targetReached || (weeklyCompletion ?? 0) >= 60 ? 'lime' : 'warning'}
              onInverse
            />
          }
        />
        <StatCard
          label={lt('This week progress')}
          value={formatCount(updatesThisWeek)}
          hint={weeklyProgressHint}
          icon={<PulseIcon />}
          iconTone="violet"
          delta={typeof weeklyRemaining === 'number' && weeklyRemaining > 0 ? formatCount(weeklyRemaining) : undefined}
          deltaTone="neutral"
          onOpen={() => scrollToSection('member-update-checklist')}
        />
        <StatCard
          label={lt('Expected updates (to date)')}
          value={elapsedWorkingDays}
          hint={expectedUpdatesHint}
          icon={<CalendarIcon />}
          iconTone="blue"
          footer={updatesTrend.length > 1 ? <Sparkline points={updatesTrend} /> : undefined}
          className={updatesTrend.length > 1 ? 'overflow-hidden pb-0' : undefined}
        />
        <StatCard
          label={lt('Final salary')}
          value={formatAmount(detail.report.finalSalary)}
          hint={salaryEstimateLabel}
          icon={<WalletIcon />}
          iconTone="lime"
          delta={Number.isFinite(detail.report.totalBonusPercent) ? formatPercent(detail.report.totalBonusPercent) : undefined}
          deltaTone={detail.report.hasPenalty ? 'danger' : 'success'}
          onOpen={() => scrollToSection('member-salary-snapshot')}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <BarChartCard
          className="min-w-0 flex-[1.5_1_520px]"
          title={t('member.overview.rhythm', 'Update rhythm')}
          deltaBadge={typeof monthlyCompletion === 'number' ? formatPercent(monthlyCompletion) : undefined}
          deltaCaption={t('member.overview.rhythm_caption', 'Submitted updates per week of the selected month')}
          periods={[
            { value: 'count' as ChartMode, label: t('member.overview.mode_updates', 'Updates') },
            { value: 'rate' as ChartMode, label: t('member.overview.mode_completion', 'Completion') },
          ]}
          period={chartMode}
          onPeriodChange={setChartMode}
          data={weeklyBars}
          highlightKey={highlightWeekKey}
          summaryTitle={t('member.overview.rhythm_summary', 'Each bar counts only the working days that already passed.')}
          total={chartMode === 'rate' ? formatPercent(submittedRate) : formatCount(calendarCounts.submitted)}
          totalCaption={
            chartMode === 'rate'
              ? t('member.overview.completion_caption', 'average completion')
              : t('member.overview.updates_caption', 'updates logged')
          }
          emptyState={emptyHint}
        />

        <GaugeDonut
          className="min-w-0 flex-[1_1_360px]"
          title={t('member.overview.calendar', 'Update calendar')}
          action={
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-strong)]">
              {getMonthName(month)}
            </span>
          }
          segments={gaugeSegments}
          centerValue={formatPercent(monthlyCompletion)}
          centerCaption={lt('monthly completion')}
          emptyState={emptyHint}
        />
      </div>

      <div id="member-update-checklist" className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1.3_1_440px] flex-col gap-4 rounded-[24px] bg-[var(--card)] p-[22px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {t('member.overview.salary_flow', 'Salary flow')}
            </span>
            <span className="text-[13px] text-[var(--muted)]">
              {t('member.overview.salary_flow_final', 'final')}{' '}
              <b className="font-semibold tabular-nums text-[var(--foreground)]" data-ui-number="true">
                {formatAmount(detail.report.finalSalary)}
              </b>
            </span>
          </div>

          <FunnelStages stages={salaryStages} />

          <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[var(--foreground)]">{lt('Productivity')}</span>
              <span className="text-[13px] font-semibold tabular-nums text-[var(--muted-strong)]" data-ui-number="true">
                {formatCount(detail.report.updateDays)}/{formatCount(detail.report.workingDays)} · {formatPercent(detail.report.productivityPercentage)}
              </span>
            </div>
            <Progress
              className="mt-3"
              value={Number.isFinite(detail.report.productivityPercentage) ? detail.report.productivityPercentage : 0}
              tone={detail.report.qualifiesProductivityBonus ? 'lime' : 'blue'}
            />
          </div>
        </div>

        <TaskList
          className="min-w-0 flex-[1_1_300px]"
          title={t('member.overview.checklist', 'Update checklist')}
          tasks={checklistTasks}
          action={
            calendarCounts.missing > 0 ? (
              <span
                className="rounded-full bg-[var(--warning-dim)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--warning-text)]"
                data-ui-number="true"
              >
                {calendarCounts.missing}
              </span>
            ) : undefined
          }
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">
              {t('member.overview.no_days', 'No working days returned for this month.')}
            </p>
          }
        />

        <Leaderboard
          className="min-w-0 flex-[1_1_300px]"
          title={t('member.overview.kpi_ranking', 'KPI score ranking')}
          badge={kpiEstimate ? `${kpiEstimate.scores.final_kpi.toFixed(1)}%` : undefined}
          entries={kpiRanking}
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--on-inverse-muted)]">
              {lt('No KPI data available for this period.')}
            </p>
          }
        />
      </div>

      {dashboardQuery.isLoading && !dashboardQuery.data ? (
        <Alert tone="blue">{lt('Syncing your latest dashboard data...')}</Alert>
      ) : null}

      {data?.statsError || detail.estimateError || detail.policyError || detail.mistakesError || detail.deliveryBonusesError || detail.updatesError || detail.calendarError ? (
        <Alert tone="warning">
          <div className="space-y-1">
            {data?.statsError ? <p>{lt('Stats API unavailable:')} {data.statsError}</p> : null}
            {detail.estimateError ? <p>{lt('Salary estimate API unavailable:')} {detail.estimateError}</p> : null}
            {detail.policyError ? <p>{tr('Compensation policy API unavailable:', 'Kompensatsiya siyosati API mavjud emas:', 'API политики компенсации недоступен:')} {detail.policyError}</p> : null}
            {detail.mistakesError ? <p>{tr('Mistake incidents API unavailable:', 'Xato hodisalari API mavjud emas:', 'API инцидентов ошибок недоступен:')} {detail.mistakesError}</p> : null}
            {detail.deliveryBonusesError ? <p>{tr('Delivery bonuses API unavailable:', 'Topshirish bonuslari API mavjud emas:', 'API бонусов за сдачу недоступен:')} {detail.deliveryBonusesError}</p> : null}
            {detail.updatesError ? <p>{lt('Update statistics unavailable:')} {detail.updatesError}</p> : null}
            {detail.calendarError ? <p>{lt('Calendar API unavailable:')} {detail.calendarError}</p> : null}
          </div>
        </Alert>
      ) : null}

      <Card id="member-salary-snapshot">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle title={lt('My Salary Snapshot')} description={salaryEstimateLabel} />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={detail.report.hasPenalty ? 'danger' : 'secondary'}>
              {detail.report.hasPenalty ? lt('Deduction applied') : lt('No deductions')}
            </Badge>
            <Badge variant={detail.report.hasBonus ? 'success' : 'secondary'}>
              {detail.report.hasBonus ? lt('Bonus applied') : lt('No bonus')}
            </Badge>
            <Badge variant={(monthlyCompletion ?? 0) >= 80 ? 'success' : (monthlyCompletion ?? 0) > 0 ? 'warning' : 'secondary'}>
              {formatPercent(monthlyCompletion)} {lt('monthly completion')}
            </Badge>
          </div>
        </div>

        <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2 xl:grid-cols-6">
          <DetailStatTile label={lt('Estimated salary')} value={formatAmount(detail.report.estimatedSalary)} tone="success" />
          <DetailStatTile label={lt('Final salary')} value={formatAmount(detail.report.finalSalary)} />
          <DetailStatTile label={lt('Base salary')} value={formatAmount(detail.report.baseSalary)} />
          <DetailStatTile label={lt('Deduction amount')} value={formatAmount(detail.report.deductionAmount)} tone="danger" />
          <DetailStatTile label={lt('Bonus amount')} value={formatAmount(detail.report.bonusAmount)} tone="success" />
          <DetailStatTile label={lt('Bonus %')} value={formatPercent(detail.report.totalBonusPercent)} tone="success" />
        </div>

        <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2 xl:grid-cols-5">
          <DetailStatTile label={tr('After deduction', 'Ayirmadan keyin', 'После удержания')} value={formatAmount(detail.report.afterPenalty)} />
          <DetailStatTile label={lt('Mistakes')} value={formatCount(detail.report.mistakesCount)} tone="danger" />
          <DetailStatTile label={lt('Delivery bonuses')} value={formatCount(detail.report.deliveryBonusCount)} tone="success" />
          <DetailStatTile
            label={lt('Productivity')}
            value={Number.isFinite(detail.report.productivityPercentage)
              ? `${formatCount(detail.report.updateDays)}/${formatCount(detail.report.workingDays)} / ${formatPercent(detail.report.productivityPercentage)}`
              : '-'}
            tone={detail.report.qualifiesProductivityBonus ? 'success' : 'default'}
          />
          <div className="rounded-[18px] bg-[var(--danger-dim)] px-4 py-3.5">
            <p className="text-xs font-semibold text-[var(--danger-text)]">{tr('Deduction percentage', 'Ayirma foizi', 'Процент удержания')}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--danger-text)]">
                {formatPercent(detail.report.penaltyPercentage)}
              </p>
              <span className="text-[11px] font-semibold text-[var(--danger-text)]">{tr('deduction impact', 'ayirma ta\'siri', 'влияние удержания')}</span>
            </div>
            <Progress
              className="mt-3"
              value={Number.isFinite(detail.report.penaltyPercentage) ? detail.report.penaltyPercentage : 0}
              tone="danger"
            />
          </div>
        </div>

        {(detail.report.formulaText || detail.report.calculationBreakdown) && (
          <div className="mt-[22px] space-y-[18px]">
            <SectionTitle
              title={lt('Calculation breakdown')}
              description={lt('Detailed formula used to compute your final salary.')}
            />

            <div className="grid gap-[18px] lg:grid-cols-2">
              {detail.report.formulaText && (
                <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
                  <p className="ui-card-label mb-2.5">Formula</p>
                  <p className="font-mono text-sm leading-relaxed text-[var(--foreground)]">{detail.report.formulaText}</p>
                </div>
              )}

              {detail.report.calculationBreakdown && (
                <div className="grid gap-3">
                  {detail.report.calculationBreakdown.bonus_lines.map((line, index) => (
                    <div key={`bonus-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--blue-dim)] p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="blue" size="sm" className="shrink-0 bg-[var(--surface)]">Bonus</Badge>
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{line.label}</h4>
                        </div>
                        {line.reason && <p className="mt-1 text-[12.5px] text-[var(--muted-strong)]">{line.reason}</p>}
                      </div>
                      <div className="pl-2 text-right">
                        <p className="text-sm font-bold tabular-nums text-[var(--blue-text)]">+{formatAmount(line.amount)}</p>
                        <p className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{line.percent}%</p>
                      </div>
                    </div>
                  ))}

                  {detail.report.calculationBreakdown.deduction_lines.map((line, index) => (
                    <div key={`deduction-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--danger-dim)] p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="danger" size="sm" className="shrink-0 bg-[var(--surface)]">Deduction</Badge>
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{line.label}</h4>
                        </div>
                        {line.reason && <p className="mt-1 text-[12.5px] text-[var(--muted-strong)]">{line.reason}</p>}
                      </div>
                      <div className="pl-2 text-right">
                        <p className="text-sm font-bold tabular-nums text-[var(--danger-text)]">-{formatAmount(line.amount)}</p>
                        <p className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{line.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-[18px] grid gap-[18px] xl:grid-cols-2">
          <div className="rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{tr('Deduction history', 'Ayirma tarixi', 'История удержаний')}</p>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                  {detail.penalties.length > 0 ? `${detail.penalties.length} ${lt('entries')}` : tr('No deductions were recorded for this period.', 'Bu davr uchun ayirma qayd etilmadi.', 'За этот период удержания не зафиксированы.')}
                </p>
              </div>
              <Badge variant={detail.penalties.length > 0 ? 'danger' : 'secondary'}>
                {detail.penalties.length}
              </Badge>
            </div>

            <div className="mt-4 space-y-2.5">
              {detail.penalties.length > 0 ? detail.penalties.map((item) => (
                <div key={item.id} className="rounded-[14px] bg-[var(--surface)] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--danger-text)]">{item.title}</p>
                      <p className="mt-1 text-[12.5px] text-[var(--muted)]">{item.description ?? tr('No reason provided.', 'Sabab ko‘rsatilmagan.', 'Причина не указана.')}</p>
                    </div>
                    <p className="shrink-0 text-[12.5px] font-medium text-[var(--muted)]">{formatDetailDate(item.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="danger">{formatAmount(item.amount)}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-[14px] bg-[var(--surface)] px-4 py-5 text-[13px] text-[var(--muted)]">
                  {tr('No deduction line-items were returned for the selected month.', 'Tanlangan oy uchun ayirma yozuvlari qaytmadi.', 'За выбранный месяц не вернулись записи удержаний.')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{tr('Bonus history', 'Bonus tarixi', 'История бонусов')}</p>
                <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                  {detail.bonuses.length > 0 ? `${detail.bonuses.length} ${lt('entries')}` : tr('No bonus records returned.', 'Bonus yozuvlari qaytmadi.', 'Записи бонусов не вернулись.')}
                </p>
              </div>
              <Badge variant={detail.bonuses.length > 0 ? 'success' : 'secondary'}>
                {detail.bonuses.length}
              </Badge>
            </div>

            <div className="mt-4 space-y-2.5">
              {detail.bonuses.length > 0 ? detail.bonuses.map((item) => (
                <div key={item.id} className="rounded-[14px] bg-[var(--surface)] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--success-text)]">{item.title}</p>
                      <p className="mt-1 text-[12.5px] text-[var(--muted)]">{item.description ?? tr('No reason provided.', 'Sabab ko‘rsatilmagan.', 'Причина не указана.')}</p>
                    </div>
                    <p className="shrink-0 text-[12.5px] font-medium text-[var(--muted)]">{formatDetailDate(item.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="success">{formatAmount(item.amount)}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-[14px] bg-[var(--surface)] px-4 py-5 text-[13px] text-[var(--muted)]">
                  {tr('No bonus line-items were returned for the selected month.', 'Tanlangan oy uchun bonus yozuvlari qaytmadi.', 'За выбранный месяц не вернулись записи бонусов.')}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <CompensationPolicyPanel policy={detail.compensationPolicy} />

      <Card noPadding className="overflow-hidden">
        <MistakeIncidentSection items={detail.mistakes} />
        <DeliveryBonusSection items={detail.deliveryBonuses} />
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle eyebrow={lt('Developer KPI')} title={lt('KPI Score Breakdown')} />
          {kpiEstimate ? (
            <div className="text-right">
              <p className="ui-card-label">{lt('Final KPI')}</p>
              <p className="mt-1.5 text-[28px] font-bold tracking-[-0.03em] tabular-nums text-[var(--primary)]" data-ui-number="true">
                {kpiEstimate.scores.final_kpi.toFixed(1)}%
              </p>
            </div>
          ) : null}
        </div>

        {kpiQuery.isLoading || kpiQuery.status === 'idle' ? (
          <div className="mt-[18px] space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" rounded="lg" />)}
          </div>
        ) : kpiQuery.isError ? (
          <p className="mt-[18px] text-sm text-[var(--muted-strong)]">{lt('KPI data unavailable for this period.')}</p>
        ) : kpiEstimate ? (
          <>
            <div className="mt-[18px] space-y-3.5">
              {kpiDimensions.map(({ key, label, tone }) => {
                const score = kpiEstimate.scores[key]
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-[var(--muted-strong)]">{label}</span>
                      <span className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">{score.toFixed(1)}%</span>
                    </div>
                    <Progress value={score} tone={tone} />
                  </div>
                )
              })}
            </div>

            <div className="mt-[22px] grid grid-cols-2 gap-[18px] sm:grid-cols-3">
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                <p className="ui-card-label">{lt('KPI Expected Salary')}</p>
                <p className="mt-1.5 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]">{kpiEstimate.salary.expected_salary.toLocaleString()}</p>
              </div>
              <div className="rounded-[18px] bg-[var(--blue-dim)] px-4 py-3.5">
                <p className="ui-card-label">{lt('KPI Bonus')}</p>
                <p className="mt-1.5 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--blue-text)]">+{kpiEstimate.salary.kpi_bonus.toLocaleString()}</p>
              </div>
              <div className="rounded-[18px] bg-[var(--danger-dim)] px-4 py-3.5">
                <p className="ui-card-label">{lt('Deductions')}</p>
                <p className="mt-1.5 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--danger-text)]">-{kpiEstimate.salary.approved_deductions.toLocaleString()}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-[18px] text-sm text-[var(--muted-strong)]">{lt('No KPI data available for this period.')}</p>
        )}
      </Card>

    </section>
  )
}
