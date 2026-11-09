import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { BellOff, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, PhoneOutgoing, UserRound, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { leadPath } from '../../../shared/api/services/telephony.service'
import { useTelephony } from '../TelephonyContext'
import { startRingtone, stopRingtone } from '../lib/ringtone'
import { formatDuration, formatPhone, hueOf, initialOf, sourceLabel } from './telephonyFormat'

/* ──────────────────────────────────────────────────────────────
   Call island — incoming, outgoing and active calls appear at the
   top centre of the screen like the MacBook notch: a black pill that
   grows into a card, plays a ringtone while ringing, and folds back
   when the call is over.
   ────────────────────────────────────────────────────────────── */

type IslandView = {
  key: string
  isIncoming: boolean
  ringing: boolean
  connected: boolean
  live: boolean
  rawName: string
  name: string
  number: string
  source: string | null
  leadStatus: string | null
  path: string | null
  confirmedAt: string | null
  muted: boolean
}

function RoundButton({ label, tone, onClick, disabled, pressed, halo, children }: {
  label: string
  tone: 'red' | 'green' | 'glass'
  onClick?: () => void
  disabled?: boolean
  pressed?: boolean
  halo?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-12 w-12 shrink-0 place-items-center rounded-full transition-[transform,background-color,filter] duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        tone === 'red' && 'bg-[#FF453A] text-white hover:brightness-110',
        tone === 'green' && 'bg-[#30D158] text-white hover:brightness-110',
        tone === 'glass' && (pressed ? 'bg-white text-black' : 'bg-white/12 text-white hover:bg-white/20'),
        halo && 'call-halo',
      )}
    >
      {children}
    </button>
  )
}

function Wave() {
  return (
    <span className="call-wave flex h-3.5 items-center gap-[2px]" aria-hidden="true">
      {[0, 120, 240, 80, 200].map((delay, index) => (
        <span key={index} className="block h-full w-[2.5px] rounded-full bg-[#30D158]" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  )
}

export function ActiveCallPanel() {
  const { t } = useLocale()
  const { call, lead, sessionStatus, sessionDirection, confirmedAt, muted, error, answer, reject, hangup, toggleMute, clearCall } = useTelephony()
  const [now, setNow] = useState(() => Date.now())
  const [silencedKey, setSilencedKey] = useState<string | null>(null)
  const [closing, setClosing] = useState<IslandView | null>(null)
  const lastViewRef = useRef<IslandView | null>(null)

  const visible = Boolean(call || sessionStatus)
  const isIncoming = call?.direction === 'incoming' || (!call && sessionDirection === 'incoming')
  const ringing = Boolean(isIncoming && (call?.status === 'ringing' || sessionStatus === 'ringing') && !confirmedAt)
  const rawName = lead?.full_name || call?.customer_name || ''
  const number = lead?.phone_number || call?.phone_number || ''
  const viewKey = String(call?.id ?? `${sessionDirection ?? 'call'}-${number}`)
  const silenced = silencedKey === viewKey

  const liveView: IslandView | null = visible ? {
    key: viewKey,
    isIncoming,
    ringing,
    connected: Boolean(confirmedAt),
    live: Boolean(sessionStatus),
    rawName,
    name: rawName || (number ? formatPhone(number) : isIncoming ? t('telephony.hud.unknown_caller', 'Unknown caller') : t('telephony.kind.outgoing', 'Outgoing call')),
    number,
    source: sourceLabel(lead?.crm_source || call?.crm_source),
    leadStatus: lead?.status ? t(`crm.status_label.${lead.status.toLowerCase().replace(/[^a-z0-9]/g, '')}`, lead.status) : null,
    path: leadPath(lead?.crm_source ?? call?.crm_source ?? null, lead?.customer_id ?? call?.customer_id ?? null),
    confirmedAt,
    muted,
  } : null

  // Ticking timer while connected
  useEffect(() => {
    if (!confirmedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [confirmedAt])

  // Ringtone while an incoming call rings (unless silenced)
  useEffect(() => {
    if (!ringing || silenced) return
    startRingtone()
    return () => stopRingtone()
  }, [ringing, silenced])

  // Remember the last frame so the island can fold away after the call is gone
  useEffect(() => {
    if (liveView) lastViewRef.current = liveView
  })
  useEffect(() => {
    if (visible) return
    const last = lastViewRef.current
    if (!last) return
    lastViewRef.current = null
    const frame = window.requestAnimationFrame(() => setClosing(last))
    const timer = window.setTimeout(() => setClosing(null), 420)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [visible])

  const view = liveView ?? closing
  if (!view || typeof document === 'undefined') return null

  const seconds = view.confirmedAt ? Math.max(0, Math.floor((now - new Date(view.confirmedAt).getTime()) / 1000)) : 0
  const hue = hueOf(view.rawName || view.number || 'call')
  const initial = initialOf(view.rawName)
  const calling = view.live && !view.isIncoming && !view.connected
  const ended = !view.live

  const statusLine = view.connected ? (
    <span className="flex items-center gap-2 text-[#30D158]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#30D158] shadow-[0_0_8px_#30D158]" />
      <span className="font-mono text-[12.5px] font-semibold tabular-nums">{formatDuration(seconds)}</span>
      {!view.muted ? <Wave /> : <MicOff size={13} className="text-white/50" />}
    </span>
  ) : view.ringing ? (
    <span className="flex items-center gap-1.5 text-white/70"><PhoneIncoming size={13} className="text-[#30D158]" />{t('telephony.kind.incoming', 'Incoming call')}</span>
  ) : calling ? (
    <span className="flex items-center gap-1.5 text-white/70"><PhoneOutgoing size={13} className="text-[#0A84FF]" />{t('telephony.hud.calling', 'Calling…')}</span>
  ) : (
    <span className="text-white/55">{t('telephony.hud.ended', 'Call ended')}</span>
  )

  const ear: CSSProperties = { background: '#0A0A0B' }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[160] flex justify-center px-2">
      <div className="pointer-events-auto relative" style={{ width: 'min(500px, calc(100vw - 16px))' }}>
        {/* concave "ears" so the island grows out of the top edge like a notch */}
        {!closing ? (
          <>
            <span aria-hidden="true" className="call-island-ears absolute top-0 -left-[14px] h-[14px] w-[14px]" style={{ ...ear, WebkitMaskImage: 'radial-gradient(circle at 0 100%, transparent 14px, #000 14.5px)', maskImage: 'radial-gradient(circle at 0 100%, transparent 14px, #000 14.5px)' }} />
            <span aria-hidden="true" className="call-island-ears absolute top-0 -right-[14px] h-[14px] w-[14px]" style={{ ...ear, WebkitMaskImage: 'radial-gradient(circle at 100% 100%, transparent 14px, #000 14.5px)', maskImage: 'radial-gradient(circle at 100% 100%, transparent 14px, #000 14.5px)' }} />
          </>
        ) : null}

        <div
          role="dialog"
          aria-modal="false"
          aria-live="polite"
          aria-label={t('telephony.hud.label', 'Active phone call')}
          className={cn('call-island bg-[#0A0A0B] text-white shadow-[0_28px_70px_-22px_rgba(0,0,0,0.75),0_0_0_0.5px_rgba(255,255,255,0.06)]', closing && 'call-island-closing')}
        >
          <div className="call-island-content px-5 pt-3 pb-4">
            {/* top row: state on the left, source / controls on the right */}
            <div className="flex h-7 items-center justify-between gap-3 text-[12.5px] font-medium">
              {statusLine}
              <span className="flex items-center gap-1.5">
                {view.source ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/75">{view.source}</span> : null}
                {view.leadStatus ? <span className="max-w-[140px] truncate rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/75">{view.leadStatus}</span> : null}
                {view.ringing ? (
                  <button
                    type="button"
                    onClick={() => { setSilencedKey(view.key); stopRingtone() }}
                    aria-pressed={silenced}
                    aria-label={t('telephony.hud.silence', 'Silence ringtone')}
                    title={t('telephony.hud.silence', 'Silence ringtone')}
                    className={cn('grid h-6 w-6 place-items-center rounded-full transition-colors', silenced ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20')}
                  >
                    <BellOff size={12} />
                  </button>
                ) : null}
                {ended ? (
                  <button type="button" onClick={clearCall} aria-label={t('telephony.close', 'Close')} title={t('telephony.close', 'Close')} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20">
                    <X size={12} />
                  </button>
                ) : null}
              </span>
            </div>

            {/* caller + actions */}
            <div className="mt-2.5 flex items-center gap-3.5">
              <span
                className={cn('grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[18px] text-[24px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]', view.ringing && 'call-halo')}
                style={{ background: `linear-gradient(140deg, hsl(${hue} 75% 62%) 0%, hsl(${hue + 40} 70% 42%) 100%)` }}
              >
                {initial || <UserRound size={26} strokeWidth={1.8} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] leading-6 font-semibold tracking-[-0.01em]">{view.name}</p>
                <p className="truncate text-[13px] text-white/55 tabular-nums">
                  {view.rawName && view.number ? formatPhone(view.number) : view.isIncoming ? t('telephony.direction.incoming', 'Incoming') : t('telephony.direction.outgoing', 'Outgoing')}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                {view.ringing ? (
                  <>
                    <RoundButton label={t('telephony.hud.decline', 'Decline')} tone="red" onClick={reject} disabled={!view.live}><PhoneOff size={20} /></RoundButton>
                    <RoundButton label={t('telephony.hud.accept', 'Accept')} tone="green" onClick={answer} disabled={!view.live} halo><Phone size={20} fill="currentColor" strokeWidth={0} /></RoundButton>
                  </>
                ) : view.live ? (
                  <>
                    {view.connected ? (
                      <RoundButton label={view.muted ? t('telephony.hud.unmute', 'Unmute') : t('telephony.hud.mute', 'Mute')} tone="glass" pressed={view.muted} onClick={toggleMute}>
                        {view.muted ? <MicOff size={19} /> : <Mic size={19} />}
                      </RoundButton>
                    ) : null}
                    {view.path ? (
                      <Link to={view.path} aria-label={t('telephony.open_lead', 'Open lead')} title={t('telephony.open_lead', 'Open lead')} className="grid h-12 w-12 place-items-center rounded-full bg-white/12 text-white transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-white/20 active:scale-95">
                        <UserRound size={19} />
                      </Link>
                    ) : null}
                    <RoundButton label={t('telephony.hud.end', 'End')} tone="red" onClick={hangup}><PhoneOff size={20} /></RoundButton>
                  </>
                ) : null}
              </div>
            </div>

            {error ? <p role="alert" className="mt-3 truncate text-[12px] text-[#FF6961]">{error}</p> : null}
            {ended && call ? <p className="mt-2 text-[11.5px] text-white/45">{t('telephony.hud.restored', 'Restored after a page reload — browser call controls are unavailable.')}</p> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
