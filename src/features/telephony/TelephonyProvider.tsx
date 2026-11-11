import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/hooks/useAuth'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { normalizePhone, telephonyService, type OutboundMode, type TelephonyCall, type TelephonyConfig, type TelephonyLead } from '../../shared/api/services/telephony.service'
import { TelephonyContext, type MobileDialState } from './TelephonyContext'
import { ActiveCallPanel } from './components/ActiveCallPanel'

type SipSession = {
  direction?: string
  remote_identity?: { uri?: { user?: string } }
  connection?: RTCPeerConnection
  on: (event: string, handler: (...args: unknown[]) => void) => void
  answer: (options: object) => void
  terminate: () => void
  isEnded: () => boolean
  isEstablished: () => boolean
}
type SipAgent = {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  start: () => void
  stop: () => void
  call: (target: string, options: object) => SipSession
}

const finalStatuses = new Set(['completed', 'missed', 'rejected', 'busy', 'failed'])
const retryDelays = [1000, 2000, 5000, 10000]

function statusError(cause: unknown) {
  const value = typeof cause === 'string' ? cause : 'Connection failed'
  if (/permission|denied/i.test(value)) return 'Microphone permission is required for calls.'
  if (/busy/i.test(value)) return 'The line is busy.'
  if (/unavailable|timeout/i.test(value)) return 'The phone service is unavailable.'
  return `Call failed: ${value}`
}

export function TelephonyProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth()
  // RBAC: "calls" view = the phone line and call history; create = placing calls.
  const allowed = can('calls', 'view')
  const canPlaceCalls = can('calls', 'create')
  const [mobileCall, setMobileCall] = useState<MobileDialState | null>(null)
  const [config, setConfig] = useState<TelephonyConfig | null>(null)
  const [connection, setConnection] = useState('Connecting')
  const [error, setError] = useState<string | null>(null)
  const [call, setCall] = useState<TelephonyCall | null>(null)
  const [lead, setLead] = useState<TelephonyLead | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [sessionDirection, setSessionDirection] = useState<'incoming' | 'outgoing' | null>(null)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const agentRef = useRef<SipAgent | null>(null)
  const sessionRef = useRef<SipSession | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callRef = useRef<TelephonyCall | null>(null)
  const leadRef = useRef<TelephonyLead | null>(null)
  const configRef = useRef<TelephonyConfig | null>(null)

  useEffect(() => { callRef.current = call }, [call])
  useEffect(() => { leadRef.current = lead }, [lead])
  useEffect(() => { configRef.current = config }, [config])

  const attachSession = useCallback((session: SipSession) => {
    sessionRef.current = session
    setMuted(false)
    setError(null)
    setSessionDirection(session.direction === 'incoming' ? 'incoming' : 'outgoing')
    setSessionStatus(session.direction === 'incoming' ? 'ringing' : 'calling')
    const attachAudio = () => {
      const peer = session.connection
      if (!peer) return
      peer.addEventListener('track', (event) => {
        if (!audioRef.current) return
        audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track])
        void audioRef.current.play().catch(() => {})
      })
    }
    session.on('peerconnection', attachAudio)
    attachAudio()
    session.on('progress', () => setSessionStatus('ringing'))
    session.on('accepted', () => setSessionStatus('connecting'))
    session.on('confirmed', () => {
      setSessionStatus('answered')
      setConfirmedAt(new Date().toISOString())
    })
    const finish = (details?: { cause?: string; message?: { status_code?: number } }) => {
      if (details?.cause) console.warn('SIP call ended', details.cause, details.message?.status_code)
      if (sessionRef.current !== session) return
      sessionRef.current = null
      callRef.current = null
      setCall(null)
      setLead(null)
      setSessionStatus(null)
      setSessionDirection(null)
      setConfirmedAt(null)
      setMuted(false)
      setHistoryVersion((value) => value + 1)
      if (audioRef.current) audioRef.current.srcObject = null
    }
    session.on('ended', (details) => finish(details as { cause?: string; message?: { status_code?: number } } | undefined))
    session.on('failed', (rawDetails) => {
      const details = rawDetails as { cause?: string; message?: { status_code?: number } } | undefined
      console.warn('SIP call failed', details?.cause, details?.message?.status_code)
      setError(statusError(details?.cause))
      finish()
    })
    session.on('getusermediafailed', (cause) => {
      console.warn('Microphone access failed', cause)
      setError('Microphone permission is required for calls.')
    })
  }, [])

  useEffect(() => {
    if (!allowed || !user?.id) return
    let active = true
    let agent: SipAgent | null = null
    void telephonyService.config().then(async (next) => {
      if (!active) return
      setConfig(next)
      if (!next.enabled) { setConnection('Disabled'); return }
      const { default: JsSIP } = await import('jssip')
      if (!active) return
      const JsSIPApi = JsSIP as unknown as { WebSocketInterface: new (url: string) => object; UA: new (options: object) => SipAgent }
      agent = new JsSIPApi.UA({
        sockets: [new JsSIPApi.WebSocketInterface(next.websocket_url)],
        uri: next.sip_uri,
        password: next.password,
        display_name: next.display_name,
        register: true,
      })
      agentRef.current = agent
      agent.on('registered', () => setConnection('Ready'))
      agent.on('unregistered', () => setConnection('Disconnected'))
      agent.on('disconnected', () => setConnection('Disconnected'))
      agent.on('registrationFailed', (rawEvent) => {
        const event = rawEvent as { cause?: string; response?: { status_code?: number } } | undefined
        console.warn('SIP registration failed', event?.cause, event?.response?.status_code)
        setConnection('Registration failed')
        setError(statusError(event?.cause))
      })
      agent.on('newRTCSession', (rawEvent) => {
        const session = (rawEvent as { session: SipSession }).session
        if (sessionRef.current && sessionRef.current !== session && !sessionRef.current.isEnded()) {
          session.terminate()
          return
        }
        attachSession(session)
        if (session.direction === 'incoming') {
          const phone = normalizePhone(session.remote_identity?.uri?.user ?? '')
          if (phone) {
            void telephonyService.resolve(phone).then((result) => {
              if (active && result && sessionRef.current === session) setLead(result)
            }).catch(() => {})
          }
        }
      })
      agent.start()
    }).catch((cause: unknown) => {
      if (active) { setConnection('Unavailable'); setError(getApiErrorMessage(cause)) }
    })
    return () => {
      active = false
      sessionRef.current?.terminate()
      sessionRef.current = null
      agent?.stop()
      agentRef.current = null
    }
  }, [allowed, user?.id, attachSession])

  useEffect(() => {
    if (!allowed || !config?.enabled) return
    let active = true
    let socket: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let ping: ReturnType<typeof setInterval> | null = null
    let attempt = 0
    const connect = () => {
      if (!active) return
      socket = new WebSocket(telephonyService.eventsUrl())
      socket.onopen = () => {
        if (attempt > 0) setHistoryVersion((value) => value + 1)
        attempt = 0
        ping = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping') }, 25000)
      }
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type: string; call?: TelephonyCall }
          if (data.type !== 'call.updated' || !data.call) return
          const next = data.call
          if (finalStatuses.has(next.status)) {
            setHistoryVersion((value) => value + 1)
            setMobileCall(null)
            if (callRef.current?.id === next.id) {
              callRef.current = null
              setCall(null)
              setLead(null)
              setConfirmedAt(null)
              setSessionStatus(null)
              const session = sessionRef.current
              if (session && !session.isEnded()) {
                try { session.terminate() } catch { /* Already ending. */ }
              }
            }
            return
          }
          if (next.status === 'ringing' || next.status === 'answered') {
            callRef.current = next
            setCall(next)
            setMobileCall(null)
            if (next.answered_at) setConfirmedAt(next.answered_at)
            if (next.customer_id && (!leadRef.current || leadRef.current.customer_id !== next.customer_id)) {
              void telephonyService.call(next.id).then((detail) => {
                if (active && detail.lead && callRef.current?.id === next.id) setLead(detail.lead)
              }).catch(() => {})
            }
          }
        } catch { /* Ignore keepalive and unknown events. */ }
      }
      socket.onclose = () => {
        if (ping) clearInterval(ping)
        if (active) reconnect = setTimeout(connect, retryDelays[Math.min(attempt++, retryDelays.length - 1)])
      }
    }
    connect()
    void telephonyService.activeCalls().then((items) => {
      if (!active) return
      const calls = Array.isArray(items) ? items : items.items
      const current = calls.find((item) => !finalStatuses.has(item.status))
      if (current && !callRef.current) {
        callRef.current = current
        setCall(current)
        if (current.answered_at) setConfirmedAt(current.answered_at)
        if (current.customer_id) {
          void telephonyService.call(current.id).then((detail) => {
            if (active && callRef.current?.id === current.id) setLead(detail.lead)
          }).catch(() => {})
        }
      }
    }).catch(() => {})
    return () => {
      active = false
      if (reconnect) clearTimeout(reconnect)
      if (ping) clearInterval(ping)
      socket?.close()
    }
  }, [allowed, config?.enabled])

  const dial = useCallback((phone: string, selectedLead?: TelephonyLead | null) => {
    const normalized = normalizePhone(phone)
    if (!canPlaceCalls) { setError('You do not have permission to make calls.'); return }
    if (configRef.current?.outbound_mode === 'mobile') {
      // The PBX calls the user's mobile first, then the customer (company caller ID and recording are kept).
      if (normalized.length < 7) { setError('Enter a full phone number.'); return }
      if (!configRef.current.enabled || callRef.current || sessionRef.current) { setError('Phone is not ready or another call is active.'); return }
      setLead(selectedLead ?? null)
      setConfirmedAt(null)
      setError(null)
      setMobileCall({ phone: normalized, startedAt: Date.now() })
      void telephonyService.dialMobile(normalized).then((result) => {
        // Some backends answer with the call row right away; otherwise the events socket brings it.
        const row = result as Partial<TelephonyCall> | null
        if (row && typeof row.id === 'number' && typeof row.status === 'string' && !callRef.current) {
          callRef.current = row as TelephonyCall
          setCall(row as TelephonyCall)
          setMobileCall(null)
        }
      }).catch((cause: unknown) => {
        setMobileCall(null)
        setLead(null)
        setError(getApiErrorMessage(cause))
      })
      return
    }
    if (normalized.length < 7 || !agentRef.current || !configRef.current?.enabled || sessionRef.current) {
      setError(normalized.length < 7 ? 'Enter a full phone number.' : 'Phone is not ready or another call is active.')
      return
    }
    const domain = configRef.current.sip_uri.split('@')[1]?.replace(/>.*/, '')
    if (!domain) { setError('Phone configuration is missing a SIP domain.'); return }
    setLead(selectedLead ?? null)
    setCall(null)
    setConfirmedAt(null)
    setError(null)
    try {
      agentRef.current.call(`sip:${normalized}@${domain}`, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: configRef.current.ice_servers },
      })
    } catch (cause) { setError(statusError(cause instanceof Error ? cause.message : cause)) }
  }, [canPlaceCalls])

  // A mobile dial that never produced a call event (phone not answered, PBX gave up) is forgotten after a minute.
  useEffect(() => {
    if (!mobileCall) return
    const timer = window.setTimeout(() => setMobileCall((current) => (current === mobileCall ? null : current)), 60_000)
    return () => window.clearTimeout(timer)
  }, [mobileCall])

  const answer = useCallback(() => {
    const session = sessionRef.current
    if (!session) { setError('Call is no longer available in this browser.'); return }
    try { session.answer({ mediaConstraints: { audio: true, video: false }, pcConfig: { iceServers: configRef.current?.ice_servers ?? [] } }) }
    catch (cause) { setError(statusError(cause instanceof Error ? cause.message : cause)) }
  }, [])
  const hangup = useCallback(() => { sessionRef.current?.terminate() }, [])
  const toggleMute = useCallback(() => {
    const tracks = sessionRef.current?.connection?.getSenders().flatMap((sender) => sender.track?.kind === 'audio' ? [sender.track] : []) ?? []
    if (tracks.length === 0) return
    const next = !tracks[0].enabled
    tracks.forEach((track) => { track.enabled = next })
    setMuted(!next)
  }, [])
  const clearCall = useCallback(() => { if (!sessionRef.current) { callRef.current = null; setCall(null); setLead(null); setError(null); setMobileCall(null) } }, [])
  const outboundMode: OutboundMode = config?.outbound_mode === 'mobile' ? 'mobile' : 'webrtc'
  const busy = Boolean(sessionStatus || call || mobileCall)
  const canDial = canPlaceCalls && Boolean(config?.enabled) && !busy && (outboundMode === 'mobile' || connection === 'Ready')
  const value = useMemo(() => ({
    config, connection, error, call, lead, sessionStatus, sessionDirection, confirmedAt, muted, historyVersion,
    outboundMode, mobileCall, canDial,
    dial, answer, reject: hangup, hangup, toggleMute, clearCall,
  }), [config, connection, error, call, lead, sessionStatus, sessionDirection, confirmedAt, muted, historyVersion, outboundMode, mobileCall, canDial, dial, answer, hangup, toggleMute, clearCall])

  return (
    <TelephonyContext.Provider value={value}>
      {children}
      {allowed ? <ActiveCallPanel key={call?.id ?? sessionStatus ?? 'idle'} /> : null}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
    </TelephonyContext.Provider>
  )
}
