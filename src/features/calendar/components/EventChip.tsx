import { cn } from '../../../shared/lib/cn'
import { timeOf } from '../lib/dates'
import type { CalEvent } from '../lib/types'

/** Small one-line event in a month cell. */
export function EventChip({ event, selected, onOpen }: { event: CalEvent; selected: boolean; onOpen: (event: CalEvent) => void }) {
  const time = event.allDay ? '' : timeOf(event.start)
  return (
    <button
      type="button"
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpen(event) }}
      title={[time, event.title].filter(Boolean).join(' · ')}
      className={cn(
        'cal-chip flex w-full min-w-0 shrink-0 items-center gap-1.5 rounded-[6px] px-1.5 py-[2px] text-left text-[11px] leading-[14px] transition-colors',
        event.allDay ? 'font-semibold text-white' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
        selected && !event.allDay && 'bg-[var(--blue-dim)]',
      )}
      style={event.allDay ? { background: event.color } : undefined}
    >
      {!event.allDay ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} /> : null}
      {time ? <span className="shrink-0 text-[var(--muted)] tabular-nums">{time}</span> : null}
      <span className="min-w-0 truncate" data-i18n-skip="true">{event.title}</span>
    </button>
  )
}
