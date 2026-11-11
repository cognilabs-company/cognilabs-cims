import { request } from '../../../shared/api/http'

/* /miniapp/* endpoints. All of them need the raw Telegram initData in X-Telegram-Init-Data. */

export type MiniUser = { id: number; name: string; surname: string; email: string; role_name: string }
export type MiniSession = { access_token: string; expires_in: number; user: MiniUser }

export type MiniLocation = {
  id: number
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
}

export type PresenceState = 'checked_in' | 'checked_out'

export type Presence = {
  state: PresenceState
  location_id: number | null
  location_name: string | null
  /** When the current state started (check-in time when checked in). */
  since: string | null
  checked_in_at: string | null
  checked_out_at: string | null
}

export type LocationsPayload = { items: MiniLocation[]; presence: Presence | null; maxAccuracy: number }

export type GeoFix = { latitude: number; longitude: number; accuracy_meters: number }

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback)
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)

function initHeaders(initData: string) {
  return { 'X-Telegram-Init-Data': initData }
}

function normalizeUser(raw: unknown): MiniUser {
  const data = isObject(raw) ? raw : {}
  return {
    id: num(data.id ?? data.user_id),
    name: str(data.name) ?? str(data.first_name) ?? '',
    surname: str(data.surname) ?? str(data.last_name) ?? '',
    email: str(data.email) ?? '',
    role_name: str(data.role_name) ?? str(data.role) ?? '',
  }
}

export function normalizeLocation(raw: unknown): MiniLocation {
  const data = isObject(raw) ? raw : {}
  return {
    id: num(data.id ?? data.location_id),
    name: str(data.name) ?? '—',
    address: str(data.address),
    latitude: num(data.latitude ?? data.lat),
    longitude: num(data.longitude ?? data.lng ?? data.lon),
    radius_meters: num(data.radius_meters ?? data.radius, 50) || 50,
    is_active: data.is_active !== false,
  }
}

export function normalizePresence(raw: unknown): Presence | null {
  const data = isObject(raw) ? (isObject(raw.presence) ? raw.presence : isObject(raw.state) ? raw.state : raw) : null
  if (!data) return null
  const stateValue = str(data.state) ?? str(data.status) ?? (typeof raw === 'string' ? raw : null)
  if (stateValue !== 'checked_in' && stateValue !== 'checked_out') return null
  const location = isObject(data.location) ? data.location : null
  const checkedIn = str(data.checked_in_at) ?? str(data.check_in_at) ?? str(data.check_in_time)
  const checkedOut = str(data.checked_out_at) ?? str(data.check_out_at) ?? str(data.check_out_time)
  return {
    state: stateValue,
    location_id: location ? num(location.id, 0) || null : num(data.location_id, 0) || null,
    location_name: (location ? str(location.name) : null) ?? str(data.location_name),
    since: (stateValue === 'checked_in' ? checkedIn : checkedOut) ?? str(data.event_at) ?? str(data.updated_at) ?? str(data.timestamp),
    checked_in_at: checkedIn,
    checked_out_at: checkedOut,
  }
}

export const miniApi = {
  async session(initData: string): Promise<MiniSession> {
    const data = await request<Raw>({ path: '/miniapp/session', method: 'POST', headers: initHeaders(initData), auth: false })
    return { access_token: String(data.access_token ?? ''), expires_in: num(data.expires_in, 7200), user: normalizeUser(data.user) }
  },
  async locations(initData: string): Promise<LocationsPayload> {
    const data = await request<unknown>({ path: '/miniapp/attendance/locations', headers: initHeaders(initData) })
    const list = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.items) ? data.items : isObject(data) && Array.isArray(data.locations) ? data.locations : []
    return {
      items: list.map(normalizeLocation).filter((item) => item.id && item.is_active),
      presence: isObject(data) ? normalizePresence(data.presence ?? null) : null,
      maxAccuracy: isObject(data) ? num(data.max_accuracy_meters, 100) || 100 : 100,
    }
  },
  async state(initData: string) {
    return normalizePresence(await request<unknown>({ path: '/miniapp/attendance/state', headers: initHeaders(initData) }))
  },
  position(initData: string, fix: GeoFix) {
    return request<unknown>({ path: '/miniapp/attendance/position', method: 'POST', headers: initHeaders(initData), body: fix })
  },
  checkIn(initData: string, locationId: number, fix: GeoFix) {
    return request<unknown>({ path: '/miniapp/attendance/check-in', method: 'POST', headers: initHeaders(initData), body: { location_id: locationId, ...fix } })
  },
  checkOut(initData: string, locationId: number, fix: GeoFix) {
    return request<unknown>({ path: '/miniapp/attendance/check-out', method: 'POST', headers: initHeaders(initData), body: { location_id: locationId, ...fix } })
  },
}
