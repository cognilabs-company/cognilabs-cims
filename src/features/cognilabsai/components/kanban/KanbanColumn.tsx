import { ArrowsInLineHorizontalIcon, TrayIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import type { ConversationItem } from '../../../../shared/api/services/cognilabsai.service'
import { KanbanCard } from './KanbanCard'
import { COLUMN_SURFACE, toneTint, type StageConfig } from './kanbanUtils'

function CountPill({ tone, count }: { tone: string; count: number }) {
  return (
    <span
      className="inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums"
      style={{ background: toneTint(tone, 16), color: tone }}
    >
      {count}
    </span>
  )
}

export function KanbanColumn({
  stage, cards, total, onCardClick, highlightedConvId, collapsed, onToggle,
}: {
  stage: StageConfig
  cards: ConversationItem[]
  total: number
  onCardClick: (id: number) => void
  highlightedConvId?: number | null
  collapsed: boolean
  onToggle: () => void
}) {
  const { t } = useLocale()
  const share = total > 0 ? Math.round((cards.length / total) * 100) : 0

  if (collapsed) {
    // Empty / folded stage: a slim strip so the board stays compact.
    return (
      <button
        type="button"
        onClick={onToggle}
        title={`${stage.label} · ${t('aikanban.expand', 'Expand')}`}
        aria-label={`${stage.label} (${cards.length}) · ${t('aikanban.expand', 'Expand')}`}
        className={`${COLUMN_SURFACE} group flex h-full w-11 shrink-0 flex-col items-center gap-2.5 rounded-[14px] py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.tone }} />
        <CountPill tone={stage.tone} count={cards.length} />
        <span
          className="min-h-0 truncate text-[12px] font-medium text-[var(--muted-strong)] transition-colors group-hover:text-[var(--foreground)]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {stage.label}
        </span>
      </button>
    )
  }

  return (
    <section aria-label={stage.label} className={`${COLUMN_SURFACE} group/col flex h-full w-[calc(100vw-80px)] max-w-[300px] shrink-0 flex-col rounded-[14px] sm:w-[272px]`}>
      <header className="flex shrink-0 items-center gap-2 py-2.5 pr-1.5 pl-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.tone }} />
        <h3 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]" title={stage.label}>{stage.label}</h3>
        <CountPill tone={stage.tone} count={cards.length} />
        <span className="ml-auto shrink-0 pl-1 text-[11px] font-medium text-[var(--caption)] tabular-nums" title={t('aikanban.share', 'Share of conversations')}>{share}%</span>
        <button
          type="button"
          onClick={onToggle}
          title={t('aikanban.collapse', 'Collapse')}
          aria-label={t('aikanban.collapse', 'Collapse')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--caption)] transition-[color,background-color,opacity] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none sm:opacity-0 sm:group-hover/col:opacity-100"
        >
          <ArrowsInLineHorizontalIcon size={15} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 pt-0.5 pb-2">
        {cards.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 rounded-[12px] border border-dashed border-[var(--border-hover)] py-8 text-center text-[12px] text-[var(--caption)]">
            <TrayIcon size={20} />
            {t('aikanban.column_empty', 'No conversations')}
          </p>
        ) : cards.map((conv, index) => (
          <KanbanCard key={conv.id} conv={conv} index={index} onClick={() => onCardClick(conv.id)} highlighted={highlightedConvId === conv.id} />
        ))}
      </div>
    </section>
  )
}
