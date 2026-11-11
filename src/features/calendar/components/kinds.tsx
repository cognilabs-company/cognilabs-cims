import { CalendarCheckIcon, CalendarXIcon, CheckSquareOffsetIcon, ClockCountdownIcon, HandshakeIcon, PhoneCallIcon } from '@phosphor-icons/react'
import type { EventKind } from '../lib/types'

export function KindIcon({ kind, size = 16 }: { kind: EventKind; size?: number }) {
  const Icon = kind === 'recall'
    ? PhoneCallIcon
    : kind === 'meeting'
      ? HandshakeIcon
      : kind === 'task'
        ? CheckSquareOffsetIcon
        : kind === 'holiday'
          ? CalendarXIcon
          : kind === 'short_day'
            ? ClockCountdownIcon
            : CalendarCheckIcon
  return <Icon size={size} weight="duotone" />
}
