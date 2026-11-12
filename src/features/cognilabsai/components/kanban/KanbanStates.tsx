import type { ReactNode } from 'react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { Skeleton } from '../../../../shared/ui/skeleton'
import { COLUMN_SURFACE } from './kanbanUtils'

const SKELETON_CARDS = [[64, 84, 64], [84, 64], [64, 84, 64, 64], [84], [64, 64]]

/** First load: column wells with a few card-shaped placeholders. */
export function KanbanBoardSkeleton() {
  const { t } = useLocale()
  return (
    <div className="flex h-full gap-3 overflow-hidden" role="status" aria-label={t('common.loading', 'Loading')}>
      {SKELETON_CARDS.map((cards, column) => (
        <div key={column} className={`${COLUMN_SURFACE} flex w-[calc(100vw-80px)] max-w-[300px] shrink-0 flex-col gap-2 rounded-[14px] p-2 sm:w-[272px]`}>
          <div className="flex items-center gap-2 px-1 pt-1.5 pb-1">
            <Skeleton rounded="full" className="h-2 w-2" />
            <Skeleton rounded="full" className="h-3 w-28" />
            <Skeleton rounded="full" className="h-4 w-6" />
          </div>
          {cards.map((height, row) => (
            <div key={row} className="flex gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3" style={{ height }}>
              <Skeleton rounded="full" className="h-[34px] w-[34px] shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <Skeleton rounded="full" className="h-3 w-3/5" />
                <Skeleton rounded="full" className="h-2.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Board with nothing to show: no conversations at all, none in this channel, or nothing found. */
export function KanbanEmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="grid h-full cursor-default place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--blue-text)]">{icon}</span>
        <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{text}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}
