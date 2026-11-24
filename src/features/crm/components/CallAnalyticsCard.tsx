import { Link } from 'react-router-dom'
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CallQuality, QualityStats } from '../../../shared/api/services/telephonyQuality.service'
import { cn } from '../../../shared/lib/cn'
import { ScoreRing } from '../../telephony/components/CallQualityCard'
import { formatDayTime, formatPhone, scoreTone } from '../../telephony/components/telephonyFormat'

export type CallAnalytics = {
  loading: boolean
  failed: boolean
  stats: QualityStats | null
  /** Graded calls of the period, newest first (one page). */
  calls: CallQuality[]
}

/** Calls under this grade are listed as "listen to these first". */
const WEAK = 60

function PartBar({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="truncate text-[var(--muted-strong)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--foreground)]">{score ?? '—'}</span>
      </div>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[var(--muted-surface)]">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${score ?? 0}%`, background: scoreTone(score) }} />
      </span>
    </div>
  )
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[12px] px-2.5 py-2" style={{ background: `color-mix(in srgb, ${tone} 9%, transparent)` }}>
      <span className="text-[17px] leading-6 font-bold tabular-nums" style={{ color: tone }}>{value}</span>
      <span className="truncate text-[11px] text-[var(--muted-strong)]">{label}</span>
    </span>
  )
}

/**
 * Dashboard block "Call analysis": the AI grades of the period (overall + call script / analysis / sales script),
 * a ranking of sales managers by call quality and the weakest calls to listen to first.
 * Every call opens on the Calls page with its full AI report.
 */
export function CallAnalyticsCard({ data, period }: { data: CallAnalytics; period: number }) {
  const { t } = useLocale()
  const { stats, calls } = data
  const sellers = stats?.bySeller ?? []
  const weakest = calls
    .filter((call) => call.overall !== null && call.overall < WEAK)
    .sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0))
    .slice(0, 5)
  const empty = !data.loading && (!stats || stats.analyzed === 0)

  return (
    <section className="relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,#7C5CFC_22%,var(--border))] bg-[linear-gradient(160deg,color-mix(in_srgb,#7C5CFC_7%,var(--card))_0%,var(--card)_45%)] p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[color-mix(in_srgb,#7C5CFC_14%,transparent)] text-[#7C5CFC]"><Sparkles size={16} /></span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{t('crm.panel.calls_ai.title', 'Call analysis')}</h2>
            <p className="text-[12.5px] text-[var(--muted)]">{t('crm.panel.calls_ai.caption', 'AI grades of recorded calls · {{count}} days', { count: period })}</p>
          </div>
        </div>
        <Link to="/call-quality" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-[var(--primary)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--blue-dim)]">
          {t('crm.panel.calls_ai.open', 'All grades')} <ArrowUpRight size={13} />
        </Link>
      </header>

      {data.loading && !stats ? (
        <p className="flex items-center gap-2 py-6 text-[13px] text-[var(--muted)]"><Loader2 size={15} className="animate-spin" />{t('common.loading', 'Loading...')}</p>
      ) : data.failed && !stats ? (
        <p className="py-6 text-center text-[13px] text-[var(--muted)]">{t('crm.panel.calls_ai.failed', 'Call grades could not be loaded.')}</p>
      ) : empty ? (
        <p className="py-6 text-center text-[13px] text-[var(--muted)]">{t('crm.panel.calls_ai.empty', 'No graded calls in this period yet.')}</p>
      ) : stats ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)]">
          {/* 1. the grade of the period */}
          <div className="flex flex-col gap-3 rounded-[16px] bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
            <div className="flex items-center gap-3.5">
              <ScoreRing score={stats.average} size={76} stroke={7} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{t('crm.panel.calls_ai.average', 'Average grade')}</p>
                <p className="text-[12px] text-[var(--muted)]">{t('crm.panel.calls_ai.analyzed', '{{count}} calls graded', { count: stats.analyzed })}</p>
              </div>
            </div>
            <div className="grid gap-2">
              <PartBar label={t('crm.panel.calls_ai.call_script', 'Call script')} score={stats.callScript} />
              <PartBar label={t('crm.panel.calls_ai.analysis', 'Understanding the client')} score={stats.analysis} />
              <PartBar label={t('crm.panel.calls_ai.sales_script', 'Sales script')} score={stats.salesScript} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Counter label={t('crm.panel.calls_ai.done', 'Graded')} value={stats.analyzed} tone="#17924A" />
              <Counter label={t('crm.panel.calls_ai.pending', 'In queue')} value={stats.pending} tone="#D9A400" />
              <Counter label={t('crm.panel.calls_ai.errors', 'Errors')} value={stats.failed} tone="#E03131" />
            </div>
          </div>

          {/* 2. sales managers by call quality */}
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[12.5px] font-semibold text-[var(--foreground)]">{t('crm.panel.calls_ai.managers', 'Sales managers: call quality')}</p>
            {sellers.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">—</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {sellers.map((seller, index) => (
                  <li key={`${seller.userId ?? 'x'}-${seller.name}`} className="flex items-center gap-2.5 rounded-[12px] bg-[var(--surface)] px-2.5 py-2 ring-1 ring-[var(--border)]">
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', index === 0 ? 'bg-[#FFE8A3] text-[#8A5A00]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}>{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-[var(--foreground)]">{seller.name}</span>
                        <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: scoreTone(seller.average) }}>{seller.average ?? '—'}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted-surface)]">
                          <span className="block h-full rounded-full" style={{ width: `${seller.average ?? 0}%`, background: scoreTone(seller.average) }} />
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--muted)] tabular-nums">{t('crm.panel.calls_ai.calls_count', '{{count}} calls', { count: seller.count })}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* 3. the calls to listen to first */}
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[12.5px] font-semibold text-[var(--foreground)]">{t('crm.panel.calls_ai.weakest', 'Weakest calls: listen first')}</p>
            {weakest.length === 0 ? (
              <p className="rounded-[12px] bg-[var(--success-dim)] px-3 py-2.5 text-[12.5px] text-[var(--success-text)]">{t('crm.panel.calls_ai.no_weak', 'No call graded below {{count}} among the latest.', { count: WEAK })}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {weakest.map((call) => (
                  <li key={call.callId}>
                    <Link to={`/telephony?call=${call.callId}`} className="group flex items-start gap-2.5 rounded-[12px] bg-[var(--surface)] px-2.5 py-2 ring-1 ring-[var(--border)] transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--elev-sm)]">
                      <ScoreRing score={call.overall} size={34} stroke={4} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
                          {call.customerName || (call.phone ? formatPhone(call.phone) : `#${call.callId}`)}
                        </span>
                        <span className="block truncate text-[11.5px] text-[var(--muted)]">{call.sellerName ?? '—'} · {formatDayTime(call.callStartedAt)}</span>
                        {call.mistakes[0] ?? call.summary ? <span className="mt-0.5 block truncate text-[11.5px] text-[var(--danger-text)]">{call.mistakes[0] ?? call.summary}</span> : null}
                      </span>
                      <ArrowUpRight size={14} className="mt-1 shrink-0 text-[var(--caption)] transition-colors group-hover:text-[var(--primary)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
