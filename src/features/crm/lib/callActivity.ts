import { telephonyService, type TelephonyCall } from '../../../shared/api/services/telephony.service'
import { tashkentDayBound } from '../../../shared/api/services/telephonyQuality.service'

/*
 * Call activity of a period, built from /telephony/calls (the same list the Calls page shows):
 * totals for the dashboard and one row per employee who made or took calls, for the
 * "manager work quality" board in the CRM. The backend has no aggregate endpoint, so the calls
 * are paged through (200 per page, at most MAX_PAGES pages) and counted here.
 */

const PAGE_SIZE = 200
const MAX_PAGES = 10

export type CallActivityUser = {
  userId: number | null
  name: string
  total: number
  incoming: number
  outgoing: number
  /** Calls with talk time (the client and the employee actually spoke). */
  answered: number
  /** Incoming calls nobody picked up. */
  missedIncoming: number
  talkSeconds: number
  lastCallAt: string | null
}

export type CallActivity = {
  days: number
  total: number
  incoming: number
  outgoing: number
  answered: number
  missedIncoming: number
  /** Outgoing calls the client did not pick up. */
  unansweredOutgoing: number
  talkSeconds: number
  /** Average talk time of the answered calls. */
  avgTalkSeconds: number
  /** Distinct clients (phone numbers) talked to. */
  clients: number
  /** One entry per Tashkent day of the period, oldest first. */
  daily: Array<{ date: string; incoming: number; outgoing: number; missed: number }>
  byUser: CallActivityUser[]
  /** The period had more calls than were loaded: numbers cover the newest ones only. */
  truncated: boolean
  loaded: number
  reported: number
}

const TASHKENT = 5 * 3_600_000
const dayOf = (iso: string) => {
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : new Date(ms + TASHKENT).toISOString().slice(0, 10)
}

export function summarizeCalls(calls: TelephonyCall[], days: number, reported = calls.length, now = Date.now()): CallActivity {
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(now + TASHKENT - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    incoming: 0,
    outgoing: 0,
    missed: 0,
  }))
  const dayIndex = new Map(daily.map((day, index) => [day.date, index]))
  const users = new Map<string, CallActivityUser>()
  const phones = new Set<string>()
  let incoming = 0
  let outgoing = 0
  let answered = 0
  let missedIncoming = 0
  let unansweredOutgoing = 0
  let talkSeconds = 0

  for (const call of calls) {
    const talk = Math.max(0, Number(call.talk_seconds) || 0)
    const isIncoming = call.direction === 'incoming'
    const spoke = talk > 0
    // No talk time and not live any more: missed / rejected / busy / no answer / cancelled.
    const unanswered = !spoke && !['ringing', 'answered', 'up', 'in_progress'].includes(String(call.status ?? '').toLowerCase())
    if (isIncoming) incoming += 1
    else outgoing += 1
    if (spoke) answered += 1
    if (isIncoming && unanswered) missedIncoming += 1
    if (!isIncoming && unanswered) unansweredOutgoing += 1
    talkSeconds += talk
    if (spoke && call.phone_number) phones.add(call.phone_number.replace(/\D/g, '').slice(-9))

    const day = call.started_at ? dayOf(call.started_at) : null
    const slot = day ? dayIndex.get(day) : undefined
    if (slot !== undefined) {
      if (isIncoming && unanswered) daily[slot].missed += 1
      else if (isIncoming) daily[slot].incoming += 1
      else daily[slot].outgoing += 1
    }

    // A missed incoming call often has no employee: it is counted in the totals only.
    const name = call.user_name?.trim() ?? ''
    if (call.user_id === null && !name) continue
    const key = call.user_id !== null ? `id:${call.user_id}` : `name:${name.toLowerCase()}`
    const row = users.get(key) ?? { userId: call.user_id, name, total: 0, incoming: 0, outgoing: 0, answered: 0, missedIncoming: 0, talkSeconds: 0, lastCallAt: null }
    if (!row.name && name) row.name = name
    row.total += 1
    if (isIncoming) row.incoming += 1
    else row.outgoing += 1
    if (spoke) row.answered += 1
    if (isIncoming && unanswered) row.missedIncoming += 1
    row.talkSeconds += talk
    if (call.started_at && (!row.lastCallAt || call.started_at > row.lastCallAt)) row.lastCallAt = call.started_at
    users.set(key, row)
  }

  return {
    days,
    total: calls.length,
    incoming,
    outgoing,
    answered,
    missedIncoming,
    unansweredOutgoing,
    talkSeconds,
    avgTalkSeconds: answered > 0 ? Math.round(talkSeconds / answered) : 0,
    clients: phones.size,
    daily,
    byUser: [...users.values()].sort((a, b) => b.talkSeconds - a.talkSeconds || b.total - a.total),
    truncated: reported > calls.length,
    loaded: calls.length,
    reported,
  }
}

/** Calls of the last `days` Tashkent days (today included), newest pages first. */
export async function loadCallActivity(days: number): Promise<CallActivity> {
  const range = { date_from: tashkentDayBound(days - 1, 'start'), date_to: tashkentDayBound(0, 'end') }
  const calls: TelephonyCall[] = []
  let reported = 0
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await telephonyService.calls({ ...range, page, page_size: PAGE_SIZE })
    const items = Array.isArray(response?.items) ? response.items : []
    calls.push(...items)
    reported = Math.max(reported, Number(response?.total) || 0, calls.length)
    const pages = Number(response?.pages) || 1
    if (items.length < PAGE_SIZE || page >= pages) break
  }
  return summarizeCalls(calls, days, reported)
}

/** The activity row of a CRM manager: by user id, or by name when the call has no id. */
export function activityOf(activity: CallActivity | null | undefined, manager: { id: number | null; name: string }) {
  if (!activity) return null
  const name = manager.name.trim().toLowerCase()
  return activity.byUser.find((row) => (row.userId !== null && row.userId === manager.id) || (name !== '' && row.name.trim().toLowerCase() === name)) ?? null
}
