import { useId, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  SalesDashboardChartsResponse,
  SalesDashboardTrendPoint,
} from '../../../shared/api/types'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { formatCompactNumber, formatShortMonthDay, getLocalizedShortWeekdayName } from '../../../shared/lib/format'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'

const tonePalette = {
  blue: {
    line: '#60a5fa',
    areaStart: 'rgba(96,165,250,0.28)',
    areaEnd: 'rgba(96,165,250,0.02)',
    dot: '#bfdbfe',
    ring: 'border-blue-500/16 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08),0_0_24px_rgba(59,130,246,0.05)]',
    label: 'text-[var(--blue-text)]',
    badge: 'blue' as const,
    bar: 'bg-blue-400',
  },
  violet: {
    line: '#a78bfa',
    areaStart: 'rgba(167,139,250,0.26)',
    areaEnd: 'rgba(167,139,250,0.03)',
    dot: '#ddd6fe',
    ring: 'border-violet-500/16 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.08),0_0_24px_rgba(139,92,246,0.05)]',
    label: 'text-[#A78BFA]',
    badge: 'violet' as const,
    bar: 'bg-violet-400',
  },
  emerald: {
    line: '#34d399',
    areaStart: 'rgba(52,211,153,0.26)',
    areaEnd: 'rgba(52,211,153,0.03)',
    dot: '#a7f3d0',
    ring: 'border-emerald-500/16 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.08),0_0_24px_rgba(34,197,94,0.05)]',
    label: 'text-[var(--success-text)]',
    badge: 'success' as const,
    bar: 'bg-emerald-400',
  },
  amber: {
    line: '#fbbf24',
    areaStart: 'rgba(251,191,36,0.24)',
    areaEnd: 'rgba(251,191,36,0.03)',
    dot: '#fde68a',
    ring: 'border-amber-500/16 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08),0_0_24px_rgba(245,158,11,0.05)]',
    label: 'text-[var(--warning-text)]',
    badge: 'warning' as const,
    bar: 'bg-amber-400',
  },
} as const

type AccentTone = keyof typeof tonePalette

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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-[var(--foreground)]">{value}</p>
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
    <Card className={cn('p-5', colors.ring)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn('text-[10px] font-semibold uppercase tracking-[0.22em]', colors.label)}>{title}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {payload
              ? `${formatCompactNumber(payload.summary.total_period_leads)} ${t('crm.charts.units.leads')}`
              : t('crm.charts.states.no_dataset')}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={colors.badge}>{payload ? formatRangeLabel(payload) : t('crm.charts.states.waiting_api')}</Badge>
          {payload ? (
            <Badge variant="outline">{formatPercent(payload.summary.conversion_rate_percent)} {t('crm.charts.metric.conversion').toLowerCase()}</Badge>
          ) : null}
        </div>
      </div>

      {payload && trend.length > 0 ? (
        <>
          <div className="mt-5 overflow-hidden rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-2 py-4">
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
                    stroke="rgba(148,163,184,0.22)"
                    strokeDasharray="3 6"
                  />
                )
              })}

              {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={colors.line}
                  strokeWidth="3"
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
                    fill="rgba(100,116,139,0.88)"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {formatTickLabel(point.date, totalPoints)}
                  </text>
                )
              })}
            </svg>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-8 text-sm text-[var(--muted-strong)]">
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
    <Card className="overflow-hidden border-[var(--border)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">{t('crm.charts.header.title')}</h2>
        </div>

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
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            label={t('crm.charts.metric.total_30d')}
            value={formatCompactNumber(summary.total_period_leads)}
          />
          <MiniStat
            label={t('crm.charts.metric.this_week')}
            value={formatCompactNumber(summary.this_week)}
          />
          <MiniStat
            label={t('crm.charts.metric.started')}
            value={formatCompactNumber(summary.project_started)}
          />
          <MiniStat
            label={t('crm.charts.metric.conversion')}
            value={formatPercent(summary.conversion_rate_percent)}
          />
        </div>
      ) : null}

      {isError && !weekly && !monthly ? (
        <div className="mt-5 rounded-xl border border-dashed border-rose-500/30 bg-rose-50 px-5 py-8 text-sm text-rose-700 dark:bg-rose-500/[0.06] dark:text-rose-100/80">
          {t('crm.charts.states.load_failed')}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
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
        </>
      )}
    </Card>
  )
}
