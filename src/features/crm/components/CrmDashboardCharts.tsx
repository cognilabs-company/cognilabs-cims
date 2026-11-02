import { useId, useMemo, type ReactNode } from 'react'
import { Calendar, Crosshair, Users, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  SalesDashboardChartsResponse,
  SalesDashboardTrendPoint,
} from '../../../shared/api/types'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { formatCompactNumber, formatShortMonthDay, getLocalizedShortWeekdayName } from '../../../shared/lib/format'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'

const CHART_GRID_LINE = '#ECEEF3'
const CHART_AXIS_TEXT = '#8A90A2'

const tonePalette = {
  blue: {
    line: '#2B59FF',
    areaStart: 'rgba(43,89,255,0.18)',
    areaEnd: 'rgba(43,89,255,0)',
    dot: '#FFFFFF',
    label: 'text-[var(--blue-text)]',
    badge: 'blue' as const,
  },
  violet: {
    line: '#6A3FE0',
    areaStart: 'rgba(106,63,224,0.16)',
    areaEnd: 'rgba(106,63,224,0)',
    dot: '#FFFFFF',
    label: 'text-[var(--violet-text)]',
    badge: 'violet' as const,
  },
} as const

type AccentTone = keyof typeof tonePalette

const iconTotalLeads = <Users className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />

const iconThisWeek = <Calendar className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />

const iconStarted = <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />

const iconConversion = <Crosshair className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />

type CrmDashboardChartsProps = {
  weekly?: SalesDashboardChartsResponse
  monthly?: SalesDashboardChartsResponse
  customerType: string
  onCustomerTypeChange: (value: string) => void
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  headerActions?: ReactNode
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0.0%'
  }

  return `${value.toFixed(1)}%`
}

function formatRangeLabel(payload?: SalesDashboardChartsResponse) {
  if (!payload) {
    return translateCurrentLiteral('Period unavailable')
  }

  const start = new Date(payload.period.start_date)
  const end = new Date(payload.period.end_date)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${payload.period.days} ${translateCurrentLiteral('days')}`
  }

  return `${formatShortMonthDay(payload.period.start_date)} - ${formatShortMonthDay(payload.period.end_date)}`
}

function formatTickLabel(date: string, totalPoints: number) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  if (totalPoints <= 8) {
    return getLocalizedShortWeekdayName(parsed.getDay())
  }

  return formatShortMonthDay(date)
}

function getPeakPoint(points: SalesDashboardTrendPoint[]) {
  return points.reduce<SalesDashboardTrendPoint | null>((current, point) => (
    !current || point.count > current.count ? point : current
  ), null)
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--caption)]">{label}</p>
      <p className="mt-2 text-[22px] font-bold tracking-[-0.03em] tabular-nums text-[var(--foreground)]" data-ui-number="true">{value}</p>
    </div>
  )
}

function TrendChartCard({
  title,
  payload,
  accent,
}: {
  title: string
  payload?: SalesDashboardChartsResponse
  accent: AccentTone
}) {
  const { t } = useTranslation()
  const ids = useId()
  const gradientId = `crm-chart-${ids.replace(/:/g, '')}`
  const colors = tonePalette[accent]
  const chartWidth = 620
  const chartHeight = 220
  const padX = 14
  const padY = 18
  const trend = useMemo(() => payload?.trend ?? [], [payload])
  const totalPoints = trend.length
  const maxValue = Math.max(...trend.map((point) => point.count), 1)
  const points = useMemo(() => {
    if (trend.length === 0) {
      return []
    }

    return trend.map((point, index) => {
      const x = trend.length === 1
        ? chartWidth / 2
        : padX + (index / (trend.length - 1)) * (chartWidth - padX * 2)
      const y = chartHeight - padY - (point.count / maxValue) * (chartHeight - padY * 2)

      return {
        ...point,
        x,
        y,
      }
    })
  }, [chartHeight, chartWidth, maxValue, trend])
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${(chartHeight - padY).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(chartHeight - padY).toFixed(2)} Z`
    : ''
  const averagePerDay = totalPoints > 0
    ? trend.reduce((sum, point) => sum + point.count, 0) / totalPoints
    : 0
  const peakPoint = getPeakPoint(trend)
  const labelStep = totalPoints <= 7 ? 1 : Math.max(1, Math.ceil(totalPoints / 6))

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn('text-[11px] font-semibold tracking-[0.08em] uppercase', colors.label)}>{title}</p>
          <h3 className="mt-2 text-[26px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
            {payload
              ? `${formatCompactNumber(payload.summary.total_period_leads)} ${t('crm.charts.units.leads')}`
              : t('crm.charts.states.no_dataset')}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={colors.badge}>{payload ? formatRangeLabel(payload) : t('crm.charts.states.waiting_api')}</Badge>
          {payload ? (
            <Badge variant="secondary">{formatPercent(payload.summary.conversion_rate_percent)} {t('crm.charts.metric.conversion').toLowerCase()}</Badge>
          ) : null}
        </div>
      </div>

      {payload && trend.length > 0 ? (
        <>
          <div className="mt-[18px] overflow-hidden rounded-[18px] bg-[var(--accent-soft)] px-2 py-4">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.areaStart} />
                  <stop offset="100%" stopColor={colors.areaEnd} />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75, 1].map((fraction) => {
                const y = padY + (chartHeight - padY * 2) * fraction

                return (
                  <line
                    key={fraction}
                    x1={padX}
                    x2={chartWidth - padX}
                    y1={y}
                    y2={y}
                    stroke={CHART_GRID_LINE}
                    strokeWidth="1"
                  />
                )
              })}

              {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={colors.line}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map((point) => (
                <circle
                  key={`${point.date}-${point.count}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={colors.dot}
                  stroke={colors.line}
                  strokeWidth="2"
                />
              ))}

              {points.map((point, index) => {
                if (index % labelStep !== 0 && index !== points.length - 1) {
                  return null
                }

                const textAnchor =
                  index === 0 ? 'start' :
                  index === points.length - 1 ? 'end' :
                  'middle'

                return (
                  <text
                    key={`label-${point.date}`}
                    x={point.x}
                    y={chartHeight - 2}
                    textAnchor={textAnchor}
                    fill={CHART_AXIS_TEXT}
                    fontSize="11"
                    fontWeight="500"
                  >
                    {formatTickLabel(point.date, totalPoints)}
                  </text>
                )
              })}
            </svg>
          </div>

          <div className="mt-[18px] grid gap-3 sm:grid-cols-3">
            <MiniStat
              label={t('crm.charts.metric.today')}
              value={formatCompactNumber(payload.summary.today)}
            />
            <MiniStat
              label={t('crm.charts.metric.average_daily')}
              value={averagePerDay.toFixed(1)}
            />
            <MiniStat
              label={t('crm.charts.metric.peak_day')}
              value={peakPoint ? formatCompactNumber(peakPoint.count) : '0'}
            />
          </div>
        </>
      ) : (
        <div className="mt-[18px] rounded-[18px] bg-[var(--muted-surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {t('crm.charts.states.trend_empty')}
        </div>
      )}
    </Card>
  )
}

export function CrmDashboardCharts({
  weekly,
  monthly,
  customerType,
  onCustomerTypeChange,
  isLoading,
  isError,
  onRetry,
  headerActions,
}: CrmDashboardChartsProps) {
  const { t } = useTranslation()
  const summary = monthly?.summary ?? weekly?.summary
  const customerTypeOptions = useMemo<SelectFieldOption[]>(() => ([
    { value: '', label: t('crm.charts.filters.all_leads') },
    { value: 'local', label: t('common.scope.local') },
    { value: 'international', label: t('common.scope.international') },
  ]), [t])

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--foreground)]">{t('crm.charts.header.title')}</h2>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-[180px]">
            <SelectField
              value={customerType}
              options={customerTypeOptions}
              onValueChange={onCustomerTypeChange}
            />
          </div>
          {headerActions ?? (
            <Button variant="secondary" onClick={onRetry} loading={isLoading}>
              {t('common.refresh')}
            </Button>
          )}
        </div>
      </div>

      {summary ? (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            solid
            icon={iconTotalLeads}
            label={t('crm.charts.metric.total_30d')}
            value={formatCompactNumber(summary.total_period_leads)}
            hint={t('crm.charts.metric.today_hint', 'Today: {{count}}', { count: summary.today })}
            delta={summary.yesterday > 0 ? formatPercent((summary.today / summary.yesterday) * 100 - 100) : undefined}
          />
          <StatCard
            icon={iconThisWeek}
            iconTone="blue"
            label={t('crm.charts.metric.this_week')}
            value={formatCompactNumber(summary.this_week)}
            hint={t('crm.charts.metric.last_week_hint', 'Last week: {{count}}', { count: summary.last_week })}
            delta={summary.last_week > 0 ? formatPercent((summary.this_week / summary.last_week) * 100 - 100) : undefined}
            deltaTone={summary.this_week >= summary.last_week ? 'success' : 'danger'}
          />
          <StatCard
            icon={iconStarted}
            iconTone="lime"
            label={t('crm.charts.metric.started')}
            value={formatCompactNumber(summary.project_started)}
            hint={t('crm.charts.metric.finished_hint', 'Finished: {{count}}', { count: summary.finished })}
          />
          <StatCard
            icon={iconConversion}
            iconTone="violet"
            label={t('crm.charts.metric.conversion')}
            value={formatPercent(summary.conversion_rate_percent)}
            hint={t('crm.charts.metric.rejected_hint', 'Rejected: {{count}}', { count: summary.rejected })}
          />
        </div>
      ) : null}

      {isError && !weekly && !monthly ? (
        <Alert tone="danger">{t('crm.charts.states.load_failed')}</Alert>
      ) : (
        <div className="grid gap-[18px] xl:grid-cols-2">
          <TrendChartCard
            title={t('crm.charts.card.weekly_title')}
            payload={weekly}
            accent="blue"
          />
          <TrendChartCard
            title={t('crm.charts.card.monthly_title')}
            payload={monthly}
            accent="violet"
          />
        </div>
      )}
    </div>
  )
}
