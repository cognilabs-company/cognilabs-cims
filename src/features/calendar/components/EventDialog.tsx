import { useState } from 'react'
import { BellRingingIcon, CalendarPlusIcon, RepeatIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CalendarRecurrence, CalendarUser } from '../../../shared/api/services/calendar.service'
import { Button } from '../../../shared/ui/button'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Dialog } from '../../../shared/ui/dialog'
import { SelectField } from '../../../shared/ui/select-field'
import { Switch } from '../../../shared/ui/switch'
import { TimeField } from '../../../shared/ui/time-field'
import { recurrenceLabel } from '../lib/kindLabel'
import type { EventDraft } from '../lib/types'

type Props = {
  initial: EventDraft
  users: CalendarUser[]
  saving: boolean
  /** Field errors from the server (422), by field name. */
  errors: Record<string, string>
  onClose: () => void
  onSave: (draft: EventDraft) => void
}

const label = 'mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]'
const box = 'w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[14px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none'

/** Create / edit a calendar event (saved on the server; reminders go to Telegram). */
export function EventDialog({ initial, users, saving, errors, onClose, onSave }: Props) {
  const { t } = useLocale()
  const [draft, setDraft] = useState(initial)
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const timeError = !draft.allDay && draft.endTime && draft.startTime && draft.endTime < draft.startTime
  const untilError = draft.recurrence !== 'none' && draft.until && draft.until < draft.date
  const valid = draft.title.trim() && draft.date && (draft.allDay || draft.startTime) && !timeError && !untilError
  const isNew = draft.baseId === null
  const repeats: CalendarRecurrence[] = ['none', 'daily', 'weekly', 'monthly']

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={isNew ? t('calendar.dialog.new', 'New event') : t('calendar.dialog.edit', 'Edit event')}
      headerIcon={<CalendarPlusIcon size={18} weight="duotone" />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => valid && onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() })} disabled={!valid} loading={saving}>
            {t('common.save', 'Save')}
          </Button>
        </>
      )}
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className={label}>{t('calendar.dialog.title', 'Title')}</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            maxLength={300}
            placeholder={t('calendar.dialog.title_placeholder', 'Meeting, reminder, deadline…')}
            className={`${box} h-10`}
          />
          {errors.title ? <span className="mt-1 block text-[12px] text-[var(--danger-text)]">{errors.title}</span> : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className={label}>{t('calendar.dialog.date', 'Date')}</span>
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
              <span className={label}>{t('calendar.dialog.start', 'Start')}</span>
              <TimeField value={draft.startTime} onValueChange={(value) => set('startTime', value)} />
            </label>
            <label className="block">
              <span className={label}>{t('calendar.dialog.end', 'End')}</span>
              <TimeField value={draft.endTime} onValueChange={(value) => set('endTime', value)} />
            </label>
          </div>
        ) : null}
        {timeError ? <p className="text-[12.5px] text-[var(--danger-text)]">{t('calendar.dialog.time_error', 'The end is earlier than the start.')}</p> : null}
        {errors.start_at || errors.end_at ? <p className="text-[12.5px] text-[var(--danger-text)]">{errors.start_at ?? errors.end_at}</p> : null}

        {/* Repeat */}
        <div className="rounded-[14px] border border-[var(--border)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--muted-strong)]"><RepeatIcon size={15} /> {t('calendar.dialog.repeat', 'Repeat')}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('calendar.dialog.repeat', 'Repeat')}>
            {repeats.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.recurrence === value}
                onClick={() => set('recurrence', value)}
                className={draft.recurrence === value
                  ? 'h-8 rounded-full bg-[var(--primary)] px-3 text-[12.5px] font-semibold text-white'
                  : 'h-8 rounded-full border border-[var(--border)] px-3 text-[12.5px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]'}
              >
                {recurrenceLabel(value, t)}
              </button>
            ))}
          </div>
          {draft.recurrence !== 'none' ? (
            <label className="mt-3 block">
              <span className={label}>{t('calendar.dialog.until', 'Repeat until (optional)')}</span>
              <CalendarField value={draft.until} onValueChange={(value) => set('until', value)} />
              {untilError ? <span className="mt-1 block text-[12px] text-[var(--danger-text)]">{t('calendar.dialog.until_error', 'Must be on or after the event date.')}</span> : null}
              {errors.recurrence_until ? <span className="mt-1 block text-[12px] text-[var(--danger-text)]">{errors.recurrence_until}</span> : null}
            </label>
          ) : null}
        </div>

        {/* Reminder */}
        <label className="flex items-start gap-3 rounded-[14px] border border-[var(--border)] p-3">
          <BellRingingIcon size={18} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-[var(--foreground)]">{t('calendar.dialog.reminder', 'Remind me in Telegram')}</span>
            <span className="block text-[12px] text-[var(--muted)]">{t('calendar.dialog.reminder_hint', 'The bot writes to you shortly before the event starts.')}</span>
          </span>
          <Switch checked={draft.reminder} onChange={(value) => set('reminder', value)} label={t('calendar.dialog.reminder', 'Remind me in Telegram')} />
        </label>

        {/* Participants */}
        <div>
          <span className={`${label} flex items-center gap-1.5`}><UsersThreeIcon size={15} /> {t('calendar.dialog.participants', 'Participants')}</span>
          <SelectField
            multiple
            searchable
            value=""
            values={draft.participantIds.map(String)}
            onValuesChange={(values) => set('participantIds', values.map(Number).filter(Number.isFinite))}
            options={users.map((user) => ({ value: String(user.id), label: user.name, hint: user.detail ?? undefined }))}
            placeholder={t('calendar.dialog.participants_placeholder', 'Nobody yet')}
            searchPlaceholder={t('common.search', 'Search')}
            emptyMessage={t('calendar.no_users', 'No users')}
          />
          <span className="mt-1 block text-[11.5px] text-[var(--muted)]">{t('calendar.dialog.participants_hint', 'For information and filtering; only you get the reminder.')}</span>
        </div>

        <label className="block">
          <span className={label}>{t('calendar.dialog.note', 'Description')}</span>
          <textarea
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            rows={3}
            maxLength={10000}
            className={`${box} resize-y py-2 text-[13.5px]`}
          />
        </label>
        {!isNew && initial.recurrence !== 'none' ? (
          <p className="rounded-[12px] bg-[var(--warning-dim)] px-3 py-2 text-[12px] text-[var(--warning-text)]">{t('calendar.dialog.series_note', 'This is a repeating event — changes apply to every repeat.')}</p>
        ) : null}
      </div>
    </Dialog>
  )
}
