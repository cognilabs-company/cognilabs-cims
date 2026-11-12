import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { toDayString, weekdaysShort } from '../lib/dates'
import type { CalEvent } from '../lib/types'
import { EventChip } from './EventChip'

type Props = {
  days: Date[]
  month: number
  byDay: Map<string, CalEvent[]>
  today: string
  selectedDay: string
  selectedEventId: string | null
  slide: 'left' | 'right' | null
  gridKey: string
  onSelectDay: (day: string) => void
  onOpenEvent: (event: CalEvent) => void
  onCreate: (day: string) => void
}

const MAX_CHIPS = 3

/** Month grid: day number, up to three events, "+N more"; holidays and short days tint the cell. */
export function MonthView({ days, month, byDay, today, selectedDay, selectedEventId, slide, gridKey, onSelectDay, onOpenEvent, onCreate }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {weekdaysShort().map((name, index) => (
          <span key={name} className={cn('px-2.5 py-2 text-[11.5px] font-semibold tracking-wide uppercase', index >= 5 ? 'text-[var(--caption)]' : 'text-[var(--muted)]')}>{name}</span>
        ))}
      </div>
      <div key={gridKey} className={cn('grid min-h-0 flex-1 grid-cols-7 grid-rows-6', slide === 'left' ? 'cal-slide-left' : slide === 'right' ? 'cal-slide-right' : '')}>
        {days.map((date, index) => {
          const day = toDayString(date)
          const events = byDay.get(day) ?? []
          const dayType = events.find((event) => event.kind === 'holiday') ?? events.find((event) => event.kind === 'short_day')
          const timed = events.filter((event) => event.kind !== 'holiday' && event.kind !== 'short_day')
          const inMonth = date.getMonth() === month
          const isToday = day === today
          const isSelected = day === selectedDay
          const weekend = index % 7 >= 5
          // Leave a line for "+N more" so it is never cut off.
          const room = dayType ? MAX_CHIPS - 1 : MAX_CHIPS
          const shown = timed.slice(0, timed.length > room ? room - 1 : room)
          const more = timed.length - shown.length
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onDoubleClick={() => onCreate(day)}
              onKeyDown={(event) => { if (event.key === 'Enter') onSelectDay(day) }}
              className={cn(
                'group/cell relative flex min-h-[104px] cursor-pointer flex-col gap-[3px] overflow-hidden border-r border-b border-[var(--border-subtle)] p-1.5 transition-colors [&:nth-child(7n)]:border-r-0',
                weekend && 'bg-[var(--muted-surface)]/40',
                !inMonth && 'opacity-45',
                isSelected ? 'bg-[var(--blue-dim)]/60 shadow-[inset_0_0_0_2px_var(--primary)]' : 'hover:bg-[var(--input-surface)]/60',
              )}
              style={dayType ? { background: `color-mix(in srgb, ${dayType.color} ${isSelected ? 14 : 8}%, transparent)` } : undefined}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={cn('grid h-[24px] min-w-[24px] place-items-center rounded-full px-1 tabular-nums', isToday ? 'bg-[var(--primary)] text-[13px] font-extrabold text-white shadow-[0_4px_10px_-4px_var(--primary)]' : 'text-[12.5px] font-semibold text-[var(--foreground)]')}>
                  {date.getDate()}
                </span>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onCreate(day) }}
                  aria-label={t('calendar.add_on_day', 'Add an event on this day')}
                  className="grid h-5 w-5 scale-75 place-items-center rounded-full text-[var(--muted)] opacity-0 transition-[opacity,transform] group-hover/cell:scale-100 group-hover/cell:opacity-100 hover:bg-[var(--surface)] hover:text-[var(--primary)]"
                >
                  +
                </button>
              </div>
              {dayType ? <EventChip event={dayType} selected={dayType.id === selectedEventId} onOpen={onOpenEvent} /> : null}
              {shown.map((event) => <EventChip key={event.id} event={event} selected={event.id === selectedEventId} onOpen={onOpenEvent} />)}
              {more > 0 ? <span className="shrink-0 px-1.5 text-[11px] leading-[14px] font-semibold text-[var(--primary)]">{t('calendar.more', '+{{count}} more', { count: more })}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
