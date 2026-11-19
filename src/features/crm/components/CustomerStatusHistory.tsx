import { useMemo, useState, type CSSProperties } from 'react'
import { ArrowRight, ChevronDown, History, Loader2, RotateCw, UserRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { cn } from '../../../shared/lib/cn'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useCrmScope } from '../lib/crmScope'
import { formatSpan, normalizeStatusHistory, timePerStatus } from '../lib/statusHistory'
import { statusIconFor } from '../lib/statusIcon'
import type { QuickStatusChoice } from './CustomerQuickView'

const statusKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const FALLBACK_COLOR = '#8A90A2'
/** Steps shown before "Show all". */
const COLLAPSED_STEPS = 4

/**
 * Lead status history: which status it moved from and to, who moved it, and how long it stayed in
 * each one — plus a bar of the total time per status.
 */
export function CustomerStatusHistory({ customerId, currentStatus, statusChoices }: {
  customerId: number
  /** Re-load when the status changes from the card. */
  currentStatus: string | null | undefined
  statusChoices?: QuickStatusChoice[]
}) {
  const { t } = useLocale()
  const { service } = useCrmScope()
  const [expanded, setExpanded] = useState(false)
  const query = useAsyncData(() => service.statusHistory(customerId), [customerId, currentStatus], { enabled: customerId > 0 })
  const steps = useMemo(() => normalizeStatusHistory(query.data), [query.data])
  const totals = useMemo(() => timePerStatus(steps), [steps])
  const totalMs = totals.reduce((sum, item) => sum + item.ms, 0)

  const unit = {
    d: t('customers.history.unit_day', 'd'),
    h: t('customers.history.unit_hour', 'h'),
    m: t('customers.history.unit_min', 'min'),
    lessMinute: t('customers.history.less_minute', '<1 min'),
  }

  function look(status: string) {
    const key = statusKey(status)
    const choice = statusChoices?.find((item) => statusKey(item.value) === key)
    return {
      label: choice?.label ?? t(`crm.status_label.${key}`, status.replace(/_/g, ' ')),
      color: choice?.color ?? FALLBACK_COLOR,
      icon: choice?.icon ?? statusIconFor(status),
    }
  }

  // Newest first in the list; the bar keeps the order of the longest stay.
  const ordered = [...steps].reverse()
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_STEPS)

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
          <History size={13} /> {t('customers.history.title', 'Status history')}
        </p>
        {steps.length ? <span className="text-[11px] font-semibold text-[var(--caption)] tabular-nums">{t('customers.history.changes', '{{count}} changes', { count: steps.length })}</span> : null}
      </div>

      {query.isLoading && !steps.length ? (
        <p className="flex items-center gap-2 rounded-[14px] border border-[var(--border)] px-3 py-3 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading...')}</p>
      ) : query.isError && !steps.length ? (
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2.5 text-[12.5px] text-[var(--muted)]">
          {t('customers.history.failed', 'Could not load the status history.')}
          <button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline"><RotateCw size={12} />{t('common.retry', 'Retry')}</button>
        </div>
      ) : !steps.length ? (
        <p className="rounded-[14px] border border-dashed border-[var(--border-hover)] px-3 py-3 text-[12.5px] text-[var(--muted)]">{t('customers.history.empty', 'The status of this lead has not changed yet.')}</p>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] p-3">
          {/* time share per status */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--muted-surface)]" aria-hidden="true">
            {totals.map((item) => (
              <span key={item.status} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.max(2, (item.ms / (totalMs || 1)) * 100)}%`, background: look(item.status).color }} />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
            {totals.map((item) => {
              const status = look(item.status)
              return (
                <li key={item.status} className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted-strong)]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: status.color }} />
                  <span className="font-medium text-[var(--foreground)]">{status.label}</span>
                  <span className="tabular-nums text-[var(--muted)]">{formatSpan(item.ms, unit)}</span>
                </li>
              )
            })}
          </ul>

          {/* the steps */}
          <ol className="mt-3 border-t border-[var(--border)] pt-3">
            {visible.map((step, index) => {
              const to = look(step.to)
              const from = step.from ? look(step.from) : null
              const last = index === visible.length - 1
              return (
                <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {!last ? <span className="absolute top-7 bottom-0 left-[13px] w-px bg-[var(--border)]" aria-hidden="true" /> : null}
                  <span className="status-tint relative grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border-0" style={{ '--tint': to.color } as CSSProperties}>
                    <to.icon size={14} strokeWidth={2.3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      {from ? (
                        <>
                          <span className="truncate text-[var(--muted-strong)]">{from.label}</span>
                          <ArrowRight size={12} className="shrink-0 text-[var(--caption)]" />
                        </>
                      ) : (
                        <span className="text-[var(--muted)]">{t('customers.history.created_as', 'Created as')}</span>
                      )}
                      <span className="truncate font-semibold text-[var(--foreground)]">{to.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-[var(--muted)]">
                      <span className="tabular-nums">{formatNumericDateTime(step.at)}</span>
                      {step.by ? <span className="inline-flex min-w-0 items-center gap-1"><UserRound size={11} className="shrink-0" /><span className="truncate">{step.by}</span></span> : null}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'h-fit shrink-0 rounded-[7px] px-2 py-1 text-[11px] leading-none font-semibold tabular-nums',
                      step.current ? 'bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
                    )}
                    title={step.current ? t('customers.history.in_status_now', 'In this status for') : t('customers.history.stayed', 'Stayed in this status')}
                  >
                    {step.current ? `${t('customers.history.now', 'now')} · ` : ''}{formatSpan(step.durationMs, unit)}
                  </span>
                </li>
              )
            })}
          </ol>

          {ordered.length > COLLAPSED_STEPS ? (
            <button type="button" onClick={() => setExpanded((open) => !open)} className="mt-2 inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--primary)]">
              {expanded ? t('common.show_less', 'Show less') : t('customers.history.show_all', 'Show all {{count}}', { count: ordered.length })}
              <ChevronDown size={13} className={cn('transition-transform', expanded && 'rotate-180')} />
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
