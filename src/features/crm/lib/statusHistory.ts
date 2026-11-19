/* GET /crm/customers/{id}/status-history → one clean list of "from → to" steps with how long the lead stayed in each status. */

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  if (isObject(value)) return text(value.name ?? value.value ?? value.label ?? value.status)
  return null
}

function pick(entry: Loose, keys: string[]) {
  for (const key of keys) {
    const value = text(entry[key])
    if (value) return value
  }
  return null
}

function seconds(entry: Loose, keys: string[]) {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return key.includes('minute') ? value * 60 : key.includes('hour') ? value * 3600 : value
  }
  return null
}

function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isObject(value)) {
    for (const key of ['items', 'history', 'status_history', 'data', 'results', 'changes']) {
      if (Array.isArray(value[key])) return value[key] as unknown[]
    }
  }
  return []
}

export type StatusStep = {
  id: string
  /** null for the first status a lead got when it was created. */
  from: string | null
  to: string
  at: string
  by: string | null
  /** How long the lead stayed in `to` (until the next change, or until now for the current status). */
  durationMs: number
  current: boolean
}

/** The backend sends naive UTC timestamps ("2026-11-15T10:55:32.72"); without a zone the browser would read them as local time. */
const time = (value: string) => new Date(/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value) ? `${value}Z` : value).getTime()

/**
 * Accepts the shapes the backend uses for history lists ({items:[…]}, plain arrays…) and the usual field
 * names (old_status / new_status, from_status / to_status, changed_at / created_at…). Oldest first.
 * When the backend sends its own duration it wins over the one counted from the dates.
 * Rows that come with `entered_at` (the documented /status-history shape) keep the backend's order, because
 * their timestamps are not always consistent with each other; other shapes are sorted by date.
 */
export function normalizeStatusHistory(raw: unknown, now = Date.now()): StatusStep[] {
  const rows = listOf(raw)
    .filter(isObject)
    .map((entry, index) => {
      const at = pick(entry, ['changed_at', 'created_at', 'timestamp', 'at', 'date', 'entered_at', 'started_at'])
      const to = pick(entry, ['to_status', 'new_status', 'status_to', 'status', 'to', 'new_status_name', 'status_name'])
      return {
        id: pick(entry, ['id', 'change_id']) ?? `step-${index}`,
        from: pick(entry, ['from_status', 'old_status', 'status_from', 'previous_status', 'from', 'old_status_name']),
        to,
        at,
        by: pick(entry, ['changed_by_name', 'changed_by_full_name', 'user_full_name', 'user_name', 'actor_name', 'created_by_full_name', 'changed_by']),
        given: seconds(entry, ['duration_seconds', 'time_in_status_seconds', 'seconds_in_status', 'duration_minutes', 'duration_hours']),
        open: 'left_at' in entry ? entry.left_at === null || entry.left_at === undefined : null,
        ordered: 'entered_at' in entry,
      }
    })
    .filter((row): row is typeof row & { to: string; at: string } => Boolean(row.to && row.at && !Number.isNaN(time(row.at))))
  if (!rows.every((row) => row.ordered)) rows.sort((a, b) => time(a.at) - time(b.at))

  return rows.map((row, index) => {
    const next = rows[index + 1]
    const end = next ? time(next.at) : now
    return {
      id: row.id,
      from: row.from ?? (index > 0 ? rows[index - 1].to : null),
      to: row.to,
      at: row.at,
      by: row.by,
      durationMs: row.given !== null ? row.given * 1000 : Math.max(0, end - time(row.at)),
      current: row.open ?? !next,
    }
  })
}

/** Total time per status (a lead can come back to the same status). Longest first. */
export function timePerStatus(steps: StatusStep[]) {
  const totals = new Map<string, number>()
  for (const step of steps) totals.set(step.to, (totals.get(step.to) ?? 0) + step.durationMs)
  return [...totals.entries()].map(([status, ms]) => ({ status, ms })).sort((a, b) => b.ms - a.ms)
}

/** 3 d 4 h · 5 h 12 min · 7 min · <1 min */
export function formatSpan(ms: number, unit: { d: string; h: string; m: string; lessMinute: string }) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return unit.lessMinute
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return hours ? `${days} ${unit.d} ${hours} ${unit.h}` : `${days} ${unit.d}`
  if (hours > 0) return mins ? `${hours} ${unit.h} ${mins} ${unit.m}` : `${hours} ${unit.h}`
  return `${mins} ${unit.m}`
}
