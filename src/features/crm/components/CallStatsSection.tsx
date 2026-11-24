import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3, Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Sparkles, Users } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { cn } from '../../../shared/lib/cn'
import { tashkentDayBound, telephonyQualityService } from '../../../shared/api/services/telephonyQuality.service'
import { formatTalkTime, scoreTone } from '../../telephony/components/telephonyFormat'
import { loadCallActivity, type CallActivity } from '../lib/callActivity'
import { PANEL_PERIODS, type PanelPeriod } from '../lib/salesPanel'
import { CallAnalyticsCard } from './CallAnalyticsCard'

const COLORS = { incoming: '#2B59FF', outgoing: '#17924A', missed: '#E03131', talk: '#7C5CFC', ai: '#D9A400' }

function Tile({ icon, label, value, caption, tone, to }: { icon: ReactNode; label: string; value: ReactNode; caption?: ReactNode; tone: string; to?: string }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-[var(--muted-strong)]">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ color: tone, background: `color-mix(in srgb, ${tone} 13%, transparent)` }}>{icon}</span>
      </span>
      <span className="mt-1 block truncate text-[24px] leading-8 font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]">{value}</span>
      {caption ? <span className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-[var(--muted)]">{caption}</span> : null}
    </>
  )
  const className = 'flex min-w-0 flex-col rounded-[16px] border p-3.5 transition-[box-shadow,transform]'
  const style = { borderColor: `color-mix(in srgb, ${tone} 22%, var(--border))`, background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 7%, var(--card)) 0%, var(--card) 60%)` }
  return to ? (
    <Link to={to} className={cn(className, 'hover:-translate-y-px hover:shadow-[var(--elev-sm)]')} style={style}>{body}</Link>
  ) : (
    <div className={className} style={style}>{body}</div>
  )
}

/** Stacked bars per day: answered incoming, outgoing, missed incoming. */
function DailyChart({ activity }: { activity: CallActivity }) {
  const { t } = useLocale()
  const max = Math.max(1, ...activity.daily.map((day) => day.incoming + day.outgoing + day.missed))
  const dense = activity.daily.length > 31
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted-strong)]">
        {([['incoming', t('ceo.calls.incoming', 'Incoming')], ['outgoing', t('ceo.calls.outgoing', 'Outgoing')], ['missed', t('ceo.calls.missed', 'Missed')]] as const).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS[key] }} />{label}</span>
        ))}
      </div>
      <div className={cn('flex h-[150px] items-end', dense ? 'gap-px' : 'gap-[3px]')}>
        {activity.daily.map((day) => {
          const total = day.incoming + day.outgoing + day.missed
          const [, month, date] = day.date.split('-')
          return (
            <div key={day.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${date}.${month}: ${total} · ↓${day.incoming} ↑${day.outgoing} ✕${day.missed}`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 3 : 0 }}>
                <span style={{ flex: day.incoming, background: COLORS.incoming }} />
                <span style={{ flex: day.outgoing, background: COLORS.outgoing }} />
                <span style={{ flex: day.missed, background: COLORS.missed }} />
              </div>
              {total === 0 ? <span className="h-[3px] w-full rounded-full bg-[var(--muted-surface)]" /> : null}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-[var(--caption)]">
        {[activity.daily[0], activity.daily[Math.floor(activity.daily.length / 2)], activity.daily[activity.daily.length - 1]].map((day, index) => {
          const [, month, date] = (day?.date ?? '--').split('-')
          return <span key={index}>{date}.{month}</span>
        })}
      </div>
    </div>
  )
}

/** Employees with the most talk time in the period. */
function TopTalkers({ activity }: { activity: CallActivity }) {
  const { t } = useLocale()
  const rows = activity.byUser.slice(0, 6)
  const max = Math.max(1, ...rows.map((row) => row.talkSeconds))
  if (rows.length === 0) return <p className="text-[12.5px] text-[var(--muted)]">—</p>
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => {
        const answerRate = row.total > 0 ? Math.round((row.answered / row.total) * 100) : 0
        return (
          <li key={`${row.userId ?? row.name}`} className="min-w-0">
            <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="truncate font-semibold text-[var(--foreground)]">{row.name || `#${row.userId}`}</span>
              <span className="shrink-0 tabular-nums text-[var(--muted-strong)]">{formatTalkTime(row.talkSeconds)}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
              <span className="block h-full rounded-full" style={{ width: `${(row.talkSeconds / max) * 100}%`, background: COLORS.talk }} />
            </span>
            <span className="mt-0.5 block truncate text-[11px] tabular-nums text-[var(--muted)]">
              {t('ceo.calls.user_line', '{{total}} calls · ↑{{outgoing}} ↓{{incoming}} · {{rate}}% answered', { total: row.total, outgoing: row.outgoing, incoming: row.incoming, rate: answerRate })}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Dashboard section "Calls": call volume, answer rate, missed calls and talk time of the period
 * (from /telephony/calls) plus the AI call-analysis block (grades, managers ranking, weakest calls).
 */
export function CallStatsSection({ showAi = true }: { showAi?: boolean }) {
  const { t } = useLocale()
  const [period, setPeriod] = useState<PanelPeriod>(30)

  const activityQuery = useAsyncData(() => loadCallActivity(period), [period])
  const aiQuery = useAsyncData(async () => {
    const range = { dateFrom: tashkentDayBound(period - 1, 'start'), dateTo: tashkentDayBound(0, 'end') }
    const [stats, calls] = await Promise.allSettled([
      telephonyQualityService.stats(range),
      telephonyQualityService.calls({ ...range, status: 'completed', pageSize: 50 }),
    ])
    if (stats.status === 'rejected' && calls.status === 'rejected') throw stats.reason
    return { stats: stats.status === 'fulfilled' ? stats.value : null, calls: calls.status === 'fulfilled' ? calls.value.items : [] }
  }, [period, showAi], { enabled: showAi })

  const activity = activityQuery.data ?? null
  const stale = activityQuery.isLoading && activity !== null && activity.days !== period
  const ai = aiQuery.data?.stats ?? null
  const answerRate = activity && activity.total > 0 ? Math.round((activity.answered / activity.total) * 100) : null
  const missedShare = activity && activity.incoming > 0 ? Math.round((activity.missedIncoming / activity.incoming) * 100) : null

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[color-mix(in_srgb,#17924A_14%,transparent)] text-[#17924A]"><Phone size={17} /></span>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{t('ceo.calls.title', 'Call statistics')}</h2>
            <p className="text-[12.5px] text-[var(--muted)]">{t('ceo.calls.caption', 'Call volume, answers and AI grades · {{count}} days', { count: period })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label={t('crm.panel.period', 'Period')} className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
            {PANEL_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={period === value}
                onClick={() => setPeriod(value)}
                className={cn('min-h-8 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors', period === value ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}
              >
                {t('crm.panel.days', '{{count}} days', { count: value })}
              </button>
            ))}
          </div>
          <Link to="/telephony" className="inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[12.5px] font-semibold text-[var(--primary)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--blue-dim)]">
            {t('ceo.calls.open', 'All calls')} <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      {activityQuery.isError && !activity ? (
        <p className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] py-8 text-center text-[13px] text-[var(--muted)]">{t('ceo.calls.failed', 'Calls could not be loaded.')}</p>
      ) : !activity ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-[112px] animate-pulse rounded-[16px] bg-[var(--muted-surface)]" />)}
        </div>
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity', stale && 'opacity-60')}>
          <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3', showAi ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
            <Tile
              icon={<Phone size={16} />}
              label={t('ceo.calls.total', 'Calls')}
              value={activity.total}
              caption={t('ceo.calls.split', '↑ {{outgoing}} outgoing · ↓ {{incoming}} incoming', { outgoing: activity.outgoing, incoming: activity.incoming })}
              tone={COLORS.incoming}
              to="/telephony"
            />
            <Tile
              icon={<PhoneOutgoing size={16} />}
              label={t('ceo.calls.answer_rate', 'Answered')}
              value={answerRate === null ? '—' : `${answerRate}%`}
              caption={t('ceo.calls.answered_line', '{{count}} conversations · {{clients}} clients', { count: activity.answered, clients: activity.clients })}
              tone={COLORS.outgoing}
            />
            <Tile
              icon={<PhoneMissed size={16} />}
              label={t('ceo.calls.missed_incoming', 'Missed incoming')}
              value={activity.missedIncoming}
              caption={missedShare === null ? '—' : t('ceo.calls.missed_share', '{{value}}% of incoming · {{count}} outgoing not picked up', { value: missedShare, count: activity.unansweredOutgoing })}
              tone={COLORS.missed}
            />
            <Tile
              icon={<Clock3 size={16} />}
              label={t('ceo.calls.talk_time', 'Talk time')}
              value={formatTalkTime(activity.talkSeconds)}
              caption={t('ceo.calls.avg_talk', 'Average conversation: {{value}}', { value: formatTalkTime(activity.avgTalkSeconds) })}
              tone={COLORS.talk}
            />
            {showAi ? (
              <Tile
                icon={<Sparkles size={16} />}
                label={t('ceo.calls.ai_grade', 'AI call grade')}
                value={aiQuery.isLoading && !ai ? <Loader2 size={20} className="mt-1 animate-spin text-[var(--muted)]" /> : <span style={{ color: scoreTone(ai?.average ?? null) }}>{ai?.average ?? '—'}</span>}
                caption={ai ? t('ceo.calls.ai_caption', '{{count}} calls graded · {{pending}} in queue', { count: ai.analyzed, pending: ai.pending }) : '—'}
                tone={COLORS.ai}
                to="/call-quality"
              />
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <PhoneIncoming size={15} className="text-[var(--muted-strong)]" />
                <h3 className="text-[14.5px] font-semibold text-[var(--foreground)]">{t('ceo.calls.by_day', 'Calls by day')}</h3>
              </div>
              <DailyChart activity={activity} />
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-[var(--muted-strong)]" />
                <h3 className="text-[14.5px] font-semibold text-[var(--foreground)]">{t('ceo.calls.by_user', 'Who talks to clients')}</h3>
              </div>
              <TopTalkers activity={activity} />
            </div>
          </div>
          {activity.truncated ? (
            <p className="text-[12px] text-[var(--muted)]">{t('ceo.calls.truncated', 'Only the newest {{loaded}} of {{total}} calls are counted.', { loaded: activity.loaded, total: activity.reported })}</p>
          ) : null}
        </div>
      )}

      {showAi ? (
        <CallAnalyticsCard
          period={period}
          data={{ loading: aiQuery.isLoading || aiQuery.isIdle, failed: aiQuery.isError, stats: ai, calls: aiQuery.data?.calls ?? [] }}
        />
      ) : null}
    </section>
  )
}
