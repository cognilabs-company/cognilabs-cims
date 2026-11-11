import {
  CalendarCheckIcon,
  ClockIcon,
  FileTextIcon,
  PhoneCallIcon,
  PhoneIncomingIcon,
  PhoneSlashIcon,
  RepeatIcon,
  RocketLaunchIcon,
  SealCheckIcon,
  TagIcon,
  WalletIcon,
  XCircleIcon,
  type Icon,
} from '@phosphor-icons/react'
import { BadgeCheck, CalendarCheck, CircleDot, CircleX, Clock3, FilePen, PhoneCall, PhoneIncoming, PhoneOff, Repeat2, Rocket, Wallet, type LucideIcon } from 'lucide-react'

type StatusIconKind = 'call' | 'no_answer' | 'contacted' | 'waiting' | 'meeting' | 'proposal' | 'payment' | 'started' | 'finished' | 'rejected' | 'in_progress' | 'other'

/**
 * CRM statuses are configured on the backend, so the icon is picked from the
 * status key: need_to_call → phone, meeting_scheduled → calendar, and so on.
 */
function statusIconKind(value: string): StatusIconKind {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (key.includes('needtocall') || key.includes('recall') || key.includes('call')) return 'call'
  if (key.includes('ndz') || key.includes('noanswer') || key.includes('unreach')) return 'no_answer'
  if (key.includes('contact')) return 'contacted'
  if (key.includes('delay') || key.includes('later') || key.includes('wait')) return 'waiting'
  if (key.includes('meeting')) return 'meeting'
  if (key.includes('kp') || key.includes('tz') || key.includes('proposal') || key.includes('offer')) return 'proposal'
  if (key.includes('pay')) return 'payment'
  if (key.includes('started') || key.includes('start')) return 'started'
  if (key.includes('finish') || key.includes('done') || key.includes('complete')) return 'finished'
  if (key.includes('reject') || key.includes('cancel') || key.includes('lost')) return 'rejected'
  if (key.includes('continu') || key.includes('progress')) return 'in_progress'
  return 'other'
}

const lucideStatusIcons: Record<StatusIconKind, LucideIcon> = {
  call: PhoneCall,
  no_answer: PhoneOff,
  contacted: PhoneIncoming,
  waiting: Clock3,
  meeting: CalendarCheck,
  proposal: FilePen,
  payment: Wallet,
  started: Rocket,
  finished: BadgeCheck,
  rejected: CircleX,
  in_progress: Repeat2,
  other: CircleDot,
}

const kpiStatusIcons: Record<StatusIconKind, Icon> = {
  call: PhoneCallIcon,
  no_answer: PhoneSlashIcon,
  contacted: PhoneIncomingIcon,
  waiting: ClockIcon,
  meeting: CalendarCheckIcon,
  proposal: FileTextIcon,
  payment: WalletIcon,
  started: RocketLaunchIcon,
  finished: SealCheckIcon,
  rejected: XCircleIcon,
  in_progress: RepeatIcon,
  other: TagIcon,
}

/** Lucide icon of a status — status pills, selects and filters. */
export function statusIconFor(value: string): LucideIcon {
  return lucideStatusIcons[statusIconKind(value)]
}

/** Phosphor icon of a status — KPI tiles (rendered duotone by MetricTile / StatCard). */
export function statusKpiIconFor(value: string): Icon {
  return kpiStatusIcons[statusIconKind(value)]
}
