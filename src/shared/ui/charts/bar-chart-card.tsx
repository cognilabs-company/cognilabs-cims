import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tabs, type TabItem } from '../tabs'
import { seriesStyleAt } from './chart-palette'

export type BarDatum = {
  key: string
  label: string
  value: number
  amount: string
  delta?: string
}

type BarChartCardProps<T extends string> = {
  title: ReactNode
  deltaBadge?: ReactNode
  deltaCaption?: ReactNode
  periods?: TabItem<T>[]
  period?: T
  onPeriodChange?: (value: T) => void
  data: BarDatum[]
  highlightKey?: string
  summaryTitle?: ReactNode
  total?: ReactNode
  totalCaption?: ReactNode
  emptyState?: ReactNode
  className?: string
}

function TrendGlyph() {
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="#2B59FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 17l8-7 6 4 12-11" />
      <path d="M22 3h6v6" />
    </svg>
  )
}

export function BarChartCard<T extends string>({
  title,
  deltaBadge,
  deltaCaption,
  periods,
  period,
  onPeriodChange,
  data,
  highlightKey,
  summaryTitle,
  total,
  totalCaption,
  emptyState,
  className,
}: BarChartCardProps<T>) {
  const max = data.reduce((acc, item) => Math.max(acc, item.value), 0)

  return (
    <div className={cn('flex flex-col gap-[18px] rounded-[24px] bg-[var(--card)] p-[22px]', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</span>
          {deltaBadge || deltaCaption ? (
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--muted-strong)]">
              {deltaBadge ? (
                <span className="rounded-full bg-[var(--blue-dim)] px-2 py-0.5 font-semibold text-[var(--blue-text)]">
                  {deltaBadge}
                </span>
              ) : null}
              {deltaCaption}
            </div>
          ) : null}
        </div>
        {periods && period && onPeriodChange ? (
          <Tabs items={periods} value={period} onChange={onPeriodChange} />
        ) : null}
      </div>

      {data.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="flex flex-wrap items-stretch gap-6">
          <div className="flex h-[250px] flex-1 basis-[360px] items-end gap-3.5 border-b border-dashed border-[var(--border-hover)]">
            {data.map((item, index) => {
              const style = seriesStyleAt(index)
              const isHighlighted = highlightKey ? item.key === highlightKey : false
              const heightPercent = max > 0 ? Math.max(22, Math.round((item.value / max) * 100)) : 22

              return (
                <div key={item.key} className="flex h-full flex-1 flex-col items-center gap-2.5">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className="relative flex w-full max-w-[84px] justify-center rounded-[18px] pt-2.5 transition-[height] duration-500"
                      style={{ height: `${heightPercent}%`, background: style.bar }}
                    >
                      {item.delta ? (
                        <span
                          className="flex h-6 items-center rounded-full px-2 text-[11.5px] font-bold"
                          style={{
                            background: style.pill,
                            color: style.pillText,
                            boxShadow: style.pill === '#FFFFFF' ? 'var(--elev-pill)' : undefined,
                          }}
                        >
                          {item.delta}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-center text-[12.5px] whitespace-nowrap',
                      isHighlighted ? 'font-semibold text-[var(--primary)]' : 'font-medium text-[var(--muted-strong)]',
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex flex-[0_1_170px] flex-col justify-between gap-4 py-1">
            {summaryTitle ? (
              <div className="flex flex-col gap-1.5">
                <TrendGlyph />
                <span className="text-[13px] leading-[1.45] text-[var(--muted-strong)]">{summaryTitle}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {data.map((item, index) => (
                <div key={item.key} className="flex items-center gap-2 text-[12.5px] text-[var(--muted-strong)]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: seriesStyleAt(index).dot }} />
                  <span className="flex-1 truncate">{item.label}</span>
                  <b className="font-semibold text-[var(--foreground)]">{item.amount}</b>
                </div>
              ))}
            </div>

            {total ? (
              <div className="flex flex-col">
                <span className="text-[30px] font-bold tracking-[-0.03em] tabular-nums" data-ui-number="true">
                  {total}
                </span>
                {totalCaption ? (
                  <span className="text-[12.5px] text-[var(--muted)]">{totalCaption}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
