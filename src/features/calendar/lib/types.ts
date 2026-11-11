export type EventKind = 'callback' | 'task' | 'holiday' | 'short_day' | 'personal'

/** One item on the calendar, from any source. */
export type CalEvent = {
  /** Unique across sources, e.g. "callback:12". */
  id: string
  kind: EventKind
  title: string
  /** ISO date-time (or a "YYYY-MM-DD" day for all-day items). */
  start: string
  end: string | null
  allDay: boolean
  color: string
  note?: string | null
  customerId?: number
  status?: string | null
  phone?: string | null
  boardId?: number
  projectName?: string
  boardName?: string
  columnName?: string
  priority?: string | null
  hours?: string | null
  member?: string | null
  /** Personal events: the stored record id. */
  personalId?: string
}

/** A user's own event (kept in this browser until the backend has a calendar API). */
export type PersonalEvent = {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  allDay: boolean
  /** HH:MM */
  startTime: string
  endTime: string
  color: string
  note: string
  createdAt: string
}

export const KIND_COLORS: Record<EventKind, string> = {
  callback: '#2B59FF',
  task: '#E8590C',
  holiday: '#E5484D',
  short_day: '#0EA5E9',
  personal: '#17924A',
}

export const KINDS: EventKind[] = ['callback', 'task', 'holiday', 'short_day', 'personal']

/** Colours a personal event can have (no purple). */
export const PERSONAL_COLORS = ['#17924A', '#2B59FF', '#0EA5E9', '#E8590C', '#E5484D', '#64748B'] as const

export type CalendarView = 'month' | 'week' | 'list'
