import { useState } from 'react'
import { CalendarPlusIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Dialog } from '../../../shared/ui/dialog'
import { Switch } from '../../../shared/ui/switch'
import { TimeField } from '../../../shared/ui/time-field'
import { PERSONAL_COLORS, type PersonalEvent } from '../lib/types'

type Props = {
  initial: PersonalEvent
  isNew: boolean
  onClose: () => void
  onSave: (event: PersonalEvent) => void
}

/** Create / edit one of the user's own events. */
export function EventDialog({ initial, isNew, onClose, onSave }: Props) {
  const { t } = useLocale()
  const [draft, setDraft] = useState(initial)
  const set = <K extends keyof PersonalEvent>(key: K, value: PersonalEvent[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const timeError = !draft.allDay && draft.endTime && draft.startTime && draft.endTime < draft.startTime
  const valid = draft.title.trim() && draft.date && (draft.allDay || draft.startTime) && !timeError

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t('calendar.dialog.new', 'New event') : t('calendar.dialog.edit', 'Edit event')}
      headerIcon={<CalendarPlusIcon size={18} weight="duotone" />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => valid && onSave({ ...draft, title: draft.title.trim(), note: draft.note.trim() })} disabled={!valid}>{t('common.save', 'Save')}</Button>
        </>
      )}
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.title', 'Title')}</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            maxLength={200}
            placeholder={t('calendar.dialog.title_placeholder', 'Meeting, reminder, deadline…')}
            className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[14px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.date', 'Date')}</span>
            <CalendarField value={draft.date} onValueChange={(value) => set('date', value)} />
          </label>
          <label className="flex h-10 items-center gap-2.5 text-[13px] font-medium text-[var(--foreground)]">
            <Switch checked={draft.allDay} onChange={(value) => set('allDay', value)} label={t('calendar.all_day', 'All day')} />
            {t('calendar.all_day', 'All day')}
          </label>
        </div>
        {!draft.allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.start', 'Start')}</span>
              <TimeField value={draft.startTime} onValueChange={(value) => set('startTime', value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.end', 'End')}</span>
              <TimeField value={draft.endTime} onValueChange={(value) => set('endTime', value)} />
            </label>
          </div>
        ) : null}
        {timeError ? <p className="text-[12.5px] text-[var(--danger-text)]">{t('calendar.dialog.time_error', 'The end is earlier than the start.')}</p> : null}
        <div>
          <span className="mb-2 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.color', 'Colour')}</span>
          <div className="flex gap-2" role="radiogroup" aria-label={t('calendar.dialog.color', 'Colour')}>
            {PERSONAL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={draft.color === color}
                aria-label={color}
                onClick={() => set('color', color)}
                className={cn('h-7 w-7 rounded-full transition-transform hover:scale-110', draft.color === color && 'ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--card)]')}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('calendar.dialog.note', 'Note')}</span>
          <textarea
            value={draft.note}
            onChange={(event) => set('note', event.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full resize-y rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <p className="text-[11.5px] text-[var(--muted)]">{t('calendar.dialog.local', 'Your own events are saved in this browser for now.')}</p>
      </div>
    </Dialog>
  )
}
