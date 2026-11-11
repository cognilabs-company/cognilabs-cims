import type { CalendarRecurrence } from '../../../shared/api/services/calendar.service'

/** What a calendar item is. recall / meeting come from the CRM, manual are events people add. */
export type EventKind = 'manual' | 'meeting' | 'recall' | 'task' | 'holiday' | 'short_day'

/** One item on the calendar, from any source. */
export type CalEvent = {
  /** Unique across sources and occurrences, e.g. "manual:12:2026-11-15". */
  id: string
  kind: EventKind
  title: string
  /** ISO date-time with offset (or a "YYYY-MM-DD" day for all-day items). */
  start: string
  end: string | null
  allDay: boolean
  color: string
  note?: string | null
  // CRM
  customerId?: number
  status?: string | null
  phone?: string | null
  assignedName?: string | null
  // Tasks
  boardId?: number
  projectName?: string
  boardName?: string
  columnName?: string
  priority?: string | null
  // Holidays / short days
  hours?: string | null
  member?: string | null
  // Manual events (backend)
  /** The base id — edits and deletes of a recurring event always use it. */
  baseId?: string
  recurrence?: CalendarRecurrence
  recurrenceUntil?: string | null
  reminder?: boolean
  participantIds?: number[]
  participantNames?: string[]
  createdById?: number | null
  createdByName?: string | null
}

export const KIND_COLORS: Record<EventKind, string> = {
  manual: '#17924A',
  meeting: '#0D9488',
  recall: '#2B59FF',
  task: '#E8590C',
  holiday: '#E5484D',
  short_day: '#0EA5E9',
}

export const KINDS: EventKind[] = ['manual', 'meeting', 'recall', 'task', 'holiday', 'short_day']

/** Which kinds belong to which source filter. */
export const SOURCE_KINDS: Record<'all' | 'manual' | 'crm' | 'other', EventKind[]> = {
  all: KINDS,
  manual: ['manual'],
  crm: ['meeting', 'recall'],
  other: ['task', 'holiday', 'short_day'],
}

export type CalendarView = 'month' | 'week' | 'list'

/** The form behind "New event" / "Edit". Times are Tashkent wall-clock HH:MM. */
export type EventDraft = {
  baseId: string | null
  title: string
  description: string
  /** YYYY-MM-DD */
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  reminder: boolean
  recurrence: CalendarRecurrence
  /** YYYY-MM-DD, only when recurrence is not "none". */
  until: string
  participantIds: number[]
}
