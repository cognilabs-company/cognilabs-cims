import { useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarPlus, PhoneCall, Sparkles, Timer, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CustomerSummary } from '../../../shared/api/types'
import { cn } from '../../../shared/lib/cn'
import { formatNumericDate } from '../../../shared/lib/format'
import { ScoreRing } from '../../telephony/components/CallQualityCard'
import { formatClock, scoreTone } from '../../telephony/components/telephonyFormat'
import type { CustomerCalls } from '../lib/customerCalls'

/* Colours of the lead card sections: every kind of block has its own, so the eye finds it at once. */
export const LEAD_TONES = {
  details: '#2B59FF',
  summary: '#7C5CFC',
  history: '#D9A400',
  calls: '#17924A',
  notes: '#0FA5B5',
  danger: '#E03131',
} as const

/** A lead card section: tinted surface, coloured icon chip, title and an optional right side. */
export function LeadPanel({ tone, icon: Icon, title, aside, children, className }: {
  tone: string
  icon?: LucideIcon
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('lead-panel relative overflow-hidden rounded-[18px] border p-3 sm:p-3.5', className)}
      style={{
        '--tone': tone,
        borderColor: `color-mix(in srgb, ${tone} 20%, var(--border))`,
        background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 7%, var(--surface)) 0%, var(--surface) 55%)`,
      } as CSSProperties}
    >
      <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 h-[3px] w-10 rounded-b-full" style={{ background: tone }} />
      {title ? (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-[var(--foreground)]">
            {Icon ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px]" style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}>
                <Icon size={13} strokeWidth={2.2} />
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </p>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function PulseTile({ icon: Icon, tone, label, value, caption, valueColor, visual }: {
  icon: LucideIcon
  tone: string
  label: string
  value: ReactNode
  caption: ReactNode
  valueColor?: string
  visual?: ReactNode
}) {
  return (
    <div
      className="group relative min-w-0 overflow-hidden rounded-[16px] border px-3 py-2.5 transition-transform duration-200 hover:-translate-y-px"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 22%, var(--border))`,
        background: `linear-gradient(150deg, color-mix(in srgb, ${tone} 12%, var(--surface)) 0%, var(--surface) 75%)`,
      }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full opacity-[0.12] transition-transform duration-500 group-hover:scale-125" style={{ background: tone }} />
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-strong)]">
        <Icon size={12.5} style={{ color: tone }} strokeWidth={2.2} />
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[19px] leading-6 font-bold tracking-[-0.02em] tabular-nums" style={{ color: valueColor ?? 'var(--foreground)' }}>{value}</span>
          <span className="block truncate text-[11px] text-[var(--muted)]">{caption}</span>
        </span>
        {visual}
      </span>
    </div>
  )
}

const DAY = 86_400_000

/**
 * "The lead at a glance" strip on top of the lead card: how old the lead is, how fast it was answered,
 * how much the team talked to it and how good the last conversation was (AI grade).
 */
export function LeadPulse({ customer, calls }: { customer: CustomerSummary; calls: CustomerCalls }) {
  const { t } = useLocale()
  // Read once when the card opens: render must stay pure.
  const [now] = useState(() => Date.now())

  const span = (ms: number) => {
    if (ms < 3_600_000) return t('customers.pulse.minutes', '{{count}} min', { count: Math.max(1, Math.round(ms / 60_000)) })
    if (ms < DAY) return t('customers.pulse.hours', '{{count}} h', { count: Math.round(ms / 3_600_000) })
    return t('customers.pulse.days', '{{count}} d', { count: Math.floor(ms / DAY) })
  }

  const createdMs = customer.created_at ? new Date(customer.created_at).getTime() : Number.NaN
  const ageMs = Number.isNaN(createdMs) ? null : Math.max(0, now - createdMs)

  const metrics = customer.lead_response_metrics
  const responseColor = !metrics ? undefined : metrics.is_late_response ? 'var(--danger-text)' : metrics.status_changed ? 'var(--success-text)' : 'var(--warning-text)'

  const list = calls.calls
  const talked = list.filter((call) => call.talk_seconds > 0)
  const missed = list.length - talked.length
  const talkSeconds = talked.reduce((sum, call) => sum + call.talk_seconds, 0)
  const lastCallMs = list[0] ? new Date(list[0].started_at).getTime() : Number.NaN
  const sinceLast = Number.isNaN(lastCallMs) ? null : Math.max(0, now - lastCallMs)
  // No call for 3+ days on a live lead is worth a look.
  const lastColor = sinceLast === null ? undefined : sinceLast > 3 * DAY ? 'var(--danger-text)' : sinceLast > DAY ? 'var(--warning-text)' : 'var(--success-text)'

  const graded = list.map((call) => ({ call, quality: calls.quality.get(call.id) })).find((entry) => entry.quality)
  const score = graded?.quality?.overall ?? null

  return (
    <section aria-label={t('customers.pulse.title', 'Lead at a glance')} className={cn('grid grid-cols-2 gap-2', calls.allowed ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
      <PulseTile
        icon={CalendarPlus}
        tone={LEAD_TONES.details}
        label={t('customers.pulse.age', 'Lead age')}
        value={ageMs === null ? '—' : span(ageMs)}
        caption={formatNumericDate(customer.created_at)}
      />
      <PulseTile
        icon={Timer}
        tone={metrics?.is_late_response ? LEAD_TONES.danger : LEAD_TONES.history}
        label={t('customers.pulse.response', 'First response')}
        value={metrics?.response_human ?? '—'}
        valueColor={responseColor}
        caption={!metrics
          ? t('customers.pulse.no_sla', 'No SLA data')
          : (
            <>
              {metrics.is_late_response
                ? t('customers.detail.lead_response.late', 'Late')
                : metrics.status_changed
                  ? t('customers.detail.lead_response.on_time', 'On time')
                  : t('customers.detail.lead_response.not_contacted', 'Not contacted yet')}
              {` · SLA ${metrics.response_limit_minutes} ${t('customers.recall.unit_min_short', 'min')}`}
              {metrics.status_changed_without_note ? <span className="text-[var(--warning-text)]"> · {t('customers.detail.lead_response.no_note', 'No note written')}</span> : null}
            </>
          )}
      />
      {calls.allowed ? (
        <>
          <PulseTile
            icon={PhoneCall}
            tone={LEAD_TONES.calls}
            label={t('customers.pulse.calls', 'Calls')}
            value={calls.loading ? '…' : (
              <>
                {list.length}
                {missed > 0 ? <span className="ml-1.5 rounded-full bg-[var(--danger-dim)] px-1.5 py-0.5 align-middle text-[10.5px] font-semibold tracking-normal text-[var(--danger-text)]">{t('customers.pulse.missed', '{{count}} missed', { count: missed })}</span> : null}
              </>
            )}
            valueColor={!calls.loading && list.length === 0 ? 'var(--muted)' : undefined}
            caption={calls.loading
              ? t('common.loading', 'Loading...')
              : list.length === 0
                ? t('customers.pulse.no_calls', 'Nobody called yet')
                : (
                  <>
                    Σ {formatClock(talkSeconds)}
                    {sinceLast !== null ? <span style={{ color: lastColor }}> · {t('customers.pulse.ago', '{{span}} ago', { span: span(sinceLast) })}</span> : null}
                  </>
                )}
          />
          <PulseTile
            icon={Sparkles}
            tone={LEAD_TONES.summary}
            label={t('customers.pulse.ai_score_short', 'AI grade')}
            value={calls.loading ? '…' : score === null ? '—' : score >= 80 ? t('customers.pulse.grade_good', 'Good') : score >= 60 ? t('customers.pulse.grade_mid', 'Average') : t('customers.pulse.grade_low', 'Weak')}
            valueColor={score === null ? 'var(--muted)' : scoreTone(score)}
            caption={calls.loading
              ? t('common.loading', 'Loading...')
              : graded?.call.user_name ?? t('customers.pulse.not_graded', 'Not graded yet')}
            visual={score !== null ? <ScoreRing score={score} size={34} stroke={4} /> : null}
          />
        </>
      ) : null}
    </section>
  )
}
