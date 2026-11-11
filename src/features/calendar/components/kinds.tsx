import { CalendarXIcon, CheckSquareOffsetIcon, ClockCountdownIcon, PhoneCallIcon, StarIcon } from '@phosphor-icons/react'
import type { EventKind } from '../lib/types'

export function KindIcon({ kind, size = 16 }: { kind: EventKind; size?: number }) {
  const Icon = kind === 'callback' ? PhoneCallIcon : kind === 'task' ? CheckSquareOffsetIcon : kind === 'holiday' ? CalendarXIcon : kind === 'short_day' ? ClockCountdownIcon : StarIcon
  return <Icon size={size} weight="duotone" />
}
