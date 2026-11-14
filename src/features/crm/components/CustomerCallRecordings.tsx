import { useState } from 'react'
import { Headphones, PhoneIncoming, PhoneOutgoing, Play } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { normalizePhone, telephonyService, type TelephonyCall } from '../../../shared/api/services/telephony.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { cn } from '../../../shared/lib/cn'
import { useAuth } from '../../auth/hooks/useAuth'
import { callKindLabel, formatClock, formatDayTime } from '../../telephony/components/telephonyFormat'
import { RecordingPlayer } from '../../telephony/components/RecordingPlayer'
import { useCrmScope } from '../lib/crmScope'

/** Enough of the number to match "+998 90 123 45 67", "998901234567" and "901234567" alike. */
const tailOf = (value: string | null | undefined) => normalizePhone(value).slice(-9)
const SHOWN = 5

/**
 * Recorded CIMS phone calls with this customer (the same player as on the Calls page).
 * Shows nothing when the user may not see calls or nobody has talked to the customer yet.
 */
export function CustomerCallRecordings({ customerId, phoneNumber }: { customerId: number; phoneNumber: string }) {
  const { t } = useLocale()
  const { can } = useAuth()
  const { kind } = useCrmScope()
  const source = kind === 'outbound' ? 'crm_outbound' : 'crm'
  const tail = tailOf(phoneNumber)
  const allowed = can('calls') && tail.length >= 7
  const [picked, setPicked] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  const query = useAsyncData(async () => {
    // /telephony/calls has no customer filter: search by the number, then keep this customer's recorded calls.
    const response = await telephonyService.calls({ page: 1, page_size: 100, search: tail })
    return response.items
      .filter((call) => call.has_recording)
      .filter((call) => tailOf(call.phone_number) === tail || (call.customer_id === customerId && (call.crm_source ?? source) === source))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [tail, customerId, source], { enabled: allowed })

  // Most customers have no recorded calls: stay out of the way until there is something to play.
  if (!allowed) return null
  const calls = query.data ?? []
  if (calls.length === 0) return null

  const active = calls.find((call) => call.id === picked) ?? calls[0]
  const others = calls.filter((call) => call.id !== active.id)
  const visible = showAll ? others : others.slice(0, SHOWN - 1)

  return (
    <section>
      <Label count={calls.length} />
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-3">
        <CallLine call={active} />
        <div className="mt-2.5">
          <RecordingPlayer key={active.id} callId={active.id} variant="app" />
        </div>
      </div>

      {others.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {visible.map((call) => (
            <li key={call.id}>
              <button
                type="button"
                onClick={() => setPicked(call.id)}
                title={t('telephony.recording_play', 'Listen to the recording')}
                className="group flex w-full items-center gap-2 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--input-surface)]"
              >
                <CallLine call={call} compact />
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--muted-strong)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-white">
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
          {others.length > visible.length ? (
            <li>
              <button type="button" onClick={() => setShowAll(true)} className="px-2.5 py-1.5 text-[12px] font-semibold text-[var(--primary)] hover:underline">
                {t('customers.calls.show_all', 'Show all {{count}}', { count: calls.length })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  )
}

function Label({ count }: { count: number }) {
  const { t } = useLocale()
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
        <Headphones size={13} /> {t('customers.calls.recordings', 'Call recordings')}
      </p>
      {count > 1 ? <span className="text-[11px] font-semibold text-[var(--caption)] tabular-nums">{count}</span> : null}
    </div>
  )
}

/** "↙ Incoming call · Yesterday, 19:23 · Aziz · 4:48" */
function CallLine({ call, compact = false }: { call: TelephonyCall; compact?: boolean }) {
  const incoming = call.direction === 'incoming'
  const Icon = incoming ? PhoneIncoming : PhoneOutgoing
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className={cn('grid shrink-0 place-items-center rounded-[9px]', compact ? 'h-7 w-7' : 'h-8 w-8', incoming ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--success-dim)] text-[var(--success-text)]')}>
        <Icon size={compact ? 13 : 15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold text-[var(--foreground)]', compact ? 'text-[12.5px]' : 'text-[13px]')}>
          {callKindLabel(call)}
          <span className="font-normal text-[var(--muted)]"> · {formatDayTime(call.started_at)}</span>
        </span>
        {call.user_name ? <span className="block truncate text-[11.5px] text-[var(--muted)]">{call.user_name}</span> : null}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-[var(--muted-strong)] tabular-nums">{formatClock(call.talk_seconds)}</span>
    </span>
  )
}
