import { useMemo, useRef } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
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
  /** RBAC projects.create — the "add task" buttons. */
  canCreate?: boolean
  /** RBAC projects.edit — column/card drag & drop and "Edit" menu items. */
  canEdit?: boolean
  /** RBAC projects.delete — "Delete" menu items. */
  canDelete?: boolean
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
  canCreate = false,
  canEdit = false,
  canDelete = false,
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

  const columnActions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: lt('Edit column'), onSelect: () => onEditColumn(column) }] : []),
    ...(canDelete ? [{ label: lt('Delete column'), tone: 'danger' as const, onSelect: () => onDeleteColumn(column.id) }] : []),
  ]

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
    disabled: !canEdit,
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
        'kb-col flex w-[calc(100vw-64px)] sm:w-[284px] shrink-0 flex-col overflow-hidden rounded-[18px] transition-shadow duration-200',
        isDragging && !isOverlay && 'opacity-40',
        isOverlay && 'rotate-[1.2deg] shadow-[0_28px_60px_-24px_rgba(14,21,37,0.55)]',
      )}
    >

      {/* Column header — drag handle */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 px-3.5 py-3',
          canEdit ? 'cursor-grab active:cursor-grabbing select-none' : 'select-none',
        )}
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: column.color || '#94a3b8', boxShadow: `0 0 10px ${column.color || '#94a3b8'}` }} />
          <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-white">
            {column.name}
          </h3>
          <span className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[11px] leading-none font-bold tabular-nums text-white/80">
            {column.cards.length}
          </span>
        </div>

        {canCreate || columnActions.length > 0 ? (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            {canCreate ? (
              <button
                type="button"
                onClick={() => onOpenAddCardModal(column.id)}
                aria-label={tr('Task qo\'shish', 'Task qo\'shish', 'Добавить задачу')}
                title={tr('Task qo\'shish', 'Task qo\'shish', 'Добавить задачу')}
                className="grid h-8 w-8 place-items-center rounded-[9px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              </button>
            ) : null}
            {columnActions.length > 0 ? (
              <ActionsMenu label={lt('Column actions')} items={columnActions} />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Cards scroll area */}
      <div
        ref={scrollRef}
        className="min-h-[4px] max-h-[calc(100vh-302px)] overflow-y-auto overflow-x-hidden px-2.5 pt-0.5 pb-2 custom-scrollbar-visible"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 py-0.5">
            {column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
                onClick={onClickCard}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card button — below scroll area */}
      {canCreate ? (
        <div className="shrink-0 px-2.5 pb-2.5 pt-1">
          <button
            type="button"
            onClick={() => onOpenAddCardModal(column.id)}
            className="kb-ghost flex h-10 w-full items-center justify-center gap-2 rounded-[12px] px-3 text-[13px] font-semibold"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {tr('Task qo\'shish', 'Task qo\'shish', 'Добавить задачу')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
