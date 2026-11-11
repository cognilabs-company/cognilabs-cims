import { request } from '../http'

/* ──────────────────────────────────────────────────────────────
   Unified calendar — /calendar (PLATFORM_FEATURES_FRONTEND.md).
   Date-times always carry an offset; the app shows them in Asia/Tashkent.
   Responses are not typed in the OpenAPI schema, so readers are defensive.
   ────────────────────────────────────────────────────────────── */

export type CalendarSource = 'all' | 'manual' | 'crm'
export type CalendarEventType = 'all' | 'manual' | 'recall' | 'meeting'
export type CalendarRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export type CalendarUser = { id: number; name: string; detail: string | null }

export type CalendarApiEvent = {
  id: string
  occurrenceId: string | null
  source: 'manual' | 'crm'
  eventType: 'manual' | 'recall' | 'meeting'
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  reminderEnabled: boolean
  recurrence: CalendarRecurrence
  recurrenceUntil: string | null
  participantIds: number[]
  participantNames: string[]
  createdById: number | null
  createdByName: string | null
  customerId: number | null
  phone: string | null
  status: string | null
  assignedName: string | null
}

export type CalendarSettings = {
  crm_recall_reminders_enabled: boolean
  crm_meeting_reminders_enabled: boolean
  reminder_minutes: number
}

export type CalendarEventPayload = {
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  reminder_enabled: boolean
  recurrence: CalendarRecurrence
  recurrence_until: string | null
  participant_ids: number[]
}

type Dict = Record<string, unknown>

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {})
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null)

function listOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const data = asDict(raw)
  for (const key of ['items', 'events', 'users', 'results', 'data']) if (Array.isArray(data[key])) return data[key] as unknown[]
  return []
}

/** "Name Surname" from whatever shape a user object has. */
export function personName(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null
  const user = asDict(raw)
  const full = str(user.full_name) ?? str(user.display_name)
  if (full) return full
  const joined = [str(user.name) ?? str(user.first_name), str(user.surname) ?? str(user.last_name)].filter(Boolean).join(' ')
  return joined || str(user.username) || str(user.email)
}

function normalizeUser(raw: unknown): CalendarUser | null {
  const user = asDict(raw)
  const id = num(user.id ?? user.user_id)
  if (id === null) return null
  return { id, name: personName(user) ?? `#${id}`, detail: str(user.job_title) ?? str(user.role_name) ?? str(user.role) }
}

function normalizeEvent(raw: unknown): CalendarApiEvent | null {
  const item = asDict(raw)
  const start = str(item.start_at)
  if (item.id === undefined || item.id === null || !start) return null
  const source = item.source === 'crm' ? 'crm' : 'manual'
  const type = item.event_type === 'meeting' ? 'meeting' : item.event_type === 'recall' ? 'recall' : source === 'crm' ? 'recall' : 'manual'
  const recurrence = item.recurrence === 'daily' || item.recurrence === 'weekly' || item.recurrence === 'monthly' ? item.recurrence : 'none'
  const participants = Array.isArray(item.participants) ? item.participants : []
  const participantIds = Array.isArray(item.participant_ids)
    ? (item.participant_ids as unknown[]).map(num).filter((value): value is number => value !== null)
    : participants.map((entry) => num(asDict(entry).id ?? asDict(entry).user_id)).filter((value): value is number => value !== null)
  const assigned = item.assigned_user ?? item.assigned_to ?? item.assignee ?? item.user
  const creator = item.created_by_user ?? item.creator ?? item.owner
  return {
    id: String(item.id),
    occurrenceId: str(item.occurrence_id) ?? (num(item.occurrence_id) !== null ? String(item.occurrence_id) : null),
    source,
    eventType: type,
    title: str(item.title) ?? str(item.customer_name) ?? '—',
    description: str(item.description) ?? str(item.note),
    startAt: start,
    endAt: str(item.end_at),
    allDay: Boolean(item.all_day),
    reminderEnabled: Boolean(item.reminder_enabled),
    recurrence,
    recurrenceUntil: str(item.recurrence_until),
    participantIds,
    participantNames: participants.map(personName).filter((value): value is string => Boolean(value)),
    createdById: num(item.created_by ?? item.created_by_id ?? asDict(creator).id),
    createdByName: personName(creator) ?? str(item.created_by_name),
    customerId: num(item.customer_id),
    phone: str(item.phone_number),
    status: str(item.status_label) ?? str(item.status),
    assignedName: personName(assigned) ?? str(item.assigned_user_name) ?? str(item.assigned_to_name),
  }
}

function normalizeSettings(raw: unknown): CalendarSettings {
  const data = asDict(raw)
  return {
    crm_recall_reminders_enabled: data.crm_recall_reminders_enabled !== false,
    crm_meeting_reminders_enabled: data.crm_meeting_reminders_enabled !== false,
    reminder_minutes: num(data.reminder_minutes) ?? 5,
  }
}

const eventPath = (id: string) => `/calendar/events/${encodeURIComponent(id)}`

export const calendarService = {
  async users() {
    return listOf(await request<unknown>({ path: '/calendar/users' })).map(normalizeUser).filter((user): user is CalendarUser => user !== null)
  },

  async settings() {
    return normalizeSettings(await request<unknown>({ path: '/calendar/settings' }))
  },

  async updateSettings(patch: Partial<CalendarSettings>) {
    return normalizeSettings(await request<unknown>({ path: '/calendar/settings', method: 'PATCH', body: patch }))
  },

  /** Manual + CRM items between two days (YYYY-MM-DD, inclusive). */
  async events(params: { dateFrom: string; dateTo: string; source?: CalendarSource; eventType?: CalendarEventType; userId?: number | null; search?: string }) {
    const raw = await request<unknown>({
      path: '/calendar/events',
      query: {
        date_from: params.dateFrom,
        date_to: params.dateTo,
        source: params.source ?? 'all',
        event_type: params.eventType ?? 'all',
        user_id: params.userId ?? undefined,
        search: params.search?.trim() || undefined,
      },
    })
    return listOf(raw).map(normalizeEvent).filter((event): event is CalendarApiEvent => event !== null)
  },

  async event(id: string) {
    return normalizeEvent(await request<unknown>({ path: eventPath(id) }))
  },

  async create(payload: CalendarEventPayload) {
    return normalizeEvent(await request<unknown>({ path: '/calendar/events', method: 'POST', body: payload }))
  },

  /** Recurring items: always the base id (never an occurrence id). */
  async update(id: string, patch: Partial<CalendarEventPayload>) {
    return normalizeEvent(await request<unknown>({ path: eventPath(id), method: 'PATCH', body: patch }))
  },

  remove(id: string) {
    return request<void>({ path: eventPath(id), method: 'DELETE' })
  },
}
