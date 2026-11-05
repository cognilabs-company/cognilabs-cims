import { request, requestBlob } from '../http'
import { env } from '../../config/env'
import { getAccessToken } from '../../lib/session'

export type TelephonyConfig = {
  enabled: boolean
  extension: string
  password: string
  sip_uri: string
  websocket_url: string
  display_name: string
  ice_servers: RTCIceServer[]
}

export type TelephonyLead = {
  crm_source: 'crm' | 'crm_outbound'
  customer_id: number
  full_name: string
  phone_number: string
  status: string | null
  platform: string | null
  seller_id: number | null
  seller_name: string | null
}

export type TelephonyCall = {
  id: number
  linked_id: string
  direction: 'incoming' | 'outgoing'
  status: string
  phone_number: string
  extension: string | null
  user_id: number | null
  user_name: string | null
  crm_source: 'crm' | 'crm_outbound' | null
  customer_id: number | null
  customer_name: string | null
  started_at: string
  ringing_at: string | null
  answered_at: string | null
  ended_at: string | null
  duration_seconds: number
  talk_seconds: number
  hangup_cause: string | null
  has_recording: boolean
}

export type CallNote = {
  id: number
  call_id: number
  note: string
  created_by: number | null
  created_by_name: string | null
  created_at: string
}

export type TelephonyCallDetail = TelephonyCall & { notes: CallNote[]; lead: TelephonyLead | null }
export type CallHistoryQuery = {
  page?: number
  page_size?: number
  search?: string
  direction?: 'incoming' | 'outgoing'
  status?: string
  date_from?: string
  date_to?: string
}
export type CallHistoryResponse = { items: TelephonyCall[]; total: number; page: number; page_size: number; pages: number }
export type RecordingStorage = {
  total_bytes: number
  used_bytes: number
  free_bytes: number
  used_percent: number
  recording_count: number
  total_talk_seconds: number
}

export type TelephonyExtension = {
  user_id: number
  user_name?: string | null
  extension?: string | null
  is_active?: boolean
  [key: string]: unknown
}

export const telephonyService = {
  config: () => request<TelephonyConfig>({ path: '/telephony/config' }),
  search: (query: string) => request<TelephonyLead[] | { items: TelephonyLead[] }>({ path: '/telephony/search', query: { query } }),
  resolve: (phone: string) => request<TelephonyLead | null>({ path: '/telephony/resolve', query: { phone } }),
  activeCalls: () => request<TelephonyCall[] | { items: TelephonyCall[] }>({ path: '/telephony/calls-active' }),
  calls: (query: CallHistoryQuery) => request<CallHistoryResponse>({ path: '/telephony/calls', query }),
  call: (id: number) => request<TelephonyCallDetail>({ path: `/telephony/calls/${id}` }),
  addNote: (id: number, note: string) => request<unknown>({ path: `/telephony/calls/${id}/notes`, method: 'POST', body: { note } }),
  recording: (id: number) => requestBlob(`/telephony/calls/${id}/recording`),
  storage: () => request<RecordingStorage>({ path: '/telephony/recordings/storage' }),
  status: () => request<Record<string, unknown>>({ path: '/telephony/status' }),
  extensions: () => request<TelephonyExtension[] | { items: TelephonyExtension[] }>({ path: '/telephony/extensions' }),
  createExtension: (userId: number) => request<TelephonyExtension>({ path: `/telephony/extensions/${userId}`, method: 'POST' }),
  updateExtension: (userId: number, isActive: boolean) => request<TelephonyExtension>({ path: `/telephony/extensions/${userId}`, method: 'PATCH', body: { is_active: isActive } }),
  eventsUrl: () => {
    const base = env.apiBaseUrl.startsWith('http')
      ? env.apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')
      : 'wss://api.project.cims.cognilabs.org'
    return `${base}/telephony/events?token=${encodeURIComponent(getAccessToken() ?? '')}`
  },
}

export function normalizePhone(value?: string | null) {
  return (value ?? '').replace(/[^\d]/g, '')
}

export function leadPath(source: TelephonyLead['crm_source'] | null, id: number | null) {
  if (!id || !source) return null
  return `/${source === 'crm_outbound' ? 'outbound-crm' : 'crm'}/customers/${id}`
}
