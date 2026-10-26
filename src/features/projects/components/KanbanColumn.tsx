import { useMemo, useRef } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import type { ColumnRecord, CardRecord } from '../../../shared/api/services/projects.service'
import { KanbanCard } from './KanbanCard'

type KanbanColumnProps = {
  column: ColumnRecord
  onOpenAddCardModal: (columnId: number) => void
  onEditColumn: (column: ColumnRecord) => void
  onDeleteColumn: (columnId: number) => void
  onEditCard: (card: CardRecord) => void
  onDeleteCard: (cardId: number) => void
  onClickCard: (card: CardRecord) => void
  isOverlay?: boolean
  readOnly?: boolean
}

export function KanbanColumn({
  column,
  onOpenAddCardModal,
  onEditColumn,
  onDeleteColumn,
  onEditCard,
  onDeleteCard,
  onClickCard,
  isOverlay,
  readOnly = false,
}: KanbanColumnProps) {
  const lt = translateCurrentLiteral
  const locale = getIntlLocale()
  const tr = (key: string, uzFallback: string, ruFallback: string) => {
    const value = lt(key)
    if (value !== key) return value
    if (locale.startsWith('ru')) return ruFallback
    if (locale.startsWith('en')) return key
    return uzFallback
  }

  const cardIds = useMemo(() => column.cards.map((c) => `card-${c.id}`), [column.cards])

  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col-${column.id}`,
    data: { type: 'column', column },
    disabled: readOnly,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-[calc(100vw-64px)] sm:w-[280px] shrink-0 flex-col rounded-xl overflow-hidden',
        'bg-[var(--accent-soft)]/40 backdrop-blur-md',
        'border border-[var(--border)] shadow-sm',
        isDragging && !isOverlay && 'opacity-30 scale-[0.98]',
        isOverlay && 'rotate-[1deg] opacity-95 shadow-[var(--shadow-xl)]',
      )}
    >
      {/* Color accent bar */}
      {column.color && (
        <div
          className="h-1.5 w-full shrink-0 opacity-90"
          style={{ background: column.color }}
        />
      )}

      {/* Column header — drag handle */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 px-4 py-3',
          readOnly ? 'select-none' : 'cursor-grab active:cursor-grabbing select-none',
        )}
        {...(!readOnly ? attributes : {})}
        {...(!readOnly ? listeners : {})}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="truncate text-[13px] font-bold text-[var(--foreground)] tracking-tight">
            {column.name}
          </h3>
          <span className="shrink-0 rounded-md bg-[var(--accent-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted-strong)] leading-none">
            {column.cards.length}
          </span>
        </div>

        {!readOnly ? (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu
              label={lt('Column actions')}
              items={[
                { label: lt('Edit column'), onSelect: () => onEditColumn(column) },
                { label: lt('Delete column'), tone: 'danger', onSelect: () => onDeleteColumn(column.id) },
              ]}
            />
          </div>
        ) : null}
      </div>

      {/* Cards scroll area */}
      <div
        ref={scrollRef}
        className="min-h-[4px] max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-hidden px-2 pt-0.5 pb-2 custom-scrollbar-visible"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5 py-0.5">
            {column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
                onClick={onClickCard}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card button — below scroll area */}
      {!readOnly ? (
        <div className="shrink-0 px-2 pb-3 pt-1">
          <button
            type="button"
            onClick={() => onOpenAddCardModal(column.id)}
            className="flex w-full items-center gap-2 rounded-xl border border-transparent bg-transparent px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {tr('Task qo\'shish', 'Task qo\'shish', 'Добавить задачу')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
