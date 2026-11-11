import { useEffect, useState } from 'react'
import { MicrophoneIcon, MicrophoneSlashIcon, NotePencilIcon, PhoneIcon, PhoneXIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { telephonyService } from '../../../shared/api/services/telephony.service'
import { cn } from '../../../shared/lib/cn'
import { useTelephony } from '../../telephony/TelephonyContext'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { preloadRingtone, startRingtone, stopRingtone } from '../../telephony/lib/ringtone'
import { haptic } from '../lib/telegram'

type Props = {
  /** The number the user dialled last (shown until the call event brings the real row). */
  dialed: string | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '#'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Full-screen call UI of the Mini App: incoming (answer / reject) and active calls (mute, hang up, note). */
export function CallScreen({ dialed }: Props) {
  const { t } = useLocale()
  const phone = useTelephony()
  const { sessionStatus, sessionDirection, call, lead, confirmedAt, muted } = phone
  const visible = Boolean(sessionStatus || (call && call.status !== 'completed'))
  const incomingRinging = sessionDirection === 'incoming' && sessionStatus === 'ringing'
  const [now, setNow] = useState(() => new Date().getTime())
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => { preloadRingtone() }, [])

  // Ring (and buzz) while an incoming call is waiting.
  useEffect(() => {
    if (!incomingRinging) return
    startRingtone()
    haptic('warning')
    const buzz = window.setInterval(() => haptic('warning'), 2000)
    return () => { stopRingtone(); window.clearInterval(buzz) }
  }, [incomingRinging])

  useEffect(() => {
    if (!confirmedAt) return
    const timer = window.setInterval(() => setNow(new Date().getTime()), 1000)
    return () => window.clearInterval(timer)
  }, [confirmedAt])

  // A new call starts with a clean note field.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (!visible) { setNoteOpen(false); setNote(''); setNoteState('idle') }
  }

  if (!visible) return null

  const number = call?.phone_number || lead?.phone_number || dialed || ''
  const name = lead?.full_name || call?.customer_name || (number ? formatPhone(number) : t('miniapp.call.unknown', 'Unknown number'))
  const seconds = confirmedAt ? Math.max(0, Math.round((now - new Date(confirmedAt).getTime()) / 1000)) : 0
  const status = incomingRinging
    ? t('miniapp.call.incoming', 'Incoming call')
    : confirmedAt
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : sessionStatus === 'ringing'
        ? t('miniapp.call.ringing', 'Ringing…')
        : sessionStatus === 'connecting'
          ? t('miniapp.call.connecting', 'Connecting…')
          : t('miniapp.call.calling', 'Calling…')

  async function saveNote() {
    if (!call?.id || !note.trim()) return
    setNoteState('saving')
    try {
      await telephonyService.addNote(call.id, note.trim())
      setNote('')
      setNoteState('saved')
      haptic('success')
    } catch {
      setNoteState('idle')
      haptic('error')
    }
  }

  return (
    <div className="mini-call fixed inset-0 z-[60] flex flex-col bg-[var(--app-canvas)] px-6 pt-[max(28px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className={cn('relative grid h-28 w-28 place-items-center rounded-full bg-[var(--blue-dim)] text-[34px] font-bold text-[var(--primary)]', incomingRinging && 'mini-ring')} data-i18n-skip="true">
          {initials(lead?.full_name || call?.customer_name || '')}
        </span>
        <p className="mt-6 max-w-full truncate text-[26px] font-bold tracking-[-0.02em] text-[var(--foreground)]" data-i18n-skip="true">{name}</p>
        {lead?.full_name && number ? <p className="mt-1 text-[15px] text-[var(--muted)] tabular-nums">{formatPhone(number)}</p> : null}
        <p className={cn('mt-3 text-[16px] font-medium tabular-nums', confirmedAt ? 'text-[var(--success-text)]' : 'text-[var(--muted-strong)]')}>{status}</p>
        {lead && (lead.status || lead.seller_name) ? (
          <p className="mt-3 rounded-full bg-[var(--muted-surface)] px-3 py-1 text-[12.5px] text-[var(--muted-strong)]">{[lead.status, lead.seller_name].filter(Boolean).join(' · ')}</p>
        ) : null}
        {phone.error ? <p className="mt-4 rounded-[14px] bg-[var(--danger-dim)] px-3.5 py-2 text-[13px] text-[var(--danger-text)]">{phone.error}</p> : null}
      </div>

      {noteOpen && call?.id ? (
        <div className="mini-in mb-5 flex items-end gap-2">
          <textarea
            autoFocus
            value={note}
            onChange={(event) => { setNote(event.target.value); setNoteState('idle') }}
            rows={2}
            placeholder={t('miniapp.phone.note_placeholder', 'Add a note…')}
            className="min-h-[50px] flex-1 resize-none rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
          <button type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteState === 'saving'} className="h-[50px] rounded-[16px] bg-[var(--primary)] px-4 text-[14px] font-semibold text-white disabled:opacity-40">
            {noteState === 'saved' ? '✓' : t('common.save', 'Save')}
          </button>
        </div>
      ) : null}

      {incomingRinging ? (
        <div className="flex items-start justify-around">
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => { haptic('tap'); stopRingtone(); phone.reject() }} aria-label={t('miniapp.call.reject', 'Decline')} className="mini-key grid h-[74px] w-[74px] place-items-center rounded-full bg-[var(--danger)] text-white shadow-[0_14px_28px_-14px_var(--danger)]">
              <PhoneXIcon size={32} weight="fill" />
            </button>
            <span className="text-[13px] font-medium text-[var(--muted-strong)]">{t('miniapp.call.reject', 'Decline')}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => { haptic('tap'); stopRingtone(); phone.answer() }} aria-label={t('miniapp.call.answer', 'Answer')} className="mini-key mini-ring grid h-[74px] w-[74px] place-items-center rounded-full bg-[var(--success)] text-white shadow-[0_14px_28px_-14px_var(--success)]">
              <PhoneIcon size={32} weight="fill" />
            </button>
            <span className="text-[13px] font-medium text-[var(--muted-strong)]">{t('miniapp.call.answer', 'Answer')}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-around">
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => { haptic('select'); phone.toggleMute() }} aria-pressed={muted} aria-label={t('miniapp.call.mute', 'Mute')} className={cn('mini-key grid h-16 w-16 place-items-center rounded-full', muted ? 'bg-[var(--foreground)] text-[var(--surface)]' : 'bg-[var(--muted-surface)] text-[var(--foreground)]')}>
              {muted ? <MicrophoneSlashIcon size={26} weight="duotone" /> : <MicrophoneIcon size={26} weight="duotone" />}
            </button>
            <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">{muted ? t('miniapp.call.unmute', 'Unmute') : t('miniapp.call.mute', 'Mute')}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => { haptic('tap'); phone.hangup() }} aria-label={t('miniapp.call.hangup', 'End')} className="mini-key grid h-[74px] w-[74px] place-items-center rounded-full bg-[var(--danger)] text-white shadow-[0_14px_28px_-14px_var(--danger)]">
              <PhoneXIcon size={32} weight="fill" />
            </button>
            <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">{t('miniapp.call.hangup', 'End')}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" disabled={!call?.id} onClick={() => setNoteOpen((open) => !open)} aria-pressed={noteOpen} aria-label={t('miniapp.call.note', 'Note')} className={cn('mini-key grid h-16 w-16 place-items-center rounded-full disabled:opacity-40', noteOpen ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--muted-surface)] text-[var(--foreground)]')}>
              <NotePencilIcon size={26} weight="duotone" />
            </button>
            <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">{t('miniapp.call.note', 'Note')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
