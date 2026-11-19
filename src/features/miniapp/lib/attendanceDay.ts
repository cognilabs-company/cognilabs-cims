/* Attendance days run 03:00 → next 03:00 in Asia/Tashkent (UTC+5, no DST). Times are shown in Tashkent. */

const TASHKENT_OFFSET_MS = 5 * 3_600_000
const DAY_START_MS = 3 * 3_600_000
const DAY_MS = 24 * 3_600_000

const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tashkent' })

/** "09:05" in Tashkent for an ISO time with an offset (never shifted twice). */
export function tashkentClock(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : clockFormat.format(date)
}

/** The 03:00 Tashkent that ends the attendance day containing `at` (epoch ms). */
export function dayEndAfter(at: number) {
  const local = at + TASHKENT_OFFSET_MS
  const start = Math.floor((local - DAY_START_MS) / DAY_MS) * DAY_MS + DAY_START_MS
  return start + DAY_MS - TASHKENT_OFFSET_MS
}

/** "2026-11-19" ± days. */
export function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

const uzMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

/** "19-noyabr" (uz) or the browser's "19 November" / "19 ноября". */
export function dayTitle(day: string, locale: string) {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  if (locale.startsWith('uz')) return `${date.getUTCDate()}-${uzMonths[date.getUTCMonth()]}`
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
}

/** 8:05:09 — a live timer. */
export function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
