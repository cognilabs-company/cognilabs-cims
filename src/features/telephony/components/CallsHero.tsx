import { useRef, useState } from 'react'
import {
  CalendarDotsIcon,
  DotsNineIcon,
  HardDrivesIcon,
  PhoneCallIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  PhoneTransferIcon,
  PhoneXIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { CountUp } from '../../../shared/ui/count-up'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { useDismiss } from './useDismiss'
import { connectionLabel, formatPhone, rangeLabel, todayLong, type CallPeriod } from './telephonyFormat'
import { normalizePhone, type OutboundMode } from '../../../shared/api/services/telephony.service'
import { translateCurrent as tr } from '../../../shared/i18n/translations'

function forwardingModeLabel(mode: string | null) {
  switch (mode) {
    case 'busy': return tr('telephony.forwarding.busy', 'Forward when busy')
    case 'no_answer': return tr('telephony.forwarding.no_answer', 'Forward if no answer')
    case 'offline': return tr('telephony.forwarding.offline', 'Forward when offline')
    default: return tr('telephony.forwarding.always', 'Always forwarded')
  }
}

export type CallsView = 'all' | 'incoming' | 'outgoing' | 'missed'
export type CallsCounts = Record<CallsView, number>
export type CallsTab = 'calls' | 'system'

const presets: Array<[Exclude<CallPeriod, 'custom'>, string, string]> = [
  ['today', 'telephony.period.today', 'Today'],
  ['yesterday', 'telephony.period.yesterday', 'Yesterday'],
  ['week', 'telephony.period.week', '7 days'],
  ['month', 'telephony.period.month', '30 days'],
  ['all', 'telephony.period.all', 'All time'],
]

/** Counters: plain tiles, the type shown only by the icon colour (same colours as the call list). */
const tiles: Array<{ view: CallsView; icon: PhosphorIcon; label: [string, string]; tone: string }> = [
  { view: 'all', icon: PhoneCallIcon, label: ['telephony.kpi.all', 'All calls'], tone: 'bg-[var(--muted-surface)] text-[var(--foreground)]' },
  { view: 'incoming', icon: PhoneIncomingIcon, label: ['telephony.kpi.incoming', 'Incoming'], tone: 'bg-[var(--calls-in-dim)] text-[var(--calls-in)]' },
  { view: 'outgoing', icon: PhoneOutgoingIcon, label: ['telephony.kpi.outgoing', 'Outgoing'], tone: 'bg-[var(--calls-out-dim)] text-[var(--calls-out)]' },
  { view: 'missed', icon: PhoneXIcon, label: ['telephony.kpi.missed', 'Missed'], tone: 'bg-[var(--calls-miss-dim)] text-[var(--calls-miss)]' },
]

type CallsHeroProps = {
  isCeo: boolean
  tab: CallsTab
  onTabChange: (tab: CallsTab) => void
  connection: string
  extension?: string | null
  dialerActive: boolean
  onShowDialer: () => void
  period: CallPeriod
  onPeriodChange: (period: CallPeriod) => void
  customFrom: string
  customTo: string
  onCustomRange: (from: string, to: string) => void
  counts: CallsCounts | null
  view: CallsView
  onViewChange: (view: CallsView) => void
  /** RBAC calls:create — hides the dial button for view-only users. */
  canDialOut?: boolean
  outboundMode?: OutboundMode
  mobileNumber?: string | null
  /** Call forwarding of the user's extension, when it is on. */
  forwarding?: { mode: string | null; target: string | null; count: number } | null
}

/** Header card of the Calls page: line state, dial button, period presets and per-type counters. */
export function CallsHero(props: CallsHeroProps) {
  const { t } = useLocale()
  const { connection, counts } = props
  const mobile = props.outboundMode === 'mobile'
  const ready = mobile || connection === 'Ready'
  const tone = ready ? 'calls-live-dot bg-[var(--success)]' : /connect/i.test(connection) ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]'
  const [rangeOpen, setRangeOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(props.customFrom)
  const [draftTo, setDraftTo] = useState(props.customTo)
  const rangeRef = useRef<HTMLDivElement>(null)
  useDismiss(rangeRef, rangeOpen, () => setRangeOpen(false))

  const customText = props.period === 'custom' ? rangeLabel(props.customFrom, props.customTo) : ''

  function openRange() {
    setDraftFrom(props.customFrom)
    setDraftTo(props.customTo)
    setRangeOpen((open) => !open)
  }

  function applyRange() {
    if (!draftFrom && !draftTo) return
    props.onCustomRange(draftFrom, draftTo)
    setRangeOpen(false)
  }

  return (
    <section className="@container relative z-20 rounded-[22px] bg-[var(--surface)] px-5 py-5 ring-1 ring-[var(--border)] sm:px-6">
      {/* Row 1 — line state on the left (with forwarding under it), view switch on the right; one line from sm up */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 @min-[660px]:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[15px] bg-[var(--blue-dim)] text-[var(--primary)]">
            <PhoneCallIcon size={23} weight="duotone" />
            <span className={cn('absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[var(--surface)]', tone)} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[18px] leading-6 font-bold tracking-[-0.02em] text-[var(--foreground)]" title={t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })}>
              {mobile ? t('telephony.line_mobile', 'Line: mobile phone') : t('telephony.line_state', 'Line: {{state}}', { state: connectionLabel(connection) })}
            </p>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--muted)]">
              <span className="truncate">
                {mobile && props.mobileNumber
                  ? t('telephony.mobile.via', 'Calls go through {{phone}}', { phone: formatPhone(props.mobileNumber) })
                  : props.extension ? t('telephony.extension_line', 'Extension {{ext}}', { ext: props.extension }) : t('telephony.no_extension', 'No extension yet')}
                <span className="hidden @min-[780px]:inline"> · {todayLong()}</span>
              </span>
              {props.forwarding ? (
                <span
                  className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[var(--muted-surface)] px-2.5 text-[12px] font-medium text-[var(--muted-strong)]"
                  title={t('telephony.forwarding.title', 'Call forwarding is on')}
                >
                  <PhoneTransferIcon size={13} weight="duotone" className="text-[var(--success-text)]" />
                  {props.forwarding.count > 1 ? (
                    t('telephony.targets.count', 'Forwarded to {{count}} numbers', { count: props.forwarding.count })
                  ) : (
                    <>
                      {forwardingModeLabel(props.forwarding.mode)}
                      {/* the number only when it differs from the line's own mobile */}
                      {props.forwarding.target && normalizePhone(props.forwarding.target) !== normalizePhone(props.mobileNumber) ? (
                        <span className="text-[var(--muted)] tabular-nums">→ {formatPhone(props.forwarding.target)}</span>
                      ) : null}
                    </>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {props.isCeo ? (
          <div role="tablist" aria-label={t('telephony.title', 'Calls')} className="inline-flex h-10 shrink-0 rounded-[13px] @max-[659px]:w-full @max-[659px]:[&>button]:flex-1 @max-[659px]:[&>button]:justify-center bg-[var(--muted-surface)] p-1">
            {([
              ['calls', t('telephony.tab.calls', 'Calls'), PhoneCallIcon],
              ['system', t('telephony.tab.system', 'Phone system'), HardDrivesIcon],
            ] as Array<[CallsTab, string, PhosphorIcon]>).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={props.tab === value}
                onClick={() => props.onTabChange(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                  props.tab === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]',
                )}
              >
                <Icon size={15} weight={props.tab === value ? 'duotone' : 'regular'} /> {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {props.tab === 'calls' ? (
        <>
          {/* Row 2 — period */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={t('telephony.period.label', 'Period')} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[13px] bg-[var(--muted-surface)] p-1">
              {presets.map(([value, key, fallback]) => {
                const active = props.period === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => props.onPeriodChange(value)}
                    className={cn(
                      'h-8 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200',
                      active ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {t(key, fallback)}
                  </button>
                )
              })}
            </div>

            <div ref={rangeRef} className="relative">
              <button
                type="button"
                onClick={openRange}
                aria-expanded={rangeOpen}
                aria-haspopup="dialog"
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-[13px] px-3.5 text-[13px] font-semibold ring-1 transition-colors',
                  props.period === 'custom' ? 'bg-[var(--blue-dim)] text-[var(--primary)] ring-[var(--blue-border)]' : 'bg-[var(--surface)] text-[var(--foreground)] ring-[var(--border)] hover:bg-[var(--input-surface)]',
                )}
              >
                <CalendarDotsIcon size={16} weight="duotone" className={props.period === 'custom' ? '' : 'text-[var(--muted-strong)]'} />
                {customText || t('telephony.period.custom', 'Pick dates')}
              </button>
              {props.period === 'custom' ? (
                <button
                  type="button"
                  onClick={() => props.onPeriodChange('all')}
                  aria-label={t('telephony.period.clear', 'Clear dates')}
                  className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--muted-strong)] text-[var(--surface)] shadow"
                >
                  <XIcon size={11} weight="bold" />
                </button>
              ) : null}

              {rangeOpen ? (
                <div role="dialog" aria-label={t('telephony.period.custom', 'Pick dates')} className="mac-pop absolute top-[calc(100%+8px)] left-0 z-40 w-[280px] rounded-[16px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-[var(--foreground)] shadow-[var(--elev-xl)]">
                  <p className="px-1 pb-2 text-[12.5px] font-semibold text-[var(--muted)]">{t('telephony.filter.date_range', 'Date range')}</p>
                  <div className="grid grid-cols-[48px_1fr] items-center gap-x-2 gap-y-2">
                    <label htmlFor="calls-from" className="px-1 text-[13px] text-[var(--muted)]">{t('telephony.filter.from', 'From')}</label>
                    <CalendarField id="calls-from" value={draftFrom} max={draftTo || undefined} onValueChange={setDraftFrom} placeholder="—" />
                    <label htmlFor="calls-to" className="px-1 text-[13px] text-[var(--muted)]">{t('telephony.filter.to', 'To')}</label>
                    <CalendarField id="calls-to" value={draftTo} min={draftFrom || undefined} onValueChange={setDraftTo} placeholder="—" />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setRangeOpen(false)} className="h-9 rounded-[11px] px-3.5 text-[13px] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">{t('telephony.cancel', 'Cancel')}</button>
                    <button type="button" onClick={applyRange} disabled={!draftFrom && !draftTo} className="h-9 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-40">{t('telephony.period.apply', 'Show')}</button>
                  </div>
                </div>
              ) : null}
            </div>

            {props.canDialOut !== false ? (
              <button
                type="button"
                onClick={props.onShowDialer}
                aria-pressed={props.dialerActive}
                className="ml-auto inline-flex h-10 items-center gap-2 rounded-[13px] bg-[var(--primary)] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:outline-none"
              >
                <DotsNineIcon size={17} weight="bold" /> {t('telephony.dial', 'Dial a number')}
              </button>
            ) : null}
          </div>

          {/* Row 3 — counters, which double as the type filter */}
          <div className="mt-3 grid grid-cols-2 gap-2.5 @min-[560px]:grid-cols-4">
            {tiles.map(({ view, icon: Icon, label, tone: iconTone }) => {
              const active = props.view === view
              const value = counts?.[view]
              const share = counts && view !== 'all' && counts.all > 0 ? Math.round(((counts[view] ?? 0) / counts.all) * 100) : null
              return (
                <button
                  key={view}
                  type="button"
                  aria-pressed={active}
                  onClick={() => props.onViewChange(view)}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-[16px] p-3 text-left transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:outline-none',
                    active ? 'bg-[var(--surface)] shadow-[0_0_0_2px_var(--primary)]' : 'bg-[var(--surface)] ring-1 ring-[var(--border)] hover:bg-[var(--input-surface)]',
                  )}
                >
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[12px]', iconTone)}>
                    <Icon size={20} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--muted-strong)]">{t(label[0], label[1])}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[21px] leading-7 font-bold tracking-[-0.02em] text-[var(--foreground)] tabular-nums" data-i18n-skip="true">
                        {value === undefined ? '—' : <CountUp value={value} format={(number) => Math.round(number).toLocaleString('ru-RU')} />}
                      </span>
                      {share !== null ? <span className="text-[12px] font-semibold text-[var(--muted)] tabular-nums" data-i18n-skip="true">{share}%</span> : null}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}
