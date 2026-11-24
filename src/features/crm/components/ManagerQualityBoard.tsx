import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, Crown, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { cn } from '../../../shared/lib/cn'
import { tashkentDayBound, telephonyQualityService, type QualityStats } from '../../../shared/api/services/telephonyQuality.service'
import { ScoreRing } from '../../telephony/components/CallQualityCard'
import { formatDayTime, formatPhone, formatTalkTime, scoreTone } from '../../telephony/components/telephonyFormat'
import { activityOf, type CallActivity, type CallActivityUser } from '../lib/callActivity'
import type { SalesPanelSummary } from '../lib/salesPanel'

type ManagerRow = SalesPanelSummary['managers'][number]
type Seller = QualityStats['bySeller'][number]

/*
 * "Sales managers: quality of work" — one card per real manager. The quality index (0–100) is a weighted
 * mean of what is known about the manager in the period; a part with no data is left out, not counted as 0:
 *   AI call grade 30 · brought to a meeting 25 · first-contact speed 20 · calls answered 15 · meeting discipline 10
 */
const WEIGHTS = { ai: 30, conversion: 25, speed: 20, calls: 15, discipline: 10 } as const
/** 40% of the period's leads brought to a meeting or further counts as full marks. */
const CONVERSION_TARGET = 0.4

function speedScore(minutes: number | null) {
  if (minutes === null) return null
  if (minutes <= 5) return 100
  if (minutes <= 15) return 85
  if (minutes <= 30) return 70
  if (minutes <= 60) return 55
  if (minutes <= 240) return 35
  return 15
}

type Parts = Record<keyof typeof WEIGHTS, number | null>

function partsOf(row: ManagerRow, calls: CallActivityUser | null, seller: Seller | null, activityLoaded: boolean): Parts {
  return {
    ai: seller?.average ?? null,
    conversion: row.assigned > 0 ? Math.round(Math.min(1, row.meeting_plus / row.assigned / CONVERSION_TARGET) * 100) : null,
    speed: speedScore(row.first_response_median_minutes),
    calls: calls && calls.total > 0 ? Math.round((calls.answered / calls.total) * 100) : activityLoaded && row.assigned > 0 ? 0 : null,
    discipline: row.assigned > 0 || row.in_meeting > 0 ? Math.max(0, 100 - row.stale_meetings * 25) : null,
  }
}

function indexOf(parts: Parts) {
  let sum = 0
  let weight = 0
  for (const key of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
    const value = parts[key]
    if (value === null) continue
    sum += value * WEIGHTS[key]
    weight += WEIGHTS[key]
  }
  return weight > 0 ? Math.round(sum / weight) : null
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[10px] bg-[var(--surface)] px-2 py-1.5 ring-1 ring-[var(--border-subtle)]">
      <span className="truncate text-[15px] leading-5 font-bold tabular-nums" style={tone ? { color: tone } : { color: 'var(--foreground)' }}>{value}</span>
      <span className="truncate text-[10.5px] text-[var(--muted)]">{label}</span>
    </span>
  )
}

function PartLine({ label, score, weight }: { label: string; score: number | null; weight?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-2 text-[11.5px]">
      <span className="truncate text-[var(--muted-strong)]">{label}{weight ? <span className="text-[var(--caption)]"> · {weight}%</span> : null}</span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
        <span className="block h-full rounded-full" style={{ width: `${score ?? 0}%`, background: scoreTone(score) }} />
      </span>
      <span className="text-right font-semibold tabular-nums" style={{ color: scoreTone(score) }}>{score ?? '—'}</span>
    </div>
  )
}

/** The manager's AI grade broken into call script / analysis / sales script, and the last graded calls. */
function ManagerCallsDetail({ userId, period }: { userId: number; period: number }) {
  const { t } = useLocale()
  const query = useAsyncData(async () => {
    const range = { dateFrom: tashkentDayBound(period - 1, 'start'), dateTo: tashkentDayBound(0, 'end') }
    const [stats, calls] = await Promise.allSettled([
      telephonyQualityService.stats({ ...range, userId }),
      telephonyQualityService.calls({ ...range, userId, status: 'completed', pageSize: 5 }),
    ])
    if (stats.status === 'rejected' && calls.status === 'rejected') throw stats.reason
    return { stats: stats.status === 'fulfilled' ? stats.value : null, calls: calls.status === 'fulfilled' ? calls.value.items : [] }
  }, [userId, period])

  if (query.isLoading || query.isIdle) return <p className="flex items-center gap-2 py-2 text-[12px] text-[var(--muted)]"><Loader2 size={13} className="animate-spin" />{t('common.loading', 'Loading...')}</p>
  if (query.isError || !query.data) return <p className="py-2 text-[12px] text-[var(--muted)]">{t('crm.panel.calls_ai.failed', 'Call grades could not be loaded.')}</p>
  const { stats, calls } = query.data
  return (
    <div className="flex flex-col gap-2.5">
      {stats && stats.analyzed > 0 ? (
        <div className="grid gap-1.5">
          <PartLine label={t('crm.panel.calls_ai.call_script', 'Call script')} score={stats.callScript} />
          <PartLine label={t('crm.panel.calls_ai.analysis', 'Understanding the client')} score={stats.analysis} />
          <PartLine label={t('crm.panel.calls_ai.sales_script', 'Sales script')} score={stats.salesScript} />
        </div>
      ) : null}
      {calls.length === 0 ? (
        <p className="text-[12px] text-[var(--muted)]">{t('crm.panel.mq.no_graded', 'No graded calls in this period.')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {calls.map((call) => (
            <li key={call.callId}>
              <Link to={`/telephony?call=${call.callId}`} className="group flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-[var(--card-hover)]">
                <ScoreRing score={call.overall} size={28} stroke={3.5} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[var(--foreground)]">{call.customerName || (call.phone ? formatPhone(call.phone) : `#${call.callId}`)}</span>
                  <span className="block truncate text-[11px] text-[var(--muted)]">{formatDayTime(call.callStartedAt)}{call.mistakes[0] ? ` · ${call.mistakes[0]}` : ''}</span>
                </span>
                <ArrowUpRight size={13} className="shrink-0 text-[var(--caption)] group-hover:text-[var(--primary)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type ManagerQualityBoardProps = {
  managers: ManagerRow[]
  period: number
  activity: CallActivity | null
  activityLoading: boolean
  /** AI grades per seller (CEO only); null hides the AI parts. */
  sellers: Seller[] | null
  fmtMinutes: (minutes: number | null) => string
}

export function ManagerQualityBoard({ managers, period, activity, activityLoading, sellers, fmtMinutes }: ManagerQualityBoardProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState<number | null>(null)
  const canAi = sellers !== null

  const sellerOf = (row: ManagerRow) => {
    if (!sellers) return null
    const name = row.name.trim().toLowerCase()
    return sellers.find((seller) => (seller.userId !== null && seller.userId === row.id) || seller.name.trim().toLowerCase() === name) ?? null
  }

  const cards = managers.map((row) => {
    const calls = activityOf(activity, row)
    const seller = sellerOf(row)
    const parts = partsOf(row, calls, seller, activity !== null)
    return { row, calls, seller, parts, index: indexOf(parts) }
  }).sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || b.row.assigned - a.row.assigned)

  const verdict = (score: number | null) =>
    score === null ? '—'
      : score >= 80 ? t('crm.panel.mq.good', 'Strong')
        : score >= 60 ? t('crm.panel.mq.medium', 'Average')
          : t('crm.panel.mq.weak', 'Needs attention')

  const notes = (card: (typeof cards)[number]) => {
    const { row, calls, seller } = card
    const ai = seller?.average ?? null
    const good: string[] = []
    const bad: string[] = []
    const median = row.first_response_median_minutes
    if (median !== null && median <= 10) good.push(t('crm.panel.mq.fast', 'Fast first contact'))
    if (median !== null && median > 30) bad.push(t('crm.panel.mq.slow', 'Slow first contact: {{value}}', { value: fmtMinutes(median) }))
    if (row.assigned >= 3 && row.meeting_plus / row.assigned >= CONVERSION_TARGET) good.push(t('crm.panel.mq.meetings_good', 'Brings leads to meetings'))
    if (row.assigned >= 5 && row.meeting_plus === 0) bad.push(t('crm.panel.mq.no_meetings', 'No meetings from {{count}} leads', { count: row.assigned }))
    if (row.won > 0) good.push(t('crm.panel.mq.won', '{{count}} won', { count: row.won }))
    if (row.stale_meetings > 0) bad.push(t('crm.panel.mq.stale', '{{count}} meetings without result', { count: row.stale_meetings }))
    if (ai !== null && ai >= 80) good.push(t('crm.panel.mq.ai_good', 'Strong conversations'))
    if (ai !== null && ai < 60) bad.push(t('crm.panel.mq.ai_weak', 'Weak conversations (AI {{value}})', { value: ai }))
    if (calls && calls.missedIncoming >= 3) bad.push(t('crm.panel.mq.missed', '{{count}} missed incoming', { count: calls.missedIncoming }))
    if (activity && !calls && row.assigned > 0) bad.push(t('crm.panel.mq.no_calls', 'No calls in the period'))
    return { good, bad }
  }

  if (managers.length === 0) return null

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-[color-mix(in_srgb,#2B59FF_20%,var(--border))] bg-[linear-gradient(165deg,color-mix(in_srgb,#2B59FF_6%,var(--card))_0%,var(--card)_40%)] p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{t('crm.panel.mq.title', 'Sales managers: quality of work')}</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            {t('crm.panel.mq.caption', 'Leads, first contact, meetings, calls and AI grades · {{count}} days', { count: period })}
          </p>
        </div>
        {activityLoading ? <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]"><Loader2 size={13} className="animate-spin" />{t('crm.panel.mq.loading_calls', 'Loading calls…')}</span> : null}
      </header>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card, place) => {
          const { row, calls, seller, parts, index } = card
          const id = row.id as number
          const { good, bad } = notes(card)
          const expanded = open === id
          const conversion = row.assigned > 0 ? Math.round((row.meeting_plus / row.assigned) * 100) : null
          const answerRate = calls && calls.total > 0 ? Math.round((calls.answered / calls.total) * 100) : null
          const tone = scoreTone(index)
          return (
            <article key={id} className="flex min-w-0 flex-col gap-3 rounded-[16px] border bg-[var(--card)] p-3.5 shadow-[var(--elev-xs,none)]" style={{ borderColor: `color-mix(in srgb, ${tone} 28%, var(--border))` }}>
              <div className="flex items-center gap-3">
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white" style={{ background: `hsl(${(id * 47) % 360} 55% 48%)` }}>
                  {row.name.trim().charAt(0).toUpperCase() || '?'}
                  {place === 0 && index !== null && cards.length > 1 ? <Crown size={14} className="absolute -top-2 -right-1 rotate-12 text-[#E8A500]" fill="#FFD43B" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{row.name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}>
                    #{place + 1} · {verdict(index)}
                  </span>
                </span>
                <span className="flex flex-col items-center">
                  <ScoreRing score={index} size={54} stroke={5} />
                  <span className="mt-0.5 text-[10px] text-[var(--muted)]">{t('crm.panel.mq.index', 'Quality')}</span>
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <Stat label={t('crm.panel.mq.leads', 'Leads')} value={row.assigned} />
                <Stat label={t('crm.panel.mq.first', '1st contact')} value={fmtMinutes(row.first_response_median_minutes)} tone={row.first_response_median_minutes !== null && row.first_response_median_minutes > 30 ? 'var(--danger)' : undefined} />
                <Stat label={t('crm.panel.mq.to_meeting', 'To meeting')} value={conversion === null ? '—' : `${conversion}%`} />
                <Stat label={t('crm.panel.managers.won', 'Won')} value={row.won} tone={row.won > 0 ? 'var(--success)' : undefined} />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <Stat label={t('crm.panel.mq.calls', 'Calls')} value={calls ? calls.total : activity ? 0 : '—'} />
                <Stat label={t('crm.panel.mq.answered', 'Answered')} value={answerRate === null ? '—' : `${answerRate}%`} />
                <Stat label={t('crm.panel.mq.talk', 'Talk time')} value={calls ? formatTalkTime(calls.talkSeconds) : '—'} />
                <Stat label={t('crm.panel.mq.ai', 'AI grade')} value={seller?.average ?? '—'} tone={seller && seller.average !== null ? scoreTone(seller.average) : undefined} />
              </div>

              {good.length || bad.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {good.map((text) => <span key={text} className="inline-flex items-center gap-1 rounded-full bg-[var(--success-dim)] px-2 py-0.5 text-[11px] font-medium text-[var(--success-text)]"><ThumbsUp size={11} />{text}</span>)}
                  {bad.map((text) => <span key={text} className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-dim)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger-text)]"><ThumbsDown size={11} />{text}</span>)}
                </div>
              ) : null}

              <button type="button" onClick={() => setOpen(expanded ? null : id)} aria-expanded={expanded} className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-[var(--primary)]">
                {expanded ? t('crm.panel.mq.less', 'Hide details') : t('crm.panel.mq.more', 'How the grade is made')}
                <ChevronDown size={13} className={cn('transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded ? (
                <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-3">
                  <div className="grid gap-1.5">
                    {canAi ? <PartLine label={t('crm.panel.mq.part_ai', 'AI call grade')} score={parts.ai} weight={WEIGHTS.ai} /> : null}
                    <PartLine label={t('crm.panel.mq.part_conversion', 'Brought to a meeting')} score={parts.conversion} weight={WEIGHTS.conversion} />
                    <PartLine label={t('crm.panel.mq.part_speed', 'First-contact speed')} score={parts.speed} weight={WEIGHTS.speed} />
                    <PartLine label={t('crm.panel.mq.part_calls', 'Calls answered')} score={parts.calls} weight={WEIGHTS.calls} />
                    <PartLine label={t('crm.panel.mq.part_discipline', 'Meeting results noted')} score={parts.discipline} weight={WEIGHTS.discipline} />
                  </div>
                  {canAi ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[12px] font-semibold text-[var(--foreground)]">{t('crm.panel.mq.graded_calls', 'Latest graded calls')}</p>
                      <ManagerCallsDetail userId={id} period={period} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      <p className="text-[11.5px] text-[var(--muted)]">
        {t('crm.panel.mq.footer', 'Quality index = AI call grade 30% · brought to a meeting 25% (40% of leads = full marks) · first-contact speed 20% · calls answered 15% · meeting results noted 10%. A part without data is not counted.')}
      </p>
    </section>
  )
}
