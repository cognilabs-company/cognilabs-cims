import {
  attendanceLocationsService,
  LIVE_WINDOW_MS,
  type AttendanceLocation,
  type LocationMapSnapshot,
  type LocationPayload,
  type MapEmployee,
} from '../../../shared/api/services/attendanceLocations.service'
import { getIntlLocale, type TranslationParams } from '../../../shared/i18n/translations'

export type Translate = (key: string, fallback?: string, params?: TranslationParams) => string

export const TASHKENT_TIMEZONE = 'Asia/Tashkent'
/** Tashkent city centre — the map's starting view when there is nothing to show yet. */
export const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]
export const DEFAULT_RADIUS = 50
export const MIN_RADIUS = 10
export const MAX_RADIUS = 1000

/* ── employee states on the live map ───────────────────────── */

export type MarkerState = 'live' | 'stale' | 'checked_out' | 'no_data'

export const MARKER_STATES: MarkerState[] = ['live', 'stale', 'checked_out', 'no_data']

export function hasPosition(employee: MapEmployee) {
  return employee.latitude !== null && employee.longitude !== null
}

export function isLiveNow(employee: MapEmployee, now: number) {
  return employee.live_at !== null && (now === 0 || now - employee.live_at <= LIVE_WINDOW_MS)
}

export function employeeMarkerState(employee: MapEmployee, now: number): MarkerState {
  if (!hasPosition(employee)) return 'no_data'
  if (employee.state === 'checked_in') return isLiveNow(employee, now) ? 'live' : 'stale'
  return 'checked_out'
}

/** Short chip label. */
export function markerStateLabel(state: MarkerState, t: Translate) {
  switch (state) {
    case 'live': return t('attendance.loc.state_live', 'Live')
    case 'stale': return t('attendance.loc.state_stale', 'Stale')
    case 'checked_out': return t('attendance.loc.state_checked_out', 'Checked out')
    default: return t('attendance.loc.state_no_data', 'No data')
  }
}

/** Legend label: says what the colour means. */
export function markerStateLegendLabel(state: MarkerState, t: Translate) {
  switch (state) {
    case 'live': return t('attendance.loc.legend_live', 'Checked in · live')
    case 'stale': return t('attendance.loc.legend_stale', 'Checked in · no fresh position')
    case 'checked_out': return t('attendance.loc.legend_checked_out', 'Checked out')
    default: return t('attendance.loc.legend_no_data', 'Never reported')
  }
}

export function markerStateHint(state: MarkerState, t: Translate) {
  switch (state) {
    case 'live': return t('attendance.loc.state_live_hint', 'Position received in the last 2 minutes')
    case 'stale': return t('attendance.loc.state_stale_hint', 'Checked in, but no fresh position')
    case 'checked_out': return t('attendance.loc.state_checked_out_hint', 'Not at work right now')
    default: return t('attendance.loc.state_no_data_hint', 'Has never shared a position')
  }
}

/** Chip + dot colours. Gray for "out", nothing louder than the app's status colours. */
export const markerStateChipClass: Record<MarkerState, string> = {
  live: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  stale: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  checked_out: 'bg-[var(--input-surface)] text-[var(--muted-strong)]',
  no_data: 'bg-transparent text-[var(--muted)] ring-1 ring-inset ring-[var(--border-hover)]',
}

export const markerStateDotClass: Record<MarkerState, string> = {
  live: 'bg-[var(--success-text)]',
  stale: 'bg-[var(--warning-text)]',
  checked_out: 'bg-[var(--muted)]',
  no_data: 'border border-dashed border-[var(--muted)] bg-transparent',
}

/** Ring + initials of the round employee badge (map marker and list avatar look the same). */
export const markerStateBadgeClass: Record<MarkerState, string> = {
  live: 'border-[var(--success-text)] text-[var(--success-text)]',
  stale: 'border-dashed border-[var(--warning-text)] text-[var(--warning-text)]',
  checked_out: 'border-[var(--muted)] text-[var(--muted)]',
  no_data: 'border-dashed border-[var(--border-hover)] text-[var(--muted)]',
}

const stateOrder: Record<MarkerState, number> = { live: 0, stale: 1, checked_out: 2, no_data: 3 }

export function sortEmployeesForList(employees: MapEmployee[], now: number) {
  return employees.slice().sort((a, b) => {
    const byState = stateOrder[employeeMarkerState(a, now)] - stateOrder[employeeMarkerState(b, now)]
    return byState !== 0 ? byState : a.name.localeCompare(b.name)
  })
}

export function employeeLocationName(employee: MapEmployee, locations: AttendanceLocation[]) {
  const ref = (employee.state === 'checked_in' ? employee.current_location : null)
    ?? employee.assigned_locations[0]
    ?? employee.current_location
  if (!ref) return null
  if (ref.name) return ref.name
  return locations.find((location) => location.id === ref.id)?.name ?? null
}

export function initialsOf(name: string) {
  const letters = name
    .replace(/^#/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return letters || '?'
}

/* ── formatting ────────────────────────────────────────────── */

export function formatAgo(ms: number, t: Translate) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return t('attendance.loc.ago_now', 'just now')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('attendance.loc.ago_minutes', '{{count}} min ago', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('attendance.loc.ago_hours', '{{count}} h ago', { count: hours })
  return t('attendance.loc.ago_days', '{{count}} d ago', { count: Math.floor(hours / 24) })
}

export function formatMeters(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`
  return `${Math.round(value)} m`
}

export function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return '—'
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(getIntlLocale(), {
    timeZone: TASHKENT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function formatTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(getIntlLocale(), { timeZone: TASHKENT_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/** `YYYY-MM-DD` (picked in Tashkent) → API date-time bounds. */
export function tashkentDayStart(date: string) {
  return date ? `${date}T00:00:00+05:00` : undefined
}

export function tashkentDayEnd(date: string) {
  return date ? `${date}T23:59:59+05:00` : undefined
}

/* ── events ────────────────────────────────────────────────── */

export type EventTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info'

export function eventTypeMeta(type: string, t: Translate): { label: string; tone: EventTone } {
  const key = type.toLowerCase().replace(/[\s-]+/g, '_')
  if (/reject|denied|fail|invalid|blocked/.test(key)) return { label: t('attendance.loc.event_rejected', 'Rejected'), tone: 'danger' }
  if (/(^|_)(checked_|check_)?in$|checkin/.test(key)) return { label: t('attendance.loc.event_check_in', 'Check-in'), tone: 'success' }
  if (/(^|_)(checked_|check_)?out$|checkout/.test(key)) return { label: t('attendance.loc.event_check_out', 'Check-out'), tone: 'neutral' }
  if (/exit|leave|left|outside/.test(key)) return { label: t('attendance.loc.event_left_area', 'Left the area'), tone: 'warning' }
  if (/enter|inside|arriv/.test(key)) return { label: t('attendance.loc.event_entered_area', 'Entered the area'), tone: 'info' }
  if (/position|location|ping|gps/.test(key)) return { label: t('attendance.loc.event_position', 'Position update'), tone: 'info' }
  const words = key.replace(/_/g, ' ').trim()
  return { label: words ? words.charAt(0).toUpperCase() + words.slice(1) : '—', tone: 'neutral' }
}

export const eventToneClass: Record<EventTone, string> = {
  success: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  neutral: 'bg-[var(--input-surface)] text-[var(--muted-strong)]',
  warning: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  danger: 'bg-[var(--danger-dim)] text-[var(--danger-text)]',
  info: 'bg-[var(--muted-surface)] text-[var(--muted)]',
}

/* ── location form ─────────────────────────────────────────── */

export type LocationFormValues = {
  name: string
  address: string
  latitude: string
  longitude: string
  radius: string
  isActive: boolean
}

export type LocationFormField = 'name' | 'latitude' | 'longitude' | 'radius'
export type LocationFormErrors = Partial<Record<LocationFormField, string>>

export function toFormValues(location: AttendanceLocation | null): LocationFormValues {
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    latitude: location?.latitude !== null && location?.latitude !== undefined ? String(location.latitude) : '',
    longitude: location?.longitude !== null && location?.longitude !== undefined ? String(location.longitude) : '',
    radius: String(location?.radius_meters ?? DEFAULT_RADIUS),
    isActive: location?.is_active ?? true,
  }
}

/** Accepts "41.3", "41,3" and surrounding spaces. */
export function parseNumber(value: string) {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function roundCoordinate(value: number) {
  return Math.round(value * 1e6) / 1e6
}

export function validateLocationForm(values: LocationFormValues, t: Translate): { errors: LocationFormErrors; payload: LocationPayload | null } {
  const errors: LocationFormErrors = {}
  const name = values.name.trim()
  if (name.length < 2) errors.name = t('attendance.loc.error_name', 'Enter a name (at least 2 characters).')

  const latitude = parseNumber(values.latitude)
  if (latitude === null) errors.latitude = t('attendance.loc.error_lat_required', 'Enter a latitude or click the map.')
  else if (latitude < -90 || latitude > 90) errors.latitude = t('attendance.loc.error_lat_range', 'Latitude must be between -90 and 90.')

  const longitude = parseNumber(values.longitude)
  if (longitude === null) errors.longitude = t('attendance.loc.error_lng_required', 'Enter a longitude or click the map.')
  else if (longitude < -180 || longitude > 180) errors.longitude = t('attendance.loc.error_lng_range', 'Longitude must be between -180 and 180.')

  const radius = parseNumber(values.radius)
  if (radius === null || !Number.isInteger(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) {
    errors.radius = t('attendance.loc.error_radius', 'Radius must be a whole number from {{min}} to {{max}} m.', { min: MIN_RADIUS, max: MAX_RADIUS })
  }

  if (Object.keys(errors).length > 0 || latitude === null || longitude === null || radius === null) return { errors, payload: null }
  return {
    errors,
    payload: {
      name,
      address: values.address.trim() || null,
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
      radius_meters: radius,
      is_active: values.isActive,
    },
  }
}

/** PATCH body: only what changed. */
export function changedFields(location: AttendanceLocation, payload: LocationPayload): Partial<LocationPayload> {
  const patch: Partial<LocationPayload> = {}
  if (payload.name !== location.name) patch.name = payload.name
  if (payload.address !== location.address) patch.address = payload.address
  if (payload.latitude !== location.latitude) patch.latitude = payload.latitude
  if (payload.longitude !== location.longitude) patch.longitude = payload.longitude
  if (payload.radius_meters !== location.radius_meters) patch.radius_meters = payload.radius_meters
  if (payload.is_active !== location.is_active) patch.is_active = payload.is_active
  return patch
}

export function geolocationErrorMessage(error: GeolocationPositionError, t: Translate) {
  if (error.code === error.PERMISSION_DENIED) return t('attendance.loc.geo_denied', 'Location access is blocked. Allow it in the browser settings.')
  if (error.code === error.TIMEOUT) return t('attendance.loc.geo_timeout', 'Getting your location took too long. Try again.')
  return t('attendance.loc.geo_unavailable', 'Your location is not available right now.')
}

/* ── assignments ───────────────────────────────────────────── */

/** location id → employee ids, from the live-map snapshot (it lists assigned employees of active locations). */
export function assignmentIndex(snapshot: LocationMapSnapshot) {
  const index = new Map<number, Set<number>>()
  const add = (locationId: number | null, employeeId: number) => {
    if (locationId === null) return
    const set = index.get(locationId) ?? new Set<number>()
    set.add(employeeId)
    index.set(locationId, set)
  }
  for (const location of snapshot.locations) {
    for (const id of location.employee_ids ?? []) add(location.id, id)
    if (!index.has(location.id)) index.set(location.id, new Set())
  }
  for (const employee of snapshot.employees) {
    for (const ref of employee.assigned_locations) {
      const id = ref.id ?? snapshot.locations.find((location) => location.name === ref.name)?.id ?? null
      add(id, employee.employee_id)
    }
  }
  return index
}

/** Locations, with assignments filled in from the live map when the list endpoint does not include them. */
export async function loadLocationsWithAssignments(includeInactive: boolean) {
  const locations = await attendanceLocationsService.listLocations(includeInactive)
  if (locations.every((location) => location.employee_ids !== null)) return locations
  try {
    const index = assignmentIndex(await attendanceLocationsService.getLocationMap())
    return locations.map((location) => {
      if (location.employee_ids !== null) return location
      const ids = index.get(location.id)
      return ids ? { ...location, employee_ids: [...ids], employees_count: location.employees_count ?? ids.size } : location
    })
  } catch {
    return locations
  }
}

/** Assigned employee ids of one location, or null when they cannot be known. */
export async function loadAssignedEmployeeIds(location: AttendanceLocation) {
  if (location.employee_ids !== null) return location.employee_ids
  const ids = assignmentIndex(await attendanceLocationsService.getLocationMap()).get(location.id)
  return ids ? [...ids] : null
}

/* ── employees (CIMS users) ────────────────────────────────── */

export type EmployeeOption = { id: number; name: string; hint: string | null }

/** attendanceService.getUsers() → sorted { id, name, hint } rows (accepts a bare array or { items }). */
export function toEmployeeOptions(payload: unknown): EmployeeOption[] {
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : []
  const options: EmployeeOption[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const user = row as { id?: unknown; name?: unknown; surname?: unknown; full_name?: unknown; email?: unknown }
    const id = typeof user.id === 'number' ? user.id : Number(user.id)
    if (!Number.isFinite(id)) continue
    const fullName = typeof user.full_name === 'string' && user.full_name.trim()
      ? user.full_name.trim()
      : [user.name, user.surname].filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(' ').trim()
    const email = typeof user.email === 'string' && user.email.trim() ? user.email.trim() : null
    options.push({ id, name: fullName || email || `#${id}`, hint: fullName ? email : null })
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
}
