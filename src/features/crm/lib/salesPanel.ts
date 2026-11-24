/*
 * "Savdo paneli" (task #667) — every number on /crm for the selected 7 / 30 / 90-day window.
 *
 * The result has the same shape as the planned `GET /crm/dashboard/summary?period=7|30|90`
 * (docs/CRM_DASHBOARD_SUMMARY_API.md). Until the backend ships it, the panel builds it here from
 * data the page already loads (all leads, dynamic statuses, sales-manager assignments), so the
 * frontend only has to drop this builder once the endpoint answers.
 *
 * Rules shared with the backend spec:
 *  - "in the period" = lead created_at (Tashkent time) within the last N days, today included;
 *  - funnel = the leads of the period by their CURRENT status, in /crm/statuses/dynamic order;
 *  - conversion = (project_started + project_finished) / leads of the period;
 *  - managers come only from /crm/sales-managers (real users) — never from assistant_name.
 */
import type { CustomerSummary, DynamicStatusOption } from '../../../shared/api/types'

export type PanelPeriod = 7 | 30 | 90

export const PANEL_PERIODS: PanelPeriod[] = [7, 30, 90]

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const TASHKENT_OFFSET = 5 * HOUR

/** The 10 sales statuses, in case /crm/statuses/dynamic is not loaded yet. */
export const DEFAULT_STATUS_ORDER = [
  'need_to_call',
  'contacted',
  'delayed',
  'meeting_scheduled',
  'creating_kp_tz',
  'payment_pending',
  'project_started',
  'project_finished',
  'ndz',
  'rejected',
]

/** Statuses shown under a separator at the bottom of the funnel (lost leads). */
export const LOST_STATUSES = new Set(['ndz', 'rejected'])
const CLOSED_STATUSES = new Set(['rejected', 'project_finished'])
const WON_STATUSES = new Set(['project_started', 'project_finished'])
/** "Uchrashuv va undan keyin" — the meeting stage and everything after it. */
const MEETING_PLUS = new Set(['meeting_scheduled', 'creating_kp_tz', 'payment_pending', 'project_started', 'project_finished'])

export const statusKey = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase().replace(/[\s/-]+/g, '_')

/* ── time ─────────────────────────────────────────────────────────────── */

/** Timestamps with a zone are exact; naive ones ("2026-11-19T22:54:00") are Tashkent wall time. */
export function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null
  const text = value.trim()
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(text)
  const naive = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(text)
  if (!hasZone && naive) {
    const [datePart, timePart = '00:00:00'] = text.split(/[ T]/)
    const [y, m, d] = datePart.split('-').map(Number)
    const [hh, mm, ss = '0'] = timePart.split(':')
    return Date.UTC(y, m - 1, d, Number(hh), Number(mm), Math.floor(Number(ss))) - TASHKENT_OFFSET
  }
  const ms = new Date(text).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Tashkent calendar day "YYYY-MM-DD" and hour of an instant. */
export function tashkentDay(ms: number) {
  return new Date(ms + TASHKENT_OFFSET).toISOString().slice(0, 10)
}
export function tashkentHour(ms: number) {
  return new Date(ms + TASHKENT_OFFSET).getUTCHours()
}
export function tashkentTime(ms: number) {
  return new Date(ms + TASHKENT_OFFSET).toISOString().slice(11, 16)
}
/** Midnight (Tashkent) of the day `ms` falls on. */
function dayStart(ms: number) {
  const shifted = ms + TASHKENT_OFFSET
  return shifted - (shifted % DAY) - TASHKENT_OFFSET
}

/* ── sources, services, phones ────────────────────────────────────────── */

export type SourceKey = 'facebook_ads' | 'ai_chat' | 'instagram' | 'telegram' | 'website' | 'other'

export const SOURCE_LABELS: Record<SourceKey, string> = {
  facebook_ads: 'Facebook Ads',
  ai_chat: 'AI chat',
  instagram: 'Instagram',
  telegram: 'Telegram',
  website: 'Website',
  other: 'Other',
}

const rawPlatform = (lead: CustomerSummary) =>
  (lead.platform ?? lead.platform_name ?? lead.source_platform ?? lead.lead_source ?? lead.source ?? lead.channel ?? '').trim()

/** "Facebook Ads" / "Facebook ads" / "Meta Ads" → facebook_ads, "Instagram" / "instagram" → instagram, Cognilabs AI chats → ai_chat. */
export function sourceOf(lead: CustomerSummary): SourceKey {
  const platform = rawPlatform(lead).toLowerCase()
  const assistant = (lead.assistant_name ?? '').toLowerCase()
  if (/cognilabs\s*ai|ai\s*chat|\bai\b/.test(assistant) || /ai\s*chat|cognilabs\s*ai/.test(platform)) return 'ai_chat'
  if (/facebook|meta|\bfb\b/.test(platform) || /facebook|meta ads/.test(assistant)) return 'facebook_ads'
  if (/insta/.test(platform)) return 'instagram'
  if (/telegram|\btg\b/.test(platform)) return 'telegram'
  if (/web|site|sayt/.test(platform)) return 'website'
  return 'other'
}

export type ServiceKey = 'ai' | 'crm_erp' | 'mobile_web' | 'other'

/** Which service the lead asked for in the form (Sheets notes: "Xizmat: …"), guessed from notes and AI summary. */
export function serviceOf(lead: CustomerSummary): ServiceKey {
  const text = `${lead.notes ?? ''} ${lead.aisummary ?? ''}`.toLowerCase()
  if (/sun'?i?y intellekt|sun.iy intellekt|\bai\b|ии|искусствен|chat ?bot|\bbot\b|call.?center/.test(text)) return 'ai'
  if (/\bcrm\b|\berp\b|avtomatlashtir|автоматиз|учет/.test(text)) return 'crm_erp'
  if (/mobil|mobile|ilova|\bapp\b|\bveb\b|\bweb\b|sayt|site|сайт|приложен/.test(text)) return 'mobile_web'
  return 'other'
}

/** +998XXXXXXXXX without the Sheets apostrophe, spaces or dashes; null when it is not a phone. */
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length < 7) return null
  if (digits.length === 9) return `+998${digits}`
  return `+${digits}`
}

const phoneOf = (lead: CustomerSummary) => lead.phone_number ?? lead.phone ?? null

const nameOf = (lead: CustomerSummary) =>
  (lead.full_name ?? lead.name ?? lead.customer_name ?? lead.display_name ?? '').trim()

/** Name field that is really an ID or a phone number ("1131869543049144", "Нодир +998…"). */
function nameLooksLikeId(lead: CustomerSummary) {
  const name = nameOf(lead)
  if (!name) return true
  return /\d{7,}/.test(name.replace(/[\s()-]/g, ''))
}

/* ── rejection reasons (same list as the reject dialog) ───────────────── */

export type RejectionKey = 'no_answer' | 'not_fit' | 'by_mistake' | 'solved_competitor' | 'small_turnover' | 'too_expensive' | 'other'

export const REJECTION_ORDER: RejectionKey[] = ['no_answer', 'not_fit', 'by_mistake', 'solved_competitor', 'small_turnover', 'too_expensive', 'other']

export function rejectionKeyOf(reason: string): RejectionKey {
  const text = reason.toLowerCase()
  if (/javob berma|aloqa yo|ko'?tarma|не отвеч|не бер|no answer|stopped answer|ndz|trubka/.test(text)) return 'no_answer'
  if (/adash|ошиб|mistake|bilmasdan|tasodif/.test(text)) return 'by_mistake'
  if (/raqobat|boshqa kompaniya|конкурент|competitor|another company|hal bo'?l|решил/.test(text)) return 'solved_competitor'
  if (/oborot|kichik biznes|budjet|byudjet|бюджет|budget|pul yo/.test(text)) return 'small_turnover'
  if (/qimmat|narx|дорог|цен|price|expensive/.test(text)) return 'too_expensive'
  if (/mos emas|kerak emas|не нуж|не подход|not needed|not our|xizmat/.test(text)) return 'not_fit'
  return 'other'
}

/* ── summary shape (= planned GET /crm/dashboard/summary) ─────────────── */

export type SummaryLead = { id: number; name: string; status: string; manager: string | null; source: SourceKey }

export type SalesPanelSummary = {
  period: PanelPeriod
  generated_at: string
  alert: {
    no_leads_24h: boolean
    last_lead_at: string | null
    /** Days in a row (≥ 2) when the main source brought no leads, inside the period. */
    gaps: Array<{ source: SourceKey; from: string; to: string; days: number }>
  }
  kpi: {
    new_leads: number
    new_leads_prev: number
    first_response_median_minutes: number | null
    responded_count: number
    responded_within_5m: number
    response_limit_minutes: number
    open_leads: number
    meeting_plus: number
    won: number
    won_amount: number | null
    conversion_percent: number
  }
  daily: Array<{ date: string; total: number; by_source: Partial<Record<SourceKey, number>> }>
  main_source: SourceKey | null
  funnel: Array<{ status: string; count: number; percent: number }>
  attention: Array<SummaryLead & { reason: AttentionReason; since: string | null; age_minutes: number }>
  today_plan: Array<SummaryLead & { recall_time: string; time: string }>
  managers: Array<{
    id: number | null
    name: string
    assigned: number
    first_response_median_minutes: number | null
    meeting_plus: number
    in_meeting: number
    kp_tz: number
    payment_pending: number
    won: number
    stale_meetings: number
  }>
  sources: Array<{ source: SourceKey; leads: number; meeting_plus: number; rejected: number }>
  services: Array<{ service: ServiceKey; leads: number; meeting_plus: number }>
  rejection_reasons: { total_rejected: number; with_reason: number; items: Array<{ key: RejectionKey; count: number }> }
  hours: number[]
  data_quality: {
    duplicate_phones: number
    duplicate_examples: Array<{ phone: string; ids: number[] }>
    apostrophe_phones: number
    id_like_names: number
    unassigned: number
    platform_variants: number
    platform_values: string[]
    rejected_without_reason: number
  }
}

export type AttentionReason = 'need_to_call_30m' | 'meeting_no_note_24h' | 'kp_tz_5d' | 'payment_7d'

/** When a lead entered its current status (from /status-history), by lead id. */
export type StatusSince = Map<number, number>

/** Lead id → manager (user) it is assigned to. */
export type ManagerAssignments = Map<number, { id: number; name: string }>

export type SalesManagerRef = { id: number; name: string }

const median = (values: number[]) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function lastNoteAt(lead: CustomerSummary): number | null {
  let latest: number | null = null
  for (const note of lead.additional_notes ?? []) {
    const record = note as unknown as Record<string, unknown>
    const at = parseInstant((record.updated_at as string | undefined) ?? (record.created_at as string | undefined))
    if (at !== null && (latest === null || at > latest)) latest = at
  }
  return latest
}

export type BuildSalesPanelInput = {
  leads: CustomerSummary[]
  period: PanelPeriod
  statuses: DynamicStatusOption[]
  managers: SalesManagerRef[]
  assignments: ManagerAssignments
  statusSince: StatusSince
  now?: number
}

export function buildSalesPanel({ leads, period, statuses, managers, assignments, statusSince, now = Date.now() }: BuildSalesPanelInput): SalesPanelSummary {
  const todayStart = dayStart(now)
  const periodStart = todayStart - (period - 1) * DAY
  const prevStart = periodStart - period * DAY

  const active = leads.filter((lead) => !lead.is_archived)
  const withTime = active
    .map((lead) => ({ lead, at: parseInstant(lead.created_at), status: statusKey(lead.status) }))
    .filter((row): row is { lead: CustomerSummary; at: number; status: string } => row.at !== null)

  const inPeriod = withTime.filter((row) => row.at >= periodStart && row.at <= now)
  const prevCount = withTime.filter((row) => row.at >= prevStart && row.at < periodStart).length

  const managerOf = (lead: CustomerSummary) => assignments.get(lead.id) ?? null
  const toSummaryLead = (lead: CustomerSummary): SummaryLead => ({
    id: lead.id,
    name: nameOf(lead) || `#${lead.id}`,
    status: statusKey(lead.status),
    manager: managerOf(lead)?.name ?? null,
    source: sourceOf(lead),
  })

  /* alert */
  const lastLeadAt = withTime.reduce<number | null>((max, row) => (max === null || row.at > max ? row.at : max), null)

  /* daily by source */
  const days: string[] = []
  for (let ms = periodStart; ms <= todayStart; ms += DAY) days.push(tashkentDay(ms))
  const dailyMap = new Map(days.map((day) => [day, { date: day, total: 0, by_source: {} as Partial<Record<SourceKey, number>> }]))
  const sourceTotals = new Map<SourceKey, number>()
  for (const row of inPeriod) {
    const bucket = dailyMap.get(tashkentDay(row.at))
    const source = sourceOf(row.lead)
    sourceTotals.set(source, (sourceTotals.get(source) ?? 0) + 1)
    if (!bucket) continue
    bucket.total += 1
    bucket.by_source[source] = (bucket.by_source[source] ?? 0) + 1
  }
  const daily = [...dailyMap.values()]
  const mainSource = [...sourceTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const gaps: SalesPanelSummary['alert']['gaps'] = []
  if (mainSource) {
    let runStart: string | null = null
    let runLength = 0
    const flush = (end: string) => {
      if (runStart && runLength >= 2) gaps.push({ source: mainSource, from: runStart, to: end, days: runLength })
      runStart = null
      runLength = 0
    }
    daily.forEach((day, index) => {
      if (!day.by_source[mainSource]) {
        if (!runStart) runStart = day.date
        runLength += 1
      } else if (runStart) {
        flush(daily[index - 1].date)
      }
    })
    if (runStart) flush(daily[daily.length - 1].date)
  }

  /* funnel in dynamic-status order */
  const order = statuses.length > 0
    ? [...statuses].sort((a, b) => a.order - b.order).map((status) => statusKey(status.value))
    : DEFAULT_STATUS_ORDER
  const statusCounts = new Map<string, number>()
  for (const row of inPeriod) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
  const extra = [...statusCounts.keys()].filter((key) => !order.includes(key))
  const total = inPeriod.length
  const funnel = [...order, ...extra].map((status) => {
    const count = statusCounts.get(status) ?? 0
    return { status, count, percent: total ? (count / total) * 100 : 0 }
  })

  /* first response */
  const responseOf = (lead: CustomerSummary) => {
    const metrics = lead.lead_response_metrics
    return metrics?.status_changed && typeof metrics.response_minutes === 'number' ? metrics.response_minutes : null
  }
  const responses = inPeriod.map((row) => responseOf(row.lead)).filter((value): value is number => value !== null)
  const limit = inPeriod.find((row) => row.lead.lead_response_metrics)?.lead.lead_response_metrics?.response_limit_minutes ?? 5

  const count = (rows: typeof inPeriod, test: (status: string) => boolean) => rows.filter((row) => test(row.status)).length
  const won = count(inPeriod, (status) => WON_STATUSES.has(status))
  const amounts = inPeriod
    .filter((row) => WON_STATUSES.has(row.status))
    .map((row) => Number((row.lead as unknown as Record<string, unknown>).deal_amount))
    .filter((value) => Number.isFinite(value) && value > 0)

  /* attention (all open leads, not only this period — stuck leads matter whenever they came) */
  const attention: SalesPanelSummary['attention'] = []
  for (const row of withTime) {
    const since = statusSince.get(row.lead.id) ?? null
    let reason: AttentionReason | null = null
    let from: number | null = null
    if (row.status === 'need_to_call') {
      from = since ?? row.at
      if (now - from > 30 * MINUTE) reason = 'need_to_call_30m'
    } else if (row.status === 'meeting_scheduled') {
      from = lastNoteAt(row.lead) ?? since ?? row.at
      if (now - from > DAY) reason = 'meeting_no_note_24h'
    } else if (row.status === 'creating_kp_tz' && since !== null) {
      from = since
      if (now - since > 5 * DAY) reason = 'kp_tz_5d'
    } else if (row.status === 'payment_pending' && since !== null) {
      from = since
      if (now - since > 7 * DAY) reason = 'payment_7d'
    }
    if (reason && from !== null) {
      attention.push({ ...toSummaryLead(row.lead), reason, since: new Date(from).toISOString(), age_minutes: Math.round((now - from) / MINUTE) })
    }
  }
  const reasonRank: Record<AttentionReason, number> = { payment_7d: 0, kp_tz_5d: 1, meeting_no_note_24h: 2, need_to_call_30m: 3 }
  attention.sort((a, b) => reasonRank[a.reason] - reasonRank[b.reason] || b.age_minutes - a.age_minutes)

  /* today plan: recall_time today (Tashkent) */
  const todayKey = tashkentDay(now)
  const todayPlan = active
    .map((lead) => ({ lead, at: parseInstant(lead.recall_time) }))
    .filter((row): row is { lead: CustomerSummary; at: number } =>
      row.at !== null && tashkentDay(row.at) === todayKey && !CLOSED_STATUSES.has(statusKey(row.lead.status)))
    .sort((a, b) => a.at - b.at)
    .map((row) => ({ ...toSummaryLead(row.lead), recall_time: new Date(row.at).toISOString(), time: tashkentTime(row.at) }))

  /* managers: only real users from /crm/sales-managers */
  const staleMeetingIds = new Set(attention.filter((item) => item.reason === 'meeting_no_note_24h').map((item) => item.id))
  const managerRows: SalesPanelSummary['managers'] = managers.map((manager) => {
    const rows = inPeriod.filter((row) => assignments.get(row.lead.id)?.id === manager.id)
    const all = withTime.filter((row) => assignments.get(row.lead.id)?.id === manager.id)
    return {
      id: manager.id,
      name: manager.name,
      assigned: rows.length,
      first_response_median_minutes: median(rows.map((row) => responseOf(row.lead)).filter((value): value is number => value !== null)),
      meeting_plus: count(rows, (status) => MEETING_PLUS.has(status)),
      in_meeting: count(all, (status) => status === 'meeting_scheduled'),
      kp_tz: count(all, (status) => status === 'creating_kp_tz'),
      payment_pending: count(all, (status) => status === 'payment_pending'),
      won: count(rows, (status) => WON_STATUSES.has(status)),
      stale_meetings: all.filter((row) => staleMeetingIds.has(row.lead.id)).length,
    }
  }).sort((a, b) => b.assigned - a.assigned || b.meeting_plus - a.meeting_plus)
  const unassigned = inPeriod.filter((row) => !assignments.has(row.lead.id)).length
  managerRows.push({
    id: null,
    name: '',
    assigned: unassigned,
    first_response_median_minutes: null,
    meeting_plus: 0,
    in_meeting: 0,
    kp_tz: 0,
    payment_pending: 0,
    won: 0,
    stale_meetings: 0,
  })

  /* sources & services */
  const sourceRows = new Map<SourceKey, { source: SourceKey; leads: number; meeting_plus: number; rejected: number }>()
  const serviceRows = new Map<ServiceKey, { service: ServiceKey; leads: number; meeting_plus: number }>()
  const hours = Array.from({ length: 24 }, () => 0)
  for (const row of inPeriod) {
    const source = sourceOf(row.lead)
    const sourceRow = sourceRows.get(source) ?? { source, leads: 0, meeting_plus: 0, rejected: 0 }
    sourceRow.leads += 1
    if (MEETING_PLUS.has(row.status)) sourceRow.meeting_plus += 1
    if (row.status === 'rejected') sourceRow.rejected += 1
    sourceRows.set(source, sourceRow)

    const service = serviceOf(row.lead)
    const serviceRow = serviceRows.get(service) ?? { service, leads: 0, meeting_plus: 0 }
    serviceRow.leads += 1
    if (MEETING_PLUS.has(row.status)) serviceRow.meeting_plus += 1
    serviceRows.set(service, serviceRow)

    hours[tashkentHour(row.at)] += 1
  }
  const serviceOrder: ServiceKey[] = ['ai', 'crm_erp', 'mobile_web', 'other']

  /* rejection reasons */
  const rejectedRows = inPeriod.filter((row) => row.status === 'rejected')
  const reasonCounts = new Map<RejectionKey, number>()
  let withReason = 0
  for (const row of rejectedRows) {
    const reason = row.lead.rejection_reason?.trim()
    if (!reason) continue
    withReason += 1
    const key = rejectionKeyOf(reason)
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1)
  }

  /* data quality (whole base: these are records to clean up) */
  const phoneGroups = new Map<string, number[]>()
  let apostrophePhones = 0
  for (const { lead } of withTime) {
    const raw = phoneOf(lead)
    if (raw && /^\s*['‘’`]/.test(raw)) apostrophePhones += 1
    const phone = normalizePhone(raw)
    if (!phone) continue
    phoneGroups.set(phone, [...(phoneGroups.get(phone) ?? []), lead.id])
  }
  const duplicates = [...phoneGroups.entries()].filter(([, ids]) => ids.length > 1)
  const platformValues = [...new Set(withTime.map(({ lead }) => rawPlatform(lead)).filter(Boolean))]
  const canonicalPlatforms = new Set(platformValues.map((value) => sourceOf({ id: 0, status: '', created_at: '', platform: value })))

  return {
    period,
    generated_at: new Date(now).toISOString(),
    alert: {
      no_leads_24h: lastLeadAt === null || now - lastLeadAt > DAY,
      last_lead_at: lastLeadAt === null ? null : new Date(lastLeadAt).toISOString(),
      gaps,
    },
    kpi: {
      new_leads: total,
      new_leads_prev: prevCount,
      first_response_median_minutes: median(responses),
      responded_count: responses.length,
      responded_within_5m: responses.filter((value) => value <= limit).length,
      response_limit_minutes: limit,
      open_leads: count(inPeriod, (status) => !CLOSED_STATUSES.has(status)),
      meeting_plus: count(inPeriod, (status) => MEETING_PLUS.has(status)),
      won,
      won_amount: amounts.length > 0 ? amounts.reduce((sum, value) => sum + value, 0) : null,
      conversion_percent: total ? (won / total) * 100 : 0,
    },
    daily,
    main_source: mainSource,
    funnel,
    attention,
    today_plan: todayPlan,
    managers: managerRows,
    sources: [...sourceRows.values()].sort((a, b) => b.leads - a.leads),
    services: serviceOrder.map((service) => serviceRows.get(service) ?? { service, leads: 0, meeting_plus: 0 }),
    rejection_reasons: {
      total_rejected: rejectedRows.length,
      with_reason: withReason,
      items: REJECTION_ORDER.map((key) => ({ key, count: reasonCounts.get(key) ?? 0 })).filter((item) => item.count > 0),
    },
    hours,
    data_quality: {
      duplicate_phones: duplicates.length,
      duplicate_examples: duplicates.slice(0, 2).map(([phone, ids]) => ({ phone, ids: ids.slice(0, 3) })),
      apostrophe_phones: apostrophePhones,
      id_like_names: withTime.filter(({ lead }) => nameLooksLikeId(lead)).length,
      unassigned: withTime.filter(({ lead, status }) => !CLOSED_STATUSES.has(status) && !assignments.has(lead.id)).length,
      platform_variants: Math.max(0, platformValues.length - canonicalPlatforms.size),
      platform_values: platformValues,
      rejected_without_reason: withTime.filter(({ lead, status }) => status === 'rejected' && !lead.rejection_reason?.trim()).length,
    },
  }
}
