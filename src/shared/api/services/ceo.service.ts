import { request } from '../http'
import type {
  CreateResponse,
  DailyMetrics,
  PaymentItem,
  PermissionMap,
  SuccessResponse,
  UserRole,
} from '../types'

export type CeoUserRecord = {
  id: number
  email: string
  name: string
  surname: string
  company_code?: string
  telegram_id?: string | null
  default_salary?: number | null
  job_title?: string | null
  role: UserRole
  is_active: boolean
  profile_image?: string | null
} & Record<string, unknown>

export type CeoMessageRecord = {
  id: number
  receiver_name: string
  receiver_email: string
  subject: string
  body: string
  sent_at: string
}

export type IncomingCeoMessageRecord = {
  id: number
  sender_id: number
  sender_name: string
  sender_email: string
  subject: string
  body: string
  sent_at: string
}

export type CompanyPaymentRecord = {
  id: number
  title: string
  amount: number
  payment_day: number
  payment_time: string
  note?: string | null
  is_active: boolean
} & Record<string, unknown>

export type CompanyPaymentsResponse = {
  payments: CompanyPaymentRecord[]
  totalAmount: number
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

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }

  return Boolean(value)
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

function normalizeCompanyPayment(item: unknown): CompanyPaymentRecord | null {
  if (!isRecord(item)) {
    return null
  }

  const id = toNumber(item.id)
  const title = typeof item.title === 'string' ? item.title.trim() : ''

  if (!id || !title) {
    return null
  }

  return {
    ...item,
    id,
    title,
    amount: toNumber(item.amount) ?? 0,
    payment_day: toNumber(item.payment_day ?? item.paymentDay) ?? 1,
    payment_time: typeof item.payment_time === 'string'
      ? item.payment_time
      : typeof item.paymentTime === 'string'
        ? item.paymentTime
        : '',
    note: typeof item.note === 'string' ? item.note : null,
    is_active: toBoolean(item.is_active ?? item.isActive),
  }
}

function normalizeCompanyPaymentsResponse(payload: unknown): CompanyPaymentsResponse {
  const parsed = parsePayload(payload)

  if (Array.isArray(parsed)) {
    const payments = parsed.map(normalizeCompanyPayment).filter((item): item is CompanyPaymentRecord => Boolean(item))

    return {
      payments,
      totalAmount: payments.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0),
    }
  }

  if (!isRecord(parsed)) {
    return {
      payments: [],
      totalAmount: 0,
    }
  }

  const list = ['items', 'payments', 'data', 'results']
    .map((key) => parsed[key])
    .find(Array.isArray)

  const payments = Array.isArray(list)
    ? list.map(normalizeCompanyPayment).filter((item): item is CompanyPaymentRecord => Boolean(item))
    : []

  return {
    payments,
    totalAmount:
      toNumber(parsed.total_amount ?? parsed.totalAmount ?? parsed.amount_total ?? parsed.amountTotal)
      ?? payments.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0),
  }
}

export type UserPayload = {
  email: string
  name: string
  surname: string
  password?: string
  company_code: string
  telegram_id?: string
  default_salary?: number
  role: UserRole
  job_title?: string
  is_active: boolean
}

export type DashboardResponse = {
  users: CeoUserRecord[]
  statistics: {
    user_count: number
    messages_count: number
    active_user_count: number
    inactive_user_count: number
    instagram_media_total_sent_count?: number
    instagram_media_total_lead_count?: number
    instagram_media_total_contacted_count?: number
    instagram_media_total_continuing_count?: number
    instagram_media_unknown_sent_count?: number
    instagram_media_unknown_lead_count?: number
    instagram_media_posts?: Array<{
      post_id: number
      media_type: string
      title: string
      url: string
      sent_count: number
      lead_count: number
      contacted_count: number
      continuing_count: number
    }>
    lead_response_limit_minutes?: number
    lead_response_total_count?: number
    lead_response_status_changed_count?: number
    lead_response_on_time_count?: number
    lead_response_late_count?: number
    lead_response_no_status_change_count?: number
    lead_response_note_written_count?: number
    lead_response_note_missing_count?: number
    lead_response_status_changed_without_note_count?: number
    lead_response_average_minutes?: number | null
    lead_response_average_human?: string | null
    lead_response_average_with_note_minutes?: number | null
    lead_response_average_with_note_human?: string | null
    lead_response_average_note_minutes?: number | null
    lead_response_average_note_human?: string | null
    lead_response_average_late_minutes?: number | null
    lead_response_average_late_human?: string | null
  }
}

export type PermissionsOverviewResponse = {
  users: Array<{
    user_id: number
    email: string
    name: string
    role: string
    job_title?: string | null
    is_active: boolean
    permissions: string[]
    permissions_display: string[]
    permissions_count: number
  }>
  total_users: number
  available_pages: string[]
  summary: Record<string, number>
}

export const ceoService = {
  getDashboard() {
    return request<DashboardResponse>({ path: '/ceo/dashboard' })
  },

  getTodayMetrics() {
    return request<DailyMetrics>({ path: '/ceo/metrics/today' })
  },

  createUser(payload: UserPayload) {
    return request<CreateResponse>({
      path: '/ceo/users',
      method: 'POST',
      body: payload,
    })
  },

  updateUser(userId: number, payload: UserPayload) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteUser(userId: number) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}`,
      method: 'DELETE',
    })
  },

  uploadUserProfileImage(userId: number, image: File) {
    const formData = new FormData()
    formData.append('image', image)

    return request<SuccessResponse>({
      path: `/ceo/users/${userId}/profile-image`,
      method: 'POST',
      body: formData,
    })
  },

  toggleUserActive(userId: number) {
    return request<{
      is_active: boolean
      active_user_count: number
      inactive_user_count: number
    }>({
      path: `/ceo/users/${userId}/toggle-active`,
      method: 'PATCH',
    })
  },

  getUserPermissions(userId: number) {
    return request<{
      user_id: number
      user_email: string
      user_name: string
      permissions: PermissionMap
      active_permissions_count: number
      total_available_pages: number
    }>({
      path: `/ceo/users/${userId}/permissions`,
    })
  },

  updateUserPermissions(userId: number, permissions: PermissionMap) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}/permissions`,
      method: 'PATCH',
      body: permissions,
    })
  },

  addUserPermissions(userId: number, permissions: PermissionMap) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}/permissions/add`,
      method: 'POST',
      body: permissions,
    })
  },

  addSingleUserPermissions(userId: number, permissions: PermissionMap) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}/permissions/add-single`,
      method: 'POST',
      body: permissions,
    })
  },

  removeUserPermission(userId: number, pageName: string) {
    return request<SuccessResponse>({
      path: `/ceo/users/${userId}/permissions/${pageName}`,
      method: 'DELETE',
    })
  },

  permissionsOverview() {
    return request<PermissionsOverviewResponse>({
      path: '/ceo/users/permissions/overview',
    })
  },

  sendMessageToAll(payload: { subject: string; body: string }) {
    return request<SuccessResponse>({
      path: '/ceo/send-message-all',
      method: 'POST',
      body: payload,
    })
  },

  sendMessageToUser(payload: { receiver_id: number; subject: string; body: string }) {
    return request<SuccessResponse>({
      path: '/ceo/send-message',
      method: 'POST',
      body: payload,
    })
  },

  listMessages() {
    return request<{
      messages: CeoMessageRecord[]
    }>({
      path: '/ceo/messages',
    })
  },

  listMyMessages() {
    return request<{
      messages: IncomingCeoMessageRecord[]
    }>({
      path: '/ceo/my-messages',
    })
  },

  deleteMessage(messageId: number) {
    return request<SuccessResponse>({
      path: `/ceo/messages/${messageId}`,
      method: 'DELETE',
    })
  },

  listPayments() {
    return request<{ payments: PaymentItem[] }>({
      path: '/ceo/payments',
    })
  },

  createPayment(payload: { project: string; date: string; summ: number; payment: boolean }) {
    return request<CreateResponse>({
      path: '/ceo/payments',
      method: 'POST',
      body: payload,
    })
  },

  updatePayment(paymentId: number, payload: { project: string; date: string | null; summ: number; payment: boolean }) {
    return request<SuccessResponse>({
      path: `/ceo/payments/${paymentId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deletePayment(paymentId: number) {
    return request<SuccessResponse>({
      path: `/ceo/payments/${paymentId}`,
      method: 'DELETE',
    })
  },

  togglePayment(paymentId: number) {
    return request<{
      message: string
      payment_id: number
      payment_status: boolean
    }>({
      path: `/ceo/payments/${paymentId}/toggle`,
      method: 'PATCH',
    })
  },

  async listCompanyPayments() {
    const response = await request<unknown>({
      path: '/ceo/company-payments',
    })

    return normalizeCompanyPaymentsResponse(response)
  },

  createCompanyPayment(payload: {
    title: string
    amount: number
    payment_day: number
    payment_time: string
    note?: string
    is_active: boolean
  }) {
    return request<CreateResponse>({
      path: '/ceo/company-payments',
      method: 'POST',
      body: payload,
    })
  },

  updateCompanyPayment(paymentId: number, payload: {
    title: string
    amount: number
    payment_day: number
    payment_time: string
    note?: string
    is_active: boolean
  }) {
    return request<SuccessResponse>({
      path: `/ceo/company-payments/${paymentId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteCompanyPayment(paymentId: number) {
    return request<SuccessResponse>({
      path: `/ceo/company-payments/${paymentId}`,
      method: 'DELETE',
    })
  },
}
