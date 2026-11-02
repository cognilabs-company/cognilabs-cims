import type { WorkdayOverrideDayType } from '../../../shared/api/services/updateTracking.service'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'

const lt = translateCurrentLiteral

export function normalizeDayType(value: string | null | undefined): WorkdayOverrideDayType {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, '_')
  return normalized === 'short_day' ? 'short_day' : 'holiday'
}

export function getOverrideTypeLabel(dayType: string | null | undefined) {
  return normalizeDayType(dayType) === 'short_day' ? lt('Short Day') : lt('Holiday')
}

export function getTypeBadgeVariant(dayType: string | null | undefined) {
  return normalizeDayType(dayType) === 'short_day' ? 'blue' : 'warning'
}
