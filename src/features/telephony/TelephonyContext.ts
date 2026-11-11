import { createContext, useContext } from 'react'
import type { OutboundMode, TelephonyCall, TelephonyConfig, TelephonyLead } from '../../shared/api/services/telephony.service'

/** Mobile mode: the PBX is ringing the user's own phone; the customer is connected once they answer. */
export type MobileDialState = { phone: string; startedAt: number }

export type PhoneState = {
  config: TelephonyConfig | null
  connection: string
  error: string | null
  call: TelephonyCall | null
  lead: TelephonyLead | null
  sessionStatus: string | null
  sessionDirection: 'incoming' | 'outgoing' | null
  confirmedAt: string | null
  muted: boolean
  historyVersion: number
  /** "webrtc" — calls in the browser; "mobile" — the PBX calls the user's mobile first. */
  outboundMode: OutboundMode
  mobileCall: MobileDialState | null
  /** The user may start a call right now (RBAC calls:create + a ready line, no other call). */
  canDial: boolean
  dial: (phone: string, lead?: TelephonyLead | null) => void
  answer: () => void
  reject: () => void
  hangup: () => void
  toggleMute: () => void
  clearCall: () => void
}

export const TelephonyContext = createContext<PhoneState | null>(null)

export function useTelephony() {
  const context = useContext(TelephonyContext)
  if (!context) throw new Error('Telephony provider is missing')
  return context
}
