import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type FunnelStage = {
  key: string
  label: string
  count: number
  value: ReactNode
  percent: number
  icon?: ReactNode
  hero?: boolean
}

type FunnelStagesProps = {
  stages: FunnelStage[]
  className?: string
}

export function FunnelStages({ stages, className }: FunnelStagesProps) {
  return (
    <div className={cn('grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]', className)}>
      {stages.map((stage) => (
        <div
          key={stage.key}
          className={cn(
            'flex flex-col gap-3.5 rounded-[18px] p-3.5',
            stage.hero ? 'bg-[var(--lime)]' : 'bg-[var(--accent-soft)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'grid h-[30px] w-[30px] place-items-center rounded-[10px]',
                stage.hero ? 'bg-white/55 text-[var(--surface-inverse)]' : 'bg-[var(--surface)] text-[var(--primary)]',
              )}
            >
              {stage.icon}
            </span>
            <span
              className={cn(
                'text-xs font-bold tabular-nums',
                stage.hero ? 'text-[var(--lime-ink)]' : 'text-[var(--primary)]',
              )}
              data-ui-number="true"
            >
              {stage.count}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className={cn('text-[12.5px]', stage.hero ? 'text-[var(--lime-ink)]' : 'text-[var(--muted-strong)]')}>
              {stage.label}
            </span>
            <span className="text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--foreground)]" data-ui-number="true">
              {stage.value}
            </span>
          </div>

          <div
            className={cn(
              'h-[5px] overflow-hidden rounded-full',
              stage.hero ? 'bg-[rgba(14,21,37,0.12)]' : 'bg-[#E3E8F5]',
            )}
          >
            <div
              className={cn('h-full rounded-full', stage.hero ? 'bg-[var(--surface-inverse)]' : 'bg-[var(--primary)]')}
              style={{ width: `${Math.min(100, Math.max(0, stage.percent))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
