import { AudioLines, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import type { TelephonyCall } from '../../../shared/api/services/telephony.service'
import { getIntlLocale } from '../../../shared/i18n/translations'
import { callKindLabel, callTone, clockTime, dayLabel, formatClock, formatPhone, sourceLabel, statusLabel, type CallTone } from './telephonyFormat'

type CallLike = Pick<TelephonyCall, 'direction' | 'status' | 'talk_seconds'>

const toneSurface: Record<CallTone, string> = {
  incoming: 'bg-[var(--calls-in-dim)] text-[var(--calls-in)]',
  outgoing: 'bg-[var(--calls-out-dim)] text-[var(--calls-out)]',
  missed: 'bg-[var(--calls-miss-dim)] text-[var(--calls-miss)]',
  live: 'bg-[var(--calls-live-dim)] text-[var(--calls-live)]',
}

/** Square badge with the call's direction icon, tinted by its outcome. */
export function CallBadge({ call, size = 38, className }: { call: CallLike; size?: number; className?: string }) {
  const tone = callTone(call)
  const Icon = tone === 'live'
    ? PhoneCall
    : tone === 'missed'
      ? (call.direction === 'incoming' ? PhoneMissed : PhoneOff)
      : call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing
  return (
    <span
      role="img"
      aria-label={callKindLabel(call)}
      className={cn('grid shrink-0 place-items-center rounded-[12px]', toneSurface[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.44)} strokeWidth={2.2} />
    </span>
  )
}

/** Outcome on the right of a row: talk time "4:05", or the status when nobody talked. */
export function CallResult({ call, className }: { call: CallLike; className?: string }) {
  const tone = callTone(call)
  if (tone === 'live') {
    return (
      <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold', toneSurface.live, className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {statusLabel(call.status)}
      </span>
    )
  }
  if (tone === 'missed') {
    return <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold', toneSurface.missed, className)}>{statusLabel(call.status)}</span>
  }
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full bg-[var(--input-surface)] px-2.5 font-mono text-[12px] font-medium tabular-nums text-[var(--muted-strong)]', className)} data-i18n-skip="true">
      {formatClock(call.talk_seconds)}
    </span>
  )
}

type CallRowProps = {
  call: TelephonyCall
  selected: boolean
  showSeller: boolean
  canCall: boolean
  onSelect: () => void
  onCall: () => void
}

/** One call in a day card: time + day on the left, a timeline badge, who, and the outcome. */
export function CallRow({ call, selected, showSeller, canCall, onSelect, onCall }: CallRowProps) {
  const { t } = useLocale()
  const tone = callTone(call)
  const name = call.customer_name?.trim()
  const details = [
    name ? formatPhone(call.phone_number) : sourceLabel(call.crm_source) ?? t('telephony.not_in_crm', 'Not in CRM'),
    showSeller ? call.user_name : null,
  ].filter(Boolean).join(' · ')

  return (
    <li className="group/li">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}
        className={cn(
          'relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors outline-none sm:gap-4 sm:px-4',
          'focus-visible:bg-[var(--row-hover)]',
          selected ? 'bg-[var(--row-selected)]' : 'hover:bg-[var(--row-hover)]',
        )}
      >
        {selected ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--primary)]" aria-hidden="true" /> : null}

        <div className="w-[64px] shrink-0 text-right" title={new Date(call.started_at).toLocaleString(getIntlLocale())}>
          <p className="text-[15px] leading-5 font-semibold tabular-nums text-[var(--foreground)]" data-i18n-skip="true">{clockTime(call.started_at)}</p>
          <p className="truncate text-[11.5px] leading-4 text-[var(--muted)]">{dayLabel(call.started_at)}</p>
        </div>

        {/* timeline: a thin line runs through the badges of one day */}
        <div className="relative flex self-stretch">
          <span className="absolute -top-2.5 -bottom-2.5 left-1/2 w-px -translate-x-1/2 bg-[var(--border)] group-first/li:top-1/2 group-last/li:bottom-1/2" aria-hidden="true" />
          <CallBadge call={call} className="relative my-auto" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[14.5px] leading-5 font-semibold', tone === 'missed' ? 'text-[var(--calls-miss)]' : 'text-[var(--foreground)]')}>
            {name || formatPhone(call.phone_number)}
          </p>
          <p className="truncate text-[12.5px] leading-[18px] text-[var(--muted)]">{details}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {call.has_recording ? (
            <AudioLines size={15} className="hidden text-[var(--muted)] sm:block" aria-label={t('telephony.recorded', 'recorded')} />
          ) : null}
          <CallResult call={call} className="hidden sm:inline-flex" />
          <button
            type="button"
            disabled={!canCall}
            onClick={(event) => { event.stopPropagation(); onCall() }}
            aria-label={t('telephony.call_number', 'Call {{phone}}', { phone: call.phone_number })}
            title={t('telephony.call', 'Call')}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--calls-live-dim)] text-[var(--calls-live)] transition-colors hover:bg-[var(--calls-live)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--calls-live)]/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--calls-live-dim)] disabled:hover:text-[var(--calls-live)]"
          >
            <PhoneCall size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </li>
  )
}

export function CallRowSkeleton() {
  return (
    <li className="flex items-center gap-4 px-4 py-3" aria-hidden="true">
      <span className="w-[64px] space-y-1.5"><span className="skeleton ml-auto block h-3 w-10 rounded-full" /><span className="skeleton ml-auto block h-2.5 w-8 rounded-full" /></span>
      <span className="skeleton h-[38px] w-[38px] rounded-[12px]" />
      <span className="flex-1 space-y-2"><span className="skeleton block h-3 w-40 rounded-full" /><span className="skeleton block h-2.5 w-28 rounded-full" /></span>
      <span className="skeleton h-6 w-12 rounded-full" />
    </li>
  )
}
