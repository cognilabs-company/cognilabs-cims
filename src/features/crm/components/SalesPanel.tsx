import { useMemo, type ReactNode } from 'react'
import {
  ChartLineUpIcon,
  ClockIcon,
  HandshakeIcon,
  LightningIcon,
  TrophyIcon,
  TrayIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { MetricTile } from '../../../shared/ui/metric-tile'
import { cn } from '../../../shared/lib/cn'
import {
  LOST_STATUSES,
  PANEL_PERIODS,
  SOURCE_LABELS,
  tashkentDay,
  tashkentTime,
  type AttentionReason,
  type PanelPeriod,
  type RejectionKey,
  type SalesPanelSummary,
  type ServiceKey,
  type SourceKey,
} from '../lib/salesPanel'
import { scoreTone } from '../../telephony/components/telephonyFormat'
import { CallAnalyticsCard, type CallAnalytics } from './CallAnalyticsCard'
import { ManagerQualityBoard } from './ManagerQualityBoard'
import type { CallActivity } from '../lib/callActivity'

type StatusMeta = { label: string; color: string }

type SalesPanelProps = {
  summary: SalesPanelSummary | null
  loading: boolean
  period: PanelPeriod
  onPeriodChange: (period: PanelPeriod) => void
  statusMeta: (status: string) => StatusMeta
  onOpenCustomer: (customerId: number) => void
  onFocusStatus: (status: string) => void
  managersLoaded: boolean
  /** AI call grades of the period; null for users who may not see them (call quality is CEO-only). */
  callAnalytics?: CallAnalytics | null
  /** Calls of the period from /telephony/calls, for the manager quality board. */
  callActivity?: { data: CallActivity | null; loading: boolean } | null
}

const SOURCE_COLORS: Record<SourceKey, string> = {
  facebook_ads: '#2B59FF',
  ai_chat: '#8BC926',
  instagram: '#7C5CFC',
  telegram: '#229ED9',
  website: '#E8590C',
  other: '#8A90A2',
}

const SERVICE_COLORS: Record<ServiceKey, string> = { ai: '#7C5CFC', crm_erp: '#2B59FF', mobile_web: '#0FA5B5', other: '#8A90A2' }

const REASON_TONE: Record<AttentionReason, string> = {
  payment_7d: '#E8590C',
  kp_tz_5d: '#7C5CFC',
  meeting_no_note_24h: '#0FA5B5',
  need_to_call_30m: '#D9A400',
}

function Card({ title, caption, children, className, action }: { title: string; caption?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
          {caption ? <span className="text-[12.5px] text-[var(--muted)]">{caption}</span> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted-surface)]">
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, background: color }} />
    </span>
  )
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const fmtPct = (value: number) => `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`

export function SalesPanel({ summary, loading, period, onPeriodChange, statusMeta, onOpenCustomer, onFocusStatus, managersLoaded, callAnalytics = null, callActivity = null }: SalesPanelProps) {
  const { t } = useLocale()

  const fmtMinutes = (minutes: number | null) => {
    if (minutes === null) return '—'
    if (minutes < 60) return t('crm.panel.unit.minutes', '{{count}} min', { count: Math.round(minutes) })
    if (minutes < 60 * 48) return t('crm.panel.unit.hours', '{{value}} h', { value: (minutes / 60).toFixed(1).replace('.', ',') })
    return t('crm.panel.unit.days', '{{count}} d', { count: Math.floor(minutes / 1440) })
  }
  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    const ms = new Date(iso).getTime()
    const [, month, day] = tashkentDay(ms).split('-')
    return `${day}.${month} ${tashkentTime(ms)}`
  }
  const sourceLabel = (source: SourceKey) => t(`crm.panel.source.${source}`, SOURCE_LABELS[source])

  const periodTabs = (
    <div role="tablist" aria-label={t('crm.panel.period', 'Period')} className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
      {PANEL_PERIODS.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={period === value}
          onClick={() => onPeriodChange(value)}
          className={cn(
            'min-h-9 rounded-full px-4 text-[13px] font-semibold transition-colors',
            period === value ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]',
          )}
        >
          {t('crm.panel.days', '{{count}} days', { count: value })}
        </button>
      ))}
    </div>
  )

  const dailyData = summary?.daily
  const mainSourceKey = summary?.main_source ?? null
  const daily = dailyData ?? []
  const dailyMax = Math.max(1, ...daily.map((day) => day.total))
  const dailySources = useMemo(() => {
    const seen = new Set<SourceKey>()
    for (const day of dailyData ?? []) for (const key of Object.keys(day.by_source) as SourceKey[]) seen.add(key)
    return (Object.keys(SOURCE_COLORS) as SourceKey[]).filter((key) => seen.has(key))
  }, [dailyData])
  const gapDays = useMemo(() => {
    const set = new Set<string>()
    for (const day of dailyData ?? []) {
      if (mainSourceKey && !day.by_source[mainSourceKey]) set.add(day.date)
    }
    return set
  }, [dailyData, mainSourceKey])
  const leadDays = daily.filter((day) => day.total > 0)
  const avgPerLeadDay = leadDays.length ? Math.round(leadDays.reduce((sum, day) => sum + day.total, 0) / leadDays.length) : 0

  if (!summary) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">{periodTabs}</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-[14px] bg-[var(--muted-surface)]" />
          ))}
        </div>
        {!loading ? <p className="text-center text-[13px] text-[var(--muted)]">{t('customers.overview.no_data', 'No data for this period yet.')}</p> : null}
      </div>
    )
  }

  const { kpi, alert, funnel, attention, today_plan: todayPlan, managers, sources, services, rejection_reasons: rejections, hours, data_quality: quality } = summary
  const total = kpi.new_leads
  const delta = kpi.new_leads - kpi.new_leads_prev
  const showAlert = alert.no_leads_24h || alert.gaps.length > 0
  const mainFunnel = funnel.filter((row) => !LOST_STATUSES.has(row.status))
  const lostFunnel = funnel.filter((row) => LOST_STATUSES.has(row.status))
  const funnelMax = Math.max(1, ...funnel.map((row) => row.count))
  const realManagers = managers.filter((row) => row.id !== null)
  const unassignedRow = managers.find((row) => row.id === null)
  // The manager's AI call grade: matched by user id, or by name when the backend sends no id.
  const qualitySellers = callAnalytics?.stats?.bySeller ?? null
  const gradeOf = (row: { id: number | null; name: string }) => qualitySellers?.find((seller) => (seller.userId !== null && seller.userId === row.id) || seller.name.trim().toLowerCase() === row.name.trim().toLowerCase()) ?? null
  const sourceMax = Math.max(1, ...sources.map((row) => row.leads))
  const serviceMax = Math.max(1, ...services.map((row) => row.leads))
  const reasonMax = Math.max(1, ...rejections.items.map((row) => row.count))
  const hourMax = Math.max(1, ...hours)
  const eveningShare = pct(hours.slice(18).reduce((a, b) => a + b, 0) + hours[0], total)

  const reasonText = (item: (typeof attention)[number]) => {
    const status = statusMeta(item.status).label
    switch (item.reason) {
      case 'need_to_call_30m':
        return t('crm.panel.attention.need_to_call', '{{status}} — not called for {{age}}', { status, age: fmtMinutes(item.age_minutes) })
      case 'meeting_no_note_24h':
        return t('crm.panel.attention.meeting', '{{status}} — no note about the meeting result for {{age}}', { status, age: fmtMinutes(item.age_minutes) })
      case 'kp_tz_5d':
        return t('crm.panel.attention.kp_tz', '{{status}} for more than 5 days', { status })
      case 'payment_7d':
        return t('crm.panel.attention.payment', '{{status}} for more than 7 days', { status })
    }
  }

  const rejectionLabel = (key: RejectionKey) =>
    t(`crm.panel.reject.${key}`, {
      no_answer: 'No answer / no contact',
      not_fit: 'Service does not fit',
      by_mistake: 'Left the form by mistake',
      solved_competitor: 'Solved / chose a competitor',
      small_turnover: 'Turnover too small',
      too_expensive: 'Too expensive',
      other: 'Other',
    }[key])

  const serviceLabel = (key: ServiceKey) =>
    t(`crm.panel.service.${key}`, { ai: 'AI integration', crm_erp: 'CRM and ERP systems', mobile_web: 'Mobile / web apps', other: 'Other / not specified' }[key])

  const qualityRows: Array<{ label: string; value: number | string; bad: boolean }> = [
    {
      label: quality.duplicate_examples.length
        ? t('crm.panel.quality.duplicates_example', 'Duplicate leads (same phone): {{example}}', { example: quality.duplicate_examples.map((row) => row.ids.map((id) => `#${id}`).join(' = ')).join(', ') })
        : t('crm.panel.quality.duplicates', 'Duplicate leads (same phone)'),
      value: quality.duplicate_phones,
      bad: quality.duplicate_phones > 0,
    },
    { label: t('crm.panel.quality.apostrophe', "Phone starts with ' (Sheets import)"), value: quality.apostrophe_phones, bad: quality.apostrophe_phones > 0 },
    { label: t('crm.panel.quality.id_names', 'ID or number instead of a name'), value: quality.id_like_names, bad: quality.id_like_names > 0 },
    { label: t('crm.panel.quality.unassigned', 'Open leads without a responsible manager'), value: quality.unassigned, bad: quality.unassigned > 0 },
    {
      label: t('crm.panel.quality.platforms', 'Platform written differently ({{values}})', { values: quality.platform_values.slice(0, 6).join(' / ') }),
      value: quality.platform_variants,
      bad: quality.platform_variants > 0,
    },
    { label: t('crm.panel.quality.no_reason', 'Rejected without a reason'), value: quality.rejected_without_reason, bad: quality.rejected_without_reason > 0 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{t('crm.panel.title', 'Sales panel')}</h2>
          <span className="text-[12.5px] text-[var(--muted)]">
            {t('crm.panel.subtitle', 'All blocks follow the selected period · leads by the date they came in')}
          </span>
        </div>
        {periodTabs}
      </div>

      {showAlert ? (
        <div role="alert" className="flex gap-3 rounded-[16px] border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-3 text-[var(--danger-text)]">
          <WarningCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1 text-[13px] leading-snug">
            <b className="text-[14px]">
              {alert.no_leads_24h
                ? t('crm.panel.alert.no_leads_24h', 'No new leads in the last 24 hours')
                : t('crm.panel.alert.gaps_title', 'There were days without leads')}
            </b>
            {alert.gaps.map((gap) => (
              <span key={`${gap.from}-${gap.to}`}>
                {t('crm.panel.alert.gap', '{{from}} – {{to}}: {{days}} days without a single lead from {{source}}.', {
                  from: gap.from.slice(5).split('-').reverse().join('.'),
                  to: gap.to.slice(5).split('-').reverse().join('.'),
                  days: gap.days,
                  source: sourceLabel(gap.source),
                })}
              </span>
            ))}
            <span>
              {t('crm.panel.alert.last_lead', 'Last lead: {{at}}. Check the Google Sheets → CIMS sync and the ad status.', { at: fmtDate(alert.last_lead_at) })}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricTile
          label={t('crm.panel.kpi.new_leads', 'New leads')}
          value={total}
          caption={t('crm.panel.kpi.new_leads_caption', '{{sign}}{{delta}} vs previous {{days}} days', { sign: delta > 0 ? '+' : '', delta, days: period })}
          icon={TrayIcon}
          accent="#2B59FF"
        />
        <MetricTile
          label={t('crm.panel.kpi.first_response', 'First contact (median)')}
          value={fmtMinutes(kpi.first_response_median_minutes)}
          caption={t('crm.panel.kpi.first_response_caption', 'Target: {{count}} min', { count: kpi.response_limit_minutes })}
          icon={ClockIcon}
          accent={kpi.first_response_median_minutes !== null && kpi.first_response_median_minutes > kpi.response_limit_minutes ? '#E03131' : '#17924A'}
        />
        <MetricTile
          label={t('crm.panel.kpi.within_5m', 'Answered within {{count}} min', { count: kpi.response_limit_minutes })}
          value={`${kpi.responded_within_5m} / ${kpi.responded_count}`}
          caption={t('crm.panel.kpi.within_5m_caption', '{{percent}} of contacted leads', { percent: fmtPct(pct(kpi.responded_within_5m, kpi.responded_count)) })}
          icon={LightningIcon}
          accent="#D9A400"
        />
        <MetricTile
          label={t('crm.panel.kpi.open', 'Open leads')}
          value={kpi.open_leads}
          caption={t('crm.panel.kpi.open_caption', 'Not rejected and not finished')}
          icon={ChartLineUpIcon}
          accent="#0FA5B5"
          onClick={() => onFocusStatus('need_to_call')}
        />
        <MetricTile
          label={t('crm.panel.kpi.meeting_plus', 'Meeting and beyond')}
          value={kpi.meeting_plus}
          caption={t('crm.panel.kpi.meeting_plus_caption', '{{percent}} of leads', { percent: fmtPct(pct(kpi.meeting_plus, total)) })}
          icon={HandshakeIcon}
          accent="#7C5CFC"
          onClick={() => onFocusStatus('meeting_scheduled')}
        />
        <MetricTile
          label={t('crm.panel.kpi.won', 'Won deals')}
          value={kpi.won}
          caption={t('crm.panel.kpi.won_caption', 'Conversion {{percent}} · amount: {{amount}}', {
            percent: fmtPct(kpi.conversion_percent),
            amount: kpi.won_amount !== null ? kpi.won_amount.toLocaleString('ru-RU') : '—',
          })}
          icon={TrophyIcon}
          accent="#E8590C"
          onClick={() => onFocusStatus('project_started')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title={t('crm.panel.daily.title', 'Daily new leads')} caption={t('crm.panel.daily.caption', 'last {{count}} days, by source', { count: period })}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--muted-strong)]">
            {dailySources.map((source) => (
              <span key={source} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SOURCE_COLORS[source] }} />
                {sourceLabel(source)}
              </span>
            ))}
            {gapDays.size > 0 && summary.main_source ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--danger-dim)] ring-1 ring-[var(--danger-border)]" />
                {t('crm.panel.daily.gap_legend', 'no leads from {{source}}', { source: sourceLabel(summary.main_source) })}
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <div className="flex h-[180px] items-end gap-[3px]" style={{ minWidth: daily.length * 9 }}>
              {daily.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.total}`}
                  className={cn('relative flex h-full min-w-[6px] flex-1 flex-col justify-end rounded-[4px]', gapDays.has(day.date) && 'bg-[var(--danger-dim)]')}
                >
                  {dailySources.map((source) => {
                    const value = day.by_source[source] ?? 0
                    if (!value) return null
                    return <span key={source} className="block w-full first:rounded-t-[3px]" style={{ height: `${(value / dailyMax) * 100}%`, background: SOURCE_COLORS[source] }} />
                  })}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-[3px] text-[10.5px] text-[var(--muted)]" style={{ minWidth: daily.length * 9 }}>
              {daily.map((day, index) => (
                <span key={day.date} className="min-w-[6px] flex-1 text-center">
                  {index % Math.ceil(daily.length / 10) === 0 ? Number(day.date.slice(8)) : ''}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            {t('crm.panel.daily.footer', 'About {{avg}} leads a day on days with leads. Red zones: days with no leads from the main source.', { avg: avgPerLeadDay })}
          </p>
        </Card>

        <Card title={t('crm.panel.attention.title', 'Needs attention')} caption={String(attention.length)}>
          {attention.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">{t('crm.panel.attention.empty', 'Nothing is stuck right now.')}</p>
          ) : (
            <ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
              {attention.map((item) => (
                <li key={`${item.id}-${item.reason}`}>
                  <button
                    type="button"
                    onClick={() => onOpenCustomer(item.id)}
                    className="flex w-full items-start gap-3 rounded-[12px] border border-[var(--border-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--card-hover)]"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: REASON_TONE[item.reason] }} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{item.name}</span>
                      <span className="text-[12px] text-[var(--muted-strong)]">{reasonText(item)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-[var(--danger-dim)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--danger-text)]">{fmtMinutes(item.age_minutes)}</span>
                      <span className="text-[11.5px] text-[var(--muted)]">{item.manager ?? t('crm.panel.unassigned', 'Unassigned')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('crm.panel.funnel.title', 'Sales funnel')} caption={t('crm.panel.funnel.caption', '{{days}} days · {{count}} leads · current status', { days: period, count: total })}>
          <div className="flex flex-col gap-2.5">
            {mainFunnel.map((row) => <FunnelRow key={row.status} row={row} max={funnelMax} meta={statusMeta(row.status)} onClick={() => onFocusStatus(row.status)} />)}
            {lostFunnel.length > 0 ? <hr className="my-1 border-[var(--border-subtle)]" /> : null}
            {lostFunnel.map((row) => <FunnelRow key={row.status} row={row} max={funnelMax} meta={statusMeta(row.status)} onClick={() => onFocusStatus(row.status)} />)}
          </div>
        </Card>

        <Card title={t('crm.panel.today.title', "Today's plan")} caption={t('crm.panel.today.caption', '{{count}} calls / meetings', { count: todayPlan.length })}>
          {todayPlan.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">{t('customers.overview.no_callbacks', 'No callbacks scheduled for today.')}</p>
          ) : (
            <ul className="flex max-h-[420px] flex-col overflow-y-auto">
              {todayPlan.map((item) => (
                <li key={item.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <button type="button" onClick={() => onOpenCustomer(item.id)} className="flex w-full gap-4 px-1 py-2.5 text-left hover:bg-[var(--card-hover)]">
                    <span className="w-12 shrink-0 font-semibold tabular-nums text-[var(--foreground)]">{item.time}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13.5px] font-medium text-[var(--foreground)]">{item.name}</span>
                      <span className="truncate text-[12px] text-[var(--muted)]">
                        {statusMeta(item.status).label} · {sourceLabel(item.source)} · {item.manager ?? t('crm.panel.unassigned', 'Unassigned')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ManagerQualityBoard
        managers={realManagers}
        period={period}
        activity={callActivity?.data ?? null}
        activityLoading={Boolean(callActivity?.loading)}
        sellers={qualitySellers}
        fmtMinutes={fmtMinutes}
      />

      <Card title={t('crm.panel.managers.title', 'Managers')} caption={t('crm.panel.managers.caption', 'real users only · leads of the period')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="text-right text-[11.5px] font-medium text-[var(--muted)]">
                <th className="py-2 pr-3 text-left font-medium">{t('crm.panel.managers.manager', 'Manager')}</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.assigned', 'Assigned leads')}</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.first_response', 'First contact, median')}</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.meeting_plus', 'Brought to a meeting')}</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.in_meeting', 'In meeting now')}</th>
                <th className="px-2 font-medium">KP/TZ</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.payment', 'Payment pending')}</th>
                <th className="px-2 font-medium">{t('crm.panel.managers.won', 'Won')}</th>
                <th className="pl-2 font-medium">{t('crm.panel.managers.stale', 'Meetings without result')}</th>
                {qualitySellers ? <th className="pl-3 font-medium">{t('crm.panel.managers.call_grade', 'AI call grade')}</th> : null}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {realManagers.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border-subtle)] text-right">
                  <td className="py-2.5 pr-3 text-left font-semibold text-[var(--foreground)]">{row.name}</td>
                  <td className="px-2">{row.assigned}</td>
                  <td className="px-2">{fmtMinutes(row.first_response_median_minutes)}</td>
                  <td className="px-2">{row.meeting_plus}</td>
                  <td className="px-2">{row.in_meeting}</td>
                  <td className="px-2">{row.kp_tz}</td>
                  <td className="px-2">{row.payment_pending}</td>
                  <td className="px-2">{row.won}</td>
                  <td className="pl-2">
                    {row.stale_meetings > 0 ? (
                      <span className="rounded-full bg-[var(--danger-dim)] px-2 py-0.5 font-semibold text-[var(--danger-text)]">{row.stale_meetings}</span>
                    ) : '0'}
                  </td>
                  {qualitySellers ? (
                    <td className="pl-3">
                      {(() => {
                        const grade = gradeOf(row)
                        if (!grade || grade.average === null) return <span className="text-[var(--muted)]">—</span>
                        const color = scoreTone(grade.average)
                        return (
                          <span title={t('crm.panel.calls_ai.calls_count', '{{count}} calls', { count: grade.count })} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
                            {grade.average}<span className="text-[11px] font-normal opacity-80">· {grade.count}</span>
                          </span>
                        )
                      })()}
                    </td>
                  ) : null}
                </tr>
              ))}
              {unassignedRow ? (
                <tr className="border-t border-[var(--border-subtle)] text-right text-[var(--muted)]">
                  <td className="py-2.5 pr-3 text-left">{t('crm.panel.unassigned', 'Unassigned')}</td>
                  <td className={cn('px-2 font-semibold', unassignedRow.assigned > 0 && 'text-[var(--danger-text)]')}>{unassignedRow.assigned}</td>
                  <td colSpan={qualitySellers ? 8 : 7} className="pl-2">—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!managersLoaded ? <p className="text-[12px] text-[var(--muted)]">{t('crm.panel.managers.loading', 'Loading assignments…')}</p> : null}
        <p className="text-[12px] text-[var(--muted)]">
          {t('crm.panel.managers.footer', 'The responsible person comes from "Assign sales manager" (users list), not from the assistant name — "Cognilabs AI" and "Facebook Ads" are sources, not managers.')}
        </p>
      </Card>

      {callAnalytics ? <CallAnalyticsCard data={callAnalytics} period={period} /> : null}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card title={t('crm.panel.sources.title', 'Sources')} caption={t('crm.panel.days', '{{count}} days', { count: period })}>
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-right text-[11.5px] text-[var(--muted)]">
                <th className="py-1 text-left font-medium">{t('crm.panel.sources.source', 'Source')}</th>
                <th className="font-medium">{t('crm.panel.sources.leads', 'Leads')}</th>
                <th className="font-medium">{t('crm.panel.sources.meeting_plus', 'Meeting+')}</th>
                <th className="font-medium">{t('crm.panel.sources.rejected', 'Rejected')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((row) => (
                <tr key={row.source} className="border-t border-[var(--border-subtle)] text-right">
                  <td className="py-2 pr-3 text-left">
                    <span className="block text-[var(--foreground)]">{sourceLabel(row.source)}</span>
                    <span className="mt-1 block max-w-[160px]"><Bar value={row.leads} max={sourceMax} color={SOURCE_COLORS[row.source]} /></span>
                  </td>
                  <td>{row.leads}</td>
                  <td>{row.meeting_plus} <span className="text-[11px] text-[var(--muted)]">{fmtPct(pct(row.meeting_plus, row.leads))}</span></td>
                  <td>{row.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rounded-[12px] border border-dashed border-[var(--border)] px-3 py-2 text-[12px] text-[var(--muted)]">
            {t('crm.panel.sources.footer', 'Once ad spend is entered, cost per lead and cost per deal will appear here.')}
          </p>
        </Card>

        <Card title={t('crm.panel.services.title', 'What clients ask for')} caption={t('crm.panel.services.caption', 'by the service in the form')}>
          <div className="flex flex-col gap-3">
            {services.map((row) => (
              <div key={row.service} className="flex items-center gap-3 text-[13px]">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[var(--foreground)]">{serviceLabel(row.service)}</span>
                  <Bar value={row.leads} max={serviceMax} color={SERVICE_COLORS[row.service]} />
                </span>
                <span className="w-9 text-right tabular-nums">{row.leads}</span>
                <span className="w-16 text-right tabular-nums text-[var(--success-text)]">{row.meeting_plus} <span className="text-[11px]">{fmtPct(pct(row.meeting_plus, row.leads))}</span></span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-[var(--muted)]">{t('crm.panel.services.footer', 'Detected from the form answer and the AI summary; the right column is meeting+.')}</p>
        </Card>

        <Card title={t('crm.panel.reject.title', 'Why leads are rejected')} caption={t('crm.panel.reject.caption', '{{with}} of {{total}} have a reason', { with: rejections.with_reason, total: rejections.total_rejected })}>
          {rejections.items.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[var(--muted)]">{t('crm.panel.reject.empty', 'No rejection reasons in this period.')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rejections.items.map((row) => (
                <div key={row.key} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_2.5rem] items-center gap-3 text-[13px]">
                  <span className="truncate text-[var(--foreground)]">{rejectionLabel(row.key)}</span>
                  <Bar value={row.count} max={reasonMax} color={row.key === 'no_answer' ? '#8A90A2' : '#E03131'} />
                  <span className="text-right tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
          {rejections.total_rejected > rejections.with_reason ? (
            <p className="rounded-[12px] border border-dashed border-[var(--border)] px-3 py-2 text-[12px] text-[var(--muted)]">
              {t('crm.panel.reject.missing', '{{count}} rejected leads have no reason. The reason is now required when rejecting.', { count: rejections.total_rejected - rejections.with_reason })}
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('crm.panel.hours.title', 'When leads come in')} caption={t('crm.panel.hours.caption', 'by hour (Tashkent)')}>
          <div className="flex h-[120px] items-end gap-[3px]">
            {hours.map((value, hour) => (
              <span
                key={hour}
                title={`${String(hour).padStart(2, '0')}:00 — ${value}`}
                className="block flex-1 rounded-t-[3px]"
                style={{ height: `${Math.max(value ? 4 : 1, (value / hourMax) * 100)}%`, background: hour >= 18 || hour === 0 ? '#2B59FF' : 'color-mix(in srgb, #2B59FF 40%, var(--muted-surface))' }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] text-[var(--muted)]">
            {['00', '06', '12', '18', '23'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            {t('crm.panel.hours.footer', '{{percent}} of leads come between 18:00 and 01:00 — plan a morning call block for them.', { percent: fmtPct(eveningShare) })}
          </p>
        </Card>

        <Card title={t('crm.panel.quality.title', 'Data quality')} caption={t('crm.panel.quality.caption', 'whole base')}>
          <ul className="flex flex-col">
            {qualityRows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-2 text-[13px] last:border-b-0">
                <span className="min-w-0 text-[var(--foreground)]">{row.label}</span>
                <span className={cn('shrink-0 font-semibold tabular-nums', row.bad ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]')}>{row.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function FunnelRow({ row, max, meta, onClick }: { row: { status: string; count: number; percent: number }; max: number; meta: StatusMeta; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-[8px] text-left text-[13px] hover:bg-[var(--card-hover)] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5rem]">
      <span className="truncate text-[var(--foreground)]">{meta.label}</span>
      <Bar value={row.count} max={max} color={meta.color} />
      <span className="text-right tabular-nums">
        <b className="font-semibold">{row.count}</b> <span className="text-[11px] text-[var(--muted)]">{fmtPct(row.percent)}</span>
      </span>
    </button>
  )
}
