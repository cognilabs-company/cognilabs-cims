import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwiseIcon, ArrowSquareOutIcon, BellRingingIcon, CheckCircleIcon, ClockCountdownIcon, MagnifyingGlassIcon, PaperPlaneTiltIcon,
  PlusIcon, RobotIcon, TrashIcon, UsersThreeIcon, WarningCircleIcon, XCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../app/hooks/useLocale'
import {
  recallBotService,
  type DeliveryStatus,
  type RecallBotSettings,
  type RecallBotSettingsPatch,
  type RecallBotStatus,
  type RecallCandidate,
  type RecallRecipient,
} from '../../shared/api/services/recallBot.service'
import { useConfirm } from '../../shared/confirm/useConfirm'
import { cn } from '../../shared/lib/cn'
import { useToast } from '../../shared/toast/useToast'
import { Button } from '../../shared/ui/button'
import { Switch } from '../../shared/ui/switch'

const DEFAULT_BOT = 'cognilabsrecallbot'
const LIMITS = {
  reminder_minutes: [1, 1440],
  max_retry_attempts: [1, 10],
  retry_interval_minutes: [1, 60],
} as const
type NumberField = keyof typeof LIMITS

type ApiError = { status?: number; details?: { detail?: unknown } | null }
const statusOf = (error: unknown) => (error as ApiError | null)?.status ?? 0

function detailText(error: unknown) {
  const detail = (error as ApiError | null)?.details?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const data = detail as { message?: unknown; detail?: unknown }
    return typeof data.message === 'string' ? data.message : typeof data.detail === 'string' ? data.detail : ''
  }
  if (Array.isArray(detail)) return (detail as Array<{ msg?: string }>).map((item) => item.msg).filter(Boolean).join(' · ')
  return ''
}

function notStarted(error: unknown) {
  const detail = (error as ApiError | null)?.details?.detail
  return statusOf(error) === 422 && Boolean(detail && typeof detail === 'object' && (detail as { status?: unknown }).status === 'not_started')
}

const card = 'rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-5'
const fieldBox = 'h-10 w-24 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-right text-[14px] text-[var(--foreground)] tabular-nums focus:border-[var(--primary)] focus:outline-none disabled:opacity-50'

/** CRM settings → recall bot (CEO): who gets Telegram reminders about CRM callbacks, when, and how retries work. */
export function RecallBotSettingsPage() {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [settings, setSettings] = useState<RecallBotSettings | null>(null)
  const [draft, setDraft] = useState<Record<NumberField, string> & { retry_enabled: boolean } | null>(null)
  const [status, setStatus] = useState<RecallBotStatus | null>(null)
  const [recipients, setRecipients] = useState<RecallRecipient[] | null>(null)
  const [loadError, setLoadError] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<RecallCandidate[] | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const [needsStart, setNeedsStart] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const botName = settings?.bot_username || status?.botUsername || DEFAULT_BOT
  const botLink = `https://t.me/${botName}`

  const refreshLists = useCallback(async () => {
    const [nextRecipients, nextStatus] = await Promise.allSettled([recallBotService.recipients(), recallBotService.status()])
    if (nextRecipients.status === 'fulfilled') setRecipients(nextRecipients.value)
    if (nextStatus.status === 'fulfilled') setStatus(nextStatus.value)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const loaded = await recallBotService.settings()
        if (!alive) return
        setSettings(loaded)
        setDraft({ reminder_minutes: String(loaded.reminder_minutes), max_retry_attempts: String(loaded.max_retry_attempts), retry_interval_minutes: String(loaded.retry_interval_minutes), retry_enabled: loaded.retry_enabled })
        setLoadError(null)
        await refreshLists()
      } catch (error) {
        if (alive) setLoadError(statusOf(error) || 500)
      }
    })()
    return () => { alive = false }
  }, [refreshLists, reloadKey])

  // Candidates follow the search box a moment after typing stops.
  useEffect(() => {
    if (!settings) return
    let alive = true
    const timer = window.setTimeout(() => {
      recallBotService.candidates(search)
        .then((items) => { if (alive) setCandidates(items) })
        .catch(() => { if (alive) setCandidates([]) })
    }, 300)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [search, settings, reloadKey])

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
    const code = statusOf(error)
    showToast({
      title: code === 403 ? t('recallbot.forbidden', 'Only the CEO can manage the recall bot') : fallback,
      description: detailText(error) || undefined,
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
      void refreshLists()
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
      void refreshLists()
    } catch (error) {
      failToast(error, t('recallbot.save_failed', 'Could not save the settings'))
    } finally {
      setToggling(false)
    }
  }

  async function add(candidate: RecallCandidate) {
    setAdding(candidate.userId)
    setNeedsStart(null)
    try {
      await recallBotService.addRecipient(candidate.userId)
      showToast({ title: t('recallbot.added', '{{name}} will get recall reminders', { name: candidate.name }), tone: 'success' })
      await refreshLists()
      setCandidates((list) => (list ?? []).map((item) => (item.userId === candidate.userId ? { ...item, isRecipient: true } : item)))
    } catch (error) {
      if (statusOf(error) === 422) setNeedsStart(candidate.name)
      else failToast(error, t('recallbot.add_failed', 'Could not add the user'))
    } finally {
      setAdding(null)
    }
  }

  async function setActive(recipient: RecallRecipient, isActive: boolean) {
    setBusyId(recipient.id)
    try {
      await recallBotService.setActive(recipient.id, isActive)
      await refreshLists()
    } catch (error) {
      failToast(error, t('recallbot.update_failed', 'Could not update the recipient'))
    } finally {
      setBusyId(null)
    }
  }

  async function test(recipient: RecallRecipient) {
    setBusyId(recipient.id)
    setNeedsStart(null)
    try {
      await recallBotService.test(recipient.id)
      showToast({ title: t('recallbot.test_sent', 'Test message sent to {{name}}', { name: recipient.name }), tone: 'success' })
    } catch (error) {
      if (notStarted(error)) setNeedsStart(recipient.name)
      else failToast(error, t('recallbot.test_failed', 'The test message was not delivered'))
    } finally {
      setBusyId(null)
      void refreshLists()
    }
  }

  async function remove(recipient: RecallRecipient) {
    const ok = await confirm({
      title: t('recallbot.remove_title', 'Remove {{name}}?', { name: recipient.name }),
      description: t('recallbot.remove_text', 'They stop getting recall reminders. You can add them again later.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(recipient.id)
    try {
      await recallBotService.remove(recipient.id)
      await refreshLists()
    } catch (error) {
      failToast(error, t('recallbot.remove_failed', 'Could not remove the recipient'))
    } finally {
      setBusyId(null)
    }
  }

  const deliveryMeta = (value: DeliveryStatus) => {
    switch (value) {
      case 'ready': return { label: t('recallbot.delivery.ready', 'Ready'), className: 'bg-[var(--success-dim)] text-[var(--success-text)]', Icon: CheckCircleIcon }
      case 'not_started': return { label: t('recallbot.delivery.not_started', 'Bot not started'), className: 'bg-[var(--warning-dim)] text-[var(--warning-text)]', Icon: ClockCountdownIcon }
      case 'blocked': return { label: t('recallbot.delivery.blocked', 'Bot blocked'), className: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', Icon: XCircleIcon }
      case 'error': return { label: t('recallbot.delivery.error', 'Error'), className: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', Icon: WarningCircleIcon }
      default: return { label: t('recallbot.delivery.unknown', 'Not checked yet'), className: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]', Icon: ClockCountdownIcon }
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
    [t('recallbot.metric.recipients', 'Active recipients'), status?.activeRecipients ?? (recipients ? recipients.filter((item) => item.isActive).length : null), 'text-[var(--foreground)]'],
    [t('recallbot.metric.sent', 'Sent in 24 h'), status?.sent24h ?? null, 'text-[var(--success-text)]'],
    [t('recallbot.metric.failed', 'Failed in 24 h'), status?.failed24h ?? null, 'text-[var(--danger-text)]'],
    [t('recallbot.metric.retries', 'Pending retries'), status?.pendingRetries ?? null, 'text-[var(--warning-text)]'],
  ]
  const recipientIds = new Set((recipients ?? []).filter((item) => item.isActive).map((item) => item.userId))

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
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

        {/* Recipients */}
        <div className={cn(card, 'space-y-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--foreground)]"><UsersThreeIcon size={18} weight="duotone" className="text-[var(--primary)]" /> {t('recallbot.recipients', 'Who gets the reminders')}</p>
            <button type="button" onClick={() => void refreshLists()} aria-label={t('recallbot.refresh', 'Refresh')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ArrowClockwiseIcon size={15} /></button>
          </div>

          {needsStart ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[var(--warning-border)] bg-[var(--warning-dim)] px-3.5 py-3">
              <WarningCircleIcon size={20} className="shrink-0 text-[var(--warning-text)]" />
              <p className="min-w-0 flex-1 text-[13px] text-[var(--foreground)]">{t('recallbot.not_started_text', '{{name}} has not started the bot yet. Ask them to open it and press Start, then try again.', { name: needsStart })}</p>
              <a href={botLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
                <PaperPlaneTiltIcon size={14} /> {t('recallbot.open_bot', 'Open @{{bot}}', { bot: botName })}
              </a>
              <button type="button" onClick={() => setNeedsStart(null)} aria-label={t('common.close', 'Close')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--surface)]"><XCircleIcon size={16} /></button>
            </div>
          ) : null}

          {/* Add: searchable user selector */}
          <div>
            <label className="relative flex h-10 items-center">
              <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('recallbot.search', 'Find an employee by name or email…')}
                className="h-10 w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
            <ul className="mt-2 max-h-[220px] space-y-1 overflow-y-auto">
              {candidates === null ? (
                <li className="skeleton h-12 rounded-[12px]" />
              ) : candidates.filter((item) => !recipientIds.has(item.userId)).length === 0 ? (
                <li className="px-1 py-3 text-[12.5px] text-[var(--muted)]">{t('recallbot.no_candidates', 'Nobody else to add')}</li>
              ) : candidates.filter((item) => !recipientIds.has(item.userId)).slice(0, 30).map((candidate) => (
                <li key={candidate.userId} className="flex items-center gap-3 rounded-[12px] px-2.5 py-2 hover:bg-[var(--input-surface)]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[11.5px] font-bold text-[var(--muted-strong)]">{candidate.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{candidate.name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--muted)]">
                      {[candidate.email, candidate.telegramReady ? t('recallbot.telegram_ready', 'Telegram linked') : t('recallbot.telegram_missing', 'No Telegram yet')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Button size="sm" variant={candidate.telegramReady ? 'primary' : 'secondary'} leftIcon={<PlusIcon size={13} weight="bold" />} loading={adding === candidate.userId} onClick={() => void add(candidate)}>
                    {candidate.isRecipient ? t('recallbot.reactivate', 'Turn back on') : t('recallbot.add', 'Add')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* Current recipients */}
          <div className="border-t border-[var(--border-subtle)] pt-3">
            {recipients === null ? (
              <span className="skeleton block h-24 rounded-[14px]" />
            ) : recipients.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--muted)]">{t('recallbot.no_recipients', 'Nobody gets the reminders yet — add employees above.')}</p>
            ) : (
              <ul className="space-y-2">
                {recipients.map((recipient) => {
                  const meta = deliveryMeta(recipient.deliveryStatus)
                  const busy = busyId === recipient.id
                  return (
                    <li key={recipient.id} className={cn('rounded-[14px] border border-[var(--border)] p-3 transition-opacity', !recipient.isActive && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{recipient.name}</span>
                          <span className="block truncate text-[11.5px] text-[var(--muted)]">{recipient.email ?? ''}</span>
                        </span>
                        <span className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold', meta.className)}><meta.Icon size={13} weight="bold" /> {meta.label}</span>
                        <Button size="sm" variant="secondary" leftIcon={<PaperPlaneTiltIcon size={13} />} disabled={busy || !recipient.isActive} onClick={() => void test(recipient)}>
                          {t('recallbot.test', 'Test')}
                        </Button>
                        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)]">
                          <Switch size="sm" checked={recipient.isActive} disabled={busy} onChange={(value) => void setActive(recipient, value)} label={t('recallbot.active', 'Active')} />
                          {recipient.isActive ? t('recallbot.active', 'Active') : t('recallbot.inactive', 'Paused')}
                        </label>
                        <button type="button" disabled={busy} onClick={() => void remove(recipient)} aria-label={t('common.delete', 'Delete')} title={t('common.delete', 'Delete')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] disabled:opacity-40">
                          <TrashIcon size={15} />
                        </button>
                      </div>
                      {recipient.lastError ? (
                        <p className="mt-2 rounded-[10px] bg-[var(--danger-dim)] px-2.5 py-1.5 text-[11.5px] text-[var(--danger-text)]">{t('recallbot.last_error', 'Last error')}: {recipient.lastError}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
