import type { EventKind } from './types'

type T = (key: string, fallback?: string, params?: Record<string, string | number>) => string

export function kindLabel(kind: EventKind, t: T) {
  switch (kind) {
    case 'callback': return t('calendar.kind.callback', 'Callback')
    case 'task': return t('calendar.kind.task', 'Task deadline')
    case 'holiday': return t('calendar.kind.holiday', 'Holiday')
    case 'short_day': return t('calendar.kind.short_day', 'Short day')
    default: return t('calendar.kind.personal', 'My event')
  }
}
