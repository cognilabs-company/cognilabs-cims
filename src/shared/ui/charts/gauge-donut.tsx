import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { arcColorAt } from './chart-palette'

export type GaugeSegment = {
  key: string
  label: string
  value: number
  color?: string
}

type GaugeDonutProps = {
  title?: ReactNode
  action?: ReactNode
  segments: GaugeSegment[]
  centerValue: ReactNode
  centerCaption?: ReactNode
  emptyState?: ReactNode
  className?: string
}

const RADIUS = 100
const STROKE = 30
const GAP = 12
const ARC_LENGTH = Math.PI * RADIUS

export function GaugeDonut({
  title,
  action,
  segments,
  centerValue,
  centerCaption,
  emptyState,
  className,
}: GaugeDonutProps) {
  const total = segments.reduce((acc, segment) => acc + segment.value, 0)
  const hasData = total > 0
  const drawn = segments.filter((segment) => segment.value > 0)
  const usable = ARC_LENGTH + STROKE - GAP * Math.max(0, drawn.length - 1)

  const arcs = drawn.reduce<Array<GaugeSegment & { color: string; dash: string; offset: number }>>(
    (acc, segment) => {
      const ratio = total > 0 ? segment.value / total : 0
      const length = Math.max(0.1, ratio * usable - STROKE)
      const offset = acc.reduce((sum, _, i) => {
        const prior = total > 0 ? drawn[i].value / total : 0
        return sum + prior * usable + GAP
      }, 0)

      acc.push({
        ...segment,
        color: segment.color ?? arcColorAt(segments.indexOf(segment)),
        dash: `${length} ${ARC_LENGTH * 3}`,
        offset: -offset,
      })

      return acc
    },
    [],
  )

  return (
    <div className={cn('flex flex-col gap-3 rounded-[24px] bg-[var(--card)] p-[22px]', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</span>
          ) : <span />}
          {action}
        </div>
      ) : null}

      {!hasData ? (
        emptyState ?? null
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-center gap-[18px]">
          <div className="relative max-w-[280px] flex-1 basis-[220px]">
            <svg viewBox="0 0 260 150" className="block w-full" aria-hidden="true">
              {arcs.map((arc) => (
                <path
                  key={arc.key}
                  d="M 30 130 A 100 100 0 0 1 230 130"
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={arc.dash}
                  strokeDashoffset={arc.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-x-0 bottom-1.5 flex flex-col items-center">
              <span className="text-[30px] font-bold tracking-[-0.03em] tabular-nums" data-ui-number="true">
                {centerValue}
              </span>
              {centerCaption ? (
                <span className="text-[12.5px] text-[var(--muted)]">{centerCaption}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {segments.map((segment, index) => (
              <div key={segment.key} className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums" data-ui-number="true">
                  {segment.value}
                </span>
                <div className="flex items-center gap-[7px] text-[12.5px] text-[var(--muted-strong)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: segment.color ?? arcColorAt(index) }}
                  />
                  {segment.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
