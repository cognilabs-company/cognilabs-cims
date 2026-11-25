import type { CardRecord } from '../../../shared/api/services/projects.service'

/* "Qaysi statusda qancha vaqt": per-task breakdown built from card.status_history.
   The open visit (no ended_at) is counted up to `now`, so it keeps growing while the modal is open. */

/** Backend timestamps are UTC without a zone ("2026-11-20T05:00:00"); read those as UTC, not browser-local. */
export function parseUtc(value: string | null | undefined) {
  if (!value) return Number.NaN
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) || !value.includes('T') ? value : `${value}Z`)
}

export type StatusVisit = {
  key: string
  name: string
  start: number
  end: number
  seconds: number
  open: boolean
  /** Enriched history only: the status it came from (null on the first entry = "created in"). */
  from: string | null
  /** Who moved it; null = unknown. */
  by: string | null
  /** When it was moved (UTC ms), NaN when not sent. */
  changedAt: number
  /** The backend sent from/to/actor fields for this entry, so the transition can be shown. */
  detailed: boolean
}

export type StatusTotal = {
  key: string
  name: string
  seconds: number
  visits: number
  open: boolean
  share: number
  colorIndex: number
}

export type StatusTimeSummary = {
  visits: StatusVisit[]
  totals: StatusTotal[]
  totalSeconds: number
  /** Status the card is sitting in right now (open visit), if any. */
  current: StatusVisit | null
}

function visitSeconds(start: number, end: number, fallback: number | null) {
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return Math.round((end - start) / 1000)
  return Math.max(0, fallback ?? 0)
}

export function summarizeStatusTime(card: Pick<CardRecord, 'status_history'>, now = Date.now()): StatusTimeSummary {
  const visits: StatusVisit[] = []
  for (const entry of card.status_history ?? []) {
    const name = (entry.to_status ?? entry.column_name)?.trim()
    if (!name) continue
    const changedAt = parseUtc(entry.changed_at)
    const entered = parseUtc(entry.started_at)
    const start = Number.isFinite(entered) ? entered : changedAt
    const open = entry.is_current ?? !entry.ended_at
    const end = open ? now : parseUtc(entry.ended_at)
    // Closed visits trust the backend duration; the open one is recomputed live.
    const seconds = !open && entry.duration_seconds !== null ? Math.max(0, entry.duration_seconds) : visitSeconds(start, end, entry.duration_seconds)
    const detailed = entry.to_status !== null || entry.changed_at !== null || entry.changed_by_name !== null
    visits.push({ key: name.toLowerCase(), name, start, end, seconds, open, from: entry.from_status?.trim() || null, by: entry.changed_by_name?.trim() || null, changedAt, detailed })
  }
  visits.sort((a, b) => (Number.isFinite(a.start) ? a.start : 0) - (Number.isFinite(b.start) ? b.start : 0))

  const byKey = new Map<string, StatusTotal>()
  for (const visit of visits) {
    const total = byKey.get(visit.key) ?? { key: visit.key, name: visit.name, seconds: 0, visits: 0, open: false, share: 0, colorIndex: byKey.size }
    total.seconds += visit.seconds
    total.visits += 1
    total.open = total.open || visit.open
    byKey.set(visit.key, total)
  }
  const totalSeconds = [...byKey.values()].reduce((sum, total) => sum + total.seconds, 0)
  const totals = [...byKey.values()].map((total) => ({ ...total, share: totalSeconds ? total.seconds / totalSeconds : 0 }))

  return { visits, totals, totalSeconds, current: [...visits].reverse().find((visit) => visit.open) ?? null }
}

/** Seconds the card has been in its current status, live; falls back to the backend snapshot. */
export function currentStatusSeconds(card: Pick<CardRecord, 'status_history' | 'current_status_duration_seconds'>, now = Date.now()) {
  const open = [...(card.status_history ?? [])].reverse().find((entry) => (entry.is_current ?? !entry.ended_at) && entry.started_at)
  if (open) {
    const start = parseUtc(open.started_at)
    if (Number.isFinite(start) && now >= start) return Math.round((now - start) / 1000)
  }
  return card.current_status_duration_seconds ?? null
}

/** A moment shown on the Tashkent clock (UTC+5), whatever the browser's own zone is. */
export function formatTashkent(ms: number, locale: string) {
  if (!Number.isFinite(ms)) return '—'
  const tag = locale === 'uz' ? 'uz-Latn-UZ' : locale === 'ru' ? 'ru-RU' : 'en-GB'
  return new Intl.DateTimeFormat(tag, { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

/** Distinct, theme-safe colours for statuses in order of first appearance. */
export const STATUS_COLORS = ['#2B59FF', '#7C5CFC', '#D9A400', '#0EA5A4', '#E8590C', '#17924A', '#D6336C', '#5C7CFA', '#868E96']

export const statusColor = (index: number) => STATUS_COLORS[index % STATUS_COLORS.length]

export function formatSpan(seconds: number | null | undefined, units: { d: string; h: string; m: string }) {
  if (seconds === null || seconds === undefined || seconds < 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days) return hours ? `${days}${units.d} ${hours}${units.h}` : `${days}${units.d}`
  if (hours) return minutes ? `${hours}${units.h} ${minutes}${units.m}` : `${hours}${units.h}`
  return `${Math.max(minutes, seconds > 0 ? 1 : 0)}${units.m}`
}
