import { env } from '../../config/env'
import { getAccessToken } from '../../lib/session'
import { request } from '../http'

/* ──────────────────────────────────────────────────────────────
   Attendance locations (geofences), the CEO live map and location events.
   Contract: CIMS_MINIAPP_FRONTEND.md → "CEO Location Management" / "CEO Live Map".
   Response bodies are not typed in the OpenAPI schema, so every reader below
   accepts a bare array or a wrapper object and tolerates missing fields.
   ────────────────────────────────────────────────────────────── */

type Raw = Record<string, unknown>

export type PresenceState = 'checked_in' | 'checked_out'

export type EmployeeRef = { id: number; name: string }
export type LocationRef = { id: number | null; name: string | null }

export type AttendanceLocation = {
  id: number
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  radius_meters: number
  is_active: boolean
  /** null when the backend did not say who is assigned. */
  employee_ids: number[] | null
  employees: EmployeeRef[]
  employees_count: number | null
}

export type LocationPayload = {
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
}

export type MapEmployee = {
  employee_id: number
  name: string
  state: PresenceState | null
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  current_location: LocationRef | null
  assigned_locations: LocationRef[]
  checked_in_at: string | null
  checked_out_at: string | null
  /** Client-clock epoch ms of the last known activity (position or event). */
  last_seen_at: number | null
  /** Client-clock epoch ms when the employee was last known to be sending positions; null when not live. */
  live_at: number | null
}

export type EmployeePatch = Partial<MapEmployee> & { employee_id: number }

export type LocationMapSnapshot = {
  locations: AttendanceLocation[]
  employees: MapEmployee[]
}

export type LocationEvent = {
  key: string
  employee_id: number | null
  employee_name: string | null
  event_type: string
  location_id: number | null
  location_name: string | null
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  distance_meters: number | null
  occurred_at: string | null
  note: string | null
}

export type LocationEventsPage = {
  items: LocationEvent[]
  /** null when the backend did not report a total. */
  total: number | null
  page: number
  page_size: number
  total_pages: number
}

export type LocationEventsQuery = {
  employee_id?: number
  location_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

/** A position counts as live for this long (the backend's `is_live` window). */
export const LIVE_WINDOW_MS = 120_000

/* ── small readers ─────────────────────────────────────────── */

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function str(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value.trim() : null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return null
}

function pick(raw: Raw, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function nonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** A bare array, or the first array found under one of `keys` (also one level down in `data`). */
function listFrom(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[]
  }
  if (isRecord(payload.data)) return listFrom(payload.data, keys)
  if (Array.isArray(payload.data)) return payload.data
  return []
}

function parseTimestamp(value: unknown): number | null {
  const text = str(value)
  if (!text) return null
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

function personName(raw: Raw): string | null {
  const direct = str(pick(raw, 'full_name', 'employee_name', 'employee_full_name', 'user_name', 'display_name'))
  if (direct) return direct
  const joined = [str(raw.name), str(raw.surname)].filter(Boolean).join(' ')
  if (joined) return joined
  if (isRecord(raw.employee)) return personName(raw.employee)
  if (isRecord(raw.user)) return personName(raw.user)
  return null
}

function employeeIdOf(raw: Raw): number | null {
  const direct = num(pick(raw, 'employee_id', 'user_id'))
  if (direct !== null) return direct
  for (const nestedKey of ['employee', 'user']) {
    const nested = raw[nestedKey]
    if (isRecord(nested)) {
      const id = num(pick(nested, 'employee_id', 'user_id', 'id'))
      if (id !== null) return id
    }
  }
  return num(raw.id)
}

function employeeRef(raw: unknown): EmployeeRef | null {
  if (typeof raw === 'number' || typeof raw === 'string') {
    const id = num(raw)
    return id === null ? null : { id, name: '' }
  }
  if (!isRecord(raw)) return null
  const id = employeeIdOf(raw)
  return id === null ? null : { id, name: personName(raw) ?? '' }
}

function locationRef(raw: unknown): LocationRef | null {
  if (typeof raw === 'number') return { id: raw, name: null }
  if (typeof raw === 'string') return { id: num(raw), name: num(raw) === null ? raw : null }
  if (!isRecord(raw)) return null
  const id = num(pick(raw, 'id', 'location_id'))
  const name = str(pick(raw, 'name', 'location_name', 'title'))
  return id === null && name === null ? null : { id, name }
}

/* ── locations ─────────────────────────────────────────────── */

export function normalizeLocation(raw: unknown): AttendanceLocation | null {
  if (!isRecord(raw)) return null
  const id = num(pick(raw, 'id', 'location_id'))
  if (id === null) return null

  const employeesRaw = pick(raw, 'employees', 'assigned_employees', 'assignments')
  const employees = Array.isArray(employeesRaw) ? employeesRaw.map(employeeRef).filter(nonNull) : null
  const idsRaw = pick(raw, 'employee_ids', 'assigned_employee_ids')
  const employeeIds = Array.isArray(idsRaw)
    ? idsRaw.map(num).filter(nonNull)
    : employees
      ? employees.map((employee) => employee.id)
      : null
  const count = num(pick(raw, 'employees_count', 'employee_count', 'assigned_count', 'assigned_employees_count')) ?? employeeIds?.length ?? null

  return {
    id,
    name: str(pick(raw, 'name', 'title')) ?? `#${id}`,
    address: str(raw.address),
    latitude: num(pick(raw, 'latitude', 'lat')),
    longitude: num(pick(raw, 'longitude', 'lng', 'lon')),
    radius_meters: num(pick(raw, 'radius_meters', 'radius')) ?? 50,
    is_active: bool(raw.is_active) ?? true,
    employee_ids: employeeIds,
    employees: employees ?? [],
    employees_count: count,
  }
}

export function normalizeLocations(payload: unknown): AttendanceLocation[] {
  return listFrom(payload, ['items', 'locations', 'results']).map(normalizeLocation).filter(nonNull)
}

/* ── live map employees ────────────────────────────────────── */

function parseState(value: unknown): PresenceState | null | undefined {
  const text = str(value)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (!text) return undefined
  if (['checked_in', 'check_in', 'checkin', 'in'].includes(text)) return 'checked_in'
  if (['checked_out', 'check_out', 'checkout', 'out'].includes(text)) return 'checked_out'
  if (['none', 'unknown', 'never', 'never_reported', 'no_data', 'not_reported'].includes(text)) return null
  return undefined
}

/** Only the fields that are present in `raw`, so a realtime message never wipes what it does not mention. */
export function employeePatch(raw: unknown, receivedAt: number): EmployeePatch | null {
  if (!isRecord(raw)) return null
  const employeeId = employeeIdOf(raw)
  if (employeeId === null) return null
  const patch: EmployeePatch = { employee_id: employeeId }

  const name = personName(raw)
  if (name) patch.name = name

  const presence = isRecord(raw.presence) ? raw.presence : null
  const stateSources = [raw.state, raw.presence_state, typeof raw.presence === 'string' ? raw.presence : undefined, presence?.state, raw.status, raw.event_type, raw.event, raw.action]
  for (const source of stateSources) {
    const state = parseState(source)
    if (state !== undefined) {
      patch.state = state
      break
    }
  }

  const position = [raw.position, raw.current_position, raw.last_position].find(isRecord) ?? null
  const latitude = num(pick(raw, 'latitude', 'current_latitude', 'lat', 'last_latitude')) ?? (position ? num(pick(position, 'latitude', 'lat')) : null)
  const longitude = num(pick(raw, 'longitude', 'current_longitude', 'lng', 'lon', 'last_longitude')) ?? (position ? num(pick(position, 'longitude', 'lng', 'lon')) : null)
  if (latitude !== null && longitude !== null) {
    patch.latitude = latitude
    patch.longitude = longitude
  }
  const accuracy = num(pick(raw, 'accuracy_meters', 'accuracy')) ?? (position ? num(pick(position, 'accuracy_meters', 'accuracy')) : null)
  if (accuracy !== null) patch.accuracy_meters = accuracy

  const current = locationRef(raw.current_location)
    ?? (pick(raw, 'current_location_id', 'current_location_name') !== undefined
      ? { id: num(raw.current_location_id), name: str(raw.current_location_name) }
      : null)
    ?? (isRecord(raw.location) ? locationRef(raw.location) : null)
    ?? (pick(raw, 'location_id', 'location_name') !== undefined ? { id: num(raw.location_id), name: str(raw.location_name) } : null)
  if (current) patch.current_location = current

  const assignedSources: unknown[] = []
  for (const key of ['assigned_locations', 'locations', 'assigned_location_ids', 'location_ids']) {
    if (Array.isArray(raw[key])) assignedSources.push(...(raw[key] as unknown[]))
  }
  if (raw.assigned_location !== undefined && raw.assigned_location !== null) assignedSources.push(raw.assigned_location)
  if (raw.assigned_location_id !== undefined && raw.assigned_location_id !== null) {
    assignedSources.push({ id: raw.assigned_location_id, name: raw.assigned_location_name })
  }
  const assigned = assignedSources.map(locationRef).filter(nonNull)
  if (assigned.length > 0) patch.assigned_locations = assigned

  const checkedInAt = str(pick(raw, 'checked_in_at', 'check_in_at', 'check_in_time', 'last_check_in_at')) ?? (presence ? str(pick(presence, 'checked_in_at', 'check_in_at')) : null)
  if (checkedInAt) patch.checked_in_at = checkedInAt
  const checkedOutAt = str(pick(raw, 'checked_out_at', 'check_out_at', 'check_out_time', 'last_check_out_at')) ?? (presence ? str(pick(presence, 'checked_out_at', 'check_out_at')) : null)
  if (checkedOutAt) patch.checked_out_at = checkedOutAt

  // "Last seen": prefer an explicit position age, then the age of the last event, then timestamps.
  const positionSeconds = num(pick(raw, 'seconds_since_position', 'seconds_since_last_position', 'seconds_since_last_seen'))
  const eventSeconds = num(pick(raw, 'seconds_since_event', 'seconds_since_last_event', 'seconds_ago'))
  const positionStamp = parseTimestamp(pick(raw, 'last_seen_at', 'last_position_at', 'position_at', 'position_updated_at', 'recorded_at'))
    ?? (position ? parseTimestamp(pick(position, 'recorded_at', 'created_at', 'timestamp')) : null)
  const eventStamp = parseTimestamp(pick(raw, 'last_event_at', 'event_at', 'occurred_at', 'updated_at', 'timestamp', 'created_at'))
  const lastSeen = positionSeconds !== null
    ? receivedAt - positionSeconds * 1000
    : eventSeconds !== null
      ? receivedAt - eventSeconds * 1000
      : positionStamp ?? eventStamp
  if (lastSeen !== null) patch.last_seen_at = Math.min(lastSeen, receivedAt)

  const isLive = bool(raw.is_live)
  if (isLive === false) patch.live_at = null
  if (isLive === true) {
    // The backend says "a position within the last 120 s"; age it from the freshest moment we can justify.
    const age = positionSeconds ?? (eventSeconds !== null && eventSeconds * 1000 <= LIVE_WINDOW_MS ? eventSeconds : 0)
    patch.live_at = receivedAt - age * 1000
  }

  return patch
}

function emptyEmployee(employeeId: number): MapEmployee {
  return {
    employee_id: employeeId,
    name: `#${employeeId}`,
    state: null,
    latitude: null,
    longitude: null,
    accuracy_meters: null,
    current_location: null,
    assigned_locations: [],
    checked_in_at: null,
    checked_out_at: null,
    last_seen_at: null,
    live_at: null,
  }
}

function sameLocation(a: LocationRef, b: LocationRef) {
  return a.id !== null && b.id !== null ? a.id === b.id : a.name === b.name
}

/** Merge one employee update into a list (adds the employee when unknown). */
export function mergeEmployee(list: MapEmployee[], patch: EmployeePatch): MapEmployee[] {
  const index = list.findIndex((employee) => employee.employee_id === patch.employee_id)
  if (index === -1) return [...list, { ...emptyEmployee(patch.employee_id), ...patch }]
  const current = list[index]
  const assigned = patch.assigned_locations
    ? [...current.assigned_locations, ...patch.assigned_locations.filter((ref) => !current.assigned_locations.some((known) => sameLocation(known, ref)))]
    : current.assigned_locations
  const next = list.slice()
  next[index] = { ...current, ...patch, assigned_locations: assigned }
  return next
}

export function normalizeLocationMap(payload: unknown, receivedAt: number): LocationMapSnapshot {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload
  const locationRows = listFrom(root, ['locations', 'items'])
  const locations = locationRows.map(normalizeLocation).filter(nonNull)

  let employees: MapEmployee[] = []
  const topLevel = isRecord(root) ? listFrom(root.employees, ['items']) : []
  for (const raw of topLevel) {
    const patch = employeePatch(raw, receivedAt)
    if (patch) employees = mergeEmployee(employees, patch)
  }
  // Employees nested under their location.
  for (const raw of locationRows) {
    if (!isRecord(raw)) continue
    const nested = pick(raw, 'employees', 'assigned_employees')
    if (!Array.isArray(nested)) continue
    const ref: LocationRef = { id: num(pick(raw, 'id', 'location_id')), name: str(raw.name) }
    for (const row of nested) {
      const patch = employeePatch(row, receivedAt)
      if (!patch) continue
      const known = employees.some((employee) => employee.employee_id === patch.employee_id)
      // A nested row repeats the same person per location: only fill what the top-level row did not give.
      employees = mergeEmployee(employees, known ? { employee_id: patch.employee_id, assigned_locations: [ref] } : { ...patch, assigned_locations: [ref, ...(patch.assigned_locations ?? [])] })
    }
  }

  return { locations, employees }
}

/** Applies one realtime message; returns null when the message is not about the map. */
export function applyLiveMessage(snapshot: LocationMapSnapshot, message: unknown, receivedAt: number): LocationMapSnapshot | null {
  if (!isRecord(message)) return null
  const type = str(pick(message, 'type', 'event'))
  const body = [message.data, message.payload, message.snapshot, message.event_data].find(isRecord) ?? message

  if (type === 'attendance_location_map') {
    return normalizeLocationMap(body, receivedAt)
  }

  if (type === 'attendance_position' || type === 'attendance_presence') {
    const rows = Array.isArray(body.employees) ? body.employees : [body]
    let employees = snapshot.employees
    for (const row of rows) {
      const patch = employeePatch(row, receivedAt)
      if (!patch) continue
      if (type === 'attendance_position') {
        // A position just arrived: the employee is live right now.
        patch.live_at = receivedAt
        patch.last_seen_at = receivedAt
      } else {
        patch.last_seen_at = patch.last_seen_at ?? receivedAt
        if (patch.state === 'checked_in' && !patch.checked_in_at) patch.checked_in_at = new Date(receivedAt).toISOString()
        if (patch.state === 'checked_out' && !patch.checked_out_at) patch.checked_out_at = new Date(receivedAt).toISOString()
      }
      employees = mergeEmployee(employees, patch)
    }
    return employees === snapshot.employees ? null : { ...snapshot, employees }
  }

  return null
}

/* ── events history ────────────────────────────────────────── */

function normalizeEvent(raw: unknown, index: number): LocationEvent | null {
  if (!isRecord(raw)) return null
  const employee = isRecord(raw.employee) ? raw.employee : null
  const location = isRecord(raw.location) ? raw.location : null
  const employeeId = num(pick(raw, 'employee_id', 'user_id')) ?? (employee ? num(pick(employee, 'id', 'employee_id')) : null)
  const occurredAt = str(pick(raw, 'occurred_at', 'event_at', 'recorded_at', 'created_at', 'timestamp', 'time'))
  const id = str(raw.id)
  return {
    key: id ?? `${employeeId ?? 'x'}-${occurredAt ?? ''}-${index}`,
    employee_id: employeeId,
    employee_name: str(pick(raw, 'employee_name', 'full_name', 'employee_full_name', 'user_name')) ?? (employee ? personName(employee) : null),
    event_type: str(pick(raw, 'event_type', 'type', 'action', 'kind', 'event')) ?? 'event',
    location_id: num(raw.location_id) ?? (location ? num(pick(location, 'id', 'location_id')) : null),
    location_name: str(raw.location_name) ?? (location ? str(location.name) : null),
    latitude: num(pick(raw, 'latitude', 'lat')),
    longitude: num(pick(raw, 'longitude', 'lng', 'lon')),
    accuracy_meters: num(pick(raw, 'accuracy_meters', 'accuracy')),
    distance_meters: num(pick(raw, 'distance_meters', 'distance', 'distance_m')),
    occurred_at: occurredAt,
    note: str(pick(raw, 'reason', 'detail', 'message', 'note')),
  }
}

export function normalizeEventsPage(payload: unknown, requested: { page: number; page_size: number }): LocationEventsPage {
  const items = listFrom(payload, ['items', 'events', 'results']).map(normalizeEvent).filter(nonNull)
  const meta = isRecord(payload) ? payload : {}
  const pageSize = Math.max(1, num(pick(meta, 'page_size', 'per_page', 'limit')) ?? requested.page_size)
  const page = num(meta.page) ?? requested.page
  const totalRaw = num(pick(meta, 'total', 'total_count', 'total_items', 'count'))
  const totalPagesRaw = num(pick(meta, 'total_pages', 'pages', 'page_count'))
  // Without any totals, a full page means "there may be another one".
  const totalPages = totalPagesRaw
    ?? (totalRaw !== null ? Math.ceil(totalRaw / pageSize) : page + (items.length >= pageSize ? 1 : 0))
  return {
    items,
    total: totalRaw,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, totalPages),
  }
}

/* ── service ───────────────────────────────────────────────── */

export const attendanceLocationsService = {
  async listLocations(includeInactive = false) {
    const payload = await request<unknown>({ path: '/attendance/locations', query: { include_inactive: includeInactive } })
    return normalizeLocations(payload)
  },

  createLocation(body: LocationPayload) {
    return request<unknown>({ path: '/attendance/locations', method: 'POST', body })
  },

  updateLocation(locationId: number, body: Partial<LocationPayload>) {
    return request<unknown>({ path: `/attendance/locations/${locationId}`, method: 'PATCH', body })
  },

  deleteLocation(locationId: number) {
    return request<unknown>({ path: `/attendance/locations/${locationId}`, method: 'DELETE' })
  },

  /** Replaces every assignment of the location. */
  replaceEmployees(locationId: number, employeeIds: number[]) {
    return request<unknown>({ path: `/attendance/locations/${locationId}/employees`, method: 'PUT', body: { employee_ids: employeeIds } })
  },

  async getLocationMap() {
    const payload = await request<unknown>({ path: '/attendance/location-map' })
    return normalizeLocationMap(payload, Date.now())
  },

  async listEvents(params: LocationEventsQuery) {
    const page = params.page ?? 1
    const pageSize = params.page_size ?? 50
    const payload = await request<unknown>({
      path: '/attendance/location-events',
      query: { ...params, page, page_size: pageSize },
    })
    return normalizeEventsPage(payload, { page, page_size: pageSize })
  },

  /** Realtime map: same host rules as the telephony events socket. */
  liveMapUrl() {
    const base = env.apiBaseUrl.startsWith('http')
      ? env.apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')
      : 'wss://api.project.cims.cognilabs.org'
    return `${base}/attendance/location-map/ws?token=${encodeURIComponent(getAccessToken() ?? '')}`
  },
}
