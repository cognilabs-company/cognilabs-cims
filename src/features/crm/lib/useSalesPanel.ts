import { useEffect, useMemo, useState } from 'react'
import { crmService } from '../../../shared/api/services/crm.service'
import type { CustomerSummary, DynamicStatusOption } from '../../../shared/api/types'
import { normalizeStatusHistory } from './statusHistory'
import {
  buildSalesPanel,
  parseInstant,
  statusKey,
  type ManagerAssignments,
  type PanelPeriod,
  type SalesManagerRef,
  type SalesPanelSummary,
  type StatusSince,
} from './salesPanel'

type ManagerInfo = { id: number; name?: string | null; surname?: string | null; email?: string | null }

/** Statuses whose age needs /status-history ("Diqqat talab qiladi": KP/TZ > 5 days, payment > 7 days, meeting). */
const HISTORY_STATUSES = new Set(['creating_kp_tz', 'payment_pending', 'meeting_scheduled'])
const HISTORY_LIMIT = 60
const PAGE_LIMIT = 200

/**
 * Loads what the panel needs besides the leads (read-only GETs):
 *  - /crm/sales-managers and each manager's leads → who owns which lead (real users only);
 *  - /crm/customers/{id}/status-history for the few leads in KP/TZ, payment or meeting.
 * Then builds the summary for the selected period.
 */
export function useSalesPanel(leads: CustomerSummary[], statuses: DynamicStatusOption[], period: PanelPeriod, enabled: boolean) {
  const [managers, setManagers] = useState<SalesManagerRef[]>([])
  const [assignments, setAssignments] = useState<ManagerAssignments>(() => new Map())
  const [managersLoaded, setManagersLoaded] = useState(false)
  const [statusSince, setStatusSince] = useState<StatusSince>(() => new Map())
  const [now, setNow] = useState(() => Date.now())

  // Ages ("30 min in need_to_call") move on their own; refresh once a minute.
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    ;(async () => {
      try {
        const raw = await crmService.salesManagers()
        const list = (Array.isArray(raw) ? raw : []) as ManagerInfo[]
        const refs = list
          .filter((item) => typeof item?.id === 'number')
          .map((item) => ({ id: item.id, name: [item.name, item.surname].filter(Boolean).join(' ').trim() || item.email || `#${item.id}` }))
        const map: ManagerAssignments = new Map()
        await Promise.all(refs.map(async (manager) => {
          for (let page = 1; page <= 20; page += 1) {
            const response = await crmService.salesManagerCustomers(manager.id, { page, limit: PAGE_LIMIT })
            for (const item of response.items ?? []) map.set(item.id, manager)
            if ((response.items ?? []).length < PAGE_LIMIT || page * PAGE_LIMIT >= (response.total_count ?? 0)) break
          }
        }))
        if (!alive) return
        setManagers(refs)
        setAssignments(map)
      } catch {
        // Not every role may list managers; the table then shows everyone as unassigned.
      } finally {
        if (alive) setManagersLoaded(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled])

  const historyIds = useMemo(
    () => leads
      .filter((lead) => !lead.is_archived && HISTORY_STATUSES.has(statusKey(lead.status)))
      .slice(0, HISTORY_LIMIT)
      .map((lead) => `${lead.id}:${statusKey(lead.status)}`)
      .join(','),
    [leads],
  )

  useEffect(() => {
    if (!enabled || !historyIds) return
    let alive = true
    const pairs = historyIds.split(',').map((pair) => {
      const [id, status] = pair.split(':')
      return { id: Number(id), status }
    })
    ;(async () => {
      const results = await Promise.allSettled(pairs.map(async ({ id, status }) => {
        const steps = normalizeStatusHistory(await crmService.statusHistory(id))
        // The latest time the lead moved into its current status.
        const entered = [...steps].reverse().find((step) => statusKey(step.to) === status)
        return { id, at: entered ? parseInstant(/[zZ]|[+-]\d{2}:?\d{2}$/.test(entered.at) ? entered.at : `${entered.at}Z`) : null }
      }))
      if (!alive) return
      const map: StatusSince = new Map()
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.at !== null) map.set(result.value.id, result.value.at)
      }
      setStatusSince(map)
    })()
    return () => {
      alive = false
    }
  }, [enabled, historyIds])

  /* GET /crm/dashboard/summary?period=N is the source of truth once the backend answers it;
     the in-browser build stays as the fallback and fills any block the answer does not carry. */
  const [server, setServer] = useState<{ period: PanelPeriod; data: unknown } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    crmService.dashboardSummary(period)
      .then((data) => { if (alive) setServer({ period, data }) })
      .catch(() => { if (alive) setServer(null) })
    return () => { alive = false }
  }, [enabled, period])

  const summary: SalesPanelSummary | null = useMemo(() => {
    if (!enabled) return null
    const local = buildSalesPanel({ leads, period, statuses, managers, assignments, statusSince, now })
    return server?.period === period ? mergeServerSummary(local, server.data) : local
  }, [assignments, enabled, leads, managers, now, period, server, statusSince, statuses])

  return { summary, managersLoaded, fromServer: server?.period === period && isServerSummary(server.data) }
}

type Loose = Record<string, unknown>
const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The answer is used only when it has the documented core (docs/CRM_DASHBOARD_SUMMARY_API.md). */
function isServerSummary(raw: unknown): raw is Loose {
  return isObject(raw) && isObject(raw.kpi) && typeof raw.kpi.new_leads === 'number' && Array.isArray(raw.funnel)
}

/**
 * Does a server value have the same shape as the locally built one? Arrays: every item matches the first local item;
 * objects: every local key is present with a matching shape; a local null accepts anything. An empty local array
 * gives no shape to check, so only an empty server array passes.
 */
function conforms(value: unknown, ref: unknown): boolean {
  if (ref === null || ref === undefined) return true
  if (Array.isArray(ref)) {
    if (!Array.isArray(value)) return false
    return ref.length === 0 ? value.length === 0 : value.every((item) => conforms(item, ref[0]))
  }
  if (isObject(ref)) {
    if (!isObject(value)) return false
    return Object.entries(ref).every(([key, inner]) => conforms(value[key], inner))
  }
  return typeof value === typeof ref
}

/** Server value wins per field when its shape matches the local one; anything missing or odd keeps the local value. */
function mergeServerSummary(local: SalesPanelSummary, raw: unknown): SalesPanelSummary {
  if (!isServerSummary(raw)) return local
  const merged: Loose = { ...(local as unknown as Loose) }
  for (const [key, localValue] of Object.entries(local as unknown as Loose)) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    if (isObject(localValue)) {
      if (!isObject(value)) continue
      const inner: Loose = { ...localValue }
      for (const [innerKey, innerLocal] of Object.entries(localValue)) {
        const innerValue = value[innerKey]
        if (innerValue !== undefined && conforms(innerValue, innerLocal)) inner[innerKey] = innerValue
      }
      merged[key] = inner
    } else if (conforms(value, localValue)) {
      merged[key] = value
    }
  }
  merged.period = local.period
  return merged as unknown as SalesPanelSummary
}
