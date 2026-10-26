import { useMemo, type CSSProperties } from 'react'
import { developerKpiService, type SalaryEstimate } from '../../../shared/api/services/developer-kpi.service'
import { useSearchParams } from 'react-router-dom'
import type { CurrentUser } from '../../../shared/api/types'
import type { CeoUserRecord } from '../../../shared/api/services/ceo.service'
import { membersService } from '../../../shared/api/services/members.service'
import { updateTrackingService } from '../../../shared/api/services/updateTracking.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { SectionTitle } from '../../../shared/ui/section-title'
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
const memberDashboardSuccessTheme = {
  '--success': '#32A852',
  '--success-dim': 'rgba(50, 168, 82, 0.10)',
  '--success-soft': 'rgba(50, 168, 82, 0.10)',
  '--success-strong': 'rgba(50, 168, 82, 0.13)',
  '--success-border': 'rgba(50, 168, 82, 0.26)',
  '--success-text': '#32A852',
  '--success-rgb': '50, 168, 82',
} as CSSProperties

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

function ProgressBar({
  value,
  tone = 'violet',
}: {
  value: number
  tone?: 'violet' | 'success' | 'danger'
}) {
  const colorClassName = {
    violet: 'bg-violet-400',
    success: 'bg-[var(--success-text)]',
    danger: 'bg-rose-400',
  } as const

  return (
    <div className="h-2 rounded-full bg-white/8">
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', colorClassName[tone])}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}

function MetricPanel({
  label,
  value,
  hint,
  progress,
  progressTone,
}: {
  label: string
  value: string | number
  hint?: string
  progress?: number
  progressTone?: 'violet' | 'success' | 'danger'
}) {
  return (
    <div className="card-base rounded-xl px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-[1.9rem] font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
      {hint ? (
        <p className="mt-2 text-xs text-[var(--muted-strong)]">{hint}</p>
      ) : null}
      {typeof progress === 'number' ? (
        <div className="mt-4">
          <ProgressBar value={progress} tone={progressTone} />
        </div>
      ) : null}
    </div>
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
  const { user } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const penaltiesSummary = detail.penalties.length > 0
    ? tr(`${detail.penalties.length} entries`, `${detail.penalties.length} ta yozuv`, `${detail.penalties.length} записей`)
    : tr('No deductions were recorded for this period.', 'Bu davr uchun ayirma qayd etilmadi.', 'За этот период удержания не зафиксированы.')
  const bonusesSummary = detail.bonuses.length > 0
    ? tr(`${detail.bonuses.length} entries`, `${detail.bonuses.length} ta yozuv`, `${detail.bonuses.length} записей`)
    : tr('No bonus records returned.', 'Bonus yozuvlari qaytmadi.', 'Записи бонусов не вернулись.')

  return (
    <section className="space-y-4 page-enter" style={memberDashboardSuccessTheme}>
      {false ? penaltiesSummary : null}
      {false ? bonusesSummary : null}
      <Card variant="glass" noPadding className="overflow-hidden rounded-xl border-white/10">
        <div className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="page-header-decor pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_right,rgba(var(--success-rgb),0.12),transparent_24%)]" />

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.02em] text-[var(--blue-text)]">{lt('Member Dashboard')}</p>
                <h1 className="ui-page-title mt-2 text-[var(--foreground)]">
                  {detail.report.fullName}
                </h1>
                <p className="mt-2 text-sm text-[var(--muted-strong)]">
                  {detail.report.roleLabel}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{userBadgeLabel}</Badge>
                  <Badge variant="secondary">{detail.report.roleLabel}</Badge>
                  <Badge variant={targetReached ? 'success' : 'warning'}>
                    {targetReached ? lt('Target reached') : lt('Need follow-up')}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] xl:min-w-[430px]">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{lt('Year')}</label>
                  <Input
                    type="number"
                    min="2020"
                    max="2035"
                    value={year}
                    onChange={(event) => updatePeriod({ year: clampNumber(Number(event.target.value) || defaultYear, 2020, 2035) })}
                    className="rounded-xl border-[var(--border)] bg-[var(--card)]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{lt('Month')}</label>
                  <SelectField
                    value={String(month)}
                    options={monthOptions}
                    onValueChange={(value) => updatePeriod({ month: clampNumber(Number(value), 1, 12) })}
                    className="rounded-xl border-[var(--border)] bg-[var(--card)]"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshIcon />}
                    onClick={() => void handleRefresh()}
                    loading={dashboardQuery.isLoading}
                    className="min-h-10 rounded-xl"
                  >
                    {lt('Refresh')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr]">
              <MetricPanel
                label={lt('Expected updates (to date)')}
                value={elapsedWorkingDays}
                hint={expectedUpdatesHint}
              />
              <MetricPanel
                label={lt('This week progress')}
                value={formatCount(updatesThisWeek)}
                hint={weeklyProgressHint}
              />
              <MetricPanel
                label={lt('Weekly completion')}
                value={formatPercent(weeklyCompletion)}
                hint={weeklyCompletionHint}
                progress={typeof weeklyCompletion === 'number' ? weeklyCompletion : undefined}
                progressTone={targetReached ? 'success' : (weeklyCompletion ?? 0) >= 60 ? 'violet' : 'danger'}
              />
            </div>

            {dashboardQuery.isLoading && !dashboardQuery.data ? (
              <div className="rounded-xl border border-[var(--blue-border)] bg-[var(--blue-dim)] px-4 py-4 text-sm text-[var(--foreground)]">
                {lt('Syncing your latest dashboard data...')}
              </div>
            ) : null}

            {data?.statsError || detail.estimateError || detail.policyError || detail.mistakesError || detail.deliveryBonusesError || detail.updatesError || detail.calendarError ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
                {data?.statsError ? <p>{lt('Stats API unavailable:')} {data.statsError}</p> : null}
                {detail.estimateError ? <p>{lt('Salary estimate API unavailable:')} {detail.estimateError}</p> : null}
                {detail.policyError ? <p>{tr('Compensation policy API unavailable:', 'Kompensatsiya siyosati API mavjud emas:', 'API политики компенсации недоступен:')} {detail.policyError}</p> : null}
                {detail.mistakesError ? <p>{tr('Mistake incidents API unavailable:', 'Xato hodisalari API mavjud emas:', 'API инцидентов ошибок недоступен:')} {detail.mistakesError}</p> : null}
                {detail.deliveryBonusesError ? <p>{tr('Delivery bonuses API unavailable:', 'Topshirish bonuslari API mavjud emas:', 'API бонусов за сдачу недоступен:')} {detail.deliveryBonusesError}</p> : null}
                {detail.updatesError ? <p>{lt('Update statistics unavailable:')} {detail.updatesError}</p> : null}
                {detail.calendarError ? <p>{lt('Calendar API unavailable:')} {detail.calendarError}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="rounded-xl border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] text-[var(--success-text)]">
              {salaryEstimateLabel}
            </p>
            <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-[var(--foreground)]">
              {lt('My Salary Snapshot')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={detail.report.hasPenalty ? 'danger' : 'outline'}>
              {detail.report.hasPenalty ? lt('Deduction applied') : lt('No deductions')}
            </Badge>
            <Badge variant={detail.report.hasBonus ? 'success' : 'outline'}>
              {detail.report.hasBonus ? lt('Bonus applied') : lt('No bonus')}
            </Badge>
            <Badge variant={(monthlyCompletion ?? 0) >= 80 ? 'success' : (monthlyCompletion ?? 0) > 0 ? 'warning' : 'outline'}>
              {formatPercent(monthlyCompletion)} {lt('monthly completion')}
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-6">
          <DetailStatTile label={lt('Estimated salary')} value={formatAmount(detail.report.estimatedSalary)} tone="success" />
          <DetailStatTile label={lt('Final salary')} value={formatAmount(detail.report.finalSalary)} />
          <DetailStatTile label={lt('Base salary')} value={formatAmount(detail.report.baseSalary)} />
          <DetailStatTile label={lt('Deduction amount')} value={formatAmount(detail.report.deductionAmount)} tone="danger" />
          <DetailStatTile label={lt('Bonus amount')} value={formatAmount(detail.report.bonusAmount)} tone="success" />
          <DetailStatTile label={lt('Bonus %')} value={formatPercent(detail.report.totalBonusPercent)} tone="success" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-5">
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
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3">
            <p className="text-xs text-[#FF0000]">{tr('Deduction percentage', 'Ayirma foizi', 'Процент удержания')}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[1.05rem] font-semibold tracking-tight text-[#FF0000]">
                {formatPercent(detail.report.penaltyPercentage)}
              </p>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#FF0000]">{tr('deduction impact', 'ayirma ta\'siri', 'влияние удержания')}</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={Number.isFinite(detail.report.penaltyPercentage) ? detail.report.penaltyPercentage : 0} tone={(detail.report.penaltyPercentage ?? 0) > 0 ? 'danger' : 'violet'} />
            </div>
          </div>
        </div>

        {/* Salary Calculation Formula and Breakdown */}
        {(detail.report.formulaText || detail.report.calculationBreakdown) && (
          <div className="mt-6 space-y-4">
            <SectionTitle
              title={lt('Calculation breakdown')}
              description={lt('Detailed formula used to compute your final salary.')}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {detail.report.formulaText && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-strong)]">Formula</p>
                  <p className="font-mono text-sm leading-relaxed text-[var(--foreground)]">{detail.report.formulaText}</p>
                </div>
              )}

              {detail.report.calculationBreakdown && (
                <div className="grid gap-3">
                  {detail.report.calculationBreakdown.bonus_lines.map((line, index) => (
                    <div key={`bonus-${index}`} className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 transition hover:bg-blue-500/8">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-500">Bonus</span>
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{line.label}</h4>
                        </div>
                        {line.reason && <p className="mt-1 text-xs text-[var(--muted-strong)]">{line.reason}</p>}
                      </div>
                      <div className="pl-4 text-right">
                        <p className="text-sm font-black text-blue-500">+{formatAmount(line.amount)}</p>
                        <p className="text-[10px] font-bold text-blue-400">{line.percent}%</p>
                      </div>
                    </div>
                  ))}

                  {detail.report.calculationBreakdown.deduction_lines.map((line, index) => (
                    <div key={`deduction-${index}`} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 transition hover:bg-rose-500/8">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-500">Deduction</span>
                          <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{line.label}</h4>
                        </div>
                        {line.reason && <p className="mt-1 text-xs text-[var(--muted-strong)]">{line.reason}</p>}
                      </div>
                      <div className="pl-4 text-right">
                        <p className="text-sm font-black text-rose-500">-{formatAmount(line.amount)}</p>
                        <p className="text-[10px] font-bold text-rose-400">{line.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-rose-500/20 bg-rose-50/90 p-4 dark:bg-black/18">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FF0000]">{tr('Deduction history', 'Ayirma tarixi', 'История удержаний')}</p>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">
                  {detail.penalties.length > 0 ? `${detail.penalties.length} ${lt('entries')}` : tr('No deductions were recorded for this period.', 'Bu davr uchun ayirma qayd etilmadi.', 'За этот период удержания не зафиксированы.')}
                </p>
              </div>
              <Badge variant={detail.penalties.length > 0 ? 'danger' : 'outline'}>
                {detail.penalties.length}
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {detail.penalties.length > 0 ? detail.penalties.map((item) => (
                <div key={item.id} className="rounded-xl border border-rose-500/16 bg-white px-4 py-3 dark:bg-black/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-rose-600 dark:text-rose-200">{item.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted-strong)]">{item.description ?? tr('No reason provided.', 'Sabab ko‘rsatilmagan.', 'Причина не указана.')}</p>
                    </div>
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{formatDetailDate(item.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatAmount(item.amount)}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-rose-500/18 bg-rose-500/5 px-4 py-5 text-sm text-[var(--muted-strong)] dark:bg-black/10">
                  {tr('No deduction line-items were returned for the selected month.', 'Tanlangan oy uchun ayirma yozuvlari qaytmadi.', 'За выбранный месяц не вернулись записи удержаний.')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4 dark:bg-[var(--success-dim)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--success-text)]">{tr('Bonus history', 'Bonus tarixi', 'История бонусов')}</p>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">
                  {detail.bonuses.length > 0 ? `${detail.bonuses.length} ${lt('entries')}` : tr('No bonus records returned.', 'Bonus yozuvlari qaytmadi.', 'Записи бонусов не вернулись.')}
                </p>
              </div>
              <Badge variant={detail.bonuses.length > 0 ? 'success' : 'outline'}>
                {detail.bonuses.length}
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {detail.bonuses.length > 0 ? detail.bonuses.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--success-border)] bg-white px-4 py-3 dark:bg-black/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--success-text)]">{item.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted-strong)]">{item.description ?? tr('No reason provided.', 'Sabab ko‘rsatilmagan.', 'Причина не указана.')}</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--success-text)]">{formatDetailDate(item.createdAt)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="success">{formatAmount(item.amount)}</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-5 text-sm text-[var(--muted-strong)] dark:bg-black/10">
                  {tr('No bonus line-items were returned for the selected month.', 'Tanlangan oy uchun bonus yozuvlari qaytmadi.', 'За выбранный месяц не вернулись записи бонусов.')}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <CompensationPolicyPanel policy={detail.compensationPolicy} />

      <Card noPadding className="overflow-hidden rounded-xl">
        <MistakeIncidentSection items={detail.mistakes} />
        <DeliveryBonusSection items={detail.deliveryBonuses} />
      </Card>

      {/* Developer KPI Section */}
      <Card className="rounded-xl border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--blue-text)]">{lt('Developer KPI')}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--foreground)]">{lt('KPI Score Breakdown')}</h2>
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
                { key: 'delivery', label: lt('Delivery'), color: 'bg-blue-500' },
                { key: 'deadline', label: lt('Deadline'), color: 'bg-violet-500' },
                { key: 'quality', label: lt('Quality'), color: 'bg-emerald-500' },
                { key: 'team', label: lt('Team'), color: 'bg-amber-500' },
                { key: 'discipline', label: lt('Discipline'), color: 'bg-cyan-500' },
              ] as const).map(({ key, label, color }) => {
                const score = kpiEstimate.scores[key]
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--muted-strong)] uppercase tracking-wider">{label}</span>
                      <span className="text-xs font-black text-[var(--foreground)]">{score.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{lt('KPI Expected Salary')}</p>
                <p className="mt-1 text-base font-black text-[var(--foreground)]">{kpiEstimate.salary.expected_salary.toLocaleString()}</p>
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
          </>
        ) : (
          <p className="text-sm text-[var(--muted-strong)]">{lt('No KPI data available for this period.')}</p>
        )}
      </Card>

    </section>
  )
}
