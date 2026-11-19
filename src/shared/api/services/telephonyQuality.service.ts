import { request } from '../http'

/* Call quality (/telephony-quality): the AI listens to a recorded call and grades it against the
   company's call script and sales script. Field names differ between backend versions, so every
   answer goes through a normaliser below. Scores are always returned on a 0–100 scale. */

export type QualityStatus = 'none' | 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export type QualityCriterion = {
  id: string
  title: string
  /** Which block of the grade it belongs to. */
  group: 'call_script' | 'analysis' | 'sales_script' | 'other'
  score: number | null
  passed: boolean | null
  comment: string | null
}

export type CallQuality = {
  callId: number
  status: QualityStatus
  overall: number | null
  /** Followed the call script (greeting, introduction, needs, closing…). */
  callScript: number | null
  /** How well the seller understood and handled the client (analysis of the conversation). */
  analysis: number | null
  /** Followed the sales script (offer, objections, next step). */
  salesScript: number | null
  summary: string | null
  strengths: string[]
  mistakes: string[]
  recommendations: string[]
  criteria: QualityCriterion[]
  transcript: string | null
  sellerName: string | null
  customerName: string | null
  phone: string | null
  callStartedAt: string | null
  analyzedAt: string | null
  error: string | null
}

export type QualityStats = {
  analyzed: number
  /** Waiting in the queue plus being graded right now: the backend's `pending` already includes `processing`. */
  pending: number
  /** Being graded right now (part of `pending`, never add the two). */
  processing: number
  failed: number
  average: number | null
  callScript: number | null
  analysis: number | null
  salesScript: number | null
  /** Completed analyses only, already sorted by `average` descending. The three part-scores exist only at the top level. */
  bySeller: Array<{ userId: number | null; name: string; count: number; average: number | null }>
}

/** `callScript` and `salesScript` are graded separately (call_script_score / sales_script_score);
    `content` is the older single text, still sent so the backend keeps its general rules. */
export type SalesScript = { title: string; content: string; callScript: string; salesScript: string; updatedAt: string | null; updatedBy: string | null }

export type SalesScriptInput = Pick<SalesScript, 'title' | 'content' | 'callScript' | 'salesScript'>

/** `dateFrom` / `dateTo` are ISO 8601 with an offset (e.g. 2026-11-19T00:00:00+05:00), applied to the call's
    `started_at` inclusively. A bare YYYY-MM-DD would be read as UTC midnight, and `date_to` as the start of that day. */
export type QualityStatsFilter = { dateFrom?: string; dateTo?: string; userId?: number }

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

/** Start (00:00:00) or end (23:59:59.999999) of the Tashkent calendar day `daysAgo` days before today, as ISO 8601 +05:00.
    Tashkent has no DST, so the offset is fixed. */
export function tashkentDayBound(daysAgo: number, edge: 'start' | 'end') {
  const shifted = new Date(Date.now() + 5 * 3_600_000 - daysAgo * 86_400_000)
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
  return `${day}T${edge === 'start' ? '00:00:00' : '23:59:59.999999'}+05:00`
}

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const num = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function listOf(value: unknown, keys = ['items', 'results', 'data', 'calls', 'analyses']): unknown[] {
  if (Array.isArray(value)) return value
  if (isObject(value)) for (const key of keys) if (Array.isArray(value[key])) return value[key] as unknown[]
  return []
}

/** The backend scores (overall and every criterion) are integers 0–100; a score with its own `max` is scaled to 0–100.
    No guessing of 0–10 scales: a real 8/100 must stay 8, not become 80. */
function percent(value: unknown, max?: unknown): number | null {
  const score = num(value)
  if (score === null) return null
  const outOf = num(max)
  const scaled = outOf && outOf > 0 ? (score / outOf) * 100 : score
  return Math.round(Math.max(0, Math.min(100, scaled)))
}

function firstScore(source: Loose, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (isObject(value)) {
      const nested = percent(value.score ?? value.value ?? value.percent, value.max_score ?? value.max)
      if (nested !== null) return nested
    } else {
      const direct = percent(value)
      if (direct !== null) return direct
    }
  }
  return null
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\n+/).map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)
  if (!Array.isArray(value)) return []
  return value.map((entry) => (typeof entry === 'string' ? entry : isObject(entry) ? str(entry.text ?? entry.title ?? entry.comment ?? entry.description) : null)).filter((entry): entry is string => Boolean(entry))
}

function groupOf(raw: string | null): QualityCriterion['group'] {
  const key = (raw ?? '').toLowerCase()
  if (key.includes('sales') || key.includes('sotuv') || key.includes('offer') || key.includes('objection') || key.includes('close')) return 'sales_script'
  if (key.includes('analys') || key.includes('tahlil') || key.includes('need') || key.includes('listen') || key.includes('ehtiyoj')) return 'analysis'
  if (key.includes('call') || key.includes('script') || key.includes('greet') || key.includes('salom') || key.includes('intro')) return 'call_script'
  return 'other'
}

function normalizeCriteria(source: Loose): QualityCriterion[] {
  const raw = source.criteria ?? source.checklist ?? source.items ?? source.script_steps ?? source.steps ?? source.evaluation ?? null
  const entries: Array<[string | null, unknown]> = Array.isArray(raw)
    ? raw.map((entry) => [null, entry])
    : isObject(raw) ? Object.entries(raw) : []
  return entries.flatMap(([key, entry], index) => {
    if (!isObject(entry)) {
      const score = percent(entry)
      return key ? [{ id: key, title: key.replace(/_/g, ' '), group: groupOf(key), score, passed: typeof entry === 'boolean' ? entry : null, comment: null }] : []
    }
    const title = str(entry.title) ?? str(entry.name) ?? str(entry.step) ?? str(entry.criterion) ?? (key ? key.replace(/_/g, ' ') : null)
    if (!title) return []
    const passed = typeof entry.passed === 'boolean' ? entry.passed : typeof entry.done === 'boolean' ? entry.done : typeof entry.ok === 'boolean' ? entry.ok : null
    return [{
      id: str(entry.id) ?? key ?? `criterion-${index}`,
      title,
      group: groupOf(str(entry.group) ?? str(entry.category) ?? str(entry.section) ?? str(entry.type) ?? key ?? title),
      score: percent(entry.score ?? entry.value, entry.max_score ?? entry.max) ?? (passed === null ? null : passed ? 100 : 0),
      passed,
      comment: str(entry.comment) ?? str(entry.feedback) ?? str(entry.reason) ?? str(entry.evidence),
    }]
  })
}

function normalizeStatus(value: unknown, hasScore: boolean): QualityStatus {
  const key = (str(value) ?? '').toLowerCase()
  if (['completed', 'done', 'success', 'analyzed', 'finished'].includes(key)) return 'completed'
  if (['pending', 'queued', 'waiting', 'new'].includes(key)) return 'pending'
  if (['processing', 'running', 'in_progress', 'transcribing', 'analyzing'].includes(key)) return 'processing'
  if (['failed', 'error'].includes(key)) return 'failed'
  if (['skipped', 'no_recording', 'too_short'].includes(key)) return 'skipped'
  return hasScore ? 'completed' : 'none'
}

export function normalizeCallQuality(raw: unknown, fallbackCallId = 0): CallQuality | null {
  if (!isObject(raw)) return null
  const outer = raw
  const source = isObject(raw.analysis) ? { ...raw, ...raw.analysis } : isObject(raw.result) ? { ...raw, ...raw.result } : raw
  const scores = isObject(source.scores) ? { ...source, ...source.scores } : source
  const call = isObject(outer.call) ? outer.call : {}
  const overall = firstScore(scores, ['overall_score', 'total_score', 'score', 'overall', 'quality_score', 'percent'])
  return {
    callId: num(source.call_id) ?? num(call.id) ?? num(outer.id) ?? fallbackCallId,
    status: normalizeStatus(source.status ?? outer.status, overall !== null),
    overall,
    callScript: firstScore(scores, ['call_script_score', 'script_score', 'call_script', 'script_adherence', 'script']),
    analysis: firstScore(scores, ['analysis_score', 'conversation_score', 'analysis', 'needs_analysis_score', 'communication_score']),
    salesScript: firstScore(scores, ['sales_script_score', 'sales_score', 'sales_script', 'sales']),
    summary: str(source.summary) ?? str(source.feedback) ?? str(source.conclusion),
    strengths: strings(source.strengths ?? source.positives ?? source.good),
    mistakes: strings(source.mistakes ?? source.weaknesses ?? source.issues ?? source.negatives),
    recommendations: strings(source.recommendations ?? source.suggestions ?? source.improvements ?? source.advice),
    criteria: normalizeCriteria(source),
    transcript: str(source.transcript) ?? str(source.transcription) ?? str(source.text),
    sellerName: str(source.user_name) ?? str(source.seller_name) ?? str(call.user_name) ?? (isObject(source.user) ? str(source.user.full_name) ?? str(source.user.name) : null),
    customerName: str(source.customer_name) ?? str(call.customer_name),
    phone: str(source.phone_number) ?? str(call.phone_number),
    callStartedAt: str(source.call_started_at) ?? str(source.started_at) ?? str(call.started_at),
    analyzedAt: str(source.analyzed_at) ?? str(source.completed_at) ?? str(source.updated_at),
    error: str(source.error) ?? str(source.error_message) ?? str(source.failure_reason),
  }
}

function normalizeStats(raw: unknown): QualityStats {
  const source = isObject(raw) ? (isObject(raw.summary) ? { ...raw, ...raw.summary } : raw) : {}
  const byStatus = isObject(source.by_status) ? source.by_status : isObject(source.status_counts) ? source.status_counts : {}
  return {
    analyzed: num(source.analyzed) ?? num(source.completed) ?? num(byStatus.completed) ?? num(source.total_analyzed) ?? 0,
    pending: num(source.pending) ?? num(byStatus.pending) ?? 0,
    processing: num(source.processing) ?? num(byStatus.processing) ?? 0,
    failed: num(source.failed) ?? num(byStatus.failed) ?? 0,
    average: firstScore(source, ['average_score', 'avg_score', 'average', 'avg_overall_score', 'overall_average']),
    callScript: firstScore(source, ['avg_call_script_score', 'call_script_average', 'avg_script_score']),
    analysis: firstScore(source, ['avg_analysis_score', 'analysis_average']),
    salesScript: firstScore(source, ['avg_sales_script_score', 'sales_script_average', 'avg_sales_score']),
    bySeller: listOf(source.by_user ?? source.by_seller ?? source.users ?? [], ['items']).filter(isObject).map((entry) => ({
      userId: num(entry.user_id) ?? num(entry.id),
      name: str(entry.user_name) ?? str(entry.full_name) ?? str(entry.name) ?? '—',
      count: num(entry.count) ?? num(entry.completed) ?? num(entry.analyzed) ?? num(entry.total) ?? 0,
      average: firstScore(entry, ['average_score', 'avg_score', 'average', 'avg_overall_score']),
    })),
  }
}

function normalizeScript(raw: unknown): SalesScript {
  const source = isObject(raw) ? (isObject(raw.script) ? raw.script : raw) : {}
  return {
    title: str(source.title) ?? '',
    content: str(source.content) ?? str(source.text) ?? '',
    callScript: str(source.call_script) ?? '',
    salesScript: str(source.sales_script) ?? '',
    updatedAt: str(source.updated_at),
    updatedBy: str(source.updated_by_name) ?? (isObject(source.updated_by) ? str(source.updated_by.full_name) : null),
  }
}

export const telephonyQualityService = {
  async calls(params: { status?: string; userId?: number; page?: number; pageSize?: number } = {}) {
    const raw = await request<unknown>({
      path: '/telephony-quality/calls',
      query: { status: params.status, user_id: params.userId, page: params.page ?? 1, page_size: params.pageSize ?? 30 },
    })
    const items = listOf(raw).map((entry) => normalizeCallQuality(entry)).filter((entry): entry is CallQuality => entry !== null)
    const total = isObject(raw) ? num(raw.total) ?? num(raw.total_count) ?? items.length : items.length
    return { items, total }
  },

  /** null when the call has never been analysed (404). */
  async call(callId: number) {
    try {
      return normalizeCallQuality(await request<unknown>({ path: `/telephony-quality/calls/${callId}` }), callId)
    } catch (error) {
      if ((error as { status?: number } | null)?.status === 404) return null
      throw error
    }
  },

  async analyze(callId: number, force = false) {
    return normalizeCallQuality(await request<unknown>({ path: `/telephony-quality/calls/${callId}/analyze`, method: 'POST', body: { force } }), callId)
  },

  async stats(filter: QualityStatsFilter = {}) {
    return normalizeStats(await request<unknown>({
      path: '/telephony-quality/stats',
      query: { date_from: filter.dateFrom, date_to: filter.dateTo, user_id: filter.userId },
    }))
  },

  async script() {
    return normalizeScript(await request<unknown>({ path: '/telephony-quality/script' }))
  },

  async saveScript(script: SalesScriptInput) {
    return normalizeScript(await request<unknown>({
      path: '/telephony-quality/script',
      method: 'PUT',
      body: { title: script.title, content: script.content, call_script: script.callScript || null, sales_script: script.salesScript || null },
    }))
  },

  async settings() {
    const raw = await request<unknown>({ path: '/telephony-quality/settings' })
    return { enabled: isObject(raw) ? raw.enabled !== false : true }
  },

  async setEnabled(enabled: boolean) {
    await request<unknown>({ path: '/telephony-quality/settings', method: 'PATCH', body: { enabled } })
    return { enabled }
  },
}
