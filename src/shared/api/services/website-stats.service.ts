import { env } from '../../config/env'
import { request } from '../http'

const websiteStatsApiBaseUrl = env.websiteStatsApiBaseUrl

export type WebsiteAnalyticsRow = {
  dimensions: Record<string, string>
  metrics: Record<string, number>
}

export type WebsiteAnalyticsReport = {
  summary: Record<string, number>
  rows: WebsiteAnalyticsRow[]
  raw: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') {
    return payload
  }

  const trimmed = payload.trim()

  if (!trimmed) {
    return ''
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return payload
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function pickNestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (isRecord(value)) {
      return value
    }
  }

  return null
}

function normalizeMetricBag(source: unknown): Record<string, number> {
  if (!isRecord(source)) {
    return {}
  }

  const result: Record<string, number> = {}

  Object.entries(source).forEach(([key, value]) => {
    const parsed = toNumber(value)

    if (parsed !== null) {
      result[key] = parsed
    }
  })

  return result
}

function parseGaHeaderNames(source: unknown) {
  if (!Array.isArray(source)) {
    return []
  }

  return source.map((entry, index) => {
    if (isRecord(entry)) {
      return pickString(entry, ['name']) ?? `value_${index + 1}`
    }

    return `value_${index + 1}`
  })
}

function normalizeAnalyticsRowsFromGaLike(record: Record<string, unknown>) {
  const dimensionNames = parseGaHeaderNames(record.dimensionHeaders)
  const metricNames = parseGaHeaderNames(record.metricHeaders)
  const rows = Array.isArray(record.rows) ? record.rows : []

  const normalizedRows = rows
    .map((entry) => {
      if (!isRecord(entry)) {
        return null
      }

      const dimensionValues = Array.isArray(entry.dimensionValues) ? entry.dimensionValues : []
      const metricValues = Array.isArray(entry.metricValues) ? entry.metricValues : []

      const dimensions = Object.fromEntries(
        dimensionNames.map((name, index) => [
          name,
          isRecord(dimensionValues[index]) ? pickString(dimensionValues[index], ['value']) ?? '' : '',
        ]),
      )

      const metrics = Object.fromEntries(
        metricNames.map((name, index) => [
          name,
          isRecord(metricValues[index]) ? toNumber(metricValues[index].value) ?? 0 : 0,
        ]),
      )

      return { dimensions, metrics } satisfies WebsiteAnalyticsRow
    })
    .filter((entry): entry is WebsiteAnalyticsRow => Boolean(entry))

  const totalsSource = Array.isArray(record.totals) ? record.totals[0] : null
  const totalsMetricValues = isRecord(totalsSource) && Array.isArray(totalsSource.metricValues)
    ? totalsSource.metricValues
    : []
  const totals = Object.fromEntries(
    metricNames.map((name, index) => [
      name,
      isRecord(totalsMetricValues[index]) ? toNumber(totalsMetricValues[index].value) ?? 0 : 0,
    ]),
  )

  return {
    rows: normalizedRows,
    summary: totals,
  }
}

function normalizeAnalyticsRowsFromArray(source: unknown): WebsiteAnalyticsRow[] {
  if (!Array.isArray(source)) {
    return []
  }

  return source
    .map((entry) => {
      if (!isRecord(entry)) {
        return null
      }

      const dimensions: Record<string, string> = {}
      const metrics: Record<string, number> = {}

      Object.entries(entry).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          dimensions[key] = value.trim()
          return
        }

        const parsed = toNumber(value)

        if (parsed !== null) {
          metrics[key] = parsed
        }
      })

      if (Object.keys(dimensions).length === 0 && Object.keys(metrics).length === 0) {
        return null
      }

      return { dimensions, metrics } satisfies WebsiteAnalyticsRow
    })
    .filter((entry): entry is WebsiteAnalyticsRow => Boolean(entry))
}

function summarizeAnalyticsRows(rows: WebsiteAnalyticsRow[]) {
  return rows.reduce<Record<string, number>>((summary, row) => {
    Object.entries(row.metrics).forEach(([key, value]) => {
      summary[key] = (summary[key] ?? 0) + value
    })

    return summary
  }, {})
}

function normalizeAnalyticsReport(payload: unknown): WebsiteAnalyticsReport {
  const parsed = parsePayload(payload)

  if (!isRecord(parsed)) {
    return {
      summary: {},
      rows: [],
      raw: parsed,
    }
  }

  const gaLike = normalizeAnalyticsRowsFromGaLike(parsed)

  if (gaLike.rows.length > 0 || Object.keys(gaLike.summary).length > 0) {
    return {
      summary: Object.keys(gaLike.summary).length > 0 ? gaLike.summary : summarizeAnalyticsRows(gaLike.rows),
      rows: gaLike.rows,
      raw: parsed,
    }
  }

  const summarySource =
    pickNestedRecord(parsed, ['summary', 'metrics', 'totals']) ??
    pickNestedRecord(parsed, ['data']) ??
    null
  const nestedData = isRecord(parsed.data) ? parsed.data : null
  const rowSource =
    ['rows', 'topPages', 'pages', 'items', 'results', 'data']
      .map((key) => parsed[key])
      .find(Array.isArray) ??
    (nestedData ? ['rows', 'topPages', 'pages', 'items', 'results'].map((key) => nestedData[key]).find(Array.isArray) : null)

  const rows = normalizeAnalyticsRowsFromArray(rowSource)
  const summary = normalizeMetricBag(summarySource)

  return {
    summary: Object.keys(summary).length > 0 ? summary : summarizeAnalyticsRows(rows),
    rows,
    raw: parsed,
  }
}

export const websiteStatsService = {
  apiBaseUrl: websiteStatsApiBaseUrl,

  getAnalytics(params?: { startDate?: string; endDate?: string; days?: number }) {
    return request<unknown>({
      path: new URL('/api/analytics', websiteStatsApiBaseUrl).toString(),
      query: {
        startDate: params?.startDate,
        endDate: params?.endDate,
        days: params?.days,
      },
    }).then(normalizeAnalyticsReport)
  },

  getRealtimeAnalytics() {
    return request<unknown>({
      path: new URL('/api/analytics/realtime', websiteStatsApiBaseUrl).toString(),
    }).then(normalizeAnalyticsReport)
  },
}
