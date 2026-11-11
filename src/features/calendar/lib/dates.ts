import { toDayString } from '../../telephony/components/telephonyFormat'

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

/** Local day key of an event start (ISO date-time or plain day). */
export function dayOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toDayString(date)
}

export function timeOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Minutes from midnight (local) of an ISO date-time. */
export function minutesOf(value: string) {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

/** "YYYY-MM-DD" + "HH:MM" → local ISO string. */
export function joinDayTime(day: string, time: string) {
  const [h, m] = (time || '00:00').split(':').map(Number)
  const date = parseDay(day)
  date.setHours(h || 0, m || 0, 0, 0)
  return date.toISOString()
}
