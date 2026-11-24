import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CardRecord } from '../../../shared/api/services/projects.service'
import { cn } from '../../../shared/lib/cn'
import { formatProjectDateTime } from '../lib/format'
import { formatSpan, statusColor, summarizeStatusTime } from '../lib/statusTime'

/** Re-renders every minute so the open status keeps counting while the card is open. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Task card → "Qaysi statusda qancha vaqt": a chronological strip of every status visit,
 * per-status totals (all visits summed, share of the task's life) and the full step-by-step history.
 */
export function CardStatusTime({ card }: { card: CardRecord }) {
  const { t } = useLocale()
  const now = useNow()
  const summary = useMemo(() => summarizeStatusTime(card, now), [card, now])
  const [showSteps, setShowSteps] = useState(false)
  const units = { d: t('kpi.timing.unit.d', 'd'), h: t('kpi.timing.unit.h', 'h'), m: t('kpi.timing.unit.m', 'm') }
  const fmt = (seconds: number | null | undefined) => formatSpan(seconds, units)

  if (summary.visits.length === 0) return null

  const colorOf = new Map(summary.totals.map((total) => [total.key, statusColor(total.colorIndex)]))
  const longest = summary.totals.reduce((best, total) => (total.seconds > best.seconds ? total : best), summary.totals[0])
  const maxSeconds = Math.max(1, longest.seconds)
  const ranked = [...summary.totals].sort((a, b) => b.seconds - a.seconds)

  return (
    <div className="space-y-3 border-t border-[var(--border-hover)] pt-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="ui-card-label">{t('task_status_time.title', 'Time in each status')}</h4>
        <span className="text-[12px] tabular-nums text-[var(--muted)]" title={t('task_status_time.total_hint', 'Sum of all statuses')}>
          Σ {fmt(summary.totalSeconds)}
        </span>
      </div>

      <div className="space-y-3.5 rounded-[18px] bg-[var(--surface)] p-4">
        {summary.current ? (
          <div className="flex items-center gap-3 rounded-[14px] p-3" style={{ background: `color-mix(in srgb, ${colorOf.get(summary.current.key)} 12%, transparent)` }}>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: colorOf.get(summary.current.key) }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: colorOf.get(summary.current.key) }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium text-[var(--muted)]">{t('task_status_time.now', 'Now in')}</p>
              <p className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{summary.current.name}</p>
            </div>
            <span className="shrink-0 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)]">{fmt(summary.current.seconds)}</span>
          </div>
        ) : null}

        {/* Chronological strip: one segment per visit, width = its share of the task's life. */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--muted-surface)]" role="img" aria-label={t('task_status_time.strip', 'Status timeline')}>
            {summary.visits.map((visit, index) => (
              <span
                key={`${visit.key}-${index}`}
                title={`${visit.name} · ${fmt(visit.seconds)}`}
                className={cn('h-full', index > 0 && 'border-l-2 border-[var(--surface)]', visit.open && 'opacity-90')}
                style={{ flexGrow: Math.max(visit.seconds, summary.totalSeconds * 0.012), flexBasis: 0, background: colorOf.get(visit.key) }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-[var(--muted)]">
            <span>{Number.isFinite(summary.visits[0].start) ? formatProjectDateTime(new Date(summary.visits[0].start).toISOString()) : ''}</span>
            <span>{summary.current ? t('task_status_time.today', 'now') : Number.isFinite(summary.visits[summary.visits.length - 1].end) ? formatProjectDateTime(new Date(summary.visits[summary.visits.length - 1].end).toISOString()) : ''}</span>
          </div>
        </div>

        {/* Per-status totals, longest first. */}
        <ul className="space-y-2.5">
          {ranked.map((total) => (
            <li key={total.key} className="space-y-1">
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: colorOf.get(total.key) }} />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--foreground)]" title={total.name}>{total.name}</span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--muted)]">{Math.round(total.share * 100)}%</span>
                <span className="w-[68px] shrink-0 text-right font-semibold tabular-nums text-[var(--foreground)]">{fmt(total.seconds)}</span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (total.seconds / maxSeconds) * 100)}%`, background: colorOf.get(total.key) }} />
              </span>
              {total.visits > 1 || total.open ? (
                <div className="flex items-center gap-2 pl-[18px] text-[11px]">
                  {total.open ? <span className="font-semibold uppercase tracking-wide text-[var(--blue-text)]">{t('task_status_time.live', 'now')}</span> : null}
                  {total.visits > 1 ? (
                    <span className="text-[var(--muted-strong)]" title={t('task_status_time.returned_hint', 'The task came back to this status')}>
                      ↺ {t('task_status_time.visits', '{{count}}×', { count: total.visits })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {summary.totals.length > 1 ? (
          <p className="text-[12px] text-[var(--muted)]">
            {t('task_status_time.longest', 'Spent the longest in «{{name}}» — {{share}}% of the time.', { name: longest.name, share: Math.round(longest.share * 100) })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowSteps((value) => !value)}
          className="text-[12.5px] font-medium text-[var(--blue-text)] hover:underline"
          aria-expanded={showSteps}
        >
          {showSteps ? t('task_status_time.hide_steps', 'Hide step-by-step history') : t('task_status_time.show_steps', 'Step-by-step history ({{count}})', { count: summary.visits.length })}
        </button>

        {showSteps ? (
          <ol className="relative space-y-0 pl-4">
            <span className="absolute top-1.5 bottom-1.5 left-[4px] w-px bg-[var(--border)]" aria-hidden="true" />
            {[...summary.visits].reverse().map((visit, index) => (
              <li key={`${visit.key}-${visit.start}-${index}`} className="relative py-1.5">
                <span className="absolute top-[11px] -left-4 h-[9px] w-[9px] rounded-full ring-2 ring-[var(--surface)]" style={{ background: colorOf.get(visit.key) }} />
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--foreground)]">{visit.name}</span>
                  <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--muted-strong)]">{fmt(visit.seconds)}</span>
                </div>
                {Number.isFinite(visit.start) ? (
                  <p className="text-[11.5px] tabular-nums text-[var(--muted)]">
                    {formatProjectDateTime(new Date(visit.start).toISOString())}
                    {' → '}
                    {visit.open ? t('task_status_time.today', 'now') : Number.isFinite(visit.end) ? formatProjectDateTime(new Date(visit.end).toISOString()) : '—'}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
