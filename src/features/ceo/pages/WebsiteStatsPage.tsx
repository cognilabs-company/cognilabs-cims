import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { websiteStatsService, type WebsiteAnalyticsRow } from '../../../shared/api/services/website-stats.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { formatCompactNumber } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { useAuth } from '../../auth/hooks/useAuth'
import { MetricCard } from '../components/MetricCard'

const analyticsRangeOptions: SelectFieldOption[] = [
  { value: '7', label: 'ceo.website.range.last_7_days' },
  { value: '30', label: 'ceo.website.range.last_30_days' },
  { value: '90', label: 'ceo.website.range.last_90_days' },
]
const trackedWebsiteUrl = 'https://www.cognilabs.org/en'

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
  const [analyticsRange, setAnalyticsRange] = useState('30')

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

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="CEO / Web"
        title={t('ceo.website.header.title')}
        description={t('ceo.website.header.description', { url: trackedWebsiteUrl })}
        meta={[
          {
            label: t('ceo.website.meta.tracked_site'),
            value: 'cognilabs.org/en',
            hint: trackedWebsiteUrl,
            tone: 'neutral',
          },
          {
            label: t('ceo.website.meta.range'),
            value: `${analyticsWindow.days} days`,
            hint: `${analyticsWindow.startDate} to ${analyticsWindow.endDate}`,
            tone: 'neutral',
          },
          {
            label: t('ceo.website.meta.page_views'),
            value: formatCompactNumber(pageViewsMetric),
            hint: t('ceo.website.meta.page_views_hint'),
            tone: 'blue',
          },
          {
            label: t('ceo.website.meta.users'),
            value: formatCompactNumber(totalUsersMetric),
            hint: t('ceo.website.meta.users_hint'),
            tone: 'success',
          },
          {
            label: t('ceo.website.meta.realtime_active'),
            value: formatCompactNumber(realtimeActiveUsersMetric),
            hint: t('ceo.website.meta.realtime_active_hint'),
            tone: 'warning',
          },
        ]}
        actions={(
          <Button variant="secondary" onClick={() => void handleRefresh()}>
            {t('ceo.website.actions.refresh')}
          </Button>
        )}
      />

      <Card noPadding>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('ceo.website.section.analytics_title')}</CardTitle>
          <div className="w-full max-w-[180px]">
            <SelectField
              value={analyticsRange}
              options={analyticsRangeOptions.map((option) => ({ ...option, label: t(option.label) }))}
              onValueChange={setAnalyticsRange}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('ceo.website.metric.page_views')}
            value={formatCompactNumber(pageViewsMetric)}
            accent="blue"
            sparkBars={[1, Math.max(pageViewsMetric * 0.35, 1), Math.max(pageViewsMetric * 0.58, 1), Math.max(pageViewsMetric * 0.82, 1), Math.max(pageViewsMetric, 1)]}
          />
          <MetricCard
            label={t('ceo.website.metric.users')}
            value={formatCompactNumber(totalUsersMetric)}
            accent="success"
            sparkBars={[1, Math.max(totalUsersMetric * 0.32, 1), Math.max(totalUsersMetric * 0.54, 1), Math.max(totalUsersMetric * 0.78, 1), Math.max(totalUsersMetric, 1)]}
          />
          <MetricCard
            label={t('ceo.website.metric.sessions')}
            value={formatCompactNumber(sessionsMetric)}
            accent="violet"
            sparkBars={[1, Math.max(sessionsMetric * 0.3, 1), Math.max(sessionsMetric * 0.56, 1), Math.max(sessionsMetric * 0.8, 1), Math.max(sessionsMetric, 1)]}
          />
          <MetricCard
            label={t('ceo.website.metric.realtime_active')}
            value={formatCompactNumber(realtimeActiveUsersMetric)}
            accent="warning"
            sparkBars={[1, Math.max(realtimeActiveUsersMetric * 0.4, 1), Math.max(realtimeActiveUsersMetric * 0.7, 1), Math.max(realtimeActiveUsersMetric, 1)]}
          />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
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
                zebra
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
                        <p className="truncate font-semibold text-(--foreground)">{row.title}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'views',
                    header: t('ceo.website.table.views'),
                    align: 'right',
                    render: (row) => formatCompactNumber(row.views),
                  },
                  {
                    key: 'users',
                    header: t('ceo.website.table.users'),
                    align: 'right',
                    render: (row) => formatCompactNumber(row.users),
                  },
                  {
                    key: 'sessions',
                    header: t('ceo.website.table.sessions'),
                    align: 'right',
                    render: (row) => formatCompactNumber(row.sessions),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card noPadding>
          <CardHeader>
            <CardTitle>{t('ceo.website.realtime_title')}</CardTitle>
            <CardDescription>{t('ceo.website.realtime_description')}</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-3">
                {realtimeRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-(--foreground)">{row.label}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning" dot>
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
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
