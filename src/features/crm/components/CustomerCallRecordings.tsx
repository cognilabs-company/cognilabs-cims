import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Headphones, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Sparkles } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { TelephonyCall } from '../../../shared/api/services/telephony.service'
import type { CallQuality } from '../../../shared/api/services/telephonyQuality.service'
import { cn } from '../../../shared/lib/cn'
import { callKindLabel, callTone, formatClock, formatDayTime, initialOf, scoreTone, type CallTone } from '../../telephony/components/telephonyFormat'
import { RecordingPlayer } from '../../telephony/components/RecordingPlayer'
import type { CustomerCalls } from '../lib/customerCalls'
import { LEAD_TONES, LeadPanel } from './LeadPulse'

const SHOWN = 5

/** The Calls page opens `?call=<id>` straight in its inspector (notes, AI review, the whole history). */
const callHref = (call: TelephonyCall) => `/telephony?call=${call.id}`

const tones: Record<CallTone, { tile: string; glow: string; Icon: typeof PhoneIncoming }> = {
  incoming: { tile: 'bg-[var(--blue-dim)] text-[var(--primary)]', glow: 'from-[var(--blue-dim)]', Icon: PhoneIncoming },
  outgoing: { tile: 'bg-[var(--success-dim)] text-[var(--success-text)]', glow: 'from-[var(--success-dim)]', Icon: PhoneOutgoing },
  missed: { tile: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', glow: 'from-[var(--danger-dim)]', Icon: PhoneMissed },
  live: { tile: 'bg-[var(--success-dim)] text-[var(--success-text)]', glow: 'from-[var(--success-dim)]', Icon: PhoneOutgoing },
}

/** AI grade chip ("★ 82"), coloured by the score. */
function ScoreChip({ quality }: { quality: CallQuality }) {
  const { t } = useLocale()
  const color = scoreTone(quality.overall)
  return (
    <span
      title={t('customers.pulse.ai_score', 'AI call grade')}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <Sparkles size={10} aria-hidden="true" />
      {quality.overall ?? '—'}
    </span>
  )
}

export function CustomerCallRecordings({ data }: { data: CustomerCalls }) {
  const { t } = useLocale()
  const [picked, setPicked] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Most customers have no recorded calls: stay out of the way until there is something to play.
  if (!data.allowed) return null
  const calls = data.calls.filter((call) => call.has_recording)
  if (calls.length === 0) return null

  const active = calls.find((call) => call.id === picked) ?? calls[0]
  const others = calls.filter((call) => call.id !== active.id)
  const visible = showAll ? others : others.slice(0, SHOWN - 1)
  const totalTalk = calls.reduce((sum, call) => sum + (call.talk_seconds || 0), 0)

  return (
    <LeadPanel
      tone={LEAD_TONES.calls}
      icon={Headphones}
      title={t('customers.calls.recordings', 'Call recordings')}
      aside={(
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] tabular-nums">
          {calls.length > 1 ? <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 ring-1 ring-[var(--border)]">{calls.length}</span> : null}
          <span title={t('customers.calls.total_talk', 'Total talk time')}>Σ {formatClock(totalTalk)}</span>
        </span>
      )}
    >
      <ActiveCall call={active} quality={data.quality.get(active.id) ?? null} />

      {others.length > 0 ? (
        <ul className="mt-2 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {visible.map((call, index) => (
            <li key={call.id} className={cn('group relative flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-[var(--input-surface)]', index > 0 && 'border-t border-[var(--border)]')}>
              <CallLine call={call} compact linked />
              {data.quality.get(call.id) ? <ScoreChip quality={data.quality.get(call.id) as CallQuality} /> : null}
              <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-[var(--caption)] opacity-0 transition-opacity group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => setPicked(call.id)}
                title={t('telephony.recording_play', 'Listen to the recording')}
                aria-label={t('telephony.recording_play', 'Listen to the recording')}
                className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--muted-strong)] transition-colors hover:bg-[var(--primary)] hover:text-white"
              >
                <Play size={12} fill="currentColor" aria-hidden="true" />
              </button>
            </li>
          ))}
          {others.length > visible.length ? (
            <li className="border-t border-[var(--border)]">
              <button type="button" onClick={() => setShowAll(true)} className="w-full px-3 py-2 text-left text-[12px] font-semibold text-[var(--primary)] hover:bg-[var(--input-surface)]">
                {t('customers.calls.show_all', 'Show all {{count}}', { count: calls.length })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </LeadPanel>
  )
}

/** The call being listened to: the whole card links to the call, the player sits above the link and only plays. */
function ActiveCall({ call, quality }: { call: TelephonyCall; quality: CallQuality | null }) {
  const { t } = useLocale()
  const tone = tones[callTone(call)]
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-gradient-to-b via-[var(--card)] via-45% to-[var(--card)] p-3 transition-[border-color,box-shadow,transform]',
        tone.glow,
        'hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] hover:shadow-[0_10px_28px_-16px_rgba(15,23,42,0.45)]',
      )}
    >
      {/* not positioned: the title link's overlay must cover the whole card */}
      <div className="flex items-center gap-2.5">
        <CallLine call={call} linked />
        {quality ? <ScoreChip quality={quality} /> : null}
        <span className="pointer-events-none hidden shrink-0 items-center gap-0.5 rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--primary)] ring-1 ring-[var(--border)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-white sm:inline-flex">
          {t('customers.calls.open_call', 'Open call')}
          <ArrowUpRight size={12} aria-hidden="true" />
        </span>
      </div>

      <div className="relative z-10 mt-2.5">
        <RecordingPlayer key={call.id} callId={call.id} variant="app" />
      </div>

      {/* what the AI made of this conversation: the full report opens with the call */}
      {quality && (quality.summary || quality.mistakes.length > 0) ? (
        <div className="pointer-events-none mt-2.5 rounded-[12px] bg-[color-mix(in_srgb,var(--violet-dim)_70%,transparent)] px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--violet-text)]">
            <Sparkles size={11} aria-hidden="true" /> {t('customers.calls.ai_verdict', 'AI on this call')}
            <span className="ml-auto flex gap-1.5 font-medium text-[var(--muted-strong)] tabular-nums">
              {([
                [t('customers.calls.part_call', 'Script'), quality.callScript],
                [t('customers.calls.part_analysis', 'Analysis'), quality.analysis],
                [t('customers.calls.part_sales', 'Sales'), quality.salesScript],
              ] as const).filter(([, value]) => value !== null).map(([label, value]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: scoreTone(value) }} />{label} {value}
                </span>
              ))}
            </span>
          </p>
          {quality.summary ? <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[var(--muted-strong)]">{quality.summary}</p> : null}
          {quality.mistakes[0] ? (
            <p className="mt-1 line-clamp-1 text-[11.5px] text-[var(--danger-text)]">⚠ {quality.mistakes[0]}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** "↙ Incoming call · Yesterday, 19:23 · (A) Aziz · 4:48". With `linked`, the title is a link stretched over the card. */
function CallLine({ call, compact = false, linked = false }: { call: TelephonyCall; compact?: boolean; linked?: boolean }) {
  const { t } = useLocale()
  const tone = tones[callTone(call)]
  const Icon = tone.Icon
  const title = callKindLabel(call)
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className={cn('grid shrink-0 place-items-center', compact ? 'h-7 w-7 rounded-[9px]' : 'h-10 w-10 rounded-[12px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]', tone.tile)}>
        <Icon size={compact ? 13 : 17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold text-[var(--foreground)]', compact ? 'text-[12.5px]' : 'text-[13.5px]')}>
          {linked ? (
            <Link
              to={callHref(call)}
              title={t('customers.calls.open_call', 'Open call')}
              className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[var(--primary)]"
            >
              {title}
            </Link>
          ) : title}
          <span className="font-normal text-[var(--muted)]"> · {formatDayTime(call.started_at)}</span>
        </span>
        {call.user_name ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            {!compact && initialOf(call.user_name) ? (
              <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[9px] font-bold text-[var(--muted-strong)]">{initialOf(call.user_name)}</span>
            ) : null}
            <span className="truncate">{call.user_name}</span>
          </span>
        ) : null}
      </span>
      <span className={cn('shrink-0 rounded-full font-semibold tabular-nums', compact ? 'text-[12px] text-[var(--muted-strong)]' : 'bg-[var(--muted-surface)] px-2 py-0.5 text-[12px] text-[var(--foreground)]')}>
        {formatClock(call.talk_seconds)}
      </span>
    </span>
  )
}
