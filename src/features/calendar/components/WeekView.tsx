import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { minutesOf, timeOf, toDayString, weekdaysShort } from '../lib/dates'
import type { CalEvent } from '../lib/types'

type Props = {
  days: Date[]
  byDay: Map<string, CalEvent[]>
  today: string
  selectedDay: string
  selectedEventId: string | null
  gridKey: string
  slide: 'left' | 'right' | null
  onSelectDay: (day: string) => void
  onOpenEvent: (event: CalEvent) => void
  onCreateAt: (day: string, time: string) => void
}

const START = 7
const END = 22
const HOUR = 52

type Placed = { event: CalEvent; top: number; height: number; column: number; columns: number }

/** Side-by-side columns for overlapping events of one day. */
function place(events: CalEvent[]): Placed[] {
  const items = events
    .map((event) => {
      const startMin = minutesOf(event.start)
      const endMin = event.end ? Math.max(startMin + 20, minutesOf(event.end)) : startMin + 30
      return { event, startMin, endMin }
    })
    .sort((a, b) => a.startMin - b.startMin)
  const out: Placed[] = []
  let group: typeof items = []
  let groupEnd = -1
  const flush = () => {
    const columnsEnd: number[] = []
    const assigned = group.map((item) => {
      let column = columnsEnd.findIndex((end) => end <= item.startMin)
      if (column === -1) { column = columnsEnd.length; columnsEnd.push(item.endMin) } else columnsEnd[column] = item.endMin
      return { item, column }
    })
    for (const { item, column } of assigned) {
      const top = ((Math.max(item.startMin, START * 60) - START * 60) / 60) * HOUR
      const bottom = ((Math.min(Math.max(item.endMin, item.startMin + 20), END * 60) - START * 60) / 60) * HOUR
      out.push({ event: item.event, top, height: Math.max(22, bottom - top), column, columns: columnsEnd.length })
    }
    group = []
  }
  for (const item of items) {
    if (group.length && item.startMin >= groupEnd) flush()
    group.push(item)
    groupEnd = Math.max(groupEnd, item.endMin)
  }
  if (group.length) flush()
  return out
}

/** Week with an hour grid (07:00–22:00), an all-day row and a "now" line. */
export function WeekView({ days, byDay, today, selectedDay, selectedEventId, gridKey, slide, onSelectDay, onOpenEvent, onCreateAt }: Props) {
  const { t } = useLocale()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Start scrolled to ~8:00.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR * 1
  }, [gridKey])

  const hours = Array.from({ length: END - START }, (_, index) => START + index)
  const nowTop = ((now.getHours() * 60 + now.getMinutes() - START * 60) / 60) * HOUR
  const names = weekdaysShort()

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day headers + all-day row */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[var(--border)]">
        <span />
        {days.map((date, index) => {
          const day = toDayString(date)
          const allDay = (byDay.get(day) ?? []).filter((event) => event.allDay)
          return (
            <div key={day} className={cn('min-w-0 border-l border-[var(--border-subtle)] px-1.5 pt-2 pb-1.5', day === selectedDay && 'bg-[var(--blue-dim)]/50')}>
              <button type="button" onClick={() => onSelectDay(day)} className="flex w-full items-baseline gap-1.5 text-left">
                <span className="text-[11.5px] font-semibold text-[var(--muted)] uppercase">{names[index]}</span>
                <span className={cn('grid h-7 min-w-7 place-items-center rounded-full px-1 text-[15px] font-bold tabular-nums', day === today ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)]')}>{date.getDate()}</span>
              </button>
              <div className="mt-1 space-y-0.5">
                {allDay.map((event) => (
                  <button key={event.id} type="button" onClick={() => onOpenEvent(event)} className="block w-full truncate rounded-[6px] px-1.5 py-0.5 text-left text-[11px] font-semibold text-white" style={{ background: event.color }} data-i18n-skip="true">
                    {event.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hour grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div key={gridKey} className={cn('relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]', slide === 'left' ? 'cal-slide-left' : slide === 'right' ? 'cal-slide-right' : '')} style={{ height: hours.length * HOUR }}>
          <div className="relative">
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] text-[var(--muted)] tabular-nums" style={{ top: index * HOUR }}>
                {index === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {days.map((date) => {
            const day = toDayString(date)
            const placed = place((byDay.get(day) ?? []).filter((event) => !event.allDay))
            return (
              <div
                key={day}
                className={cn('relative border-l border-[var(--border-subtle)]', day === selectedDay && 'bg-[var(--blue-dim)]/25')}
                onDoubleClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const minutes = START * 60 + Math.round((((event.clientY - rect.top) / HOUR) * 60) / 30) * 30
                  onCreateAt(day, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
                }}
                onClick={() => onSelectDay(day)}
              >
                {hours.map((hour, index) => <span key={hour} className="pointer-events-none absolute inset-x-0 border-t border-[var(--border-subtle)]" style={{ top: index * HOUR }} />)}
                {placed.map(({ event, top, height, column, columns }) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpenEvent(event) }}
                    className={cn('cal-chip absolute overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-4 transition-[box-shadow] hover:shadow-[0_6px_16px_-10px_rgba(14,21,37,0.5)]', event.id === selectedEventId && 'ring-2 ring-[var(--primary)]')}
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(column / columns) * 100}% + 2px)`,
                      width: `calc(${100 / columns}% - 4px)`,
                      borderLeftColor: event.color,
                      background: `color-mix(in srgb, ${event.color} 13%, var(--surface))`,
                    }}
                    title={`${timeOf(event.start)} · ${event.title}`}
                  >
                    <span className="block truncate font-semibold text-[var(--foreground)]" data-i18n-skip="true">{event.title}</span>
                    {height > 34 ? <span className="block truncate text-[var(--muted)] tabular-nums">{timeOf(event.start)}{event.end && event.kind === 'manual' ? `–${timeOf(event.end)}` : ''}</span> : null}
                  </button>
                ))}
                {day === today && nowTop >= 0 && nowTop <= hours.length * HOUR ? (
                  <span className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-label={t('calendar.now', 'Now')}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-[var(--danger)]" />
                    <span className="h-[2px] flex-1 bg-[var(--danger)]" />
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
