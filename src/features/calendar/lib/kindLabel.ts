import type { CalendarRecurrence } from '../../../shared/api/services/calendar.service'
import type { EventKind } from './types'

type T = (key: string, fallback?: string, params?: Record<string, string | number>) => string

export function kindLabel(kind: EventKind, t: T) {
  switch (kind) {
    case 'recall': return t('calendar.kind.recall', 'Callback')
    case 'meeting': return t('calendar.kind.meeting', 'Meeting')
    case 'call': return t('calendar.kind.call', 'Call')
    case 'task': return t('calendar.kind.task', 'Task deadline')
    case 'holiday': return t('calendar.kind.holiday', 'Holiday')
    case 'short_day': return t('calendar.kind.short_day', 'Short day')
    default: return t('calendar.kind.manual', 'Event')
  }
}

export function recurrenceLabel(value: CalendarRecurrence, t: T) {
  switch (value) {
    case 'daily': return t('calendar.repeat.daily', 'Every day')
    case 'weekly': return t('calendar.repeat.weekly', 'Every week')
    case 'monthly': return t('calendar.repeat.monthly', 'Every month')
    default: return t('calendar.repeat.none', 'Does not repeat')
  }
}
