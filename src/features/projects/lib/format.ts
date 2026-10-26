import type { CardPriority } from '../../../shared/api/services/projects.service'
import { getStoredLocale, translateCurrent } from '../../../shared/i18n/translations'
import { formatShortDate as formatSharedShortDate, formatShortDateTime as formatSharedShortDateTime } from '../../../shared/lib/format'

function parseProjectDate(value?: string | null): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Format ISO date string to short human-readable form */
export function formatProjectDate(date?: string | null): string {
  const parsed = parseProjectDate(date)

  if (!parsed) {
    return translateCurrent('projects.unknown_date', 'Unknown date')
  }

  return formatSharedShortDate(date, getStoredLocale())
}

export function formatProjectDateTime(date?: string | null): string {
  const parsed = parseProjectDate(date)

  if (!parsed) {
    return translateCurrent('projects.unknown_date', 'Unknown date')
  }

  if (typeof date === 'string' && /(?:T| )\d{1,2}:\d{2}/.test(date)) {
    return formatSharedShortDateTime(date, getStoredLocale())
  }

  return formatSharedShortDate(date, getStoredLocale())
}

/** Get relative time label (e.g. "2 days ago") */
export function formatRelativeDate(date?: string | null): string {
  const parsed = parseProjectDate(date)

  if (!parsed) {
    return ''
  }

  const now = Date.now()
  const then = parsed.getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return translateCurrent('projects.relative.upcoming', 'Upcoming')
  if (diffDays === 0) return translateCurrent('projects.relative.today', 'Today')
  if (diffDays === 1) return translateCurrent('projects.relative.yesterday', 'Yesterday')
  if (diffDays < 7) return translateCurrent('projects.relative.days_ago', '{count}d ago', { count: diffDays })
  if (diffDays < 30) return translateCurrent('projects.relative.weeks_ago', '{count}w ago', { count: Math.floor(diffDays / 7) })
  if (diffDays < 365) return translateCurrent('projects.relative.months_ago', '{count}mo ago', { count: Math.floor(diffDays / 30) })
  return translateCurrent('projects.relative.years_ago', '{count}y ago', { count: Math.floor(diffDays / 365) })
}

/** Check if a due date is overdue */
export function isDueDateOverdue(dueDate?: string | null): boolean {
  const parsed = parseProjectDate(dueDate)
  return parsed ? parsed.getTime() < Date.now() : false
}

/** Check if a due date is due soon (within 2 days) */
export function isDueDateSoon(dueDate?: string | null): boolean {
  const parsed = parseProjectDate(dueDate)

  if (!parsed) {
    return false
  }

  const diff = parsed.getTime() - Date.now()
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000
}

export type PriorityDisplayConfig = {
  label: string
  color: string
  badgeVariant: 'danger' | 'warning' | 'blue' | 'secondary'
}

/** Priority display config */
export function getPriorityConfig(): Record<CardPriority, PriorityDisplayConfig> {
  return {
    urgent: { label: translateCurrent('projects.priority.urgent', 'Urgent'), color: '#f87171', badgeVariant: 'danger' },
    high: { label: translateCurrent('projects.priority.high', 'High'), color: '#fb923c', badgeVariant: 'warning' },
    medium: { label: translateCurrent('projects.priority.medium', 'Medium'), color: '#60a5fa', badgeVariant: 'blue' },
    low: { label: translateCurrent('projects.priority.low', 'Low'), color: '#71717a', badgeVariant: 'secondary' },
  }
}

/** Column preset colours */
export function getColumnColors(): { label: string; value: string }[] {
  return [
    { label: translateCurrent('projects.color.blue', 'Blue'), value: '#3b82f6' },
    { label: translateCurrent('projects.color.violet', 'Violet'), value: '#8b5cf6' },
    { label: translateCurrent('projects.color.green', 'Green'), value: '#22c55e' },
    { label: translateCurrent('projects.color.amber', 'Amber'), value: '#f59e0b' },
    { label: translateCurrent('projects.color.red', 'Red'), value: '#ef4444' },
    { label: translateCurrent('projects.color.pink', 'Pink'), value: '#ec4899' },
    { label: translateCurrent('projects.color.cyan', 'Cyan'), value: '#06b6d4' },
    { label: translateCurrent('projects.color.slate', 'Slate'), value: '#64748b' },
  ]
}

/** Get initials from name + surname */
export function getInitials(name?: string | null, surname?: string | null): string {
  const firstName = typeof name === 'string' ? name.trim() : ''
  const lastName = typeof surname === 'string' ? surname.trim() : ''
  const first = firstName.charAt(0).toUpperCase()
  const last = lastName.charAt(0).toUpperCase()

  if (first || last) {
    return `${first}${last}`
  }

  return '?'
}

/** Deterministic hue from string (for avatar colors) */
export function stringToHue(str?: string | null): number {
  const value = typeof str === 'string' ? str : ''

  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

/** Snooze date presets */
export function getSnoozePresets(): { label: string; date: Date }[] {
  const now = new Date()

  const laterToday = new Date(now)
  laterToday.setHours(now.getHours() + 3, 0, 0, 0)

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(9, 0, 0, 0)

  return [
    { label: translateCurrent('projects.snooze.later_today', 'Later today'), date: laterToday },
    { label: translateCurrent('projects.snooze.tomorrow', 'Tomorrow'), date: tomorrow },
    { label: translateCurrent('projects.snooze.next_week', 'Next week'), date: nextWeek },
  ]
}
