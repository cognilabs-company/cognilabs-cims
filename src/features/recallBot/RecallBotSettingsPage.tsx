import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowSquareOutIcon, BellRingingIcon, RobotIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../app/hooks/useLocale'
import type { BotRecipient } from '../../shared/api/services/botRecipients'
import {
  recallBotService,
  type RecallBotSettings,
  type RecallBotSettingsPatch,
  type RecallBotStatus,
} from '../../shared/api/services/recallBot.service'
import { cn } from '../../shared/lib/cn'
import { useToast } from '../../shared/toast/useToast'
import { Button } from '../../shared/ui/button'
import { Switch } from '../../shared/ui/switch'
import { BotRecipientsCard } from '../botRecipients/BotRecipientsCard'
import { apiDetailText, apiStatusOf, settingsCard as card } from '../botRecipients/lib'

const DEFAULT_BOT = 'cognilabsrecallbot'
const LIMITS = {
  reminder_minutes: [1, 1440],
  max_retry_attempts: [1, 10],
  retry_interval_minutes: [1, 60],
} as const
type NumberField = keyof typeof LIMITS

const fieldBox = 'h-10 w-24 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-right text-[14px] text-[var(--foreground)] tabular-nums focus:border-[var(--primary)] focus:outline-none disabled:opacity-50'

/** CRM settings → recall bot (CEO): who gets Telegram reminders about CRM callbacks, when, and how retries work. */
export function RecallBotSettingsPage() {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<RecallBotSettings | null>(null)
  const [draft, setDraft] = useState<Record<NumberField, string> & { retry_enabled: boolean } | null>(null)
  const [status, setStatus] = useState<RecallBotStatus | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const botName = settings?.bot_username || status?.botUsername || DEFAULT_BOT
  const botLink = `https://t.me/${botName}`

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await recallBotService.status())
    } catch {
      // Health is optional; the page works without it.
    }
  }, [])

  // The recipients card reports its list on load and after every change; later reports refresh the bot health.
  const recipientsSeen = useRef(false)
  const onRecipients = useCallback((list: BotRecipient[]) => {
    setActiveCount(list.filter((item) => item.isActive).length)
    if (recipientsSeen.current) void refreshStatus()
    recipientsSeen.current = true
  }, [refreshStatus])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const loaded = await recallBotService.settings()
        if (!alive) return
        setSettings(loaded)
        setDraft({ reminder_minutes: String(loaded.reminder_minutes), max_retry_attempts: String(loaded.max_retry_attempts), retry_interval_minutes: String(loaded.retry_interval_minutes), retry_enabled: loaded.retry_enabled })
        setLoadError(null)
        await refreshStatus()
      } catch (error) {
        if (alive) setLoadError(apiStatusOf(error) || 500)
      }
    })()
    return () => { alive = false }
  }, [refreshStatus, reloadKey])

  const invalid = useMemo(() => {
    if (!draft) return {} as Partial<Record<NumberField, boolean>>
    const out: Partial<Record<NumberField, boolean>> = {}
    for (const key of Object.keys(LIMITS) as NumberField[]) {
      const value = Number(draft[key])
      const [min, max] = LIMITS[key]
      out[key] = !Number.isInteger(value) || value < min || value > max
    }
    return out
  }, [draft])

  const patch = useMemo<RecallBotSettingsPatch>(() => {
    if (!settings || !draft) return {}
    const next: RecallBotSettingsPatch = {}
    for (const key of Object.keys(LIMITS) as NumberField[]) if (Number(draft[key]) !== settings[key]) next[key] = Number(draft[key])
    if (draft.retry_enabled !== settings.retry_enabled) next.retry_enabled = draft.retry_enabled
    return next
  }, [draft, settings])
  const dirty = Object.keys(patch).length > 0
  const hasInvalid = Object.values(invalid).some(Boolean)

  function failToast(error: unknown, fallback: string) {
    showToast({
      title: apiStatusOf(error) === 403 ? t('recallbot.forbidden', 'Only the CEO can manage the recall bot') : fallback,
      description: apiDetailText(error) || undefined,
      tone: 'error',
    })
  }

  async function saveSettings() {
    if (!dirty || hasInvalid) return
    setSaving(true)
    try {
      const saved = await recallBotService.updateSettings(patch)
      setSettings(saved)
      setDraft({ reminder_minutes: String(saved.reminder_minutes), max_retry_attempts: String(saved.max_retry_attempts), retry_interval_minutes: String(saved.retry_interval_minutes), retry_enabled: saved.retry_enabled })
      showToast({ title: t('recallbot.saved', 'Recall bot settings saved'), tone: 'success' })
      void refreshStatus()
    } catch (error) {
      failToast(error, t('recallbot.save_failed', 'Could not save the settings'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(enabled: boolean) {
    if (!settings) return
    setToggling(true)
    try {
      const saved = await recallBotService.updateSettings({ enabled })
      setSettings(saved)
      showToast({ title: enabled ? t('recallbot.enabled_on', 'Recall reminders are on') : t('recallbot.enabled_off', 'Recall reminders are off'), tone: 'success' })
      void refreshStatus()
    } catch (error) {
      failToast(error, t('recallbot.save_failed', 'Could not save the settings'))
    } finally {
      setToggling(false)
    }
  }

  if (loadError) {
    return (
      <div className={cn(card, 'grid place-items-center py-14 text-center')}>
        <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={28} weight="duotone" /></span>
        <p className="mt-4 text-[16px] font-bold text-[var(--foreground)]">
          {loadError === 403 ? t('recallbot.forbidden', 'Only the CEO can manage the recall bot') : t('recallbot.load_failed', 'Could not load the recall bot')}
        </p>
        {loadError !== 403 ? <Button className="mt-4" variant="secondary" leftIcon={<ArrowClockwiseIcon size={15} />} onClick={() => { setLoadError(null); setReloadKey((key) => key + 1) }}>{t('recallbot.retry', 'Try again')}</Button> : null}
      </div>
    )
  }

  if (!settings || !draft) {
    return (
      <div className="space-y-4">
        <span className="skeleton block h-[120px] rounded-[20px]" />
        <span className="skeleton block h-[220px] rounded-[20px]" />
        <span className="skeleton block h-[280px] rounded-[20px]" />
      </div>
    )
  }

  const metrics: Array<[string, number | null, string]> = [
    [t('recallbot.metric.recipients', 'Active recipients'), status?.activeRecipients ?? activeCount, 'text-[var(--foreground)]'],
    [t('recallbot.metric.sent', 'Sent in 24 h'), status?.sent24h ?? null, 'text-[var(--success-text)]'],
    [t('recallbot.metric.failed', 'Failed in 24 h'), status?.failed24h ?? null, 'text-[var(--danger-text)]'],
    [t('recallbot.metric.retries', 'Pending retries'), status?.pendingRetries ?? null, 'text-[var(--warning-text)]'],
  ]

  const numberRow = (key: NumberField, title: string, hint: string, disabled = false) => (
    <label className={cn('flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-3', disabled && 'opacity-60')}>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
        <span className={cn('block text-[12px]', invalid[key] ? 'text-[var(--danger-text)]' : 'text-[var(--muted)]')}>
          {invalid[key] ? t('recallbot.range', 'From {{min}} to {{max}}', { min: LIMITS[key][0], max: LIMITS[key][1] }) : hint}
        </span>
      </span>
      <input
        type="number"
        min={LIMITS[key][0]}
        max={LIMITS[key][1]}
        value={draft[key]}
        disabled={disabled}
        onChange={(event) => setDraft((current) => (current ? { ...current, [key]: event.target.value } : current))}
        className={cn(fieldBox, invalid[key] && 'border-[var(--danger)]')}
      />
    </label>
  )

  return (
    <section className="space-y-4">
      {/* Bot + health */}
      <div className={cn(card, 'flex flex-wrap items-center gap-5')}>
        <div className="flex min-w-[260px] flex-1 items-center gap-3.5">
          <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-[14px]', settings.enabled ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]')}>
            <RobotIcon size={26} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-bold text-[var(--foreground)]">{t('recallbot.title', 'CRM recall bot')}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--muted)]">
              <a href={botLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline">@{botName} <ArrowSquareOutIcon size={12} /></a>
              {status?.schedulerRunning != null ? (
                <span className="inline-flex items-center gap-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full', status.schedulerRunning ? 'bg-[var(--success-text)]' : 'bg-[var(--warning-text)]')} />
                  {status.schedulerRunning ? t('recallbot.scheduler_on', 'Scheduler running') : t('recallbot.scheduler_off', 'Scheduler stopped')}
                </span>
              ) : null}
              {status?.botConfigured === false ? <span className="font-semibold text-[var(--danger-text)]">{t('recallbot.not_configured', 'Bot token is not configured')}</span> : null}
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--foreground)]">
            {settings.enabled ? t('recallbot.on', 'On') : t('recallbot.off', 'Off')}
            <Switch checked={settings.enabled} disabled={toggling} onChange={(value) => void toggleEnabled(value)} label={t('recallbot.enabled', 'Recall reminders')} />
          </label>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-auto">
          {metrics.map(([label, value, tone]) => (
            <div key={label} className="min-w-[120px] rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-2.5">
              <p className="text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
              <p className={cn('text-[20px] font-bold tabular-nums', value === null ? 'text-[var(--muted)]' : tone)}>{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Timing + retries */}
        <div className={cn(card, 'space-y-3 self-start')}>
          <p className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--foreground)]"><BellRingingIcon size={18} weight="duotone" className="text-[var(--primary)]" /> {t('recallbot.timing', 'Timing and retries')}</p>
          {numberRow('reminder_minutes', t('recallbot.reminder_minutes', 'Remind before the callback'), t('recallbot.reminder_minutes_hint', 'Minutes before the customer’s callback time'))}
          <label className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{t('recallbot.retry_enabled', 'Retry when delivery fails')}</span>
              <span className="block text-[12px] text-[var(--muted)]">{t('recallbot.retry_enabled_hint', 'Send again if Telegram did not accept the message')}</span>
            </span>
            <Switch checked={draft.retry_enabled} onChange={(value) => setDraft((current) => (current ? { ...current, retry_enabled: value } : current))} label={t('recallbot.retry_enabled', 'Retry when delivery fails')} />
          </label>
          {numberRow('max_retry_attempts', t('recallbot.max_retry_attempts', 'Attempts'), t('recallbot.max_retry_attempts_hint', 'How many times to try again'), !draft.retry_enabled)}
          {numberRow('retry_interval_minutes', t('recallbot.retry_interval_minutes', 'Pause between attempts'), t('recallbot.retry_interval_minutes_hint', 'Minutes'), !draft.retry_enabled)}
          <div className="flex justify-end gap-2 pt-1">
            {dirty ? (
              <Button variant="secondary" onClick={() => setDraft({ reminder_minutes: String(settings.reminder_minutes), max_retry_attempts: String(settings.max_retry_attempts), retry_interval_minutes: String(settings.retry_interval_minutes), retry_enabled: settings.retry_enabled })}>
                {t('common.cancel', 'Cancel')}
              </Button>
            ) : null}
            <Button onClick={() => void saveSettings()} disabled={!dirty || hasInvalid} loading={saving}>{t('common.save', 'Save')}</Button>
          </div>
        </div>

        <BotRecipientsCard
          api={recallBotService}
          botName={botName}
          title={t('recallbot.recipients', 'Who gets the reminders')}
          copy={{
            added: (name) => t('recallbot.added', '{{name}} will get recall reminders', { name }),
            removeText: t('recallbot.remove_text', 'They stop getting recall reminders. You can add them again later.'),
            empty: t('recallbot.no_recipients', 'Nobody gets the reminders yet — add employees above.'),
            forbidden: t('recallbot.forbidden', 'Only the CEO can manage the recall bot'),
          }}
          onChange={onRecipients}
        />
      </div>
    </section>
  )
}
