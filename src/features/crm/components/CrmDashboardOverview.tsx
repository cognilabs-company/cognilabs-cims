import { useMemo } from 'react'
import { FileText, Flag, Phone, Plus, Target, Trophy, UserPlus, Users } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { ConversionRateResponse, CustomerStatsResponse, CustomerSummary } from '../../../shared/api/types'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { Sparkline } from '../../../shared/ui/charts/sparkline'
import { TaskList, type TaskRow } from '../../../shared/ui/charts/task-list'
import { StatCard } from '../../../shared/ui/stat-card'
import { resolveTone, toneByIndex, toneSurface, toneText } from '../../../shared/ui/tone'
import { cn } from '../../../shared/lib/cn'
import { getCustomerDisplayName } from '../../../shared/lib/customer-display'

type PeriodKey = '' | 'today' | '3d' | '7d' | '30d' | '90d'

type StatusLabelOption = {
  value: string
  label: string
}

type CrmDashboardOverviewProps = {
  customers: CustomerSummary[]
  stats: CustomerStatsResponse | null
  conversion: ConversionRateResponse | null
  statusOptions: StatusLabelOption[]
  period: PeriodKey
  onPeriodChange: (period: PeriodKey) => void
  onOpenCustomer: (customerId: number) => void
  onFocusStatus: (status: string) => void
}

function humanizeStatusKey(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
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
  statusOptions,
  period,
  onPeriodChange,
  onOpenCustomer,
  onFocusStatus,
}: CrmDashboardOverviewProps) {
  const { t } = useLocale()

  const statusLabelOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const option of statusOptions) {
      map.set(option.value.toLowerCase().replace(/[^a-z0-9]/g, ''), option.label)
    }
    return (raw: string) => map.get(raw.toLowerCase().replace(/[^a-z0-9]/g, '')) ?? humanizeStatusKey(raw)
  }, [statusOptions])

  const total = stats?.total_customers ?? customers.length
  const needToCall = stats?.need_to_call ?? 0
  const contacted = stats?.contacted ?? 0
  const projectStarted = stats?.project_started ?? 0
  const continuing = stats?.continuing ?? 0
  const finished = stats?.finished ?? 0
  const rejected = stats?.rejected ?? 0
  const conversionRate = conversion?.conversion_rate ?? 0

  const createdTrend = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const customer of customers) {
      const created = customer.created_at ? new Date(customer.created_at) : null
      if (!created || Number.isNaN(created.getTime())) continue
      const key = created.toISOString().slice(0, 10)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-14)
      .map(([, count]) => count)
  }, [customers])

  const statusBars = useMemo<BarDatum[]>(() => {
    const dict = stats?.status_dict ?? {}
    const percentages = stats?.status_percentages ?? {}
    const entries = Object.entries(dict)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    return entries.map(([rawKey, count]) => ({
      key: rawKey,
      label: statusLabelOf(rawKey),
      value: count,
      amount: String(count),
      delta: percentages[rawKey] != null ? `${Math.round(percentages[rawKey])}%` : undefined,
    }))
  }, [stats?.status_dict, stats?.status_percentages, statusLabelOf])

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
      { key: 'need_to_call', label: t('customers.stats.need_to_call', 'Need to call'), count: needToCall, icon: <Flag className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> },
      { key: 'contacted', label: t('customers.stats.contacted', 'Contacted'), count: contacted, icon: <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> },
      { key: 'project_started', label: t('customers.stats.project_started', 'Project started'), count: projectStarted, icon: <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> },
      { key: 'finished', label: t('customers.stats.finished', 'Finished'), count: finished, icon: <Trophy className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />, hero: true },
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
          meta: statusLabelOf(customer.status),
          tag: `${hours}:${minutes}`,
          tone: resolveTone(customer.status, 'blue'),
        }
      })
  }, [customers, statusLabelOf])

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
          status: statusLabelOf(customer.status),
          statusTone: resolveTone(customer.status, toneByIndex(index)),
          tone: logoTones[index % logoTones.length],
          date: created && !Number.isNaN(created.getTime()) ? created.toLocaleDateString() : '',
        }
      })
  }, [customers, statusLabelOf])

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
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <StatCard
          solid
          label={t('customers.stats.total', 'Total customers')}
          value={total}
          icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />}
          hint={t('customers.stats.active_now', 'Active in the pipeline')}
          delta={continuing > 0 ? `${continuing}` : undefined}
        />
        <StatCard
          label={t('customers.stats.need_to_call', 'Need to call')}
          value={needToCall}
          icon={<UserPlus className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />}
          iconTone="blue"
          hint={t('customers.stats.contacted_hint', 'Contacted: {{count}}', { count: contacted })}
          delta={needToCall > 0 ? `${Math.round((needToCall / (total || 1)) * 100)}%` : undefined}
          deltaTone="neutral"
          onOpen={() => onFocusStatus('need_to_call')}
        />
        <StatCard
          label={t('customers.stats.project_started', 'Project started')}
          value={projectStarted}
          icon={<Trophy className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
          iconTone="warning"
          hint={t('customers.stats.finished_hint', 'Finished: {{count}}', { count: finished })}
          delta={total > 0 ? `${Math.round((projectStarted / total) * 100)}%` : undefined}
          deltaTone="neutral"
          onOpen={() => onFocusStatus('project_started')}
        />
        <StatCard
          label={t('customers.stats.conversion', 'Conversion')}
          value={`${conversionRate.toFixed(1)}%`}
          icon={<Target className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />}
          iconTone="lime"
          hint={t('customers.stats.conversion_hint', 'Started: {{count}}', { count: conversion?.project_started_count ?? projectStarted })}
          footer={createdTrend.length > 1 ? <Sparkline points={createdTrend} /> : undefined}
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
              <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
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
