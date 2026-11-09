import { normalizePhone, type TelephonyCall } from '../../../shared/api/services/telephony.service'
import { getIntlLocale, getStoredLocale, translateCurrent as tr } from '../../../shared/i18n/translations'

// Browser ICU data for uz-UZ is patchy ("Sha", "26-10-28"), so Uzbek names are spelled out here.
const uzWeekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const uzMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const pad2 = (value: number) => String(value).padStart(2, '0')

function weekdayName(date: Date) {
  return getStoredLocale() === 'uz' ? uzWeekdays[date.getDay()] : date.toLocaleDateString(getIntlLocale(), { weekday: 'long' })
}

function shortDate(date: Date) {
  return getStoredLocale() === 'en'
    ? date.toLocaleDateString(getIntlLocale(), { day: '2-digit', month: '2-digit', year: '2-digit' })
    : `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`
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

export function formatCallDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(getIntlLocale())
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

/** Right-hand label in the Recents list: "11:05", "Yesterday", "Monday", "03.11.26". */
export function formatRecentTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = dayDiff(date)
  if (diff <= 0) return timeOf(date)
  if (diff === 1) return tr('telephony.yesterday', 'Yesterday')
  if (diff < 7) return weekdayName(date)
  return shortDate(date)
}

/** Day + time for the inspector: "Today · 11:05", "Yesterday · 08:14", "3 Nov · 14:20". */
export function formatDayTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const diff = dayDiff(date)
  const day = diff <= 0
    ? tr('telephony.today', 'Today')
    : diff === 1
      ? tr('telephony.yesterday', 'Yesterday')
      : dayMonth(date, diff > 300)
  return `${day} · ${timeOf(date)}`
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

export function statusTone(value: string) {
  if (value === 'answered' || value === 'completed') return 'text-[var(--success-text)] bg-[var(--success-dim)]'
  if (value === 'missed' || value === 'failed') return 'text-[var(--danger-text)] bg-[var(--danger-dim)]'
  if (value === 'rejected' || value === 'busy') return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30'
  return 'text-[var(--blue-text)] bg-[var(--blue-dim)]'
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

/** Recents row: consecutive calls with the same number + same kind collapse into one row, "(3)". */
export type RecentGroup = {
  key: string
  head: TelephonyCall
  calls: TelephonyCall[]
  missed: boolean
}

export function groupRecents(items: TelephonyCall[]): RecentGroup[] {
  const groups: RecentGroup[] = []
  for (const call of items) {
    const missed = isUnanswered(call)
    const last = groups[groups.length - 1]
    const sameDay = last && new Date(last.head.started_at).toDateString() === new Date(call.started_at).toDateString()
    if (
      last
      && sameDay
      && normalizePhone(last.head.phone_number) === normalizePhone(call.phone_number)
      && last.head.direction === call.direction
      && last.missed === missed
    ) {
      last.calls.push(call)
      continue
    }
    groups.push({ key: `g-${call.id}`, head: call, calls: [call], missed })
  }
  return groups
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

export function isToday(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && dayDiff(date) <= 0
}
