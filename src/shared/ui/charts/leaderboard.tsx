import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type LeaderboardEntry = {
  key: string
  name: string
  caption?: ReactNode
  amount: ReactNode
  percent: number
  initials: string
}

type LeaderboardProps = {
  title: ReactNode
  badge?: ReactNode
  entries: LeaderboardEntry[]
  emptyState?: ReactNode
  className?: string
}

const avatarTones = [
  'bg-[var(--lime)] text-[var(--surface-inverse)]',
  'bg-[#5B80FF] text-white',
  'bg-[#FFB86B] text-[var(--surface-inverse)]',
  'bg-[#C6D4FF] text-[var(--surface-inverse)]',
  'bg-[#E9D8FF] text-[var(--surface-inverse)]',
]

export function Leaderboard({ title, badge, entries, emptyState, className }: LeaderboardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[24px] bg-[var(--surface-inverse)] p-[22px] text-white',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[17px] font-semibold tracking-[-0.01em]">{title}</span>
        {badge ? (
          <span className="rounded-full bg-[rgba(184,241,90,0.12)] px-2.5 py-1 text-xs font-semibold text-[var(--lime)]">
            {badge}
          </span>
        ) : null}
      </div>

      {entries.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="flex flex-col gap-3.5">
          {entries.map((entry, index) => (
            <div key={entry.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'w-[18px] shrink-0 text-xs font-bold tabular-nums',
                    index === 0 ? 'text-[var(--lime)]' : 'text-[#6B7183]',
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-xs font-bold',
                    avatarTones[index % avatarTones.length],
                  )}
                >
                  {entry.initials}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">{entry.name}</span>
                  {entry.caption ? (
                    <span className="truncate text-[11.5px] text-[var(--on-inverse-muted)]">{entry.caption}</span>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums" data-ui-number="true">
                  {entry.amount}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn('h-full rounded-full', index === 0 ? 'bg-[var(--lime)]' : 'bg-white/32')}
                  style={{ width: `${Math.min(100, Math.max(0, entry.percent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
