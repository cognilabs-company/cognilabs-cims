import { useMemo } from 'react'
import { PercentIcon, RocketLaunchIcon, UserPlusIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { ConversionRateResponse, CustomerStatsResponse, CustomerSummary } from '../../../shared/api/types'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { TaskList, type TaskRow } from '../../../shared/ui/charts/task-list'
import { MetricTile } from '../../../shared/ui/metric-tile'
import { resolveTone, toneByIndex, toneSurface, toneText } from '../../../shared/ui/tone'
import { cn } from '../../../shared/lib/cn'
import { getCustomerDisplayName } from '../../../shared/lib/customer-display'

type PeriodKey = '' | 'today' | '3d' | '7d' | '30d' | '90d'

type CrmDashboardOverviewProps = {
  customers: CustomerSummary[]
  stats: CustomerStatsResponse | null
  conversion: ConversionRateResponse | null
  /** Leads created since midnight (from the full list, not the selected period). */
  createdToday: number
  /** Opens the customer list, optionally with a query such as "period=today". */
  onOpenList: (query?: string) => void
  period: PeriodKey
  onPeriodChange: (period: PeriodKey) => void
  onOpenCustomer: (customerId: number) => void
  onFocusStatus: (status: string) => void
  /** Human labels for status keys (e.g. need_to_call → "Need To Call"). */
  statusLabels?: Record<string, string>
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}

function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function initialsOf(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || '—'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function CrmDashboardOverview({
  customers,
  stats,
  conversion,
  createdToday,
  onOpenList,
  period,
  onPeriodChange,
  onOpenCustomer,
  onFocusStatus,
  statusLabels,
}: CrmDashboardOverviewProps) {
  const { t } = useLocale()

  const total = stats?.total_customers ?? customers.length
  const needToCall = stats?.need_to_call ?? 0
  const contacted = stats?.contacted ?? 0
  const projectStarted = stats?.project_started ?? 0
  const continuing = stats?.continuing ?? 0
  const finished = stats?.finished ?? 0
  const rejected = stats?.rejected ?? 0
  // Outbound CRM has no conversion endpoint: fall back to started projects / all customers.
  const conversionRate = conversion?.conversion_rate ?? (total > 0 ? (projectStarted / total) * 100 : 0)
  const conversionStarted = conversion?.project_started_count ?? projectStarted

  const statusBars = useMemo<BarDatum[]>(() => {
    const dict = stats?.status_dict ?? {}
    const percentages = stats?.status_percentages ?? {}
    const entries = Object.entries(dict)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const humanize = (key: string) => statusLabels?.[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    return entries.map(([label, count]) => ({
      key: label,
      label: humanize(label),
      value: count,
      amount: String(count),
      delta: percentages[label] != null ? `${Math.round(percentages[label])}%` : undefined,
    }))
  }, [stats?.status_dict, stats?.status_percentages, statusLabels])

  const topStatusKey = statusBars.length > 0 ? statusBars[0].key : undefined

  const gaugeSegments = useMemo<GaugeSegment[]>(
    () => [
      { key: 'continuing', label: t('customers.stats.continuing', 'Continuing'), value: continuing, color: '#A6E83B' },
      { key: 'rejected', label: t('customers.stats.rejected', 'Rejected'), value: rejected, color: '#C6D4FF' },
      { key: 'finished', label: t('customers.stats.finished', 'Finished'), value: finished, color: '#2B59FF' },
    ],
    [continuing, finished, rejected, t],
  )

  const funnelStages = useMemo<FunnelStage[]>(() => {
    const steps = [
      { key: 'need_to_call', label: t('customers.stats.need_to_call', 'Need to call'), count: needToCall, icon: <IconFlag /> },
      { key: 'contacted', label: t('customers.stats.contacted', 'Contacted'), count: contacted, icon: <IconPhone /> },
      { key: 'project_started', label: t('customers.stats.project_started', 'Project started'), count: projectStarted, icon: <IconDoc /> },
      { key: 'finished', label: t('customers.stats.finished', 'Finished'), count: finished, icon: <IconTrophy />, hero: true },
    ]
    const max = steps.reduce((acc, step) => Math.max(acc, step.count), 0) || 1

    return steps.map((step) => ({
      key: step.key,
      label: step.label,
      count: step.count,
      value: step.count,
      percent: Math.round((step.count / max) * 100),
      icon: step.icon,
      hero: step.hero,
    }))
  }, [contacted, finished, needToCall, projectStarted, t])

  const todayTasks = useMemo<TaskRow[]>(() => {
    const today = startOfDay(new Date())

    return customers
      .filter((customer) => {
        if (!customer.recall_time) return false
        const recall = new Date(customer.recall_time)
        return !Number.isNaN(recall.getTime()) && startOfDay(recall) === today
      })
      .sort((left, right) => String(left.recall_time).localeCompare(String(right.recall_time)))
      .slice(0, 6)
      .map((customer) => {
        const recall = new Date(String(customer.recall_time))
        const hours = String(recall.getHours()).padStart(2, '0')
        const minutes = String(recall.getMinutes()).padStart(2, '0')

        return {
          key: String(customer.id),
          title: getCustomerDisplayName(customer),
          meta: customer.status,
          tag: `${hours}:${minutes}`,
          tone: 'blue' as const,
        }
      })
  }, [customers])

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const buckets = new Map<string, number>()
    for (const customer of customers) {
      const owner = customer.assistant_name?.trim()
      if (!owner) continue
      buckets.set(owner, (buckets.get(owner) ?? 0) + 1)
    }

    const ranked = [...buckets.entries()].sort(([, a], [, b]) => b - a).slice(0, 5)
    const max = ranked.length > 0 ? ranked[0][1] : 1

    return ranked.map(([name, count]) => ({
      key: name,
      name,
      initials: initialsOf(name),
      caption: t('customers.leaderboard.leads', '{{count}} leads', { count }),
      amount: count,
      percent: Math.round((count / max) * 100),
    }))
  }, [customers, t])

  const recentLeads = useMemo(() => {
    const logoTones = [
      'bg-[var(--blue-dim)] text-[var(--blue-text)]',
      'bg-[var(--lime-dim)] text-[var(--lime-text)]',
      'bg-[var(--warning-dim)] text-[var(--warning-text)]',
      'bg-[var(--violet-dim)] text-[var(--violet-text)]',
    ]

    return [...customers]
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, 4)
      .map((customer, index) => {
        const name = getCustomerDisplayName(customer)
        const created = customer.created_at ? new Date(customer.created_at) : null

        return {
          id: customer.id,
          name,
          initial: name.charAt(0).toUpperCase() || '—',
          owner: customer.assistant_name?.trim() || '—',
          status: customer.status,
          statusTone: resolveTone(customer.status, toneByIndex(index)),
          tone: logoTones[index % logoTones.length],
          date: created && !Number.isNaN(created.getTime()) ? created.toLocaleDateString() : '',
        }
      })
  }, [customers])

  const periodTabs = useMemo(
    () => [
      { value: '7d' as PeriodKey, label: t('customers.period.7d', '7 days') },
      { value: '30d' as PeriodKey, label: t('customers.period.30d', '30 days') },
      { value: '90d' as PeriodKey, label: t('customers.period.90d', '90 days') },
    ],
    [t],
  )

  const barPeriod: PeriodKey = period === '' || period === 'today' ? '30d' : period

  const emptyHint = (
    <p className="py-10 text-center text-[13px] text-[var(--muted)]">
      {t('customers.overview.no_data', 'No data for this period yet.')}
    </p>
  )

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Headline numbers (moved here from the Customers page) — each opens the list */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label={t('customers.list_page.total', 'Customers')}
          value={total}
          caption={t('customers.list_page.total_hint', 'All records in the CRM')}
          icon={UsersThreeIcon}
          accent="#2B59FF"
          onClick={() => onOpenList()}
        />
        <MetricTile
          label={t('customers.list_page.added_today', 'Added today')}
          value={createdToday}
          caption={t('customers.list_page.added_today_hint', 'New leads since midnight')}
          icon={UserPlusIcon}
          accent="#17924A"
          onClick={() => onOpenList('period=today')}
        />
        <MetricTile
          label={t('customers.stats.conversion', 'Conversion')}
          value={conversionRate}
          format={(value) => `${value.toFixed(1)}%`}
          caption={t('customers.list_page.conversion_hint', 'Projects started: {{count}}', { count: conversionStarted })}
          icon={PercentIcon}
          accent="#7C5CFC"
        />
        <MetricTile
          label={t('customers.stats.project_started', 'Project started')}
          value={projectStarted}
          caption={t('customers.stats.finished_hint', 'Finished: {{count}}', { count: finished })}
          icon={RocketLaunchIcon}
          accent="#E8590C"
          onClick={() => onFocusStatus('project_started')}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <BarChartCard
          className="min-w-0 flex-[1.5_1_520px]"
          title={t('customers.overview.status_report', 'Status report')}
          deltaCaption={t('customers.overview.status_caption', 'Share of the current pipeline')}
          periods={periodTabs}
          period={barPeriod}
          onPeriodChange={onPeriodChange}
          data={statusBars}
          highlightKey={topStatusKey}
          total={total}
          totalCaption={t('customers.overview.total_caption', 'total customers')}
          emptyState={emptyHint}
        />

        <GaugeDonut
          className="min-w-0 flex-[1_1_360px]"
          title={t('customers.overview.pipeline_state', 'Pipeline state')}
          segments={gaugeSegments}
          centerValue={total}
          centerCaption={t('customers.overview.total_caption', 'total customers')}
          emptyState={emptyHint}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1.3_1_440px] flex-col gap-4 rounded-[24px] bg-[var(--card)] p-[22px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {t('customers.overview.funnel', 'Sales funnel')}
            </span>
            <span className="text-[13px] text-[var(--muted)]">
              {t('customers.overview.funnel_total', 'total')}{' '}
              <b className="font-semibold text-[var(--foreground)]">{total}</b>
            </span>
          </div>
          <FunnelStages stages={funnelStages} />

          {recentLeads.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-3 rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5 text-xs font-medium text-[var(--muted)]">
                <span>{t('customers.overview.col_customer', 'Customer')}</span>
                <span>{t('customers.overview.col_owner', 'Owner')}</span>
                <span className="text-right">{t('customers.overview.col_status', 'Stage')}</span>
              </div>
              {recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onOpenCustomer(lead.id)}
                  className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-3 text-left text-[13.5px] transition-colors last:border-b-0 hover:bg-[var(--card-hover)]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-sm font-bold', lead.tone)}>
                      {lead.initial}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-[var(--foreground)]">{lead.name}</span>
                      <span className="truncate text-xs text-[var(--muted)]">{lead.date}</span>
                    </span>
                  </span>
                  <span className="truncate text-[var(--muted-strong)]">{lead.owner}</span>
                  <span className="flex justify-end">
                    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', toneSurface[lead.statusTone], toneText[lead.statusTone])}>
                      {lead.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <TaskList
          className="min-w-0 flex-[1_1_300px]"
          title={t('customers.overview.today_tasks', 'Today callbacks')}
          tasks={todayTasks}
          onSelect={(key) => onOpenCustomer(Number(key))}
          action={
            <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[var(--surface-inverse)] text-white">
              <IconAdd />
            </span>
          }
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">
              {t('customers.overview.no_callbacks', 'No callbacks scheduled for today.')}
            </p>
          }
        />

        <Leaderboard
          className="min-w-0 flex-[1_1_300px]"
          title={t('customers.overview.top_managers', 'Top managers')}
          badge={t('customers.overview.all_time', 'All time')}
          entries={leaderboard}
          emptyState={
            <p className="py-8 text-center text-[13px] text-[var(--on-inverse-muted)]">
              {t('customers.overview.no_managers', 'No assigned managers yet.')}
            </p>
          }
        />
      </div>
    </div>
  )
}
