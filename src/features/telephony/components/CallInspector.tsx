import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Copy, ExternalLink, Headphones, MessageSquarePlus, Phone, StickyNote, UserRound, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, telephonyService, type TelephonyCall, type TelephonyCallDetail, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { RecordingPlayer } from './RecordingPlayer'
import { CallBadge, CallResult } from './CallParts'
import { callKindLabel, callTone, formatDayTime, formatPhone, formatTalkTime, hueOf, initialOf, sourceLabel, statusLabel } from './telephonyFormat'

type CallInspectorProps = {
  call: TelephonyCall
  /** Other loaded calls with the same number, newest first (includes `call`). */
  related: TelephonyCall[]
  canCall: boolean
  onDial: (phone: string, lead: TelephonyLead | null) => void
  onSelectCall: (id: number) => void
  /** Mobile sheet: back to the list. */
  onBack?: () => void
  /** Desktop: close the card and show the keypad again. */
  onClose?: () => void
}

function Card({ title, icon, aside, children, className }: { title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--muted-strong)]">
        <span className="text-[var(--muted)]">{icon}</span>
        {title}
        {aside ? <span className="ml-auto">{aside}</span> : null}
      </h3>
      {children}
    </section>
  )
}

function Fact({ label, children, danger }: { label: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--muted)]">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-[14px] font-medium', danger ? 'text-[var(--calls-miss)]' : 'text-[var(--foreground)]')}>{children}</dd>
    </div>
  )
}

/** Right pane of the Calls page: who it was, what happened, recording, notes and the history with that number. */
export function CallInspector({ call, related, canCall, onDial, onSelectCall, onBack, onClose }: CallInspectorProps) {
  const { t } = useLocale()
  const [detail, setDetail] = useState<TelephonyCallDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    void telephonyService.call(call.id).then((result) => { if (active) setDetail(result) })
      .catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
    return () => { active = false }
  }, [call.id])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function saveNote() {
    if (!note.trim()) return
    setSaving(true)
    setError(null)
    try {
      await telephonyService.addNote(call.id, note.trim())
      setDetail(await telephonyService.call(call.id))
      setNote('')
    } catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  function copyNumber() {
    void navigator.clipboard?.writeText(call.phone_number).then(() => setCopied(true)).catch(() => {})
  }

  const lead = detail?.lead ?? null
  const name = lead?.full_name || call.customer_name || ''
  const initial = initialOf(name)
  const hue = hueOf(name || call.phone_number)
  const path = leadPath(lead?.crm_source ?? call.crm_source, lead?.customer_id ?? call.customer_id)
  const source = sourceLabel(lead?.crm_source ?? call.crm_source)
  const hasRecording = detail?.has_recording ?? call.has_recording
  const dialLead: TelephonyLead | null = lead ?? (call.crm_source && call.customer_id
    ? { crm_source: call.crm_source, customer_id: call.customer_id, full_name: call.customer_name ?? '', phone_number: call.phone_number, status: null, platform: null, seller_id: call.user_id, seller_name: call.user_name }
    : null)
  const notes = detail?.notes ?? []

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-[var(--muted-surface)] ring-1 ring-[var(--border)]">
      {/* bar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1 rounded-[11px] pr-3 pl-1.5 text-[13.5px] font-medium text-[var(--foreground)] hover:bg-[var(--input-surface)]">
            <ChevronLeft size={18} /> {t('telephony.back', 'Back')}
          </button>
        ) : (
          <p className="px-1.5 text-[14px] font-semibold text-[var(--foreground)]">{t('telephony.call_details', 'Call details')}</p>
        )}
        <div className="ml-auto flex items-center gap-1">
          {path ? (
            <Link to={path} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[var(--blue-dim)] px-3 text-[13px] font-semibold text-[var(--blue-text)] transition-colors hover:bg-[var(--blue-soft)]">
              <ExternalLink size={14} /> {t('telephony.open_lead', 'Open lead')}
            </Link>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose} aria-label={t('telephony.close', 'Close')} title={t('telephony.close', 'Close')} className="grid h-9 w-9 place-items-center rounded-[11px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="calls-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* who */}
        <section className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] text-white shadow-[0_10px_24px_-14px_rgba(43,89,255,0.9)]"
              style={{ background: `linear-gradient(150deg, hsl(${hue} 88% 67%) 0%, hsl(${hue + 18} 74% 52%) 100%)` }}
              aria-hidden="true"
            >
              {initial ? <span className="text-[28px] leading-none font-bold">{initial}</span> : <UserRound size={28} />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[19px] leading-6 font-bold tracking-[-0.01em] text-[var(--foreground)]">{name || formatPhone(call.phone_number)}</h2>
              {name ? <p className="mt-0.5 text-[13.5px] tabular-nums text-[var(--muted)]" data-i18n-skip="true">{formatPhone(call.phone_number)}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', source ? 'bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'bg-[var(--input-surface)] text-[var(--muted)]')}>
                  {source ?? t('telephony.not_in_crm', 'Not in CRM')}
                </span>
                {lead?.status ? <span className="rounded-full bg-[var(--lime-dim)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--lime-text)]">{lead.status}</span> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onDial(call.phone_number, dialLead)}
              disabled={!canCall}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[var(--success)] text-[14px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(23,146,74,0.9)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              <Phone size={16} fill="currentColor" strokeWidth={0} /> {t('telephony.call_back', 'Call')}
            </button>
            <button type="button" onClick={() => noteRef.current?.focus()} aria-label={t('telephony.action.note', 'Note')} title={t('telephony.action.note', 'Note')} className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--input-surface)] text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface-hover)]">
              <MessageSquarePlus size={18} />
            </button>
            <button type="button" onClick={copyNumber} aria-label={t('telephony.copy_number', 'Copy number')} title={t('telephony.copy_number', 'Copy number')} className={cn('grid h-11 w-11 place-items-center rounded-[14px] transition-colors', copied ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)]')}>
              {copied ? <Check size={18} /> : <Copy size={17} />}
            </button>
          </div>
        </section>

        {error ? <p role="alert" className="rounded-[14px] bg-[var(--danger-dim)] px-4 py-2.5 text-[13px] text-[var(--danger-text)]">{error}</p> : null}

        {/* this call */}
        <section className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-3">
            <CallBadge call={call} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{callKindLabel(call)}</p>
              <p className="text-[13px] text-[var(--muted)]">{formatDayTime(call.started_at)}</p>
            </div>
            <CallResult call={call} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4">
            <Fact label={t('telephony.fact.talk_time', 'Talk time')}>{call.talk_seconds > 0 ? formatTalkTime(call.talk_seconds) : '—'}</Fact>
            <Fact label={t('telephony.fact.status', 'Status')} danger={callTone(call) === 'missed'}>{statusLabel(call.status)}</Fact>
            <Fact label={t('telephony.fact.seller', 'Seller')}>{call.user_name || '—'}</Fact>
            <Fact label={t('telephony.fact.extension', 'Extension')}><span className="tabular-nums">{call.extension || '—'}</span></Fact>
            {lead?.platform ? <Fact label={t('telephony.fact.platform', 'Platform')}>{lead.platform}</Fact> : null}
            {lead?.seller_name ? <Fact label={t('telephony.fact.responsible', 'Responsible')}>{lead.seller_name}</Fact> : null}
            {detail?.hangup_cause ? <div className="col-span-2"><Fact label={t('telephony.fact.hangup', 'Hangup cause')}>{detail.hangup_cause}</Fact></div> : null}
          </dl>
        </section>

        {hasRecording ? (
          <Card title={t('telephony.recording', 'Recording')} icon={<Headphones size={15} />}>
            <RecordingPlayer callId={call.id} />
          </Card>
        ) : null}

        <Card title={t('telephony.notes', 'Notes')} icon={<StickyNote size={15} />} aside={notes.length ? <span className="text-[12px] tabular-nums text-[var(--muted)]">{notes.length}</span> : null}>
          {notes.length ? (
            <ul className="mb-3 space-y-2">
              {notes.map((item) => (
                <li key={item.id} className="rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5">
                  <p className="text-[13.5px] leading-snug whitespace-pre-wrap text-[var(--foreground)]">{item.note}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">{item.created_by_name || t('telephony.note_author', 'User')} · {formatDayTime(item.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            ref={noteRef}
            rows={note ? 3 : 2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void saveNote() }}
            placeholder={detail ? t('telephony.add_note', 'Add a note…') : t('telephony.loading', 'Loading…')}
            disabled={!detail}
            aria-label={t('telephony.notes', 'Notes')}
            className="control-field w-full resize-none rounded-[12px] px-3 py-2.5 text-[13.5px] leading-snug"
          />
          {note.trim() ? (
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="mr-auto text-[11.5px] text-[var(--caption)]" data-i18n-skip="true">⌘ / Ctrl + Enter</span>
              <button type="button" onClick={() => setNote('')} className="h-8 rounded-[10px] px-3 text-[13px] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">{t('telephony.cancel', 'Cancel')}</button>
              <button type="button" onClick={() => void saveNote()} disabled={saving} className="h-8 rounded-[10px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50">
                {saving ? t('telephony.saving', 'Saving…') : t('telephony.save', 'Save')}
              </button>
            </div>
          ) : null}
        </Card>

        {related.length > 1 ? (
          <Card title={t('telephony.same_number', 'With this number')} icon={<Phone size={14} />} aside={<span className="text-[12px] tabular-nums text-[var(--muted)]">{related.length}</span>}>
            <ul className="-mx-2 -mb-1">
              {related.map((item) => {
                const current = item.id === call.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCall(item.id)}
                      aria-current={current ? 'true' : undefined}
                      className={cn('flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors', current ? 'bg-[var(--row-selected)]' : 'hover:bg-[var(--row-hover)]')}
                    >
                      <CallBadge call={item} size={32} className="rounded-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[var(--foreground)]">{callKindLabel(item)}</span>
                        <span className="block text-[12px] text-[var(--muted)]">{formatDayTime(item.started_at)}</span>
                      </span>
                      <CallResult call={item} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
