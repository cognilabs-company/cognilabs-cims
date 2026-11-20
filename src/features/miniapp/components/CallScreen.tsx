import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { telephonyService } from '../../../shared/api/services/telephony.service'
import { cn } from '../../../shared/lib/cn'
import { useTelephony } from '../../telephony/TelephonyContext'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { preloadRingtone, startRingtone, stopRingtone } from '../../telephony/lib/ringtone'
import { haptic } from '../lib/telegram'
import { IcCheck, IcHangup, IcMic, IcMicOff, IcNote, IcPhone } from '../ui/icons'
import { Arcs, Dots, VoiceBars } from '../ui/motion'

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
  const waiting = !incomingRinging && !confirmedAt
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
    <div className="m-hero m-fade fixed inset-0 z-[60] flex flex-col rounded-none px-6 pt-[max(28px,env(safe-area-inset-top))] pb-[max(26px,env(safe-area-inset-bottom))]" data-on={confirmedAt ? 'true' : 'false'} role="dialog" aria-modal="true" aria-label={name}>
      <span className="m-grain" />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="relative grid h-36 w-36 place-items-center">
          {incomingRinging || waiting ? (
            <>
              <span className="absolute inset-0 rounded-full border border-white/10" />
              <span className="m-radar-ping absolute inset-0 rounded-full border-[var(--m-lime)]/40 text-[var(--m-lime)]" />
              <span className="m-radar-ping absolute inset-0 rounded-full text-[var(--m-lime)]" style={{ animationDelay: '0.9s' }} />
            </>
          ) : null}
          <span className={cn('relative grid h-[120px] w-[120px] place-items-center rounded-full p-[3px]', incomingRinging && 'm-ring')} style={{ background: 'conic-gradient(from 200deg, var(--primary), var(--m-lime), var(--primary))' }}>
            <span className="m-display grid h-full w-full place-items-center rounded-full bg-[var(--m-hero-2)] text-[36px] font-semibold text-[var(--m-lime)]" data-i18n-skip="true">
              {initials(lead?.full_name || call?.customer_name || '')}
            </span>
          </span>
        </span>
        <p className="m-rise mt-7 max-w-full truncate text-[27px] leading-tight font-extrabold tracking-[-0.02em]" data-i18n-skip="true">{name}</p>
        {lead?.full_name && number ? <p className="m-rise mt-1 text-[15px] text-[var(--m-on-hero-muted)] tabular-nums" style={{ '--i': 1 } as CSSProperties}>{formatPhone(number)}</p> : null}
        <p className={cn('mt-4 flex items-center gap-2.5 text-[16px] font-semibold', confirmedAt ? 'm-display text-[22px] text-[var(--m-lime)]' : 'text-[var(--m-on-hero-muted)]')}>
          {confirmedAt ? <VoiceBars className="text-[var(--m-lime)]" /> : null}
          <span className="tabular-nums">{status}</span>
          {waiting ? <Dots className="text-[var(--m-lime)]" /> : null}
          {confirmedAt ? <VoiceBars className="-scale-x-100 text-[var(--m-lime)]" /> : null}
        </p>
        {lead && (lead.status || lead.seller_name) ? (
          <p className="m-pop mt-4 rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--m-on-hero)]/85">{[lead.status, lead.seller_name].filter(Boolean).join(' · ')}</p>
        ) : null}
        {phone.error ? <p className="m-shake mt-4 rounded-[16px] bg-[var(--m-coral)]/15 px-3.5 py-2 text-[13px] text-[#ffb3a4]">{phone.error}</p> : null}
      </div>

      {noteOpen && call?.id ? (
        <div className="m-rise mb-6 flex items-end gap-2">
          <textarea
            autoFocus
            value={note}
            onChange={(event) => { setNote(event.target.value); setNoteState('idle') }}
            rows={2}
            placeholder={t('miniapp.phone.note_placeholder', 'Add a note…')}
            className="min-h-[54px] flex-1 resize-none rounded-[20px] border border-white/10 bg-white/8 px-4 py-3 text-[14px] text-[var(--m-on-hero)] placeholder:text-white/40 focus:border-[var(--m-lime)] focus:outline-none"
          />
          <button type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteState === 'saving'} className="m-press grid h-[54px] min-w-[54px] place-items-center rounded-[20px] bg-[var(--m-lime)] px-4 text-[14px] font-bold text-[var(--m-lime-ink)] disabled:opacity-35">
            {noteState === 'saving' ? <Arcs size={18} /> : noteState === 'saved' ? <IcCheck size={20} strokeWidth={2.6} /> : t('common.save', 'Save')}
          </button>
        </div>
      ) : null}

      {incomingRinging ? (
        <div className="m-rise flex items-start justify-around">
          <RoundAction label={t('miniapp.call.reject', 'Decline')} onClick={() => { haptic('tap'); stopRingtone(); phone.reject() }} className="h-[76px] w-[76px] bg-[var(--m-coral)] text-white shadow-[0_16px_34px_-14px_var(--m-coral)]">
            <IcHangup size={34} duo={0.25} />
          </RoundAction>
          <RoundAction label={t('miniapp.call.answer', 'Answer')} onClick={() => { haptic('tap'); stopRingtone(); phone.answer() }} className="m-ring h-[76px] w-[76px] bg-[var(--m-lime)] text-[var(--m-lime-ink)]">
            <IcPhone size={32} duo={0.3} strokeWidth={2.1} />
          </RoundAction>
        </div>
      ) : (
        <div className="m-rise flex items-start justify-around">
          <RoundAction label={muted ? t('miniapp.call.unmute', 'Unmute') : t('miniapp.call.mute', 'Mute')} pressed={muted} onClick={() => { haptic('select'); phone.toggleMute() }} className={cn('h-16 w-16', muted ? 'bg-[var(--m-on-hero)] text-[var(--m-hero)]' : 'bg-white/10 text-[var(--m-on-hero)] backdrop-blur')}>
            {muted ? <IcMicOff size={26} duo={0.2} /> : <IcMic size={26} duo={0.2} />}
          </RoundAction>
          <RoundAction label={t('miniapp.call.hangup', 'End')} onClick={() => { haptic('tap'); phone.hangup() }} className="h-[76px] w-[76px] bg-[var(--m-coral)] text-white shadow-[0_16px_34px_-14px_var(--m-coral)]">
            <IcHangup size={34} duo={0.25} />
          </RoundAction>
          <RoundAction label={t('miniapp.call.note', 'Note')} pressed={noteOpen} disabled={!call?.id} onClick={() => setNoteOpen((open) => !open)} className={cn('h-16 w-16', noteOpen ? 'bg-[var(--m-lime)] text-[var(--m-lime-ink)]' : 'bg-white/10 text-[var(--m-on-hero)] backdrop-blur')}>
            <IcNote size={25} duo={0.2} />
          </RoundAction>
        </div>
      )}
    </div>
  )
}

function RoundAction({ label, onClick, className, pressed, disabled, children }: { label: string; onClick: () => void; className: string; pressed?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="flex w-[84px] flex-col items-center gap-2">
      <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label} className={cn('m-press grid place-items-center rounded-full transition-colors duration-300 disabled:opacity-35', className)}>
        {children}
      </button>
      <span className="max-w-full truncate text-[12.5px] font-semibold text-[var(--m-on-hero-muted)]">{label}</span>
    </div>
  )
}
