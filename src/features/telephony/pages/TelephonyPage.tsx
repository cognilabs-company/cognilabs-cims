import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Headphones, Phone, Search } from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useTelephony } from '../TelephonyContext'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { PageHeader } from '../../../shared/ui/page-header'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, normalizePhone, telephonyService, type CallHistoryResponse, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { CallDetailPanel } from '../components/CallDetailPanel'
import { formatCallDate, formatDuration, statusLabel, statusTone } from '../components/telephonyFormat'
import { CeoTelephonyPanel } from '../components/CeoTelephonyPanel'

const statuses = ['ringing', 'answered', 'completed', 'missed', 'rejected', 'busy', 'failed']

export function TelephonyPage() {
  const { user } = useAuth()
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
  const [detailId, setDetailId] = useState<number | null>(null)
  const debouncedPhone = useDebouncedValue(phone, 300)
  const debouncedQuery = useDebouncedValue(query, 300)
  const digits = normalizePhone(debouncedPhone)
  const isCeo = user?.role === 'CEO'

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

  const resultCount = useMemo(() => history?.total ?? 0, [history?.total])
  const selectedPath = selectedLead ? leadPath(selectedLead.crm_source, selectedLead.customer_id) : null

  function updatePhone(value: string) {
    phoneRef.current = value
    setPhone(value)
    setSelectedLead(null)
    setLeads([])
    setLeadError(null)
    if (normalizePhone(value).length >= 4) setSearching(true)
    else setSearching(false)
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

  return (
    <div className="space-y-7 pb-12">
      <PageHeader title="Calls" actions={<span className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${connection === 'Ready' ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--input-surface)] text-[var(--muted)]'}`}><span className="h-2 w-2 rounded-full bg-current" />{connection}{config?.extension ? ` · Ext ${config.extension}` : ''}</span>} />
      {phoneError && <p role="alert" className="text-sm text-[var(--danger-text)]">{phoneError}</p>}
      <section className="grid gap-7 border-b border-[var(--border)] pb-7 lg:grid-cols-[minmax(290px,420px)_1fr]">
        <div>
          <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">Dialer</h2>
          <label htmlFor="dialer-phone" className="mb-2 block text-xs font-semibold text-[var(--muted)]">Phone number or last 4 digits</label>
          <div className="flex gap-2"><Input id="dialer-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => updatePhone(event.target.value)} placeholder="+998 90 123 45 67" />
            <Button title="Call" aria-label="Call" disabled={normalizePhone(phone).length < 7 || connection !== 'Ready'} onClick={() => dial(phone, selectedLead)}><Phone size={17} /></Button></div>
          {searching && <p className="mt-2 text-xs text-[var(--muted)]">Searching leads...</p>}
          {leadError && <p className="mt-2 text-xs text-[var(--danger-text)]">{leadError}</p>}
          {digits.length >= 4 && !selectedLead && !searching && leads.length === 0 && !leadError && <p className="mt-2 text-xs text-[var(--muted)]">No matching leads.</p>}
          {leads.length > 0 && !selectedLead && <div className="mt-3 max-h-64 overflow-y-auto border-y border-[var(--border)]">{leads.map((item) => <button type="button" key={`${item.crm_source}-${item.customer_id}`} onClick={() => selectLead(item)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-2 py-3 text-left last:border-0 hover:bg-[var(--input-surface)]"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--foreground)]">{item.full_name}</span><span className="block text-xs text-[var(--muted)]">{item.phone_number}</span></span><span className="shrink-0 text-right text-xs text-[var(--muted)]">{item.crm_source === 'crm_outbound' ? 'Outbound CRM' : 'CRM'}<br />{item.status || '-'}</span></button>)}</div>}
        </div>
        {selectedLead && <div className="self-start border-l-2 border-[var(--primary)] pl-5"><p className="ui-eyebrow">Selected lead</p><h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">{selectedLead.full_name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{selectedLead.phone_number}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-strong)]"><span>{selectedLead.crm_source === 'crm_outbound' ? 'Outbound CRM' : 'CRM'}</span><span>·</span><span>{selectedLead.status || 'No status'}</span>{selectedLead.platform && <><span>·</span><span>{selectedLead.platform}</span></>}</div>{selectedPath && <Link to={selectedPath} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-text)] hover:underline"><ExternalLink size={14} /> Open lead</Link>}</div>}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-[var(--foreground)]">Call history</h2><span className="text-xs text-[var(--muted)]">{resultCount} calls</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_150px_150px_150px]">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search calls" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setLoadingHistory(true) }} placeholder="Customer or phone" className="pl-9" /></div>
          <SelectField value={direction} options={[{ value: '', label: 'All directions' }, { value: 'incoming', label: 'Incoming' }, { value: 'outgoing', label: 'Outgoing' }]} onValueChange={(value) => { setDirection(value); setPage(1); setLoadingHistory(true) }} />
          <SelectField value={status} options={[{ value: '', label: 'All statuses' }, ...statuses.map((value) => ({ value, label: statusLabel(value) }))]} onValueChange={(value) => { setStatus(value); setPage(1); setLoadingHistory(true) }} />
          <Input aria-label="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); setLoadingHistory(true) }} />
          <Input aria-label="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); setLoadingHistory(true) }} />
        </div>
        <div className="mt-4 overflow-x-auto border-t border-[var(--border)]"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="px-3 py-3 font-semibold">Direction</th><th className="px-3 py-3 font-semibold">Customer</th><th className="px-3 py-3 font-semibold">Phone</th><th className="px-3 py-3 font-semibold">Seller</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Started</th><th className="px-3 py-3 font-semibold">Talk</th><th className="px-3 py-3 font-semibold">Recording</th></tr></thead><tbody>
          {history?.items.map((item) => <tr key={item.id} onClick={() => setDetailId(item.id)} className="cursor-pointer border-b border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--input-surface)]"><td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 capitalize">{item.direction === 'incoming' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}{item.direction}</span></td><td className="max-w-[180px] truncate px-3 py-3 font-medium">{item.customer_name || '-'}</td><td className="px-3 py-3">{item.phone_number}</td><td className="px-3 py-3">{item.user_name || '-'}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></td><td className="px-3 py-3 whitespace-nowrap text-xs">{formatCallDate(item.started_at)}</td><td className="px-3 py-3 tabular-nums">{formatDuration(item.talk_seconds)}</td><td className="px-3 py-3">{item.has_recording && <button type="button" title="Open recording" aria-label={`Open recording for call ${item.id}`} onClick={(event) => { event.stopPropagation(); setDetailId(item.id) }} className="text-[var(--blue-text)]"><Headphones size={17} /></button>}</td></tr>)}
        </tbody></table>{loadingHistory && <p className="px-3 py-5 text-sm text-[var(--muted)]">Loading calls...</p>}{historyError && <p role="alert" className="px-3 py-5 text-sm text-[var(--danger-text)]">{historyError}</p>}{!loadingHistory && !historyError && history?.items.length === 0 && <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">No calls match these filters.</p>}</div>
        <div className="mt-4 flex items-center justify-between"><span className="text-xs text-[var(--muted)]">Page {history?.page ?? page} of {Math.max(1, history?.pages ?? 1)}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1 || loadingHistory} onClick={() => { setPage((current) => current - 1); setLoadingHistory(true) }}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= (history?.pages ?? 1) || loadingHistory} onClick={() => { setPage((current) => current + 1); setLoadingHistory(true) }}>Next</Button></div></div>
      </section>
      {isCeo && <CeoTelephonyPanel />}
      {detailId !== null && <CallDetailPanel key={detailId} callId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
