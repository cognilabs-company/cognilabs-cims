import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Grip, ListFilter, PhoneMissed, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useLocale } from '../../../app/hooks/useLocale'
import { useTelephony } from '../TelephonyContext'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { normalizePhone, telephonyService, type CallHistoryResponse, type TelephonyCall, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { CallInspector } from '../components/CallInspector'
import { DialerPane } from '../components/DialerPane'
import { MacAvatar, MacMenu, MacMenuItem, MacMenuLabel, MacMenuSeparator, RowCallButton, ToolbarButton } from '../components/MacPrimitives'
import { useDismiss } from '../components/useDismiss'
import { connectionLabel, formatPhone, formatRecentTime, groupRecents, sourceLabel, statusLabel, type RecentGroup } from '../components/telephonyFormat'
import { CeoTelephonyPanel } from '../components/CeoTelephonyPanel'

const statuses = ['ringing', 'answered', 'completed', 'missed', 'rejected', 'busy', 'failed']

type View = 'all' | 'missed' | 'incoming' | 'outgoing'
const views: View[] = ['all', 'missed', 'incoming', 'outgoing']
const viewFallback: Record<View, string> = { all: 'All calls', missed: 'Missed', incoming: 'Incoming', outgoing: 'Outgoing' }

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

function RecentRow({ group, selected, showSeller, canCall, onSelect, onCall }: {
  group: RecentGroup
  selected: boolean
  showSeller: boolean
  canCall: boolean
  onSelect: () => void
  onCall: () => void
}) {
  const { t } = useLocale()
  const { head, calls, missed } = group
  const name = head.customer_name?.trim()
  const Arrow = head.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight
  const subtitle = name ? formatPhone(head.phone_number) : sourceLabel(head.crm_source) ?? t('telephony.unknown', 'unknown')

  return (
    <li className="group/li">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}
        className={cn(
          'group flex cursor-default items-center gap-3 rounded-[10px] px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60',
          selected ? 'bg-[var(--mp-selected)]' : 'hover:bg-[var(--mp-hover)]',
        )}
      >
        <MacAvatar name={name} size={36} />
        <div className={cn(
          'flex min-w-0 flex-1 items-center gap-3 py-[9px]',
          'border-b border-[var(--mp-separator)] group-last/li:border-transparent',
          selected && 'border-transparent',
        )}>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-[14px] leading-[18px] font-semibold', missed ? 'text-[var(--mp-red)]' : 'text-[var(--mp-text)]')}>
              {name || formatPhone(head.phone_number)}
            </p>
            <p className="mt-px flex min-w-0 items-center gap-1 text-[12.5px] leading-4 text-[var(--mp-secondary)]">
              <Arrow size={12} strokeWidth={2.4} className="shrink-0" aria-label={t(`telephony.direction.${head.direction}`, head.direction)} />
              <span className="truncate">
                {subtitle}{calls.length > 1 ? ` (${calls.length})` : ''}
                {showSeller && head.user_name ? ` · ${head.user_name}` : ''}
              </span>
            </p>
          </div>
          <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--mp-secondary)]">{formatRecentTime(head.started_at)}</span>
          <RowCallButton disabled={!canCall} label={t('telephony.call_number', 'Call {{phone}}', { phone: head.phone_number })} onClick={onCall} />
        </div>
      </div>
    </li>
  )
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-2.5 py-[9px]" aria-hidden="true">
      <span className="h-9 w-9 animate-pulse rounded-full bg-[var(--mp-control)]" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-40 animate-pulse rounded bg-[var(--mp-control)]" />
        <span className="block h-2.5 w-24 animate-pulse rounded bg-[var(--mp-control)]" />
      </span>
      <span className="h-2.5 w-10 animate-pulse rounded bg-[var(--mp-control)]" />
    </li>
  )
}

type Tab = 'calls' | 'system'

export function TelephonyPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const { config, connection, error: phoneError, dial, historyVersion } = useTelephony()
  const [params, setParams] = useSearchParams()
  const [phone, setPhone] = useState(() => params.get('phone') ?? '')
  const phoneRef = useRef(phone)
  const [selectedLead, setSelectedLead] = useState<TelephonyLead | null>(null)
  const [leads, setLeads] = useState<TelephonyLead[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<CallHistoryResponse | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  // null → the right pane shows the keypad; a key → that call's contact card.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mobileSheet, setMobileSheet] = useState<'call' | 'dialer' | null>(null)
  const [tab, setTab] = useState<Tab>('calls')
  const [viewOpen, setViewOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const debouncedPhone = useDebouncedValue(phone, 300)
  const debouncedQuery = useDebouncedValue(query, 300)
  const digits = normalizePhone(debouncedPhone)
  const isCeo = user?.role === 'CEO'
  const canCall = connection === 'Ready'
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => true)

  useDismiss(viewRef, viewOpen, () => setViewOpen(false))
  useDismiss(filterRef, filterOpen, () => setFilterOpen(false))

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
      const items = await telephonyService.search(digits)
      if (active && normalizePhone(phoneRef.current) === digits) { setLeads(Array.isArray(items) ? items : items.items); setLeadError(null) }
    })().catch((cause: unknown) => { if (active && normalizePhone(phoneRef.current) === digits) { setLeads([]); setLeadError(getApiErrorMessage(cause)) } })
      .finally(() => { if (active && normalizePhone(phoneRef.current) === digits) setSearching(false) })
    return () => { active = false }
  }, [digits, selectedLead])

  useEffect(() => {
    let active = true
    void telephonyService.calls({
      page, page_size: 30, search: debouncedQuery.trim(),
      direction: direction ? direction as 'incoming' | 'outgoing' : undefined,
      status: status || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined,
    }).then((result) => { if (active) { setHistory(result); setHistoryError(null) } })
      .catch((cause: unknown) => { if (active) setHistoryError(getApiErrorMessage(cause)) })
      .finally(() => { if (active) setLoadingHistory(false) })
    return () => { active = false }
  }, [page, debouncedQuery, direction, status, dateFrom, dateTo, historyVersion])

  const groups = useMemo(() => groupRecents(history?.items ?? []), [history?.items])
  const selectedGroup = useMemo(() => groups.find((group) => group.key === selectedKey) ?? null, [groups, selectedKey])

  const view: View = status === 'missed' ? 'missed' : direction === 'incoming' ? 'incoming' : direction === 'outgoing' ? 'outgoing' : 'all'
  const extraFilters = (status && status !== 'missed' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)
  const totalPages = Math.max(1, history?.pages ?? 1)
  const viewLabel = (key: View) => t(`telephony.view.${key}`, viewFallback[key])
  const connectionText = `${connectionLabel(connection)}${config?.extension ? ` · ${t('telephony.ext', 'Ext {{ext}}', { ext: config.extension })}` : ''}`
  const connectionTone = connection === 'Ready' ? 'bg-[var(--mp-green)]' : /connect/i.test(connection) ? 'bg-[var(--mp-orange)]' : 'bg-[var(--mp-red)]'
  const dialerShown = desktop ? !selectedGroup : mobileSheet === 'dialer'

  function resetPage() { setPage(1); setLoadingHistory(true) }

  function applyView(next: View) {
    setDirection(next === 'incoming' || next === 'outgoing' ? next : '')
    setStatus(next === 'missed' ? 'missed' : status === 'missed' ? '' : status)
    setViewOpen(false)
    resetPage()
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

  function selectGroup(group: RecentGroup) {
    setSelectedKey(group.key)
    if (!desktop) setMobileSheet('call')
  }

  function showDialer() {
    setSelectedKey(null)
    if (desktop) document.getElementById('dialer-phone')?.focus()
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
      extension={config?.extension}
      onBack={onBack}
    />
  )

  return (
    <div
      className="mac-phone flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-[var(--mp-window)] ring-1 ring-[var(--mp-separator)] transition-colors duration-300"
      style={{ height: 'var(--page-h)', minHeight: 360 }}
    >
      <h1 className="sr-only">{t('telephony.title', 'Calls')}</h1>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--mp-separator)] px-4 py-2.5 lg:px-5">
        {isCeo ? (
          <div role="tablist" aria-label={t('telephony.title', 'Calls')} className="inline-flex h-8 rounded-full bg-[var(--mp-control)] p-[3px]">
            {([
              ['calls', t('telephony.tab.calls', 'Calls')],
              ['system', t('telephony.tab.system', 'Phone system')],
            ] as Array<[Tab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'rounded-full px-3.5 text-[13px] font-medium text-[var(--mp-text)] transition',
                  tab === value ? 'bg-[var(--mp-segment)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]' : 'text-[var(--mp-secondary)] hover:text-[var(--mp-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'calls' ? (
          <>
            <div ref={viewRef} className="relative">
              <ToolbarButton aria-haspopup="menu" aria-expanded={viewOpen} onClick={() => setViewOpen((value) => !value)} className="pr-2.5">
                {view === 'missed' ? <PhoneMissed size={14} className="text-[var(--mp-red)]" /> : null}
                {viewLabel(view)}
                <ChevronDown size={14} className="text-[var(--mp-secondary)]" />
              </ToolbarButton>
              {viewOpen ? (
                <MacMenu>
                  {views.map((key) => (
                    <MacMenuItem key={key} checked={view === key} onSelect={() => applyView(key)}>{viewLabel(key)}</MacMenuItem>
                  ))}
                </MacMenu>
              ) : null}
            </div>

            <div ref={filterRef} className="relative">
              <ToolbarButton aria-label={t('telephony.filters', 'Filters')} title={t('telephony.filters', 'Filters')} aria-haspopup="menu" aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)} className="px-2.5">
                <ListFilter size={15} />
                {extraFilters > 0 ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--mp-blue)] px-1 text-[10px] font-bold text-white">{extraFilters}</span> : null}
                <ChevronDown size={14} className="text-[var(--mp-secondary)]" />
              </ToolbarButton>
              {filterOpen ? (
                <MacMenu className="w-[250px]">
                  <MacMenuLabel>{t('telephony.filter.status', 'Status')}</MacMenuLabel>
                  <MacMenuItem checked={!status} onSelect={() => { setStatus(''); resetPage() }}>{t('telephony.filter.any_status', 'Any status')}</MacMenuItem>
                  {statuses.map((value) => (
                    <MacMenuItem key={value} checked={status === value} onSelect={() => { setStatus(value); resetPage() }}>{statusLabel(value)}</MacMenuItem>
                  ))}
                  <MacMenuSeparator />
                  <MacMenuLabel>{t('telephony.filter.date_range', 'Date range')}</MacMenuLabel>
                  <div className="grid grid-cols-[38px_1fr] items-center gap-x-2 gap-y-1.5 px-2 pb-1.5">
                    <label htmlFor="calls-from" className="text-[12px] text-[var(--mp-secondary)]">{t('telephony.filter.from', 'From')}</label>
                    <input id="calls-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); resetPage() }} className="h-7 rounded-[7px] bg-[var(--mp-control)] px-2 text-[12.5px] text-[var(--mp-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60" />
                    <label htmlFor="calls-to" className="text-[12px] text-[var(--mp-secondary)]">{t('telephony.filter.to', 'To')}</label>
                    <input id="calls-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); resetPage() }} className="h-7 rounded-[7px] bg-[var(--mp-control)] px-2 text-[12.5px] text-[var(--mp-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60" />
                  </div>
                  {extraFilters > 0 || status ? (
                    <>
                      <MacMenuSeparator />
                      <MacMenuItem onSelect={() => { setStatus(''); setDirection(''); setDateFrom(''); setDateTo(''); setFilterOpen(false); resetPage() }}>{t('telephony.filter.clear', 'Clear all filters')}</MacMenuItem>
                    </>
                  ) : null}
                </MacMenu>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 px-1 text-[12px] font-medium text-[var(--mp-secondary)] md:inline-flex" title={t('telephony.phone_state', 'Phone: {{state}}', { state: connectionText })}>
                <span className={cn('h-2 w-2 rounded-full', connectionTone)} />
                {connectionText}
              </span>
              <button
                type="button"
                aria-label={t('telephony.keypad', 'Keypad')}
                title={t('telephony.keypad', 'Keypad')}
                aria-pressed={dialerShown}
                onClick={showDialer}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60',
                  dialerShown ? 'bg-[var(--mp-blue)] text-white' : 'bg-[var(--mp-control)] text-[var(--mp-text)] hover:bg-[var(--mp-control-hover)]',
                )}
              >
                <Grip size={16} />
              </button>
            </div>

            <div className="relative order-last w-full sm:order-none sm:w-[220px] xl:w-[280px]">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--mp-secondary)]" />
              <input
                type="search"
                aria-label={t('telephony.search_calls', 'Search calls')}
                value={query}
                onChange={(event) => { setQuery(event.target.value); resetPage() }}
                placeholder={t('telephony.search', 'Search')}
                className="h-8 w-full rounded-full bg-[var(--mp-control)] pr-8 pl-8 text-[13px] text-[var(--mp-text)] placeholder:text-[var(--mp-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button type="button" aria-label={t('telephony.clear_search', 'Clear search')} onClick={() => { setQuery(''); resetPage() }} className="absolute top-1/2 right-2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-[var(--mp-secondary)] text-[var(--mp-window)]">
                  <X size={10} strokeWidth={3} />
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {phoneError ? (
        <p role="alert" className="shrink-0 border-b border-[var(--mp-separator)] bg-[var(--mp-red)]/10 px-5 py-2 text-[13px] text-[var(--mp-red)]">{phoneError}</p>
      ) : null}

      {tab === 'system' && isCeo ? (
        <div className="mac-phone-scroll min-h-0 flex-1 overflow-y-auto">
          <CeoTelephonyPanel />
        </div>
      ) : (
        /* ── Body: Recents | Keypad or contact card ──────────── */
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_minmax(400px,1fr)]">
          <section aria-labelledby="recents-title" className="flex min-h-0 min-w-0 flex-col">
            <div className="flex items-baseline justify-between px-4 pt-3 pb-1.5 lg:px-5">
              <h2 id="recents-title" className="text-[17px] font-bold tracking-[-0.01em] text-[var(--mp-text)]">
                {view === 'all' ? t('telephony.recents', 'Recents') : viewLabel(view)}
              </h2>
              <span className="text-[12px] tabular-nums text-[var(--mp-secondary)]">{history ? t('telephony.calls_count', '{{count}} calls', { count: history.total }) : ''}</span>
            </div>

            <ul className="mac-phone-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 lg:px-2.5">
              {loadingHistory && !history ? Array.from({ length: 9 }, (_, index) => <RowSkeleton key={index} />) : null}
              {groups.map((group) => (
                <RecentRow
                  key={group.key}
                  group={group}
                  selected={group.key === selectedGroup?.key}
                  showSeller={isCeo}
                  canCall={canCall}
                  onSelect={() => selectGroup(group)}
                  onCall={() => dial(group.head.phone_number, leadFromCall(group.head))}
                />
              ))}
              {historyError ? <li role="alert" className="px-4 py-6 text-center text-[13px] text-[var(--mp-red)]">{historyError}</li> : null}
              {!loadingHistory && !historyError && history?.items.length === 0 ? (
                <li className="flex flex-col items-center px-6 py-16 text-center">
                  <PhoneMissed size={30} className="text-[var(--mp-tertiary)]" />
                  <p className="mt-3 text-[15px] font-semibold text-[var(--mp-text)]">{t('telephony.no_recents', 'No Recents')}</p>
                  <p className="mt-1 text-[13px] text-[var(--mp-secondary)]">{t('telephony.no_match', 'No calls match these filters.')}</p>
                </li>
              ) : null}
            </ul>

            {totalPages > 1 ? (
              <div className="flex shrink-0 items-center justify-between border-t border-[var(--mp-separator)] py-2 pr-24 pl-4 text-[12px] text-[var(--mp-secondary)] lg:px-5">
                <span className="tabular-nums">{t('telephony.page_of', 'Page {{page}} of {{total}}', { page: history?.page ?? page, total: totalPages })}</span>
                <div className="flex gap-1">
                  <button type="button" aria-label={t('telephony.prev_page', 'Previous page')} disabled={page <= 1 || loadingHistory} onClick={() => { setPage((current) => current - 1); setLoadingHistory(true) }} className="grid h-7 w-7 place-items-center rounded-full text-[var(--mp-text)] hover:bg-[var(--mp-control)] disabled:opacity-35">
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" aria-label={t('telephony.next_page', 'Next page')} disabled={page >= totalPages || loadingHistory} onClick={() => { setPage((current) => current + 1); setLoadingHistory(true) }} className="grid h-7 w-7 place-items-center rounded-full text-[var(--mp-text)] hover:bg-[var(--mp-control)] disabled:opacity-35">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Right pane: keypad by default, contact card once a call is picked */}
          <div className="hidden min-h-0 min-w-0 p-3 lg:block">
            {selectedGroup
              ? <CallInspector key={selectedGroup.head.id} group={selectedGroup} canCall={canCall} onDial={dial} onClose={() => setSelectedKey(null)} />
              : dialer()}
          </div>
        </div>
      )}

      {/* Mobile: keypad / contact card open as a full-screen sheet */}
      {!desktop && mobileSheet === 'call' && selectedGroup ? (
        <div className="mac-phone fixed inset-0 z-[120] bg-[var(--mp-window)] p-2" role="dialog" aria-modal="true" aria-label={t('telephony.call_details', 'Call details')}>
          <CallInspector key={selectedGroup.head.id} group={selectedGroup} canCall={canCall} onDial={dial} onBack={() => setMobileSheet(null)} />
        </div>
      ) : null}
      {!desktop && mobileSheet === 'dialer' ? (
        <div className="mac-phone fixed inset-0 z-[120] bg-[var(--mp-window)] p-2" role="dialog" aria-modal="true" aria-label={t('telephony.keypad', 'Keypad')}>
          {dialer(() => setMobileSheet(null))}
        </div>
      ) : null}
    </div>
  )
}
