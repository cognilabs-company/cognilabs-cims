import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { dayParts, timeOf } from '../lib/dates'
import type { CalEvent } from '../lib/types'
import { kindLabel } from '../lib/kindLabel'
import { KindIcon } from './kinds'

type Props = {
  groups: Array<{ day: string; events: CalEvent[] }>
  today: string
  selectedEventId: string | null
  onOpenEvent: (event: CalEvent) => void
}

/** The visible month as a list, day by day. */
export function AgendaView({ groups, today, selectedEventId, onOpenEvent }: Props) {
  const { t } = useLocale()
  if (!groups.length) {
    return <p className="py-20 text-center text-[14px] text-[var(--muted)]">{t('calendar.list_empty', 'Nothing in this period')}</p>
  }
  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      {groups.map(({ day, events }, index) => {
        const parts = dayParts(day)
        return (
          <section key={day} className="cal-list-in mb-3" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
            <p className="sticky top-0 z-10 flex items-baseline gap-2 bg-[var(--card)] px-1 py-1.5">
              <span className={cn('text-[14px] font-bold', day === today ? 'text-[var(--primary)]' : 'text-[var(--foreground)]')}>{parts.date}</span>
              <span className="text-[12px] text-[var(--muted)]">{parts.weekday}</span>
            </p>
            <ul className="overflow-hidden rounded-[14px] ring-1 ring-[var(--border)]">
              {events.map((event) => (
                <li key={event.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <button type="button" onClick={() => onOpenEvent(event)} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--input-surface)]', event.id === selectedEventId && 'bg-[var(--blue-dim)]/60')}>
                    <span className="w-12 shrink-0 text-[12.5px] font-semibold text-[var(--muted-strong)] tabular-nums">{event.allDay ? t('calendar.all_day', 'All day') : timeOf(event.start)}</span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${event.color} 14%, transparent)`, color: event.color }}>
                      <KindIcon kind={event.kind} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{event.title}</span>
                      <span className="block truncate text-[12px] text-[var(--muted)]">{[kindLabel(event.kind, t), event.status, event.projectName].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
