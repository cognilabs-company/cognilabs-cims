import { normalizePhone, type TelephonyCall } from '../../../shared/api/services/telephony.service'
import { getIntlLocale, getStoredLocale, translateCurrent as tr } from '../../../shared/i18n/translations'

// Browser ICU data for uz-UZ is patchy ("Sha", "26-10-28"), so Uzbek names are spelled out here.
const uzWeekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const uzMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const uzMonthsLong = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const pad2 = (value: number) => String(value).padStart(2, '0')

function weekdayName(date: Date) {
  return getStoredLocale() === 'uz' ? uzWeekdays[date.getDay()] : date.toLocaleDateString(getIntlLocale(), { weekday: 'long' })
}

function dayMonthLong(date: Date, withYear: boolean) {
  if (getStoredLocale() === 'uz') return `${date.getDate()}-${uzMonthsLong[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}`
  return date.toLocaleDateString(getIntlLocale(), { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) })
}

function capitalize(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value
}

function dayMonth(date: Date, withYear: boolean) {
  if (getStoredLocale() === 'uz') return `${date.getDate()}-${uzMonths[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}`
  return date.toLocaleDateString(getIntlLocale(), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/** Human talk time in the macOS Phone style: "13 s", "4 min 05 s", "1 h 02 min". */
export function formatTalkTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  if (safe < 60) return tr('telephony.duration.seconds', '{{s}} s', { s: safe })
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return tr('telephony.duration.hours', '{{h}} h {{m}} min', { h, m: String(m).padStart(2, '0') })
  return tr('telephony.duration.minutes', '{{m}} min {{s}} s', { m, s: String(s).padStart(2, '0') })
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function dayDiff(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
}

function timeOf(date: Date) {
  return date.toLocaleTimeString(getIntlLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "Today", "Yesterday", "Monday" (this week) or "9 Nov" — the day a call happened, said like a person would. */
export function dayLabel(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = dayDiff(date)
  if (diff <= 0) return tr('telephony.today', 'Today')
  if (diff === 1) return tr('telephony.yesterday', 'Yesterday')
  if (diff < 7) return capitalize(weekdayName(date))
  return dayMonth(date, date.getFullYear() !== new Date().getFullYear())
}

/** "19:23" */
export function clockTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : timeOf(date)
}

/** When a call happened: "Yesterday, 19:23", "Today, 11:05", "Monday, 08:40", "3 Nov, 14:20". */
export function formatDayTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${dayLabel(value)}, ${timeOf(date)}`
}

/** Day group header: { title: "Yesterday", date: "10 November, Tuesday" } or { title: "Monday", date: "3 November" }. */
export function dayHeading(value: string) {
  const date = new Date(value)
  const diff = dayDiff(date)
  const long = dayMonthLong(date, date.getFullYear() !== new Date().getFullYear())
  if (diff <= 1) return { title: diff <= 0 ? tr('telephony.today', 'Today') : tr('telephony.yesterday', 'Yesterday'), date: `${long}, ${weekdayName(date)}` }
  return { title: capitalize(weekdayName(date)), date: long }
}

/** Calendar day of a timestamp in local time — the key calls are grouped by. */
export function dayKeyOf(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Compact talk time for list pills: "0:42", "4:05", "1:02:09". */
export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = pad2(safe % 60)
  return h > 0 ? `${h}:${pad2(m)}:${s}` : `${m}:${s}`
}

export type CallPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

/** "2026-11-11T00:00:00+05:00" — local wall time with its UTC offset, the format the API uses. */
function localIso(date: Date) {
  const offset = -date.getTimezoneOffset()
  const abs = Math.abs(offset)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${offset >= 0 ? '+' : '-'}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

function dayStart(base: Date, back = 0) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - back, 0, 0, 0)
}

function dayEnd(base: Date, back = 0) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - back, 23, 59, 59)
}

function parseDay(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/** date_from / date_to for a period preset; custom ranges take "YYYY-MM-DD" days (both ends inclusive). */
export function periodRange(period: CallPeriod, customFrom = '', customTo = '', now = new Date()): { date_from?: string; date_to?: string } {
  switch (period) {
    case 'today': return { date_from: localIso(dayStart(now)), date_to: localIso(dayEnd(now)) }
    case 'yesterday': return { date_from: localIso(dayStart(now, 1)), date_to: localIso(dayEnd(now, 1)) }
    case 'week': return { date_from: localIso(dayStart(now, 6)), date_to: localIso(dayEnd(now)) }
    case 'month': return { date_from: localIso(dayStart(now, 29)), date_to: localIso(dayEnd(now)) }
    case 'custom': {
      const from = parseDay(customFrom)
      const to = parseDay(customTo)
      return { date_from: from ? localIso(dayStart(from)) : undefined, date_to: to ? localIso(dayEnd(to)) : undefined }
    }
    default: return {}
  }
}

/** Short label for a custom range chip: "3 Nov – 9 Nov", "from 3 Nov", "until 9 Nov". */
export function rangeLabel(from: string, to: string) {
  const a = parseDay(from)
  const b = parseDay(to)
  const year = new Date().getFullYear()
  const fa = a ? dayMonth(a, a.getFullYear() !== year) : ''
  const fb = b ? dayMonth(b, b.getFullYear() !== year) : ''
  if (a && b) return fa === fb ? fa : `${fa} – ${fb}`
  if (a) return tr('telephony.range.from', 'from {{date}}', { date: fa })
  if (b) return tr('telephony.range.until', 'until {{date}}', { date: fb })
  return ''
}

/** "Wednesday, 11 November" — today's date for the page header. */
export function todayLong(now = new Date()) {
  return `${capitalize(weekdayName(now))}, ${dayMonthLong(now, false)}`
}

export function statusLabel(value: string) {
  return tr(`telephony.status.${value}`, value.charAt(0).toUpperCase() + value.slice(1))
}

export function sourceLabel(source: string | null | undefined) {
  if (!source) return null
  return source === 'crm_outbound' ? tr('telephony.source.crm_outbound', 'Outbound CRM') : tr('telephony.source.crm', 'CRM')
}

export function connectionLabel(value: string) {
  return tr(`telephony.connection.${value}`, value)
}

/** A call that never connected — shown in red, like a missed call on iPhone/Mac. */
export function isUnanswered(call: Pick<TelephonyCall, 'status' | 'talk_seconds'>) {
  return ['missed', 'rejected', 'busy', 'failed'].includes(call.status) && !(call.talk_seconds > 0)
}

/** Title for a single call row in the inspector: "Incoming call", "Missed call", "Cancelled call"… */
export function callKindLabel(call: Pick<TelephonyCall, 'direction' | 'status' | 'talk_seconds'>) {
  if (call.status === 'ringing') return call.direction === 'incoming' ? tr('telephony.kind.incoming_ringing', 'Incoming · ringing') : tr('telephony.kind.calling', 'Calling…')
  if (call.status === 'answered') return tr('telephony.kind.in_progress', 'Call in progress')
  if (isUnanswered(call)) {
    if (call.direction === 'incoming') return call.status === 'rejected' ? tr('telephony.kind.declined', 'Declined call') : tr('telephony.kind.missed', 'Missed call')
    return call.status === 'busy' ? tr('telephony.kind.busy', 'Busy') : tr('telephony.kind.cancelled', 'Cancelled call')
  }
  return call.direction === 'incoming' ? tr('telephony.kind.incoming', 'Incoming call') : tr('telephony.kind.outgoing', 'Outgoing call')
}

export type CallTone = 'incoming' | 'outgoing' | 'missed' | 'live'

/** Colour family of a call in lists and badges: blue in, violet out, red unanswered, green live. */
export function callTone(call: Pick<TelephonyCall, 'direction' | 'status' | 'talk_seconds'>): CallTone {
  if (call.status === 'ringing' || call.status === 'answered') return 'live'
  if (isUnanswered(call)) return 'missed'
  return call.direction
}

/** Stable hue (0–359) from a name or number — tints the contact hero like a Contact Poster. */
export function hueOf(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return 200 + (hash % 80) // keep it in the calm blue → violet range
}

export function initialOf(name: string | null | undefined) {
  const trimmed = (name ?? '').trim()
  if (!trimmed || /^[+\d\s()-]+$/.test(trimmed)) return ''
  return trimmed.charAt(0).toUpperCase()
}

/** "+998901234567" → "+998 90 123 45 67" (Uzbek numbers); other numbers are returned as-is. */
export function formatPhone(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  const digits = normalizePhone(raw)
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`
  }
  return raw || '-'
}

const uzMonthsTitle = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const uzWeekdaysShort = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']

/** "Noyabr 2026" — calendar header. */
export function monthTitle(year: number, month: number) {
  if (getStoredLocale() === 'uz') return `${uzMonthsTitle[month]} ${year}`
  return capitalize(new Date(year, month, 1).toLocaleDateString(getIntlLocale(), { month: 'long', year: 'numeric' }))
}

/** Monday-first short weekday names for a calendar grid. */
export function weekdaysShort() {
  if (getStoredLocale() === 'uz') return uzWeekdaysShort
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, index) => capitalize(new Date(2024, 0, 1 + index).toLocaleDateString(getIntlLocale(), { weekday: 'short' })))
}

/** "YYYY-MM-DD" of a local date. */
export function toDayString(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** "Chorshanba, 11-noyabr" for a "YYYY-MM-DD" day ('' when empty). */
export function dayLabelLong(day: string) {
  const date = parseDay(day)
  if (!date) return ''
  return `${capitalize(weekdayName(date))}, ${dayMonthLong(date, date.getFullYear() !== new Date().getFullYear())}`
}

/** Split "YYYY-MM-DD" into a weekday line and a date line (calendar header). */
export function dayParts(day: string) {
  const date = parseDay(day) ?? new Date()
  return { weekday: capitalize(weekdayName(date)), date: dayMonthLong(date, date.getFullYear() !== new Date().getFullYear()) }
}
