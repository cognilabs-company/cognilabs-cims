import { ClockIcon } from '@phosphor-icons/react'
import { cn } from '../../../shared/lib/cn'
import { timeOf } from '../lib/dates'
import type { CalEvent } from '../lib/types'

/** Small one-line event in a month cell: colour bar, clock + time when it has one, title. */
export function EventChip({ event, selected, onOpen }: { event: CalEvent; selected: boolean; onOpen: (event: CalEvent) => void }) {
  const time = event.allDay ? '' : timeOf(event.start)
  return (
    <button
      type="button"
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpen(event) }}
      title={[time, event.title].filter(Boolean).join(' · ')}
      className={cn(
        'cal-chip flex w-full min-w-0 shrink-0 items-center gap-1 rounded-[7px] border-l-[3px] py-[3px] pr-1.5 pl-1.5 text-left text-[11.5px] leading-[15px] transition-[filter,box-shadow]',
        event.allDay ? 'font-semibold text-white' : 'text-[var(--foreground)] hover:brightness-95',
        selected && 'shadow-[0_0_0_1.5px_var(--primary)]',
      )}
      style={event.allDay
        ? { background: event.color, borderColor: event.color }
        : { background: `color-mix(in srgb, ${event.color} 11%, transparent)`, borderColor: event.color }}
    >
      {time ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums" style={{ color: event.color }}>
          <ClockIcon size={11} weight="bold" />
          {time}
        </span>
      ) : null}
      <span className="min-w-0 truncate font-medium" data-i18n-skip="true">{event.title}</span>
    </button>
  )
}
