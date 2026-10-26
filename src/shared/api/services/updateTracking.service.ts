import { request } from '../http'
import type { CompanyStatsResponse, UpdateTrackingStats } from '../types'

export type WorkdayOverrideDayType = 'holiday' | 'short_day' | (string & {})

export type WorkdayOverrideMemberOption = {
  id: number
  name: string
  surname: string
  full_name: string
  role: string
  telegram_id?: string | null
  profile_image?: string | null
}

export type WorkdayOverrideRecord = {
  id: number
  special_date: string
  day_type: WorkdayOverrideDayType
  title: string
  note?: string | null
  target_type: string
  member_id?: number | null
  member_name?: string | null
  workday_hours?: string | null
  update_required: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export type CreateWorkdayOverridePayload = {
  special_date: string
  day_type: WorkdayOverrideDayType
  title: string
  note?: string
  applies_to_all: boolean
  member_ids?: number[]
  workday_hours?: number
  update_required: boolean
}

export type UpdateWorkdayOverridePayload = {
  special_date: string
  day_type: WorkdayOverrideDayType
  title: string
  note?: string
  applies_to_all: boolean
  member_id?: number | null
  workday_hours?: number
  update_required: boolean
}

export type WorkdayOverrideListParams = {
  month?: number
  year?: number
  startDate?: string
  endDate?: string
}

const emptyStats: UpdateTrackingStats = {
  user_id: 0,
  user_name: '',
  total_updates: 0,
  updates_this_week: 0,
  updates_last_week: 0,
  updates_this_month: 0,
  updates_last_month: 0,
  updates_last_3_months: 0,
  percentage_this_week: 0,
  percentage_last_week: 0,
  percentage_this_month: 0,
  percentage_last_3_months: 0,
  expected_updates_per_week: 0,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

function findFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function hasStatsShape(source: Record<string, unknown>) {
  return [
    'total_updates',
    'updates_this_week',
    'updates_this_month',
    'percentage_this_week',
    'percentage_this_month',
    'expected_updates_per_week',
  ].some((key) => key in source)
}

function normalizeStatsPayload(payload: unknown): UpdateTrackingStats {
  const parsed = parsePayload(payload)

  if (!isRecord(parsed)) {
    return emptyStats
  }

  const nestedCandidates = [parsed, ...Object.values(parsed).filter(isRecord)]
  const source = nestedCandidates.find(hasStatsShape) ?? parsed

  return {
    user_id: toNumber(source.user_id ?? source.id) ?? emptyStats.user_id,
    user_name: findFirstString(source, ['user_name', 'full_name', 'name']) ?? emptyStats.user_name,
    total_updates: toNumber(source.total_updates ?? source.total_submitted ?? source.updates_count) ?? emptyStats.total_updates,
    updates_this_week: toNumber(source.updates_this_week ?? source.this_week_updates) ?? emptyStats.updates_this_week,
    updates_last_week: toNumber(source.updates_last_week ?? source.last_week_updates) ?? emptyStats.updates_last_week,
    updates_this_month: toNumber(source.updates_this_month ?? source.this_month_updates) ?? emptyStats.updates_this_month,
    updates_last_month: toNumber(source.updates_last_month ?? source.last_month_updates) ?? emptyStats.updates_last_month,
    updates_last_3_months: toNumber(source.updates_last_3_months ?? source.last_3_months_updates) ?? emptyStats.updates_last_3_months,
    percentage_this_week: toNumber(source.percentage_this_week ?? source.weekly_percentage ?? source.completion_this_week) ?? emptyStats.percentage_this_week,
    percentage_last_week: toNumber(source.percentage_last_week ?? source.last_week_percentage) ?? emptyStats.percentage_last_week,
    percentage_this_month: toNumber(source.percentage_this_month ?? source.monthly_percentage ?? source.completion_this_month) ?? emptyStats.percentage_this_month,
    percentage_last_3_months: toNumber(source.percentage_last_3_months ?? source.last_3_months_percentage) ?? emptyStats.percentage_last_3_months,
    expected_updates_per_week: toNumber(source.expected_updates_per_week ?? source.weekly_target ?? source.expected_weekly_updates) ?? emptyStats.expected_updates_per_week,
  }
}

function is404Error(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  return 'status' in error && (error as { status?: unknown }).status === 404
}

export const updateTrackingService = {
  async myStats() {
    try {
      const payload = await request<unknown>({
        path: '/update-tracking/stats/me',
        query: {
          detailed: false,
        },
      })

      return normalizeStatsPayload(payload)
    } catch (error) {
      if (!is404Error(error)) {
        throw error
      }

      const fallbacks = [
        () => request<unknown>({ path: '/update-tracking/my-profile' }),
        () => request<unknown>({ path: '/update-tracking/my-combined-report' }),
        () => request<unknown>({ path: '/update-tracking/my-report' }),
      ]

      for (const loadFallback of fallbacks) {
        try {
          return normalizeStatsPayload(await loadFallback())
        } catch {
          continue
        }
      }

      return emptyStats
    }
  },

  myProfile() {
    return request<unknown>({
      path: '/update-tracking/my-profile',
    })
  },

  myReport(month?: number, year?: number) {
    return request<unknown>({
      path: '/update-tracking/my-report',
      query: { month, year },
    })
  },

  myCombinedReport(month?: number, year?: number) {
    return request<unknown>({
      path: '/update-tracking/my-combined-report',
      query: { month, year },
    })
  },

  monthlyReport(month?: number, year?: number) {
    return request<unknown>({
      path: '/update-tracking/my-monthly-report',
      query: { month, year },
    })
  },

  calendar(month?: number, year?: number) {
    return request<unknown>({
      path: '/update-tracking/my-daily-calendar',
      query: { month, year },
    })
  },

  trends() {
    return request<unknown>({
      path: '/update-tracking/my-trends',
    })
  },

  recent(limit = 20, userId?: number) {
    return request<unknown>({
      path: '/update-tracking/recent',
      query: { limit, user_id: userId },
    })
  },

  processDailyNotifications(targetDate?: string) {
    return request<string>({
      path: '/update-tracking/process-daily-notifications',
      method: 'POST',
      query: { target_date: targetDate },
    })
  },

  missing(date?: string) {
    return request<unknown>({
      path: '/update-tracking/missing',
      query: { date_check: date },
    })
  },

  companyStats() {
    return request<CompanyStatsResponse>({
      path: '/update-tracking/company-stats',
    })
  },

  teamMonthly(month?: number, year?: number) {
    return request<unknown>({
      path: '/update-tracking/all-users-updates',
      query: { month, year },
    })
  },

  employeeMonthlyUpdates(year: number, month: number, employeeId?: number) {
    return request<unknown>({
      path: '/update-tracking/employee-monthly-updates',
      query: { year, month, employee_id: employeeId },
    })
  },

  workdayOverrideMemberOptions() {
    return request<WorkdayOverrideMemberOption[]>({
      path: '/update-tracking/workday-overrides/member-options',
    })
  },

  workdayOverrides(params?: WorkdayOverrideListParams) {
    return request<WorkdayOverrideRecord[]>({
      path: '/update-tracking/workday-overrides',
      query: {
        month: params?.month,
        year: params?.year,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    })
  },

  createWorkdayOverride(payload: CreateWorkdayOverridePayload) {
    return request<{
      message: string
      items: WorkdayOverrideRecord[]
    }>({
      path: '/update-tracking/workday-overrides',
      method: 'POST',
      body: payload,
    })
  },

  updateWorkdayOverride(overrideId: number, payload: UpdateWorkdayOverridePayload) {
    return request<WorkdayOverrideRecord>({
      path: `/update-tracking/workday-overrides/${overrideId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteWorkdayOverride(overrideId: number) {
    return request<string>({
      path: `/update-tracking/workday-overrides/${overrideId}`,
      method: 'DELETE',
    })
  },
}
