import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Eye, ListFilter, PhoneOff, RotateCcw, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useLocale } from '../../../app/hooks/useLocale'
import { useTelephony } from '../TelephonyContext'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { normalizePhone, telephonyService, type CallHistoryQuery, type TelephonyCall, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { SelectField } from '../../../shared/ui/select-field'
import { Button } from '../../../shared/ui/button'
import { CallInspector } from '../components/CallInspector'
import { CallRow, CallRowSkeleton } from '../components/CallParts'
import { CallsHero, type CallsCounts, type CallsTab, type CallsView } from '../components/CallsHero'
import { DialerPane } from '../components/DialerPane'
import { CeoTelephonyPanel } from '../components/CeoTelephonyPanel'
import { dayHeading, dayKeyOf, formatTalkTime, periodRange, statusLabel, type CallPeriod } from '../components/telephonyFormat'

const PAGE_SIZE = 30
const statuses = ['ringing', 'answered', 'completed', 'missed', 'rejected', 'busy', 'failed']
const desktopQuery = '(min-width: 1024px)'

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isDesktop() {
  return typeof window !== 'undefined' && window.matchMedia(desktopQuery).matches
}

function leadFromCall(call: TelephonyCall): TelephonyLead | null {
  if (!call.crm_source || !call.customer_id) return null
  return {
    crm_source: call.crm_source,
    customer_id: call.customer_id,
    full_name: call.customer_name ?? '',
    phone_number: call.phone_number,
    status: null,
    platform: null,
    seller_id: call.user_id,
    seller_name: call.user_name,
  }
}

type Filters = { period: CallPeriod; from: string; to: string; search: string; direction: string; status: string }

function filtersKey(f: Filters) {
  return [f.period, f.from, f.to, f.search, f.direction, f.status].join('|')
}

function buildQuery(f: Filters): CallHistoryQuery {
  return {
    search: f.search || undefined,
    direction: f.direction === 'incoming' || f.direction === 'outgoing' ? f.direction : undefined,
    status: f.status || undefined,
    ...periodRange(f.period, f.from, f.to),
  }
}

const byNewest = (a: TelephonyCall, b: TelephonyCall) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()

/** Refresh of page 1 (a call event came in): update known calls, add new ones on top. */
function mergeCalls(previous: TelephonyCall[], fresh: TelephonyCall[]) {
  const freshById = new Map(fresh.map((call) => [call.id, call]))
  const known = new Set(previous.map((call) => call.id))
  return [...fresh.filter((call) => !known.has(call.id)), ...previous.map((call) => freshById.get(call.id) ?? call)].sort(byNewest)
}

function appendCalls(previous: TelephonyCall[], next: TelephonyCall[]) {
  const known = new Set(previous.map((call) => call.id))
  return [...previous, ...next.filter((call) => !known.has(call.id))]
}

type DayGroup = { key: string; first: string; calls: TelephonyCall[] }

export function TelephonyPage() {
  const { user, can } = useAuth()
  const { t } = useLocale()
  const { config, connection, error: phoneError, dial, historyVersion, canDial, outboundMode } = useTelephony()
  const [params, setParams] = useSearchParams()
  const isCeo = user?.role === 'CEO'
  // RBAC calls:create shows the call buttons at all; canDial says whether the line can call right now.
  const mayCall = can('calls', 'create')
  const canCall = canDial
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => true)

  // ── keypad / lead lookup ─────────────────────────────────────
  const [phone, setPhone] = useState(() => params.get('phone') ?? '')
  const phoneRef = useRef(phone)
  const [selectedLead, setSelectedLead] = useState<TelephonyLead | null>(null)
  const [leads, setLeads] = useState<TelephonyLead[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const debouncedPhone = useDebouncedValue(phone, 300)
  const digits = normalizePhone(debouncedPhone)

  // ── filters ──────────────────────────────────────────────────
  const [tab, setTab] = useState<CallsTab>('calls')
  const [period, setPeriod] = useState<CallPeriod>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const search = useDebouncedValue(query, 300).trim()
  const filters: Filters = { period, from: customFrom, to: customTo, search, direction, status }
  const currentKey = filtersKey(filters)

  // ── list ─────────────────────────────────────────────────────
  const [items, setItems] = useState<TelephonyCall[]>([])
  const [loaded, setLoaded] = useState<{ key: string; error: string | null } | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const loadedKeyRef = useRef<string | null>(null)
  const moreBusy = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loading = loaded?.key !== currentKey
  const listError = loaded?.key === currentKey ? loaded.error : null
  const hasMore = !loading && page < pages

  const [counts, setCounts] = useState<{ key: string; value: CallsCounts } | null>(null)
  const countsKey = [period, customFrom, customTo, search].join('|')

  // ── selection ────────────────────────────────────────────────
  const [selected, setSelected] = useState<TelephonyCall | null>(null)
  const [mobileSheet, setMobileSheet] = useState<'call' | 'dialer' | null>(() => (params.get('phone') && !isDesktop() ? 'dialer' : null))

  useEffect(() => {
    const nextPhone = params.get('phone')
    const crmSource = params.get('crm_source')
    const customerId = Number(params.get('customer_id'))
    if (nextPhone && (crmSource === 'crm' || crmSource === 'crm_outbound') && customerId > 0) {
      void telephonyService.resolve(normalizePhone(nextPhone)).then((result) => {
        if (result?.customer_id === customerId && result.crm_source === crmSource) setSelectedLead(result)
      }).catch(() => {})
    }
  }, [params])

  useEffect(() => {
    if (digits.length < 4 || (selectedLead && normalizePhone(selectedLead.phone_number) === digits)) return
    let active = true
    void (async () => {
      if (digits.length >= 9) {
        try {
          const match = await telephonyService.resolve(digits)
          if (match && active && normalizePhone(phoneRef.current) === digits) {
            setSelectedLead(match)
            setLeads([])
            setLeadError(null)
            return
          }
        } catch { /* Search can still find a partial lead. */ }
      }
      const found = await telephonyService.search(digits)
      if (active && normalizePhone(phoneRef.current) === digits) { setLeads(Array.isArray(found) ? found : found.items); setLeadError(null) }
    })().catch((cause: unknown) => { if (active && normalizePhone(phoneRef.current) === digits) { setLeads([]); setLeadError(getApiErrorMessage(cause)) } })
      .finally(() => { if (active && normalizePhone(phoneRef.current) === digits) setSearching(false) })
    return () => { active = false }
  }, [digits, selectedLead])

  // First page: replaces the list when filters change, merges when a call event bumps historyVersion.
  useEffect(() => {
    let active = true
    const next: Filters = { period, from: customFrom, to: customTo, search, direction, status }
    const key = filtersKey(next)
    const merge = loadedKeyRef.current === key
    void telephonyService.calls({ page: 1, page_size: PAGE_SIZE, ...buildQuery(next) })
      .then((result) => {
        if (!active) return
        loadedKeyRef.current = key
        setItems((previous) => (merge ? mergeCalls(previous, result.items) : result.items))
        if (!merge) setPage(1)
        setPages((current) => (merge ? Math.max(current, result.pages) : result.pages))
        setTotal(result.total)
        setMoreError(null)
        setLoaded({ key, error: null })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (!merge) { loadedKeyRef.current = key; setItems([]); setTotal(null); setPages(1); setPage(1) }
        setLoaded({ key, error: getApiErrorMessage(cause) })
      })
    return () => { active = false }
  }, [period, customFrom, customTo, search, direction, status, historyVersion])

  // Counters in the header: the period + search, split by type.
  useEffect(() => {
    let active = true
    const key = [period, customFrom, customTo, search].join('|')
    const base: CallHistoryQuery = { page: 1, page_size: 1, search: search || undefined, ...periodRange(period, customFrom, customTo) }
    void Promise.all([
      telephonyService.calls(base),
      telephonyService.calls({ ...base, direction: 'incoming' }),
      telephonyService.calls({ ...base, direction: 'outgoing' }),
      telephonyService.calls({ ...base, status: 'missed' }),
    ]).then(([all, incoming, outgoing, missed]) => {
      if (active) setCounts({ key, value: { all: all.total, incoming: incoming.total, outgoing: outgoing.total, missed: missed.total } })
    }).catch(() => { if (active) setCounts(null) })
    return () => { active = false }
  }, [period, customFrom, customTo, search, historyVersion])

  function loadMore() {
    if (moreBusy.current || loading || page >= pages) return
    moreBusy.current = true
    setLoadingMore(true)
    setMoreError(null)
    const key = currentKey
    const nextPage = page + 1
    void telephonyService.calls({ page: nextPage, page_size: PAGE_SIZE, ...buildQuery(filters) })
      .then((result) => {
        if (loadedKeyRef.current !== key) return
        setItems((previous) => appendCalls(previous, result.items))
        setPage(nextPage)
        setPages(result.pages)
        setTotal(result.total)
      })
      .catch((cause: unknown) => setMoreError(getApiErrorMessage(cause)))
      .finally(() => { moreBusy.current = false; setLoadingMore(false) })
  }

  const onReachEnd = useEffectEvent(() => { if (!moreError) loadMore() })

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onReachEnd()
    }, { rootMargin: '400px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, page])

  const days = useMemo(() => {
    const groups: DayGroup[] = []
    for (const call of items) {
      const key = dayKeyOf(call.started_at)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.calls.push(call)
      else groups.push({ key, first: call.started_at, calls: [call] })
    }
    return groups
  }, [items])

  const selectedCall = selected ? items.find((call) => call.id === selected.id) ?? selected : null
  const related = useMemo(() => {
    if (!selectedCall) return []
    const target = normalizePhone(selectedCall.phone_number)
    const same = items.filter((call) => normalizePhone(call.phone_number) === target)
    return same.some((call) => call.id === selectedCall.id) ? same : [selectedCall, ...same].sort(byNewest)
  }, [items, selectedCall])

  const view: CallsView = status === 'missed' ? 'missed' : direction === 'incoming' ? 'incoming' : direction === 'outgoing' ? 'outgoing' : 'all'
  const filtered = Boolean(search || status || direction || period !== 'all')
  const dialerShown = desktop ? !selectedCall : mobileSheet === 'dialer'

  function changeView(next: CallsView) {
    setDirection(next === 'incoming' || next === 'outgoing' ? next : '')
    setStatus(next === 'missed' ? 'missed' : status === 'missed' ? '' : status)
  }

  function changePeriod(next: CallPeriod) {
    setPeriod(next)
    if (next !== 'custom') { setCustomFrom(''); setCustomTo('') }
  }

  function clearFilters() {
    setQuery('')
    setStatus('')
    setDirection('')
    changePeriod('all')
  }

  function updatePhone(value: string) {
    phoneRef.current = value
    setPhone(value)
    setSelectedLead(null)
    setLeads([])
    setLeadError(null)
    setSearching(normalizePhone(value).length >= 4)
  }

  function selectLead(item: TelephonyLead) {
    phoneRef.current = item.phone_number
    setSelectedLead(item)
    setPhone(item.phone_number)
    setLeads([])
    setLeadError(null)
    setSearching(false)
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('phone', item.phone_number)
      next.set('crm_source', item.crm_source)
      next.set('customer_id', String(item.customer_id))
      return next
    }, { replace: true })
  }

  function selectCall(call: TelephonyCall) {
    setSelected(call)
    if (!desktop) setMobileSheet('call')
  }

  function selectCallById(id: number) {
    const call = items.find((item) => item.id === id)
    if (call) setSelected(call)
  }

  function showDialer() {
    setSelected(null)
    if (desktop) window.requestAnimationFrame(() => document.getElementById('dialer-phone')?.focus())
    else setMobileSheet('dialer')
  }

  const dialer = (onBack?: () => void) => (
    <DialerPane
      phone={phone}
      onPhoneChange={updatePhone}
      leads={leads}
      selectedLead={selectedLead}
      searching={searching}
      leadError={leadError}
      onSelectLead={selectLead}
      onCall={() => dial(phone, selectedLead)}
      canCall={canCall && normalizePhone(phone).length >= 7}
      connection={connection}
      outboundMode={outboundMode}
      mobileNumber={config?.mobile_number}
      extension={config?.extension}
      onBack={onBack}
    />
  )

  // Forwarding shown in the header: the enabled targets (any number), or the old single target.
  const activeTargets = (config?.forwarding_targets ?? []).filter((target) => target.enabled)
  const forwardingSummary = !config?.forwarding_enabled
    ? null
    : activeTargets.length
      ? { mode: activeTargets[0].mode, target: activeTargets[0].target, count: activeTargets.length }
      : config.forwarding_target ? { mode: config.forwarding_mode ?? null, target: config.forwarding_target, count: 1 } : null

  const hero = (
    <CallsHero
      isCeo={isCeo}
      tab={tab}
      onTabChange={setTab}
      connection={connection}
      extension={config?.extension}
      dialerActive={dialerShown}
      onShowDialer={showDialer}
      canDialOut={mayCall}
      outboundMode={outboundMode}
      mobileNumber={config?.mobile_number}
      forwarding={forwardingSummary}
      period={period}
      onPeriodChange={changePeriod}
      customFrom={customFrom}
      customTo={customTo}
      onCustomRange={(from, to) => { setCustomFrom(from); setCustomTo(to); setPeriod('custom') }}
      counts={counts?.key === countsKey ? counts.value : null}
      view={view}
      onViewChange={changeView}
    />
  )

  const phoneAlert = phoneError ? (
    <p role="alert" className="rounded-[14px] bg-[var(--danger-dim)] px-4 py-2.5 text-[13px] font-medium text-[var(--danger-text)]">{phoneError}</p>
  ) : null

  return (
    <div className="calls-ui page-enter">
      {tab === 'system' && isCeo ? (
        <div className="space-y-4">
          {hero}
          {phoneAlert}
          <div className="rounded-[22px] bg-[var(--surface)] ring-1 ring-[var(--border)]">
            <CeoTelephonyPanel />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            {hero}
            {phoneAlert}
            {/* ── Day-by-day list ─────────────────────────────── */}
            <section aria-label={t('telephony.title', 'Calls')} className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[200px] flex-1 sm:max-w-[360px]">
                  <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="search"
                    aria-label={t('telephony.search_calls', 'Search calls')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('telephony.search_placeholder', 'Name or number')}
                    className="h-10 w-full rounded-[13px] bg-[var(--surface)] pr-9 pl-10 text-[14px] text-[var(--foreground)] ring-1 ring-[var(--border)] transition-shadow placeholder:text-[var(--caption)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query ? (
                    <button type="button" aria-label={t('telephony.clear_search', 'Clear search')} onClick={() => setQuery('')} className="absolute top-1/2 right-2.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--input-surface)]">
                      <X size={14} />
                    </button>
                  ) : null}
                </label>
                <SelectField
                  value={status}
                  onValueChange={setStatus}
                  options={[{ value: '', label: t('telephony.filter.any_status', 'Any status') }, ...statuses.map((value) => ({ value, label: statusLabel(value) }))]}
                  leadingIcon={<ListFilter size={15} />}
                  aria-label={t('telephony.filter.status', 'Status')}
                  className="w-[200px]"
                />
                {filtered ? (
                  <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1.5 rounded-[13px] px-3 text-[13px] font-medium text-[var(--muted-strong)] hover:bg-[var(--surface)]">
                    <RotateCcw size={14} /> {t('telephony.filter.reset', 'Reset')}
                  </button>
                ) : null}
                <span className="ml-auto text-[13px] text-[var(--muted)] tabular-nums">
                  {total !== null && !loading ? t('telephony.calls_count', '{{count}} calls', { count: total.toLocaleString('ru-RU') }) : ''}
                </span>
              </div>

              <div className={cn('transition-opacity', loading && items.length > 0 && 'opacity-60')}>
                {loading && items.length === 0 ? (
                  <div className="mt-3">
                    <div className="calls-day-head px-1 pt-1 pb-2"><span className="skeleton block h-4 w-32 rounded-full" /></div>
                    <ul className="overflow-hidden rounded-[20px] bg-[var(--surface)] py-1 ring-1 ring-[var(--border)]">
                      {Array.from({ length: 7 }, (_, index) => <CallRowSkeleton key={index} />)}
                    </ul>
                  </div>
                ) : null}

                {days.map((day, index) => {
                  const heading = dayHeading(day.first)
                  const talk = day.calls.reduce((sum, call) => sum + (call.talk_seconds || 0), 0)
                  const partial = index === days.length - 1 && page < pages
                  return (
                    <section key={day.key} aria-label={heading.title} className="mt-1">
                      <header className="calls-day-head sticky -top-4 z-10 lg:top-[calc(var(--pad-page-y)*-1)] flex items-center gap-2.5 px-1 pt-3 pb-2">
                        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--foreground)]">{heading.title}</h2>
                        <span className="truncate text-[12.5px] text-[var(--muted)]">{heading.date}</span>
                        <span className="h-px min-w-4 flex-1 bg-[var(--border)]" aria-hidden="true" />
                        <span className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--muted-strong)] tabular-nums ring-1 ring-[var(--border)]">
                          {t('telephony.day_count', '{{count}} calls', { count: `${day.calls.length}${partial ? '+' : ''}` })}
                          {talk > 0 ? <span className="text-[var(--muted)]"> · {formatTalkTime(talk)}</span> : null}
                        </span>
                      </header>
                      <ul className="overflow-hidden rounded-[20px] bg-[var(--surface)] py-1 ring-1 ring-[var(--border)]">
                        {day.calls.map((call) => (
                          <CallRow
                            key={call.id}
                            call={call}
                            selected={call.id === selectedCall?.id}
                            showSeller={isCeo}
                            canCall={canCall}
                            showCall={mayCall}
                            onSelect={() => selectCall(call)}
                            onCall={() => dial(call.phone_number, leadFromCall(call))}
                          />
                        ))}
                      </ul>
                    </section>
                  )
                })}

                {listError ? (
                  <div role="alert" className="mt-3 rounded-[20px] bg-[var(--danger-dim)] px-5 py-4 text-[13.5px] text-[var(--danger-text)]">{listError}</div>
                ) : null}

                {!loading && !listError && items.length === 0 ? (
                  <div className="mt-3 flex flex-col items-center rounded-[20px] bg-[var(--surface)] px-6 py-14 text-center ring-1 ring-[var(--border)]">
                    <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--input-surface)] text-[var(--muted)]"><PhoneOff size={24} /></span>
                    <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">{filtered ? t('telephony.no_match_title', 'Nothing found') : t('telephony.no_recents', 'No calls yet')}</p>
                    <p className="mt-1 max-w-[320px] text-[13px] text-[var(--muted)]">
                      {filtered ? t('telephony.no_match', 'No calls match these filters.') : t('telephony.no_calls_hint', 'Calls you make and receive will show up here, day by day.')}
                    </p>
                    {filtered ? <Button variant="secondary" size="sm" className="mt-4" leftIcon={<RotateCcw size={14} />} onClick={clearFilters}>{t('telephony.filter.reset', 'Reset')}</Button> : null}
                  </div>
                ) : null}

                {hasMore ? (
                  <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-5">
                    {moreError ? <p role="alert" className="text-[12.5px] text-[var(--danger-text)]">{moreError}</p> : null}
                    <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>{t('telephony.load_more', 'Show more')}</Button>
                  </div>
                ) : !loading && items.length > 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-[var(--caption)]">{t('telephony.list_end', 'That’s all for this period')}</p>
                ) : null}
              </div>
            </section>
          </div>

          {/* ── Right pane: call card or keypad (ends above the AI launcher in the corner) ── */}
          <aside className="sticky top-0 hidden h-[calc(100dvh-var(--header-h)-116px)] min-h-[460px] lg:block">
            {selectedCall ? (
              <CallInspector
                key={selectedCall.id}
                call={selectedCall}
                related={related}
                canCall={canCall}
                showCall={mayCall}
                onDial={dial}
                onSelectCall={selectCallById}
                onClose={() => setSelected(null)}
              />
            ) : mayCall ? dialer() : (
              <div className="grid h-full place-items-center rounded-[22px] bg-[var(--surface)] px-8 text-center ring-1 ring-[var(--border)]">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--input-surface)] text-[var(--muted)]"><Eye size={22} /></span>
                  <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">{t('telephony.view_only.title', 'View only')}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">{t('telephony.view_only.text', 'You can see the call history. Ask an admin for the “calls · create” permission to make calls.')}</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Mobile: call card / keypad as a full-screen sheet (portalled above the app header) */}
      {!desktop && mobileSheet === 'call' && selectedCall ? createPortal(
        <div className="calls-ui fixed inset-0 z-[120] bg-[var(--background)] p-2" role="dialog" aria-modal="true" aria-label={t('telephony.call_details', 'Call details')}>
          <CallInspector
            key={selectedCall.id}
            call={selectedCall}
            related={related}
            canCall={canCall}
            showCall={mayCall}
            onDial={dial}
            onSelectCall={selectCallById}
            onBack={() => setMobileSheet(null)}
          />
        </div>,
        document.body,
      ) : null}
      {!desktop && mobileSheet === 'dialer' ? createPortal(
        <div className="calls-ui fixed inset-0 z-[120] bg-[var(--background)] p-2" role="dialog" aria-modal="true" aria-label={t('telephony.dial', 'Dial a number')}>
          {dialer(() => setMobileSheet(null))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
