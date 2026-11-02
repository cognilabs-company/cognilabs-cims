import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, MousePointerClick, Radio, Users } from 'lucide-react'
import { websiteStatsService, type WebsiteAnalyticsRow } from '../../../shared/api/services/website-stats.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { formatCompactNumber } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { BarChartCard, type BarDatum } from '../../../shared/ui/charts/bar-chart-card'
import { FunnelStages, type FunnelStage } from '../../../shared/ui/charts/funnel-stages'
import { GaugeDonut, type GaugeSegment } from '../../../shared/ui/charts/gauge-donut'
import { Leaderboard, type LeaderboardEntry } from '../../../shared/ui/charts/leaderboard'
import { DataTable } from '../../../shared/ui/data-table'
import { StatCard } from '../../../shared/ui/stat-card'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { useAuth } from '../../auth/hooks/useAuth'

type AnalyticsRangeKey = '7' | '30' | '90'

const trackedWebsiteUrl = 'https://www.cognilabs.org/en'
const trackedWebsiteLabel = 'cognilabs.org/en'

const websiteStatsApiHost = (() => {
  try {
    return new URL(websiteStatsService.apiBaseUrl).host
  } catch {
    return websiteStatsService.apiBaseUrl
  }
})()

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function resolveAnalyticsQuery(daysValue: string) {
  const days = Math.max(1, Number(daysValue) || 30)
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - (days - 1))

  return {
    days,
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
  }
}

function normalizeAnalyticsLookupKey(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
}

function getAnalyticsMetric(metrics: Record<string, number>, candidates: string[]) {
  const metricEntries = Object.entries(metrics)

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeAnalyticsLookupKey(candidate)
    const matched = metricEntries.find(([key]) => normalizeAnalyticsLookupKey(key) === normalizedCandidate)

    if (matched) {
      return matched[1]
    }
  }

  return 0
}

function getAnalyticsDimension(dimensions: Record<string, string>, candidates: string[]) {
  const dimensionEntries = Object.entries(dimensions)

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeAnalyticsLookupKey(candidate)
    const matched = dimensionEntries.find(([key]) => normalizeAnalyticsLookupKey(key) === normalizedCandidate)

    if (matched?.[1]) {
      return matched[1]
    }
  }

  return ''
}

function getAnalyticsRowLabel(row: WebsiteAnalyticsRow) {
  return (
    getAnalyticsDimension(row.dimensions, ['pageTitle', 'screenPageTitle', 'title', 'pagePath', 'pagePathPlusQueryString'])
    || Object.values(row.dimensions).find(Boolean)
    || 'Untitled'
  )
}

function compactPageLabel(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()

  if (normalized.length <= 16) {
    return normalized
  }

  return `${normalized.slice(0, 15)}…`
}

function pageInitials(value: string) {
  const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean)

  if (parts.length === 0) {
    return '—'
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function getWebsiteStatsErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback)

  if (/failed to fetch/i.test(message) || /err_name_not_resolved/i.test(message)) {
    return `Analytics hostiga ulanib bo'lmadi (${websiteStatsApiHost}). Backend proxy yoki DNS ni tekshiring.`
  }

  return message
}

export function WebsiteStatsPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeKey>('30')

  const analyticsWindow = useMemo(() => resolveAnalyticsQuery(analyticsRange), [analyticsRange])

  const analyticsQuery = useAsyncData(
    () => websiteStatsService.getAnalytics(analyticsWindow),
    [analyticsWindow.days, analyticsWindow.startDate, analyticsWindow.endDate, isAuthenticated],
    { enabled: isAuthenticated },
  )

  const realtimeAnalyticsQuery = useAsyncData(
    () => websiteStatsService.getRealtimeAnalytics(),
    [isAuthenticated],
    { enabled: isAuthenticated },
  )

  const analyticsSummary = analyticsQuery.data?.summary ?? {}
  const realtimeSummary = realtimeAnalyticsQuery.data?.summary ?? {}

  const analyticsTopPages = useMemo(() => {
    return (analyticsQuery.data?.rows ?? [])
      .map((row, index) => ({
        id: `${getAnalyticsRowLabel(row)}-${index}`,
        title: getAnalyticsRowLabel(row),
        views: getAnalyticsMetric(row.metrics, ['screenPageViews', 'views', 'pageViews']),
        users: getAnalyticsMetric(row.metrics, ['totalUsers', 'activeUsers', 'users']),
        sessions: getAnalyticsMetric(row.metrics, ['sessions']),
      }))
      .sort((left, right) => right.views - left.views || right.users - left.users || right.sessions - left.sessions)
      .slice(0, 8)
  }, [analyticsQuery.data?.rows])

  const realtimeRows = useMemo(() => {
    return (realtimeAnalyticsQuery.data?.rows ?? [])
      .map((row, index) => ({
        id: `${getAnalyticsRowLabel(row)}-${index}`,
        label: getAnalyticsRowLabel(row),
        activeUsers: getAnalyticsMetric(row.metrics, ['activeUsers', 'users', 'totalUsers']),
        views: getAnalyticsMetric(row.metrics, ['screenPageViews', 'views', 'pageViews', 'eventCount']),
      }))
      .sort((left, right) => right.activeUsers - left.activeUsers || right.views - left.views)
      .slice(0, 6)
  }, [realtimeAnalyticsQuery.data?.rows])

  const totalUsersMetric = getAnalyticsMetric(analyticsSummary, ['totalUsers', 'activeUsers', 'users'])
  const sessionsMetric = getAnalyticsMetric(analyticsSummary, ['sessions'])
  const pageViewsMetric = getAnalyticsMetric(analyticsSummary, ['screenPageViews', 'views', 'pageViews'])
  const realtimeActiveUsersMetric = getAnalyticsMetric(realtimeSummary, ['activeUsers', 'users', 'totalUsers'])

  const hasSummaryMetrics = pageViewsMetric > 0 || sessionsMetric > 0 || totalUsersMetric > 0 || realtimeActiveUsersMetric > 0
  const viewsPerSession = sessionsMetric > 0 ? (pageViewsMetric / sessionsMetric).toFixed(1) : null
  const rangeBadge = t('ceo.website.overview.range_badge', '{{days}} days', { days: analyticsWindow.days })

  const rangeTabs = useMemo(
    () => [
      { value: '7' as AnalyticsRangeKey, label: t('ceo.website.range.7d', '7 days') },
      { value: '30' as AnalyticsRangeKey, label: t('ceo.website.range.30d', '30 days') },
      { value: '90' as AnalyticsRangeKey, label: t('ceo.website.range.90d', '90 days') },
    ],
    [t],
  )

  const pageBars = useMemo<BarDatum[]>(() => {
    const rankedViews = analyticsTopPages.reduce((acc, row) => acc + row.views, 0)

    return analyticsTopPages
      .filter((row) => row.views > 0)
      .slice(0, 5)
      .map((row) => ({
        key: row.id,
        label: compactPageLabel(row.title),
        value: row.views,
        amount: formatCompactNumber(row.views),
        delta: rankedViews > 0 ? `${Math.round((row.views / rankedViews) * 100)}%` : undefined,
      }))
  }, [analyticsTopPages])

  const viewsSegments = useMemo<GaugeSegment[]>(() => {
    const leaders = analyticsTopPages.filter((row) => row.views > 0).slice(0, 3)

    if (leaders.length === 0) {
      return []
    }

    const leaderViews = leaders.reduce((acc, row) => acc + row.views, 0)
    const segments: GaugeSegment[] = leaders.map((row) => ({
      key: row.id,
      label: compactPageLabel(row.title),
      value: row.views,
    }))
    const otherViews = Math.max(0, pageViewsMetric - leaderViews)

    if (otherViews > 0) {
      segments.push({
        key: 'other-pages',
        label: t('ceo.website.overview.other_pages', 'Other pages'),
        value: otherViews,
      })
    }

    return segments
  }, [analyticsTopPages, pageViewsMetric, t])

  const trafficStages = useMemo<FunnelStage[]>(() => {
    const steps = [
      {
        key: 'views',
        label: t('ceo.website.metric.page_views'),
        count: pageViewsMetric,
        icon: <Eye className="h-4 w-4" />,
      },
      {
        key: 'sessions',
        label: t('ceo.website.metric.sessions'),
        count: sessionsMetric,
        icon: <MousePointerClick className="h-4 w-4" />,
      },
      {
        key: 'users',
        label: t('ceo.website.metric.users'),
        count: totalUsersMetric,
        icon: <Users className="h-4 w-4" />,
      },
      {
        key: 'live',
        label: t('ceo.website.overview.stage_live', 'Live now'),
        count: realtimeActiveUsersMetric,
        icon: <Radio className="h-4 w-4" />,
        hero: true,
      },
    ]
    const top = steps.reduce((acc, step) => Math.max(acc, step.count), 0) || 1

    return steps.map((step) => ({
      key: step.key,
      label: step.label,
      count: step.count,
      value: `${Math.round((step.count / top) * 100)}%`,
      percent: Math.round((step.count / top) * 100),
      icon: step.icon,
      hero: step.hero,
    }))
  }, [pageViewsMetric, realtimeActiveUsersMetric, sessionsMetric, t, totalUsersMetric])

  const audienceLeaders = useMemo<LeaderboardEntry[]>(() => {
    const ranked = analyticsTopPages
      .filter((row) => row.users > 0)
      .sort((left, right) => right.users - left.users)
      .slice(0, 5)
    const top = ranked.length > 0 ? ranked[0].users : 1

    return ranked.map((row) => ({
      key: row.id,
      name: row.title,
      initials: pageInitials(row.title),
      caption: t('ceo.website.leaderboard.views', '{{value}} views', { value: formatCompactNumber(row.views) }),
      amount: formatCompactNumber(row.users),
      percent: Math.round((row.users / top) * 100),
    }))
  }, [analyticsTopPages, t])

  async function handleRefresh() {
    const results = await Promise.allSettled([
      analyticsQuery.refetch(),
      realtimeAnalyticsQuery.refetch(),
    ])

    const failed = results.find((result) => result.status === 'rejected')

    if (failed?.status === 'rejected') {
      showToast({
        title: t('ceo.website.refresh_failed'),
        description: getWebsiteStatsErrorMessage(failed.reason, t('ceo.website.refresh_failed_description')),
        tone: 'error',
      })
      return
    }

    showToast({
      title: t('ceo.website.refreshed'),
      description: t('ceo.website.refreshed_description'),
      tone: 'success',
    })
  }

  const mutedHint = (
    <p className="py-10 text-center text-[13px] text-[var(--muted)]">
      {t('ceo.website.overview.no_pages', 'No page rows for this range yet.')}
    </p>
  )

  const analyticsOverviewState = analyticsQuery.isLoading && !analyticsQuery.data ? (
    <LoadingStateBlock
      eyebrow={t('ceo.website.section.analytics_eyebrow')}
      title={t('ceo.website.loading_title')}
      description={t('ceo.website.loading_description')}
    />
  ) : analyticsQuery.isError && !analyticsQuery.data ? (
    <ErrorStateBlock
      eyebrow={t('ceo.website.section.analytics_eyebrow')}
      title={t('ceo.website.error_title')}
      description={getWebsiteStatsErrorMessage(
        analyticsQuery.error,
        '/api/analytics did not return a usable payload.',
      )}
      actionLabel={t('common.retry')}
      onAction={() => {
        void analyticsQuery.refetch().catch(() => null)
      }}
    />
  ) : (
    mutedHint
  )

  return (
    <section className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="ui-page-title text-[var(--foreground)]">{t('ceo.website.header.title')}</h1>
          <p className="text-sm text-[var(--muted)]">
            {t('ceo.website.page.subtitle', 'Google Analytics traffic and live visitors for the public website.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-[var(--card)] px-4 text-[12.5px]">
            <span className="text-[var(--muted)]">{t('ceo.website.meta.tracked_site')}</span>
            <b className="font-semibold text-[var(--foreground)]" data-i18n-skip="true">{trackedWebsiteLabel}</b>
          </span>
          <Button variant="secondary" onClick={() => void handleRefresh()}>
            {t('ceo.website.actions.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <StatCard
          solid
          label={t('ceo.website.metric.page_views')}
          value={formatCompactNumber(pageViewsMetric)}
          hint={t('ceo.website.metric.page_views_caption', 'Views in the selected range')}
          icon={<Eye className="h-[18px] w-[18px]" />}
          delta={rangeBadge}
          onOpen={() => window.open(trackedWebsiteUrl, '_blank', 'noopener,noreferrer')}
          openLabel={t('ceo.website.actions.open_site', 'Open website')}
        />
        <StatCard
          label={t('ceo.website.metric.users')}
          value={formatCompactNumber(totalUsersMetric)}
          hint={t('ceo.website.metric.users_caption')}
          icon={<Users className="h-[18px] w-[18px]" />}
          iconTone="blue"
        />
        <StatCard
          label={t('ceo.website.metric.sessions')}
          value={formatCompactNumber(sessionsMetric)}
          hint={t('ceo.website.metric.sessions_caption')}
          icon={<MousePointerClick className="h-[18px] w-[18px]" />}
          iconTone="violet"
          delta={viewsPerSession ? t('ceo.website.metric.per_session', '{{value}} / session', { value: viewsPerSession }) : undefined}
          deltaTone="neutral"
        />
        <StatCard
          label={t('ceo.website.metric.realtime_active')}
          value={formatCompactNumber(realtimeActiveUsersMetric)}
          hint={t('ceo.website.metric.realtime_caption')}
          icon={<Radio className="h-[18px] w-[18px]" />}
          iconTone="lime"
          onOpen={() => {
            void realtimeAnalyticsQuery.refetch().catch(() => null)
          }}
          openLabel={t('ceo.website.actions.refresh_live', 'Refresh live traffic')}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <BarChartCard
          className="min-w-0 flex-[1.5_1_520px]"
          title={t('ceo.website.overview.traffic_by_page', 'Traffic by page')}
          deltaBadge={rangeBadge}
          deltaCaption={t('ceo.website.overview.traffic_caption', 'Page views in the selected range')}
          periods={rangeTabs}
          period={analyticsRange}
          onPeriodChange={setAnalyticsRange}
          data={pageBars}
          highlightKey={pageBars.length > 0 ? pageBars[0].key : undefined}
          total={formatCompactNumber(pageViewsMetric)}
          totalCaption={t('ceo.website.overview.total_views_caption', 'total page views')}
          emptyState={analyticsOverviewState}
        />

        <GaugeDonut
          className="min-w-0 flex-[1_1_360px]"
          title={t('ceo.website.overview.views_share', 'Views by page')}
          segments={viewsSegments}
          centerValue={formatCompactNumber(pageViewsMetric)}
          centerCaption={t('ceo.website.overview.total_views_caption', 'total page views')}
          emptyState={mutedHint}
        />
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1.3_1_440px] flex-col gap-4 rounded-[24px] bg-[var(--card)] p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {t('ceo.website.overview.stages', 'Traffic stages')}
            </span>
            <span className="text-[12.5px] text-[var(--muted)]" data-i18n-skip="true">
              {`${analyticsWindow.startDate} → ${analyticsWindow.endDate}`}
            </span>
          </div>

          {hasSummaryMetrics ? <FunnelStages stages={trafficStages} /> : mutedHint}

          <div className="mt-auto grid gap-2.5 rounded-[18px] bg-[var(--accent-soft)] p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] text-[var(--muted)]">
                {t('ceo.website.overview.pages_tracked', 'Pages tracked')}
              </span>
              <span className="text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]" data-ui-number="true">
                {analyticsTopPages.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] text-[var(--muted)]">
                {t('ceo.website.overview.views_per_session', 'Views per session')}
              </span>
              <span className="text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]" data-ui-number="true">
                {viewsPerSession ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-[24px] bg-[var(--card)] p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {t('ceo.website.realtime_title')}
            </span>
            <Badge variant="success" dot>
              {t('ceo.website.badge.active', { count: formatCompactNumber(realtimeActiveUsersMetric) })}
            </Badge>
          </div>

          {realtimeAnalyticsQuery.isLoading && !realtimeAnalyticsQuery.data ? (
            <LoadingStateBlock
              eyebrow={t('ceo.website.realtime_eyebrow')}
              title={t('ceo.website.realtime_loading_title')}
              description={t('ceo.website.realtime_loading_description')}
            />
          ) : realtimeAnalyticsQuery.isError && !realtimeAnalyticsQuery.data ? (
            <ErrorStateBlock
              eyebrow={t('ceo.website.realtime_eyebrow')}
              title={t('ceo.website.realtime_error_title')}
              description={getWebsiteStatsErrorMessage(
                realtimeAnalyticsQuery.error,
                '/api/analytics/realtime did not return a usable payload.',
              )}
              actionLabel={t('common.retry')}
              onAction={() => {
                void realtimeAnalyticsQuery.refetch().catch(() => null)
              }}
            />
          ) : realtimeRows.length === 0 ? (
            <EmptyStateBlock
              eyebrow={t('ceo.website.realtime_eyebrow')}
              title={t('ceo.website.realtime_empty_title')}
              description={t('ceo.website.realtime_empty_description')}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {realtimeRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{row.label}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" dot>
                      {t('ceo.website.badge.active', { count: formatCompactNumber(row.activeUsers) })}
                    </Badge>
                    <Badge variant="secondary">
                      {t('ceo.website.badge.events', { count: formatCompactNumber(row.views) })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Leaderboard
          className="min-w-0 flex-[1_1_300px]"
          title={t('ceo.website.overview.top_audience', 'Top pages by audience')}
          badge={rangeBadge}
          entries={audienceLeaders}
          emptyState={(
            <p className="py-8 text-center text-[13px] text-[var(--on-inverse-muted)]">
              {t('ceo.website.overview.no_audience', 'No audience data yet.')}
            </p>
          )}
        />
      </div>

      <Card noPadding>
        <CardHeader>
          <CardTitle>{t('ceo.website.top_pages_title')}</CardTitle>
          <CardDescription>{t('ceo.website.top_pages_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsQuery.isLoading && !analyticsQuery.data ? (
            <LoadingStateBlock
              eyebrow={t('ceo.website.section.analytics_eyebrow')}
              title={t('ceo.website.loading_title')}
              description={t('ceo.website.loading_description')}
            />
          ) : analyticsQuery.isError && !analyticsQuery.data ? (
            <ErrorStateBlock
              eyebrow={t('ceo.website.section.analytics_eyebrow')}
              title={t('ceo.website.error_title')}
              description={getWebsiteStatsErrorMessage(
                analyticsQuery.error,
                '/api/analytics did not return a usable payload.',
              )}
              actionLabel={t('common.retry')}
              onAction={() => {
                void analyticsQuery.refetch().catch(() => null)
              }}
            />
          ) : (
            <DataTable
              caption={t('ceo.website.top_pages_title')}
              rows={analyticsTopPages}
              getRowKey={(row) => row.id}
              pageSize={8}
              emptyState={(
                <EmptyStateBlock
                  eyebrow={t('ceo.website.section.analytics_eyebrow')}
                  title={t('ceo.website.empty_title')}
                  description={t('ceo.website.empty_description')}
                />
              )}
              columns={[
                {
                  key: 'page',
                  header: t('ceo.website.table.page'),
                  width: '320px',
                  render: (row) => (
                    <div className="max-w-[320px]">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{row.title}</p>
                    </div>
                  ),
                },
                {
                  key: 'views',
                  header: t('ceo.website.table.views'),
                  align: 'right',
                  render: (row) => (
                    <span data-ui-number="true" className="font-semibold">{formatCompactNumber(row.views)}</span>
                  ),
                },
                {
                  key: 'users',
                  header: t('ceo.website.table.users'),
                  align: 'right',
                  render: (row) => (
                    <span data-ui-number="true" className="text-[var(--muted-strong)]">{formatCompactNumber(row.users)}</span>
                  ),
                },
                {
                  key: 'sessions',
                  header: t('ceo.website.table.sessions'),
                  align: 'right',
                  render: (row) => (
                    <span data-ui-number="true" className="text-[var(--muted-strong)]">{formatCompactNumber(row.sessions)}</span>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
