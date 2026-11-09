import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Headphones, MessageSquareText, Phone, UserRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, telephonyService, type TelephonyCallDetail, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { RecordingPlayer } from './RecordingPlayer'
import {
  callKindLabel, formatDayTime, formatPhone, formatTalkTime, hueOf, initialOf, isToday, isUnanswered, sourceLabel, statusLabel, type RecentGroup,
} from './telephonyFormat'

type CallInspectorProps = {
  group: RecentGroup
  canCall: boolean
  onDial: (phone: string, lead: TelephonyLead | null) => void
  onBack?: () => void
}

function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-[14px] bg-[var(--mp-glass)] text-[var(--mp-glass-text)] backdrop-blur-xl', className)}>
      {children}
    </section>
  )
}

function HeroAction({ label, onClick, disabled, children, to }: { label: string; onClick?: () => void; disabled?: boolean; children: ReactNode; to?: string | null }) {
  const className = cn(
    'grid h-12 w-12 place-items-center rounded-full bg-[var(--mp-glass-strong)] text-[var(--mp-glass-text)] backdrop-blur-xl transition',
    'hover:brightness-110 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
    disabled && 'pointer-events-none opacity-40',
  )
  return (
    <span className="flex flex-col items-center gap-1.5">
      {to && !disabled
        ? <Link to={to} className={className} aria-label={label} title={label}>{children}</Link>
        : <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label} title={label}>{children}</button>}
      <span className="text-[11px] font-medium text-[var(--mp-glass-secondary)]">{label}</span>
    </span>
  )
}

export function CallInspector({ group, canCall, onDial, onBack }: CallInspectorProps) {
  const { t } = useLocale()
  const head = group.head
  const [detail, setDetail] = useState<TelephonyCallDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const recordingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    void telephonyService.call(head.id).then((result) => { if (active) setDetail(result) })
      .catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
    return () => { active = false }
  }, [head.id])

  async function saveNote() {
    if (!note.trim()) return
    setSaving(true)
    setError(null)
    try {
      await telephonyService.addNote(head.id, note.trim())
      setDetail(await telephonyService.call(head.id))
      setNote('')
    } catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  const lead = detail?.lead ?? null
  const name = lead?.full_name || head.customer_name || ''
  const title = name || formatPhone(head.phone_number)
  const initial = initialOf(name)
  const path = leadPath(lead?.crm_source ?? head.crm_source, lead?.customer_id ?? head.customer_id)
  const source = sourceLabel(lead?.crm_source ?? head.crm_source)
  const hasRecording = detail?.has_recording ?? head.has_recording
  const visibleCalls = showAll ? group.calls : group.calls.slice(0, 3)
  const recent = isToday(head.started_at)
  const dialLead: TelephonyLead | null = lead ?? (head.crm_source && head.customer_id
    ? { crm_source: head.crm_source, customer_id: head.customer_id, full_name: head.customer_name ?? '', phone_number: head.phone_number, status: null, platform: null, seller_id: head.user_id, seller_name: head.user_name }
    : null)

  const metaParts = [head.extension ? t('telephony.ext', 'Ext {{ext}}', { ext: head.extension }) : null, head.user_name].filter(Boolean)

  return (
    <div
      className="mac-phone-scroll relative h-full overflow-y-auto rounded-[22px] text-[var(--mp-glass-text)]"
      style={{ '--mp-hue': hueOf(name || head.phone_number), background: 'var(--mp-hero)' } as CSSProperties}
    >
      {/* soft light from the top, like a Contact Poster */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.22),transparent_70%)]" />

      <div className="relative flex items-center justify-between px-4 pt-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex h-8 items-center gap-0.5 rounded-full bg-[var(--mp-glass-strong)] pr-3 pl-1.5 text-[13px] font-medium backdrop-blur-xl">
            <ChevronLeft size={18} /> {t('telephony.recents', 'Recents')}
          </button>
        ) : <span />}
        {path ? (
          <Link to={path} className="inline-flex h-8 items-center rounded-full bg-[var(--mp-glass-strong)] px-3.5 text-[13px] font-semibold backdrop-blur-xl transition hover:brightness-110">
            {t('telephony.open_lead', 'Open lead')}
          </Link>
        ) : null}
      </div>

      {/* Hero */}
      <header className="relative flex flex-col items-center px-6 pt-2 pb-6 text-center">
        <div style={{ background: 'var(--mp-hero-avatar)' }} className="grid h-[132px] w-[132px] place-items-center rounded-full border-[1.5px] border-white/40 shadow-[inset_0_1px_20px_rgba(255,255,255,0.18),0_10px_40px_-10px_rgba(0,0,0,0.35)] backdrop-blur-md">
          {initial ? (
            <span className="text-[64px] leading-none font-semibold text-white drop-shadow-sm">{initial}</span>
          ) : (
            <UserRound size={60} strokeWidth={1.6} className="text-white/90" />
          )}
        </div>
        {metaParts.length > 0 ? (
          <p className="mt-5 text-[12.5px] font-medium text-[var(--mp-glass-secondary)]">{metaParts.join(' · ')}</p>
        ) : null}
        <h2 className={cn('mt-1.5 max-w-full truncate text-[26px] leading-tight font-semibold tracking-[-0.01em]', metaParts.length === 0 && 'mt-5')}>
          {title}
        </h2>
        {name ? <p className="mt-0.5 text-[13px] tabular-nums text-[var(--mp-glass-secondary)]">{formatPhone(head.phone_number)}</p> : null}

        <div className="mt-5 flex items-start justify-center gap-5">
          <HeroAction label={t('telephony.action.note', 'Note')} onClick={() => noteRef.current?.focus()}><MessageSquareText size={20} /></HeroAction>
          <HeroAction label={t('telephony.action.call', 'Call')} disabled={!canCall} onClick={() => onDial(head.phone_number, dialLead)}><Phone size={20} fill="currentColor" strokeWidth={0} /></HeroAction>
          <HeroAction label={t('telephony.action.record', 'Record')} disabled={!hasRecording} onClick={() => recordingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Headphones size={20} /></HeroAction>
          <HeroAction label={t('telephony.action.lead', 'Lead')} disabled={!path} to={path}><UserRound size={20} /></HeroAction>
        </div>
      </header>

      <div className="relative space-y-3 px-4 pb-5">
        {error ? <p role="alert" className="rounded-[12px] bg-[var(--mp-glass)] px-4 py-2.5 text-[13px] text-[var(--mp-red)]">{error}</p> : null}

        {/* Call history */}
        <GlassCard>
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            disabled={group.calls.length <= 3}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] font-medium disabled:cursor-default"
          >
            <span>{t('telephony.call_history', 'Call history')}{group.calls.length > 1 ? <span className="ml-1.5 text-[var(--mp-glass-secondary)]">{group.calls.length}</span> : null}</span>
            {group.calls.length > 3
              ? <ChevronDown size={16} className={cn('text-[var(--mp-glass-secondary)] transition-transform', showAll && 'rotate-180')} />
              : <ChevronRight size={16} className="text-[var(--mp-glass-secondary)]" />}
          </button>
          <ul>
            {visibleCalls.map((call) => (
              <li key={call.id} className="flex items-start justify-between gap-3 border-t border-[var(--mp-glass-line)] px-4 py-2.5">
                <div className="min-w-0">
                  <p className={cn('text-[14px] font-medium', isUnanswered(call) && 'text-[var(--mp-red)]')}>{callKindLabel(call)}</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--mp-glass-secondary)]">
                    {call.talk_seconds > 0 ? formatTalkTime(call.talk_seconds) : statusLabel(call.status)}
                    {call.has_recording ? ` · ${t('telephony.recorded', 'recorded')}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-medium tabular-nums">{formatDayTime(call.started_at)}</p>
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Number + notes */}
        <GlassCard className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--mp-purple)]" data-i18n-skip="true">
                {t('telephony.phone_label', 'phone')}
                {recent ? <span className="rounded-[4px] bg-[var(--mp-purple)] px-1 py-px text-[8.5px] font-bold tracking-wider text-white uppercase">{t('telephony.recent_badge', 'recent')}</span> : null}
              </p>
              <p className="mt-0.5 truncate text-[16px] tabular-nums">{formatPhone(head.phone_number)}</p>
            </div>
            <button
              type="button"
              onClick={() => onDial(head.phone_number, dialLead)}
              disabled={!canCall}
              aria-label={t('telephony.call_number', 'Call {{phone}}', { phone: head.phone_number })}
              title={t('telephony.call', 'Call')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--mp-glass-strong)] transition hover:text-[var(--mp-green)] disabled:opacity-40"
            >
              <Phone size={14} fill="currentColor" strokeWidth={0} />
            </button>
          </div>

          <div className="mt-3 border-t border-[var(--mp-glass-line)] pt-3">
            <label htmlFor="call-inspector-note" className="text-[12.5px] font-medium text-[var(--mp-purple)]">{t('telephony.notes', 'Notes')}</label>
            {detail?.notes?.length ? (
              <ul className="mt-2 space-y-2.5">
                {detail.notes.map((item) => (
                  <li key={item.id}>
                    <p className="text-[14px] leading-snug whitespace-pre-wrap">{item.note}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--mp-glass-secondary)]">{item.created_by_name || t('telephony.note_author', 'User')} · {formatDayTime(item.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              ref={noteRef}
              id="call-inspector-note"
              rows={note ? 3 : 2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void saveNote() }}
              placeholder={detail ? t('telephony.add_note', 'Add a note…') : t('telephony.loading', 'Loading…')}
              disabled={!detail}
              className="mt-1.5 w-full resize-none bg-transparent text-[14px] leading-snug placeholder:text-[var(--mp-glass-secondary)] focus:outline-none"
            />
            {note.trim() ? (
              <div className="flex items-center justify-end gap-2">
                <span className="mr-auto text-[11px] text-[var(--mp-glass-secondary)]">⌘ + Enter</span>
                <button type="button" onClick={() => setNote('')} className="h-7 rounded-full px-3 text-[12.5px] font-medium text-[var(--mp-glass-secondary)] hover:bg-[var(--mp-glass)]">{t('telephony.cancel', 'Cancel')}</button>
                <button type="button" onClick={() => void saveNote()} disabled={saving} className="h-7 rounded-full bg-[var(--mp-blue)] px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                  {saving ? t('telephony.saving', 'Saving…') : t('telephony.save', 'Save')}
                </button>
              </div>
            ) : null}
          </div>
        </GlassCard>

        {/* Recording */}
        {hasRecording ? (
          <GlassCard className="px-4 py-3">
            <div ref={recordingRef}>
              <p className="mb-2 text-[12.5px] font-medium text-[var(--mp-purple)]">{t('telephony.recording', 'Recording')}</p>
              <RecordingPlayer callId={head.id} />
            </div>
          </GlassCard>
        ) : null}

        {/* Facts */}
        <GlassCard>
          {[
            { key: 'status', label: t('telephony.fact.status', 'Status'), value: statusLabel(head.status), danger: group.missed },
            { key: 'seller', label: t('telephony.fact.seller', 'Seller'), value: head.user_name || '—' },
            { key: 'source', label: t('telephony.fact.source', 'Source'), value: source || t('telephony.fact.not_linked', 'Not linked') },
            ...(detail?.hangup_cause ? [{ key: 'hangup', label: t('telephony.fact.hangup', 'Hangup cause'), value: detail.hangup_cause }] : []),
          ].map((row, index) => (
            <div key={row.key} className={cn('flex items-center justify-between gap-3 px-4 py-3 text-[14px]', index > 0 && 'border-t border-[var(--mp-glass-line)]')}>
              <span className="text-[var(--mp-glass-secondary)]">{row.label}</span>
              <span className={cn('truncate font-medium', row.danger && 'text-[var(--mp-red)]')}>{row.value}</span>
            </div>
          ))}
        </GlassCard>

        {path ? (
          <GlassCard>
            <Link to={path} className="block px-4 py-3.5 text-[14px] font-medium text-[var(--mp-glass-text)] transition hover:bg-white/5">
              {t('telephony.open_lead_in', 'Open lead in {{source}}', { source: source ?? 'CRM' })}
            </Link>
          </GlassCard>
        ) : null}
      </div>
    </div>
  )
}
