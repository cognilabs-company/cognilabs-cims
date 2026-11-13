import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowClockwiseIcon, ArrowSquareOutIcon, BellRingingIcon, CaretLeftIcon, CaretRightIcon, CheckCircleIcon, ClockCountdownIcon,
  DeviceMobileIcon, ListChecksIcon, MinusCircleIcon, PencilSimpleLineIcon, ScanSmileyIcon, SignInIcon, SignOutIcon, WarningCircleIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../app/hooks/useLocale'
import {
  attendanceNotificationsService as api,
  type AttendanceNotificationSettings,
  type AttendanceNotificationSettingsPatch,
  type NotificationLog,
  type NotificationLogsPage,
} from '../../shared/api/services/attendanceNotifications.service'
import type { BotRecipient } from '../../shared/api/services/botRecipients'
import { cn } from '../../shared/lib/cn'
import { formatShortMonthDayTime } from '../../shared/lib/format'
import { useToast } from '../../shared/toast/useToast'
import { Button } from '../../shared/ui/button'
import { Switch } from '../../shared/ui/switch'
import { BotRecipientsCard } from '../botRecipients/BotRecipientsCard'
import { apiDetailText, apiStatusOf, settingsCard as card } from '../botRecipients/lib'

/** The CIMS bot (the same one that opens the Mini App). */
const DEFAULT_BOT = 'cognilabs_cims_bot'
const PAGE_SIZE = 25
type Toggle = keyof AttendanceNotificationSettingsPatch

/**
 * Attendance notifications (CEO): the CIMS bot tells chosen people when employees check in or out.
 * Events come from the Mini App, manual check-out and FaceID on their own — nothing here sends them.
 */
export function AttendanceNotificationsSettings() {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<AttendanceNotificationSettings | null>(null)
  const [loadError, setLoadError] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState<Toggle | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [logsKey, setLogsKey] = useState(0)

  const forbidden = t('attnotify.forbidden', 'Only the CEO can manage attendance notifications')
  const botName = settings?.bot_username || DEFAULT_BOT
  const botLink = `https://t.me/${botName}`

  useEffect(() => {
    let alive = true
    api.settings()
      .then((loaded) => { if (alive) { setSettings(loaded); setLoadError(null) } })
      .catch((error: unknown) => { if (alive) setLoadError(apiStatusOf(error) || 500) })
    return () => { alive = false }
  }, [reloadKey])

  // A test message or a recipient change shows up in the log — reload it after every change but the first report.
  const recipientsSeen = useRef(false)
  const onRecipients = useCallback((list: BotRecipient[]) => {
    setActiveCount(list.filter((item) => item.isActive).length)
    if (recipientsSeen.current) setLogsKey((key) => key + 1)
    recipientsSeen.current = true
  }, [])

  async function toggle(field: Toggle, value: boolean) {
    if (!settings) return
    setPending(field)
    setSettings({ ...settings, [field]: value })
    try {
      const saved = await api.updateSettings({ [field]: value })
      setSettings(saved)
      if (field === 'enabled') showToast({ title: value ? t('attnotify.enabled_on', 'Attendance notifications are on') : t('attnotify.enabled_off', 'Attendance notifications are off'), tone: 'success' })
    } catch (error) {
      setSettings(settings)
      showToast({ title: apiStatusOf(error) === 403 ? forbidden : t('attnotify.save_failed', 'Could not save the settings'), description: apiDetailText(error) || undefined, tone: 'error' })
    } finally {
      setPending(null)
    }
  }

  if (loadError) {
    return (
      <div className={cn(card, 'grid place-items-center py-14 text-center')}>
        <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={28} weight="duotone" /></span>
        <p className="mt-4 text-[16px] font-bold text-[var(--foreground)]">{loadError === 403 ? forbidden : t('attnotify.load_failed', 'Could not load attendance notifications')}</p>
        {loadError !== 403 ? <Button className="mt-4" variant="secondary" leftIcon={<ArrowClockwiseIcon size={15} />} onClick={() => { setLoadError(null); setReloadKey((key) => key + 1) }}>{t('attnotify.retry', 'Try again')}</Button> : null}
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <span className="skeleton block h-[96px] rounded-[20px]" />
        <span className="skeleton block h-[260px] rounded-[20px]" />
        <span className="skeleton block h-[240px] rounded-[20px]" />
      </div>
    )
  }

  const sources: Array<[ReactNode, string]> = [
    [<DeviceMobileIcon key="m" size={15} />, t('attnotify.source.miniapp', 'Telegram Mini App')],
    [<PencilSimpleLineIcon key="p" size={15} />, t('attnotify.source.manual', 'Manual check-out')],
    [<ScanSmileyIcon key="f" size={15} />, t('attnotify.source.faceid', 'FaceID')],
  ]

  const eventRow = (field: 'check_in_enabled' | 'check_out_enabled', icon: ReactNode, title: string, hint: string) => (
    <label className={cn('flex cursor-pointer items-center gap-3 rounded-[14px] border border-[var(--border)] p-3 transition-opacity', !settings.enabled && 'opacity-60')}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--muted-surface)] text-[var(--muted-strong)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block text-[12px] text-[var(--muted)]">{hint}</span>
      </span>
      <Switch checked={settings[field]} disabled={pending !== null} onChange={(value) => void toggle(field, value)} label={title} />
    </label>
  )

  return (
    <section className="space-y-4">
      {/* Bot + master switch */}
      <div className={cn(card, 'flex flex-wrap items-center gap-x-5 gap-y-3')}>
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-[14px]', settings.enabled ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]')}>
          <BellRingingIcon size={26} weight="duotone" />
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-[15.5px] font-bold text-[var(--foreground)]">{t('attnotify.title', 'Attendance notifications')}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--muted)]">
            <a href={botLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline">@{botName} <ArrowSquareOutIcon size={12} /></a>
            <span>{t('attnotify.subtitle', 'tells the chosen people when employees check in or out')}</span>
          </p>
        </div>
        {activeCount !== null ? (
          <span className="rounded-[12px] bg-[var(--muted-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--muted-strong)]">
            {t('attnotify.active_count', '{{count}} active recipients', { count: activeCount })}
          </span>
        ) : null}
        <label className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--foreground)]">
          {settings.enabled ? t('attnotify.on', 'On') : t('attnotify.off', 'Off')}
          <Switch checked={settings.enabled} disabled={pending !== null} onChange={(value) => void toggle('enabled', value)} label={t('attnotify.enabled', 'Attendance notifications')} />
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* What to send */}
        <div className={cn(card, 'space-y-3 self-start')}>
          <p className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--foreground)]"><ListChecksIcon size={18} weight="duotone" className="text-[var(--primary)]" /> {t('attnotify.events', 'What to send')}</p>
          {!settings.enabled ? (
            <p className="rounded-[12px] bg-[var(--warning-dim)] px-3 py-2 text-[12px] text-[var(--warning-text)]">{t('attnotify.master_off', 'Notifications are off — nothing is sent until you turn them on above.')}</p>
          ) : null}
          {eventRow('check_in_enabled', <SignInIcon size={18} />, t('attnotify.check_in', 'Check-in'), t('attnotify.check_in_hint', 'When an employee arrives'))}
          {eventRow('check_out_enabled', <SignOutIcon size={18} />, t('attnotify.check_out', 'Check-out'), t('attnotify.check_out_hint', 'When an employee leaves'))}
          <div className="rounded-[14px] bg-[var(--muted-surface)] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted-strong)]">{t('attnotify.sources', 'Sent automatically for')}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {sources.map(([icon, label]) => (
                <li key={label} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--card)] px-2.5 text-[12px] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">{icon} {label}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">{t('attnotify.sources_hint', 'Employees do nothing extra — their usual check-in and check-out is enough.')}</p>
          </div>
        </div>

        <BotRecipientsCard
          api={api}
          botName={botName}
          title={t('attnotify.recipients', 'Who gets the notifications')}
          copy={{
            added: (name) => t('attnotify.added', '{{name}} will get attendance notifications', { name }),
            removeText: t('attnotify.remove_text', 'They stop getting attendance notifications. You can add them again later.'),
            empty: t('attnotify.no_recipients', 'Nobody gets attendance notifications yet — add employees above.'),
            forbidden,
          }}
          onChange={onRecipients}
        />
      </div>

      <DeliveryLogs reloadKey={logsKey} />
    </section>
  )
}

/** Paginated history of what the bot sent (or failed to send) and to whom. */
function DeliveryLogs({ reloadKey }: { reloadKey: number }) {
  const { t, locale } = useLocale()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<NotificationLogsPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [manualKey, setManualKey] = useState(0)

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      if (!alive) return
      setLoading(true)
      api.deliveryLogs(page, PAGE_SIZE)
        .then((next) => { if (alive) { setData(next); setFailed(false) } })
        .catch(() => { if (alive) setFailed(true) })
        .finally(() => { if (alive) setLoading(false) })
    }, 0)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [page, reloadKey, manualKey])

  const statusMeta = (log: NotificationLog) => {
    switch (log.status) {
      case 'sent': return { label: t('attnotify.log.sent', 'Sent'), className: 'bg-[var(--success-dim)] text-[var(--success-text)]', Icon: CheckCircleIcon }
      case 'failed': return { label: t('attnotify.log.failed', 'Failed'), className: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', Icon: XCircleIcon }
      case 'pending': return { label: t('attnotify.log.pending', 'Pending'), className: 'bg-[var(--warning-dim)] text-[var(--warning-text)]', Icon: ClockCountdownIcon }
      case 'skipped': return { label: t('attnotify.log.skipped', 'Skipped'), className: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]', Icon: MinusCircleIcon }
      default: return { label: log.statusLabel ?? '—', className: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]', Icon: MinusCircleIcon }
    }
  }

  const eventBadge = (log: NotificationLog) => {
    if (log.eventType === 'other') return <span className="text-[12.5px] text-[var(--muted-strong)]">{log.eventLabel ?? '—'}</span>
    const isIn = log.eventType === 'check_in'
    return (
      <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold', isIn ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}>
        {isIn ? <SignInIcon size={12} weight="bold" /> : <SignOutIcon size={12} weight="bold" />}
        {isIn ? t('attnotify.check_in', 'Check-in') : t('attnotify.check_out', 'Check-out')}
      </span>
    )
  }

  const when = (log: NotificationLog) => formatShortMonthDayTime(log.sentAt ?? log.createdAt, locale)
  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const from = items.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const to = (page - 1) * PAGE_SIZE + items.length
  const th = 'px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase'

  return (
    <div className={cn(card, 'p-0')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
        <p className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--foreground)]"><ClockCountdownIcon size={18} weight="duotone" className="text-[var(--primary)]" /> {t('attnotify.logs', 'Delivery history')}</p>
        <button type="button" onClick={() => setManualKey((key) => key + 1)} aria-label={t('attnotify.refresh', 'Refresh')} title={t('attnotify.refresh', 'Refresh')} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">
          <ArrowClockwiseIcon size={15} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {failed && !data ? (
        <div className="px-5 pb-6 text-center">
          <p className="text-[13px] text-[var(--danger-text)]">{t('attnotify.logs_failed', 'Could not load the delivery history')}</p>
          <Button className="mt-3" size="sm" variant="secondary" leftIcon={<ArrowClockwiseIcon size={13} />} onClick={() => setManualKey((key) => key + 1)}>{t('attnotify.retry', 'Try again')}</Button>
        </div>
      ) : !data ? (
        <div className="space-y-2 px-5 pb-5">{[0, 1, 2, 3].map((index) => <span key={index} className="skeleton block h-11 rounded-[12px]" />)}</div>
      ) : items.length === 0 ? (
        <p className="px-5 pb-8 pt-3 text-center text-[13px] text-[var(--muted)]">{t('attnotify.logs_empty', 'Nothing has been sent yet.')}</p>
      ) : (
        <>
          {/* Desktop: a table */}
          <div className={cn('hidden overflow-x-auto md:block', loading && 'opacity-60')}>
            <table className="w-full min-w-[760px] border-t border-[var(--border-subtle)]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className={cn(th, 'pl-5')}>{t('attnotify.log.time', 'Time')}</th>
                  <th className={th}>{t('attnotify.log.employee', 'Employee')}</th>
                  <th className={th}>{t('attnotify.log.event', 'Event')}</th>
                  <th className={th}>{t('attnotify.log.recipient', 'Sent to')}</th>
                  <th className={th}>{t('attnotify.log.status', 'Status')}</th>
                  <th className={cn(th, 'pr-5')}>{t('attnotify.log.error', 'Error')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => {
                  const meta = statusMeta(log)
                  return (
                    <tr key={log.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--input-surface)]">
                      <td className="py-2.5 pr-3 pl-5 text-[12.5px] whitespace-nowrap text-[var(--muted-strong)] tabular-nums" title={log.sentAt ? undefined : t('attnotify.log.created', 'Created')}>{when(log)}</td>
                      <td className="px-3 py-2.5">
                        <span className="block max-w-[200px] truncate text-[13px] font-semibold text-[var(--foreground)]">{log.employee ?? '—'}</span>
                        {log.source ? <span className="block text-[11px] text-[var(--muted)]">{sourceLabel(log.source, t)}</span> : null}
                      </td>
                      <td className="px-3 py-2.5">{eventBadge(log)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-[13px] text-[var(--foreground)]">{log.recipient ?? '—'}</td>
                      <td className="px-3 py-2.5"><span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap', meta.className)}><meta.Icon size={12} weight="bold" /> {meta.label}</span></td>
                      <td className="max-w-[260px] py-2.5 pr-5 pl-3 text-[12px] break-words text-[var(--danger-text)]">{log.error ?? <span className="text-[var(--muted)]">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phone: stacked rows */}
          <ul className={cn('divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] md:hidden', loading && 'opacity-60')}>
            {items.map((log) => {
              const meta = statusMeta(log)
              return (
                <li key={log.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--foreground)]">{log.employee ?? '—'}</span>
                    {eventBadge(log)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
                    <span className="tabular-nums">{when(log)}</span>
                    <span>→ {log.recipient ?? '—'}</span>
                    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold', meta.className)}><meta.Icon size={11} weight="bold" /> {meta.label}</span>
                  </div>
                  {log.error ? <p className="rounded-[8px] bg-[var(--danger-dim)] px-2 py-1 text-[11.5px] break-words text-[var(--danger-text)]">{log.error}</p> : null}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {data && (items.length > 0 || page > 1) ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-3">
          <span className="text-[12px] text-[var(--muted)] tabular-nums">
            {data.total !== null
              ? t('attnotify.range_total', '{{from}}–{{to}} of {{total}}', { from, to, total: data.total })
              : t('attnotify.range', '{{from}}–{{to}}', { from, to })}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label={t('attnotify.prev', 'Previous page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-40"><CaretLeftIcon size={14} /></button>
            <span className="min-w-[56px] text-center text-[12.5px] font-semibold text-[var(--foreground)] tabular-nums">{page} / {Math.max(totalPages, page)}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label={t('attnotify.next', 'Next page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-40"><CaretRightIcon size={14} /></button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Translate = ReturnType<typeof useLocale>['t']

function sourceLabel(source: string, t: Translate) {
  const key = source.toLowerCase()
  if (key.includes('mini') || key.includes('telegram')) return t('attnotify.source.miniapp', 'Telegram Mini App')
  if (key.includes('manual')) return t('attnotify.source.manual', 'Manual check-out')
  if (key.includes('face') || key.includes('raw') || key.includes('hikvision')) return t('attnotify.source.faceid', 'FaceID')
  return source
}
