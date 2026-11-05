import { createContext, useContext } from 'react'
import type { TelephonyCall, TelephonyConfig, TelephonyLead } from '../../shared/api/services/telephony.service'

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
