import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Phone, PhoneOff, Mic, MicOff, UserRound, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, telephonyService } from '../../../shared/api/services/telephony.service'
import { useTelephony } from '../TelephonyContext'
import { MacAvatar } from './MacPrimitives'
import { connectionLabel, formatDuration, formatPhone, sourceLabel } from './telephonyFormat'

function RoundControl({ label, onClick, disabled, tone = 'default', pressed, className, children }: {
  label: string
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'green' | 'red'
  pressed?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        title={label}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'grid h-[52px] w-[52px] place-items-center rounded-full transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60',
          tone === 'green' && 'bg-[var(--mp-green)] text-white hover:brightness-105',
          tone === 'red' && 'bg-[var(--mp-red)] text-white hover:brightness-105',
          tone === 'default' && (pressed ? 'bg-[var(--mp-text)] text-[var(--mp-window)]' : 'bg-[var(--mp-control)] text-[var(--mp-text)] hover:bg-[var(--mp-control-hover)]'),
          className,
        )}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium text-[var(--mp-secondary)]">{label}</span>
    </span>
  )
}

/** Floating macOS-style call HUD — stays on top while you keep working in CRM. */
export function ActiveCallPanel() {
  const { t } = useLocale()
  const { call, lead, sessionStatus, sessionDirection, confirmedAt, muted, connection, error, answer, reject, hangup, toggleMute, clearCall } = useTelephony()
  const [now, setNow] = useState(Date.now())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!confirmedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [confirmedAt])

  const visible = Boolean(call || sessionStatus)
  if (!visible || typeof document === 'undefined') return null

  const isIncoming = call?.direction === 'incoming' || (!call && sessionDirection === 'incoming')
  const ringing = isIncoming && (call?.status === 'ringing' || sessionStatus === 'ringing') && !confirmedAt
  const rawName = lead?.full_name || call?.customer_name || ''
  const number = lead?.phone_number || call?.phone_number || ''
  const name = rawName || (number ? formatPhone(number) : isIncoming ? t('telephony.hud.unknown_caller', 'Unknown caller') : t('telephony.kind.outgoing', 'Outgoing call'))
  const path = leadPath(lead?.crm_source ?? call?.crm_source ?? null, lead?.customer_id ?? call?.customer_id ?? null)
  const seconds = confirmedAt ? Math.max(0, Math.floor((now - new Date(confirmedAt).getTime()) / 1000)) : 0
  const source = sourceLabel(lead?.crm_source || call?.crm_source)
  const stateText = confirmedAt
    ? formatDuration(seconds)
    : ringing
      ? t('telephony.hud.incoming_call', 'Incoming call…')
      : sessionStatus === 'connecting'
        ? t('telephony.hud.connecting', 'Connecting…')
        : sessionStatus
          ? t('telephony.hud.calling', 'Calling…')
          : t('telephony.hud.ended', 'Call ended')

  async function saveNote() {
    if (!call?.id || !note.trim()) return
    setSaving(true)
    setNoteError(null)
    try {
      await telephonyService.addNote(call.id, note.trim())
      setNote('')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (cause) { setNoteError(getApiErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('telephony.hud.label', 'Active phone call')}
      className="mac-phone mac-pop fixed inset-x-3 bottom-3 z-[150] rounded-[24px] border border-[var(--mp-menu-border)] bg-[var(--mp-menu)] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:inset-x-auto sm:top-[88px] sm:right-5 sm:bottom-auto sm:w-[360px]"
    >
      {/* Caller */}
      <div className="flex items-center gap-3">
        <span className={cn('rounded-full', ringing && 'mac-ring')}>
          <MacAvatar name={rawName} size={48} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-medium text-[var(--mp-secondary)]">
            {isIncoming ? t('telephony.direction.incoming', 'Incoming') : t('telephony.direction.outgoing', 'Outgoing')}{source ? ` · ${source}` : ''}{lead?.status ? ` · ${lead.status}` : ''}
          </p>
          <h2 className="truncate text-[17px] leading-tight font-semibold text-[var(--mp-text)]">{name}</h2>
          <p className={cn('mt-0.5 text-[13px] tabular-nums', confirmedAt ? 'font-medium text-[var(--mp-green)]' : 'text-[var(--mp-secondary)]')}>
            {stateText}{rawName && number ? <span className="text-[var(--mp-secondary)]"> · {formatPhone(number)}</span> : null}
          </p>
        </div>
        {!sessionStatus ? (
          <button type="button" title={t('telephony.close', 'Close')} aria-label={t('telephony.close', 'Close')} onClick={clearCall} className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-full bg-[var(--mp-control)] text-[var(--mp-secondary)] hover:bg-[var(--mp-control-hover)]">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-start justify-center gap-6">
        {ringing ? (
          <>
            <RoundControl label={t('telephony.hud.decline', 'Decline')} tone="red" onClick={reject} disabled={!sessionStatus}><PhoneOff size={22} /></RoundControl>
            <RoundControl label={t('telephony.hud.accept', 'Accept')} tone="green" onClick={answer} disabled={!sessionStatus} className="mac-ring"><Phone size={22} fill="currentColor" strokeWidth={0} /></RoundControl>
          </>
        ) : (
          <>
            <RoundControl label={muted ? t('telephony.hud.unmute', 'Unmute') : t('telephony.hud.mute', 'Mute')} pressed={muted} onClick={toggleMute} disabled={!sessionStatus}>
              {muted ? <MicOff size={21} /> : <Mic size={21} />}
            </RoundControl>
            <RoundControl label={t('telephony.hud.end', 'End')} tone="red" onClick={hangup} disabled={!sessionStatus}><PhoneOff size={22} /></RoundControl>
            {path ? (
              <span className="flex flex-col items-center gap-1.5">
                <Link to={path} aria-label={t('telephony.open_lead', 'Open lead')} title={t('telephony.open_lead', 'Open lead')} className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[var(--mp-control)] text-[var(--mp-text)] transition hover:bg-[var(--mp-control-hover)]">
                  <UserRound size={21} />
                </Link>
                <span className="text-[11px] font-medium text-[var(--mp-secondary)]">{t('telephony.action.lead', 'Lead')}</span>
              </span>
            ) : null}
          </>
        )}
      </div>

      {!sessionStatus && call ? <p className="mt-3 text-center text-[12px] text-[var(--mp-secondary)]">{t('telephony.hud.restored', 'Restored after a page reload — browser call controls are unavailable.')}</p> : null}
      {error ? <p className="mt-3 text-center text-[13px] text-[var(--mp-red)]" role="alert">{error}</p> : null}
      {connection !== 'Ready' && sessionStatus ? <p className="mt-2 text-center text-[11.5px] text-[var(--mp-secondary)]">{t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })}</p> : null}

      {/* Quick note */}
      {call?.id ? (
        <div className="mt-4 rounded-[14px] bg-[var(--mp-control)] p-2.5">
          <label htmlFor="active-call-note" className="sr-only">{t('telephony.hud.note_label', 'Call note')}</label>
          <textarea
            id="active-call-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void saveNote() }}
            placeholder={t('telephony.hud.note_placeholder', 'Add a note about this call…')}
            rows={2}
            className="w-full resize-none bg-transparent px-1 text-[13.5px] leading-snug text-[var(--mp-text)] placeholder:text-[var(--mp-secondary)] focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            {saved ? <span className="mr-auto px-1 text-[12px] font-medium text-[var(--mp-green)]">{t('telephony.hud.saved', 'Saved')}</span> : null}
            {noteError ? <span className="mr-auto truncate px-1 text-[12px] text-[var(--mp-red)]" role="alert">{noteError}</span> : null}
            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={!note.trim() || saving}
              className="h-7 rounded-full bg-[var(--mp-blue)] px-3.5 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
            >
              {saving ? t('telephony.saving', 'Saving…') : t('telephony.hud.save_note', 'Save note')}
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
