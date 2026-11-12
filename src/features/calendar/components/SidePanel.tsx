import { ArrowSquareOutIcon, PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { dayParts, timeOf } from '../lib/dates'
import { kindLabel, recurrenceLabel } from '../lib/kindLabel'
import type { CalEvent } from '../lib/types'
import { KindIcon } from './kinds'

type Props = {
  day: string
  events: CalEvent[]
  selected: CalEvent | null
  onOpenEvent: (event: CalEvent) => void
  onCloseEvent: () => void
  onCreate: (day: string) => void
  onEdit: (event: CalEvent) => void
  onDelete: (event: CalEvent) => void
  onGo: (event: CalEvent) => void
  /** Manual events: may the user change / delete them (calendar:edit / calendar:delete). */
  canEdit: boolean
  canDelete: boolean
  canCreate: boolean
}

/** Right panel: the selected event, or the selected day's agenda. */
export function SidePanel({ day, events, selected, onOpenEvent, onCloseEvent, onCreate, onEdit, onDelete, onGo, canEdit, canDelete, canCreate }: Props) {
  const { t } = useLocale()
  const parts = dayParts(day)

  if (selected) {
    const rows: Array<[string, string | null | undefined]> = [
      [t('calendar.field.when', 'When'), selected.allDay ? t('calendar.all_day', 'All day') : `${timeOf(selected.start)}${selected.end && timeOf(selected.end) !== timeOf(selected.start) ? ` – ${timeOf(selected.end)}` : ''}`],
      [t('calendar.field.repeat', 'Repeats'), selected.recurrence && selected.recurrence !== 'none'
        ? `${recurrenceLabel(selected.recurrence, t)}${selected.recurrenceUntil ? ` · ${t('calendar.field.until', 'until {{date}}', { date: dayParts(selected.recurrenceUntil.slice(0, 10)).date })}` : ''}`
        : null],
      [t('calendar.field.reminder', 'Reminder'), selected.kind === 'manual' ? (selected.reminder ? t('calendar.field.reminder_on', 'Telegram, before it starts') : t('calendar.field.reminder_off', 'Off')) : null],
      [t('calendar.field.direction', 'Direction'), selected.kind === 'call' && selected.direction ? (selected.direction === 'incoming' ? t('calendar.call.incoming', 'Incoming') : t('calendar.call.outgoing', 'Outgoing')) : null],
      [t('calendar.field.duration', 'Talk time'), selected.kind === 'call' ? `${Math.floor((selected.talkSeconds ?? 0) / 60)}:${String((selected.talkSeconds ?? 0) % 60).padStart(2, '0')}` : null],
      [t('calendar.field.status', 'Status'), selected.status],
      [t('calendar.field.phone', 'Phone'), selected.phone ? formatPhone(selected.phone) : null],
      [t('calendar.field.assigned', 'Responsible'), selected.assignedName],
      [t('calendar.field.participants', 'Participants'), selected.participantNames?.length ? selected.participantNames.join(', ') : null],
      [t('calendar.field.created_by', 'Created by'), selected.createdByName],
      [t('calendar.field.project', 'Project'), [selected.projectName, selected.boardName].filter(Boolean).join(' · ') || null],
      [t('calendar.field.column', 'Column'), selected.columnName],
      [t('calendar.field.hours', 'Working hours'), selected.hours],
      [t('calendar.field.member', 'For'), selected.member],
    ]
    return (
      <div key={selected.id} className="cal-panel-in flex h-full flex-col">
        <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: `color-mix(in srgb, ${selected.color} 15%, transparent)`, color: selected.color }}>
            <KindIcon kind={selected.kind} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-[var(--muted)]">{kindLabel(selected.kind, t)}</p>
            <p className="text-[16px] leading-snug font-bold break-words text-[var(--foreground)]" data-i18n-skip="true">{selected.title}</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted-strong)]">{parts.weekday}, {parts.date}</p>
          </div>
          <button type="button" onClick={onCloseEvent} aria-label={t('common.close', 'Close')} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--input-surface)]">
            <XIcon size={16} />
          </button>
        </div>
        <dl className="space-y-2.5 p-4">
          {rows.filter(([, value]) => value).map(([label, value]) => (
            <div key={label} className="flex gap-3 text-[13px]">
              <dt className="w-[96px] shrink-0 text-[var(--muted)]">{label}</dt>
              <dd className="min-w-0 font-medium break-words text-[var(--foreground)]">{value}</dd>
            </div>
          ))}
          {selected.note ? <p className="rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5 text-[13px] whitespace-pre-wrap text-[var(--foreground)]">{selected.note}</p> : null}
        </dl>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border-subtle)] p-4">
          {(selected.kind === 'recall' || selected.kind === 'meeting' || selected.kind === 'call') && selected.customerId ? (
            <button type="button" onClick={() => onGo(selected)} className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)]">
              <ArrowSquareOutIcon size={16} /> {t('calendar.open_customer', 'Open customer')}
            </button>
          ) : null}
          {selected.kind === 'task' ? (
            <button type="button" onClick={() => onGo(selected)} className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)]">
              <ArrowSquareOutIcon size={16} /> {t('calendar.open_board', 'Open board')}
            </button>
          ) : null}
          {selected.kind === 'manual' ? (
            <>
              {canEdit ? <button type="button" onClick={() => onEdit(selected)} className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]">
                <PencilSimpleIcon size={16} /> {t('common.edit', 'Edit')}
              </button> : null}
              {canDelete ? <button type="button" onClick={() => onDelete(selected)} className="inline-flex h-10 items-center gap-2 rounded-[11px] px-3 text-[13px] font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-dim)]">
                <TrashIcon size={16} /> {t('common.delete', 'Delete')}
              </button> : null}
            </>
          ) : null}
        </div>
      </div>
    )
  }

  const dayType = events.find((event) => event.kind === 'holiday' || event.kind === 'short_day')
  const list = events.filter((event) => event !== dayType)
  return (
    <div key={day} className="cal-panel-in flex h-full flex-col">
      <div className="border-b border-[var(--border-subtle)] p-4">
        <p className="text-[12.5px] font-semibold text-[var(--muted)]">{parts.weekday}</p>
        <p className="text-[20px] font-bold text-[var(--foreground)]">{parts.date}</p>
        {dayType ? (
          <button type="button" onClick={() => onOpenEvent(dayType)} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: dayType.color }}>
            <KindIcon kind={dayType.kind} size={13} /> {dayType.title}
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? (
          <p className="px-1 py-8 text-center text-[13px] text-[var(--muted)]">{t('calendar.day_empty', 'Nothing planned for this day')}</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((event, index) => (
              <li key={event.id} className="cal-list-in" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                <button type="button" onClick={() => onOpenEvent(event)} className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--input-surface)]">
                  <span className="w-11 shrink-0 text-[12.5px] font-semibold text-[var(--muted-strong)] tabular-nums">{event.allDay ? '—' : timeOf(event.start)}</span>
                  <span className={cn('h-8 w-1 shrink-0 rounded-full')} style={{ background: event.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{event.title}</span>
                    <span className="block truncate text-[11.5px] text-[var(--muted)]">{[kindLabel(event.kind, t), event.status ?? event.projectName].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {canCreate ? <div className="border-t border-[var(--border-subtle)] p-3">
        <button type="button" onClick={() => onCreate(day)} className="flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-dashed border-[var(--border-hover)] text-[13px] font-semibold text-[var(--muted-strong)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">
          <PlusIcon size={15} weight="bold" /> {t('calendar.add_event', 'Add event')}
        </button>
      </div> : null}
    </div>
  )
}
