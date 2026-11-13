import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowClockwiseIcon, MagnifyingGlassIcon, PaperPlaneTiltIcon, PlusIcon, TrashIcon, UsersThreeIcon, WarningCircleIcon, XCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../app/hooks/useLocale'
import type { BotCandidate, BotRecipient, BotRecipientsApi } from '../../shared/api/services/botRecipients'
import { useConfirm } from '../../shared/confirm/useConfirm'
import { cn } from '../../shared/lib/cn'
import { formatShortMonthDayTime } from '../../shared/lib/format'
import { useToast } from '../../shared/toast/useToast'
import { Button } from '../../shared/ui/button'
import { Switch } from '../../shared/ui/switch'
import { apiDetailText, apiStatusOf, settingsCard, telegramStatusOf, useDeliveryMeta } from './lib'

type Props = {
  api: BotRecipientsApi
  /** Bot username without "@" — the CTA for people who have not pressed Start. */
  botName: string
  title: string
  copy: {
    /** Toast after adding; gets {{name}} already filled in. */
    added: (name: string) => string
    removeText: string
    empty: string
    forbidden: string
  }
  /** Called with the fresh list after every load or change (metrics, status refresh). */
  onChange?: (recipients: BotRecipient[]) => void
  /** Optional extra row under the title (e.g. a hint). */
  hint?: ReactNode
}

/**
 * Who a Telegram bot writes to: a searchable employee picker, then the active list with delivery state,
 * a test message, pause / resume and remove. Shared by the recall bot and attendance notifications.
 */
export function BotRecipientsCard({ api, botName, title, copy, onChange, hint }: Props) {
  const { t, locale } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const deliveryMeta = useDeliveryMeta()
  const [recipients, setRecipients] = useState<BotRecipient[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<BotCandidate[] | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const [needsStart, setNeedsStart] = useState<string | null>(null)
  const [candidatesKey, setCandidatesKey] = useState(0)
  const botLink = `https://t.me/${botName}`
  // The parent's callback may change every render; read it through a ref so loads do not repeat.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const refresh = useCallback(async () => {
    try {
      const next = await api.recipients()
      setRecipients(next)
      onChangeRef.current?.(next)
    } catch {
      setRecipients((current) => current ?? [])
    }
  }, [api])

  useEffect(() => {
    let alive = true
    api.recipients()
      .then((next) => { if (alive) { setRecipients(next); onChangeRef.current?.(next) } })
      .catch(() => { if (alive) setRecipients([]) })
    return () => { alive = false }
  }, [api])

  // Candidates follow the search box a moment after typing stops.
  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      api.candidates(search)
        .then((items) => { if (alive) setCandidates(items) })
        .catch(() => { if (alive) setCandidates([]) })
    }, 300)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [api, search, candidatesKey])

  function failToast(error: unknown, fallback: string) {
    showToast({ title: apiStatusOf(error) === 403 ? copy.forbidden : fallback, description: apiDetailText(error) || undefined, tone: 'error' })
  }

  async function add(candidate: BotCandidate) {
    setAdding(candidate.userId)
    setNeedsStart(null)
    try {
      await api.addRecipient(candidate.userId)
      showToast({ title: copy.added(candidate.name), tone: 'success' })
      await refresh()
      setCandidatesKey((key) => key + 1)
    } catch (error) {
      if (apiStatusOf(error) === 422 && telegramStatusOf(error) !== 'blocked') setNeedsStart(candidate.name)
      else failToast(error, t('botrecipients.add_failed', 'Could not add the employee'))
    } finally {
      setAdding(null)
    }
  }

  async function setActive(recipient: BotRecipient, isActive: boolean) {
    setBusyId(recipient.id)
    try {
      await api.setActive(recipient.id, isActive)
      await refresh()
    } catch (error) {
      failToast(error, t('botrecipients.update_failed', 'Could not update the recipient'))
    } finally {
      setBusyId(null)
    }
  }

  async function test(recipient: BotRecipient) {
    setBusyId(recipient.id)
    setNeedsStart(null)
    try {
      await api.test(recipient.id)
      showToast({ title: t('botrecipients.test_sent', 'Test message sent to {{name}}', { name: recipient.name }), tone: 'success' })
    } catch (error) {
      const telegram = telegramStatusOf(error)
      if (telegram === 'not_started') setNeedsStart(recipient.name)
      else if (telegram === 'blocked') showToast({ title: t('botrecipients.blocked_text', '{{name}} has blocked the bot', { name: recipient.name }), description: t('botrecipients.blocked_hint', 'They need to unblock @{{bot}} in Telegram.', { bot: botName }), tone: 'error' })
      else failToast(error, t('botrecipients.test_failed', 'The test message was not delivered'))
    } finally {
      setBusyId(null)
      void refresh()
    }
  }

  async function remove(recipient: BotRecipient) {
    const ok = await confirm({
      title: t('botrecipients.remove_title', 'Remove {{name}}?', { name: recipient.name }),
      description: copy.removeText,
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(recipient.id)
    try {
      await api.remove(recipient.id)
      await refresh()
      setCandidatesKey((key) => key + 1)
    } catch (error) {
      failToast(error, t('botrecipients.remove_failed', 'Could not remove the recipient'))
    } finally {
      setBusyId(null)
    }
  }

  const activeIds = new Set((recipients ?? []).filter((item) => item.isActive).map((item) => item.userId))
  const pickable = (candidates ?? []).filter((item) => !activeIds.has(item.userId))

  return (
    <div className={cn(settingsCard, 'space-y-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--foreground)]"><UsersThreeIcon size={18} weight="duotone" className="text-[var(--primary)]" /> {title}</p>
        <button type="button" onClick={() => { void refresh(); setCandidatesKey((key) => key + 1) }} aria-label={t('botrecipients.refresh', 'Refresh')} title={t('botrecipients.refresh', 'Refresh')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"><ArrowClockwiseIcon size={15} /></button>
      </div>
      {hint}

      {needsStart ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[var(--warning-border)] bg-[var(--warning-dim)] px-3.5 py-3">
          <WarningCircleIcon size={20} className="shrink-0 text-[var(--warning-text)]" />
          <p className="min-w-0 flex-1 text-[13px] text-[var(--foreground)]">{t('botrecipients.not_started_text', '{{name}} has not started @{{bot}} yet. Ask them to open it and press Start, then try again.', { name: needsStart, bot: botName })}</p>
          <a href={botLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
            <PaperPlaneTiltIcon size={14} /> {t('botrecipients.open_bot', 'Open @{{bot}}', { bot: botName })}
          </a>
          <button type="button" onClick={() => setNeedsStart(null)} aria-label={t('common.close', 'Close')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--surface)]"><XCircleIcon size={16} /></button>
        </div>
      ) : null}

      {/* Add: searchable employee picker */}
      <div>
        <label className="relative flex h-10 items-center">
          <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('botrecipients.search', 'Find an employee by name or email…')}
            className="h-10 w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface)] pr-3 pl-9 text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <ul className="mt-2 max-h-[240px] space-y-1 overflow-y-auto">
          {candidates === null ? (
            <li className="skeleton h-12 rounded-[12px]" />
          ) : pickable.length === 0 ? (
            <li className="px-1 py-3 text-[12.5px] text-[var(--muted)]">{t('botrecipients.no_candidates', 'Nobody else to add')}</li>
          ) : pickable.slice(0, 30).map((candidate) => (
            <li key={candidate.userId} className="flex items-center gap-3 rounded-[12px] px-2.5 py-2 hover:bg-[var(--input-surface)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[11.5px] font-bold text-[var(--muted-strong)]">{candidate.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{candidate.name}</span>
                {candidate.telegramReady ? (
                  <span className="block truncate text-[11.5px] text-[var(--muted)]">{[candidate.email, t('botrecipients.telegram_ready', 'Telegram linked')].filter(Boolean).join(' · ')}</span>
                ) : (
                  <span className="block truncate text-[11.5px] text-[var(--warning-text)]" title={t('botrecipients.needs_start', 'Must open @{{bot}} and press Start', { bot: botName })}>
                    {t('botrecipients.needs_start', 'Must open @{{bot}} and press Start', { bot: botName })}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant={candidate.telegramReady ? 'primary' : 'secondary'}
                leftIcon={<PlusIcon size={13} weight="bold" />}
                loading={adding === candidate.userId}
                disabled={!candidate.telegramReady}
                title={candidate.telegramReady ? undefined : t('botrecipients.needs_start', 'Must open @{{bot}} and press Start', { bot: botName })}
                onClick={() => void add(candidate)}
              >
                {candidate.isRecipient ? t('botrecipients.reactivate', 'Turn back on') : t('botrecipients.add', 'Add')}
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
          <p className="py-6 text-center text-[13px] text-[var(--muted)]">{copy.empty}</p>
        ) : (
          <ul className="space-y-2">
            {recipients.map((recipient) => {
              const meta = deliveryMeta(recipient.deliveryStatus)
              const busy = busyId === recipient.id
              const sub = [recipient.email, recipient.lastCheckedAt ? t('botrecipients.checked_at', 'Checked {{time}}', { time: formatShortMonthDayTime(recipient.lastCheckedAt, locale) }) : null].filter(Boolean).join(' · ')
              return (
                <li key={recipient.id} className={cn('rounded-[14px] border border-[var(--border)] p-3 transition-opacity', !recipient.isActive && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Phones: the name gets its own line, the controls wrap under it. */}
                    <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{recipient.name}</span>
                      {sub ? <span className="block truncate text-[11.5px] text-[var(--muted)]">{sub}</span> : null}
                    </span>
                    <span className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold', meta.className)}><meta.Icon size={13} weight="bold" /> {meta.label}</span>
                    <Button size="sm" variant="secondary" leftIcon={<PaperPlaneTiltIcon size={13} />} disabled={busy || !recipient.isActive} onClick={() => void test(recipient)}>
                      {t('botrecipients.test', 'Test')}
                    </Button>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)]">
                      <Switch size="sm" checked={recipient.isActive} disabled={busy} onChange={(value) => void setActive(recipient, value)} label={t('botrecipients.active', 'Active')} />
                      {recipient.isActive ? t('botrecipients.active', 'Active') : t('botrecipients.inactive', 'Paused')}
                    </label>
                    <button type="button" disabled={busy} onClick={() => void remove(recipient)} aria-label={t('common.delete', 'Delete')} title={t('common.delete', 'Delete')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] disabled:opacity-40">
                      <TrashIcon size={15} />
                    </button>
                  </div>
                  {recipient.lastError ? (
                    <p className="mt-2 rounded-[10px] bg-[var(--danger-dim)] px-2.5 py-1.5 text-[11.5px] break-words text-[var(--danger-text)]">{t('botrecipients.last_error', 'Last error')}: {recipient.lastError}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
