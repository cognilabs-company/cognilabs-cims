import { BadgeCheck, CalendarCheck, CircleDot, CircleX, Clock3, FilePen, PhoneCall, PhoneIncoming, PhoneOff, Repeat2, Rocket, Wallet, type LucideIcon } from 'lucide-react'

/**
 * CRM statuses are configured on the backend, so the icon is picked from the
 * status key: need_to_call → phone, meeting_scheduled → calendar, and so on.
 */
export function statusIconFor(value: string): LucideIcon {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (key.includes('needtocall') || key.includes('recall') || key.includes('call')) return PhoneCall
  if (key.includes('ndz') || key.includes('noanswer') || key.includes('unreach')) return PhoneOff
  if (key.includes('contact')) return PhoneIncoming
  if (key.includes('delay') || key.includes('later') || key.includes('wait')) return Clock3
  if (key.includes('meeting')) return CalendarCheck
  if (key.includes('kp') || key.includes('tz') || key.includes('proposal') || key.includes('offer')) return FilePen
  if (key.includes('pay')) return Wallet
  if (key.includes('started') || key.includes('start')) return Rocket
  if (key.includes('finish') || key.includes('done') || key.includes('complete')) return BadgeCheck
  if (key.includes('reject') || key.includes('cancel') || key.includes('lost')) return CircleX
  if (key.includes('continu') || key.includes('progress')) return Repeat2
  return CircleDot
}
