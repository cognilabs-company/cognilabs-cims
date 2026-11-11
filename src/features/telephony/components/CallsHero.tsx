import { useRef, useState } from 'react'
import { CalendarDays, Grip, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Server, X, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { useDismiss } from './useDismiss'
import { connectionLabel, rangeLabel, todayLong, type CallPeriod } from './telephonyFormat'

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

const tiles: Array<{ view: CallsView; icon: LucideIcon; label: [string, string]; accent: string; soft: string }> = [
  { view: 'all', icon: PhoneCall, label: ['telephony.kpi.all', 'All calls'], accent: '#b8f15a', soft: 'rgba(184, 241, 90, 0.16)' },
  { view: 'incoming', icon: PhoneIncoming, label: ['telephony.kpi.incoming', 'Incoming'], accent: '#86a2ff', soft: 'rgba(134, 162, 255, 0.18)' },
  { view: 'outgoing', icon: PhoneOutgoing, label: ['telephony.kpi.outgoing', 'Outgoing'], accent: '#bba3ff', soft: 'rgba(187, 163, 255, 0.18)' },
  { view: 'missed', icon: PhoneMissed, label: ['telephony.kpi.missed', 'Missed'], accent: '#ff8a8a', soft: 'rgba(255, 138, 138, 0.18)' },
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
}

/** Navy header of the Calls page: line state, dial button, period presets and per-type counters. */
export function CallsHero(props: CallsHeroProps) {
  const { t } = useLocale()
  const { connection, counts } = props
  const ready = connection === 'Ready'
  const tone = ready ? 'calls-live-dot bg-[#b8f15a]' : /connect/i.test(connection) ? 'bg-[#ffb35c]' : 'bg-[#ff7a7a]'
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
    <section className="calls-hero @container relative z-20 rounded-[26px] px-5 py-5 sm:px-6">
      {/* Row 1 — title, line state, actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white/[0.08] text-[#b8f15a] ring-1 ring-white/10">
            <PhoneCall size={22} strokeWidth={2.2} />
            <span className={cn('absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px] border-[var(--calls-hero-bg)]', tone)} />
          </span>
          <div className="min-w-0">
            <p className="text-[19px] leading-6 font-bold tracking-[-0.02em]" title={t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })}>
              {t('telephony.line_state', 'Line: {{state}}', { state: connectionLabel(connection) })}
            </p>
            <p className="truncate text-[13px] text-white/60">
              {props.extension ? t('telephony.extension_line', 'Extension {{ext}}', { ext: props.extension }) : t('telephony.no_extension', 'No extension yet')}
              <span className="hidden sm:inline"> · {todayLong()}</span>
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {props.isCeo ? (
            <div role="tablist" aria-label={t('telephony.title', 'Calls')} className="inline-flex h-10 rounded-[13px] bg-white/[0.07] p-1 ring-1 ring-white/10">
              {([
                ['calls', t('telephony.tab.calls', 'Calls'), PhoneCall],
                ['system', t('telephony.tab.system', 'Phone system'), Server],
              ] as Array<[CallsTab, string, LucideIcon]>).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={props.tab === value}
                  onClick={() => props.onTabChange(value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors',
                    props.tab === value ? 'bg-white text-[var(--calls-hero-ink)]' : 'text-white/70 hover:text-white',
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          ) : null}

        </div>
      </div>

      {props.tab === 'calls' ? (
        <>
          {/* Row 2 — period */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={t('telephony.period.label', 'Period')} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[14px] bg-white/[0.07] p-1 ring-1 ring-white/10">
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
                      'h-8 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
                      active ? 'bg-[#b8f15a] text-[var(--calls-hero-ink)] shadow-[0_4px_14px_-6px_rgba(184,241,90,0.9)]' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
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
                  props.period === 'custom' ? 'bg-[#b8f15a] text-[var(--calls-hero-ink)] ring-[#b8f15a]' : 'bg-white/[0.07] text-white/80 ring-white/10 hover:text-white',
                )}
              >
                <CalendarDays size={15} />
                {customText || t('telephony.period.custom', 'Pick dates')}
              </button>
              {props.period === 'custom' ? (
                <button
                  type="button"
                  onClick={() => props.onPeriodChange('all')}
                  aria-label={t('telephony.period.clear', 'Clear dates')}
                  className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[var(--calls-hero-ink)] shadow"
                >
                  <X size={12} strokeWidth={3} />
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

            <button
              type="button"
              onClick={props.onShowDialer}
              aria-pressed={props.dialerActive}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#b8f15a] px-4 text-[13.5px] font-semibold text-[var(--calls-hero-ink)] shadow-[0_8px_22px_-10px_rgba(184,241,90,0.8)] transition hover:brightness-105 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              <Grip size={16} strokeWidth={2.4} /> {t('telephony.dial', 'Dial a number')}
            </button>
          </div>

          {/* Row 3 — counters, which double as the type filter */}
          <div className="mt-3 grid grid-cols-2 gap-2.5 @min-[560px]:grid-cols-4">
            {tiles.map(({ view, icon: Icon, label, accent, soft }) => {
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
                    'flex min-w-0 items-center gap-2.5 rounded-[18px] p-3 text-left ring-1 transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
                    active ? 'bg-white text-[var(--calls-hero-ink)] ring-white' : 'bg-white/[0.06] text-white ring-white/10 hover:bg-white/[0.1]',
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={active ? { background: view === 'all' ? '#0e1525' : accent, color: view === 'all' ? '#b8f15a' : '#0e1525' } : { background: soft, color: accent }}>
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[12.5px] font-medium', active ? 'text-[#4a5165]' : 'text-white/65')}>{t(label[0], label[1])}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[21px] leading-7 font-bold tracking-[-0.02em] tabular-nums" data-i18n-skip="true">
                        {value === undefined ? '—' : value.toLocaleString('ru-RU')}
                      </span>
                      {share !== null ? <span className={cn('text-[12px] font-semibold tabular-nums', active ? 'text-[#8a90a2]' : 'text-white/45')} data-i18n-skip="true">{share}%</span> : null}
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
