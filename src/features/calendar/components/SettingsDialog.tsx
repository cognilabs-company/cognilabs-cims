import { useEffect, useState } from 'react'
import { BellSimpleRingingIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { calendarService, type CalendarSettings } from '../../../shared/api/services/calendar.service'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Switch } from '../../../shared/ui/switch'

type Props = { onClose: () => void }

/** CEO: global Telegram reminders for CRM callbacks and meetings (manual events have their own switch). */
export function SettingsDialog({ onClose }: Props) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<CalendarSettings | null>(null)
  const [minutes, setMinutes] = useState('')
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    calendarService.settings()
      .then((data) => { if (alive) { setSettings(data); setMinutes(String(data.reminder_minutes)) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const minutesValue = Number(minutes)
  const minutesValid = Number.isInteger(minutesValue) && minutesValue >= 1 && minutesValue <= 1440

  async function save() {
    if (!settings || !minutesValid) return
    setSaving(true)
    try {
      await calendarService.updateSettings({ ...settings, reminder_minutes: minutesValue })
      showToast({ title: t('calendar.settings.saved', 'Reminder settings saved'), tone: 'success' })
      onClose()
    } catch (error) {
      const status = (error as { status?: number } | null)?.status
      showToast({
        title: status === 403 ? t('calendar.settings.forbidden', 'Only the CEO can change these settings') : t('calendar.settings.failed', 'Could not save the settings'),
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const row = (key: 'crm_recall_reminders_enabled' | 'crm_meeting_reminders_enabled', title: string, hint: string) => (
    <label className="flex items-start gap-3 rounded-[14px] border border-[var(--border)] p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block text-[12px] text-[var(--muted)]">{hint}</span>
      </span>
      <Switch checked={Boolean(settings?.[key])} onChange={(value) => setSettings((current) => (current ? { ...current, [key]: value } : current))} disabled={!settings} label={title} />
    </label>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('calendar.settings.title', 'CRM reminders')}
      description={t('calendar.settings.description_short', 'Telegram reminders for CRM callbacks and meetings, for everyone.')}
      headerIcon={<BellSimpleRingingIcon size={18} weight="duotone" />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} disabled={!settings || !minutesValid} loading={saving}>{t('common.save', 'Save')}</Button>
        </>
      )}
    >
      {failed ? (
        <p className="text-[13px] text-[var(--danger-text)]">{t('calendar.settings.load_failed', 'Could not load the settings.')}</p>
      ) : (
        <div className="space-y-2.5">
          {row('crm_recall_reminders_enabled', t('calendar.settings.recall', 'Callback reminders'), t('calendar.settings.recall_hint', 'Before a customer’s callback time.'))}
          {row('crm_meeting_reminders_enabled', t('calendar.settings.meeting', 'Meeting reminders'), t('calendar.settings.meeting_hint', 'Before a meeting with a customer.'))}
          <label className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-3">
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-[var(--foreground)]">{t('calendar.settings.minutes', 'How many minutes before')}</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              disabled={!settings}
              onChange={(event) => setMinutes(event.target.value)}
              className="h-9 w-24 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-right text-[14px] text-[var(--foreground)] tabular-nums focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          {!minutesValid && settings ? <p className="text-[12px] text-[var(--danger-text)]">{t('calendar.settings.minutes_error', 'From 1 to 1440 minutes.')}</p> : null}
          <p className="text-[12px] text-[var(--muted)]">{t('calendar.settings.manual_note', 'Ordinary events are not affected — each has its own reminder switch.')}</p>
        </div>
      )}
    </Dialog>
  )
}
