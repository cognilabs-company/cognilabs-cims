
export { dayLabelLong, dayParts, monthTitle, toDayString, weekdaysShort } from '../../telephony/components/telephonyFormat'

export function parseDay(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Monday on or before the date. */
export function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

/** The 6×7 month grid (Monday first) around `date`'s month. */
export function monthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function weekDays(date: Date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/* Calendar times are shown in Asia/Tashkent (UTC+5 all year — no daylight saving). */
const TASHKENT_OFFSET_MIN = 5 * 60
export const TASHKENT_OFFSET = '+05:00'

/** Wall-clock parts in Tashkent of an ISO date-time. */
function tashkent(value: string) {
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return null
  const shifted = new Date(ms + TASHKENT_OFFSET_MIN * 60_000)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), h: shifted.getUTCHours(), min: shifted.getUTCMinutes() }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Tashkent day key (YYYY-MM-DD) of an event start (ISO date-time or plain day). */
export function dayOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = tashkent(value)
  return parts ? `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` : ''
}

/** Tashkent HH:MM of an ISO date-time ("" for a plain day). */
export function timeOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parts = tashkent(value)
  return parts ? `${pad(parts.h)}:${pad(parts.min)}` : ''
}

/** Minutes from midnight (Tashkent) of an ISO date-time. */
export function minutesOf(value: string) {
  const parts = tashkent(value)
  return parts ? parts.h * 60 + parts.min : 0
}

/** "YYYY-MM-DD" + "HH:MM" (Tashkent) → ISO date-time with the +05:00 offset. */
export function joinDayTime(day: string, time: string) {
  const [h, m] = (time || '00:00').split(':').map(Number)
  return `${day}T${pad(h || 0)}:${pad(m || 0)}:00${TASHKENT_OFFSET}`
}

/** Today in Tashkent (YYYY-MM-DD). */
export function tashkentToday() {
  return dayOf(new Date().toISOString())
}
