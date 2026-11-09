import type { AppLocale } from '../../../shared/i18n/translations'

/**
 * Recall (call-back) times are scheduled on Tashkent wall-clock time
 * (UTC+5, no daylight saving), whatever time zone the browser is in.
 *
 * Rules:
 *  - a recall can't be on a day before today (Tashkent);
 *  - it must be at least RECALL_MIN_LEAD_MIN minutes from now (Tashkent).
 * The picker offers 5-minute slots.
 */
export const RECALL_MIN_LEAD_MIN = 6
export const RECALL_STEP_MIN = 5

const MINUTE = 60_000
const OFFSET_MS = 5 * 60 * MINUTE

/** A Tashkent wall-clock moment: date is YYYY-MM-DD. */
export type WallTime = { date: string; hour: number; minute: number }

const pad = (value: number) => String(value).padStart(2, '0')

export function wallFromInstant(ms: number): WallTime {
  const shifted = new Date(ms + OFFSET_MS)
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

export function instantFromWall(wall: WallTime): number {
  const [year, month, day] = wall.date.split('-').map(Number)
  return Date.UTC(year, month - 1, day, wall.hour, wall.minute) - OFFSET_MS
}

/** Value for the API: "2026-03-03T09:53:00+05:00". */
export function toRecallApiValue(wall: WallTime) {
  return `${wall.date}T${pad(wall.hour)}:${pad(wall.minute)}:00+05:00`
}

export function sameWall(a: WallTime | null, b: WallTime | null) {
  return Boolean(a && b && a.date === b.date && a.hour === b.hour && a.minute === b.minute)
}

/** The earliest instant allowed right now (now + 6 min, exact). */
export function recallLimit(now: number) {
  return now + RECALL_MIN_LEAD_MIN * MINUTE
}

export function isRecallAllowed(wall: WallTime, now: number) {
  return instantFromWall(wall) >= recallLimit(now)
}

/** First 5-minute slot that satisfies the rules. */
export function earliestRecallSlot(now: number): WallTime {
  const step = RECALL_STEP_MIN * MINUTE
  return wallFromInstant(Math.ceil(recallLimit(now) / step) * step)
}

/** Round an instant up to the next 5-minute slot. */
export function slotAtOrAfter(ms: number): WallTime {
  const step = RECALL_STEP_MIN * MINUTE
  return wallFromInstant(Math.ceil(ms / step) * step)
}

export function todayKey(now: number) {
  return wallFromInstant(now).date
}

export function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

export function formatClock(wall: WallTime) {
  return `${pad(wall.hour)}:${pad(wall.minute)}`
}

/* ── Calendar labels (explicit for Uzbek, Intl for the rest) ── */

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const UZ_WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const UZ_WEEKDAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const INTL: Record<Exclude<AppLocale, 'uz'>, string> = { ru: 'ru-RU', en: 'en-US' }

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1)

function utcDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function monthTitle(locale: AppLocale, year: number, monthIndex: number) {
  if (locale === 'uz') return `${UZ_MONTHS[monthIndex]} ${year}`
  const name = new Intl.DateTimeFormat(INTL[locale], { month: 'long', timeZone: 'UTC' }).format(Date.UTC(year, monthIndex, 1))
  return `${capitalize(name)} ${year}`
}

export function weekdayHeaders(locale: AppLocale) {
  if (locale === 'uz') return UZ_WEEKDAYS_SHORT
  const format = new Intl.DateTimeFormat(INTL[locale], { weekday: 'short', timeZone: 'UTC' })
  // 2024-01-01 was a Monday
  return Array.from({ length: 7 }, (_, index) => capitalize(format.format(Date.UTC(2024, 0, 1 + index)).replace('.', '')))
}

export function weekdayName(locale: AppLocale, dateKey: string) {
  if (locale === 'uz') return UZ_WEEKDAYS[weekdayIndex(dateKey)]
  return capitalize(new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', timeZone: 'UTC' }).format(utcDate(dateKey)))
}

/** "Payshanba, 12-noyabr" · "Четверг, 12 ноября" · "Thursday, November 12". */
export function formatDayLong(locale: AppLocale, dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  if (locale === 'uz') return `${weekdayName(locale, dateKey)}, ${day}-${UZ_MONTHS[month - 1].toLowerCase()}`
  return capitalize(new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utcDate(dateKey)))
}

/** "12-noy" · "12 нояб." · "Nov 12" — for tight spots. */
export function formatDayShort(locale: AppLocale, dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  if (locale === 'uz') return `${day}-${UZ_MONTHS[month - 1].slice(0, 3).toLowerCase()}`
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utcDate(dateKey))
}

/** Remaining time split into parts, e.g. { days: 1, hours: 2, minutes: 5 }. */
export function remainingParts(target: number, now: number) {
  const total = Math.max(0, Math.round((target - now) / MINUTE))
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 }
}
