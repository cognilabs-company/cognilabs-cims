import { request } from '../http'
import { asDict, candidatesOf, listOf, nameOf, num, recipientsOf, str, type Dict } from './botRecipients'

/* ──────────────────────────────────────────────────────────────
   Attendance notifications — /attendance/notifications (CIMS_ATTENDANCE_NOTIFICATIONS_FRONTEND.md).
   CEO only. The CIMS bot tells the chosen people when employees check in / out (Mini App, manual
   check-out and FaceID); the frontend only manages settings and recipients.
   Responses are not typed in the OpenAPI schema, so readers are defensive.
   ────────────────────────────────────────────────────────────── */

export type AttendanceNotificationSettings = {
  enabled: boolean
  check_in_enabled: boolean
  check_out_enabled: boolean
  /** Not in the contract today; read in case the backend starts sending it. */
  bot_username: string | null
  updated_at: string | null
}

export type AttendanceNotificationSettingsPatch = Partial<Pick<AttendanceNotificationSettings, 'enabled' | 'check_in_enabled' | 'check_out_enabled'>>

export type NotificationEventType = 'check_in' | 'check_out' | 'other'
export type NotificationLogStatus = 'sent' | 'failed' | 'pending' | 'skipped' | 'other'

export type NotificationLog = {
  id: string
  employee: string | null
  recipient: string | null
  eventType: NotificationEventType
  /** The raw event type when it is neither check-in nor check-out. */
  eventLabel: string | null
  source: string | null
  status: NotificationLogStatus
  statusLabel: string | null
  error: string | null
  sentAt: string | null
  createdAt: string | null
}

export type NotificationLogsPage = {
  items: NotificationLog[]
  page: number
  pageSize: number
  total: number | null
  totalPages: number
}

function normalizeSettings(raw: unknown): AttendanceNotificationSettings {
  const data = asDict(raw)
  return {
    enabled: data.enabled === true,
    check_in_enabled: data.check_in_enabled !== false,
    check_out_enabled: data.check_out_enabled !== false,
    bot_username: str(data.bot_username)?.replace(/^@/, '') ?? null,
    updated_at: str(data.updated_at),
  }
}

function personOf(data: Dict, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object') {
      const name = nameOf(asDict(value))
      if (name) return name
    }
  }
  return null
}

function eventTypeOf(value: string | null): NotificationEventType {
  const key = (value ?? '').toLowerCase().replace(/[\s-]/g, '_')
  if (/check_?in|arriv|entry|^in$/.test(key)) return 'check_in'
  if (/check_?out|leav|exit|^out$/.test(key)) return 'check_out'
  return 'other'
}

function statusOf(value: string | null): NotificationLogStatus {
  switch ((value ?? '').toLowerCase()) {
    case 'sent': case 'delivered': case 'ready': case 'success': case 'ok': return 'sent'
    case 'failed': case 'error': case 'blocked': case 'not_started': return 'failed'
    case 'pending': case 'queued': case 'retrying': case 'sending': return 'pending'
    case 'skipped': case 'disabled': case 'ignored': return 'skipped'
    default: return 'other'
  }
}

function normalizeLog(raw: unknown, index: number): NotificationLog {
  const data = asDict(raw)
  const eventRaw = str(data.event_type) ?? str(data.event) ?? str(data.type)
  const statusRaw = str(data.status) ?? str(data.delivery_status)
  const eventType = eventTypeOf(eventRaw)
  return {
    id: str(data.id) ?? (num(data.id) !== null ? String(data.id) : `log-${index}`),
    employee: personOf(data, ['employee_name', 'employee_full_name', 'employee', 'user_name', 'user']),
    recipient: personOf(data, ['recipient_name', 'recipient_full_name', 'recipient_user', 'recipient']),
    eventType,
    eventLabel: eventType === 'other' ? eventRaw : null,
    source: str(data.source) ?? str(data.event_source) ?? str(data.origin),
    status: statusOf(statusRaw),
    statusLabel: statusRaw,
    error: str(data.error) ?? str(data.last_error) ?? str(data.error_message),
    sentAt: str(data.sent_at) ?? str(data.delivered_at),
    createdAt: str(data.created_at) ?? str(data.event_time) ?? str(data.occurred_at),
  }
}

function normalizeLogs(raw: unknown, requested: { page: number; pageSize: number }): NotificationLogsPage {
  const data = asDict(raw)
  const meta = { ...data, ...asDict(data.meta), ...asDict(data.pagination) }
  const items = listOf(raw).map(normalizeLog)
  const pageSize = Math.max(1, num(meta.page_size) ?? num(meta.per_page) ?? num(meta.limit) ?? requested.pageSize)
  const total = num(meta.total) ?? num(meta.total_items) ?? num(meta.count)
  const pages = num(meta.total_pages) ?? num(meta.pages) ?? num(meta.page_count)
  const page = num(meta.page) ?? requested.page
  const hasNext = meta.has_next === true
  const totalPages = Math.max(1, pages ?? (total !== null ? Math.ceil(total / pageSize) : hasNext || items.length >= pageSize ? page + 1 : page))
  return { items, page, pageSize, total, totalPages }
}

const recipientPath = (id: number) => `/attendance/notifications/recipients/${id}`

export const attendanceNotificationsService = {
  async settings() {
    return normalizeSettings(await request<unknown>({ path: '/attendance/notifications/settings' }))
  },

  /** Only the changed fields (an empty body is a 422). */
  async updateSettings(patch: AttendanceNotificationSettingsPatch) {
    return normalizeSettings(await request<unknown>({ path: '/attendance/notifications/settings', method: 'PATCH', body: patch }))
  },

  async candidates(search: string) {
    return candidatesOf(await request<unknown>({ path: '/attendance/notifications/recipient-candidates', query: { search: search.trim() || undefined } }))
  },

  async recipients() {
    return recipientsOf(await request<unknown>({ path: '/attendance/notifications/recipients' }))
  },

  /** 201 new / 200 reactivated. */
  addRecipient(userId: number) {
    return request<unknown>({ path: '/attendance/notifications/recipients', method: 'POST', body: { user_id: userId } })
  },

  setActive(id: number, isActive: boolean) {
    return request<unknown>({ path: recipientPath(id), method: 'PATCH', body: { is_active: isActive } })
  },

  /** Soft remove (204). */
  remove(id: number) {
    return request<void>({ path: recipientPath(id), method: 'DELETE' })
  },

  /** A real test message from the CIMS bot: { status: "ready" }, or 422 with the Telegram status. */
  test(id: number) {
    return request<unknown>({ path: `${recipientPath(id)}/test`, method: 'POST' })
  },

  async deliveryLogs(page = 1, pageSize = 50) {
    const raw = await request<unknown>({ path: '/attendance/notifications/delivery-logs', query: { page, page_size: pageSize } })
    return normalizeLogs(raw, { page, pageSize })
  },
}
