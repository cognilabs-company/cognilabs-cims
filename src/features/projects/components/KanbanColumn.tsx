import { useMemo } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import type { ActionsMenuItem } from '../../../shared/ui/actions-menu'
import type { ColumnRecord, CardRecord } from '../../../shared/api/services/projects.service'
import { KanbanCard, KanbanCardPreview, KanbanMenu } from './KanbanCard'

type KanbanColumnProps = {
  column: ColumnRecord
  onOpenAddCardModal: (columnId: number) => void
  onEditColumn: (column: ColumnRecord) => void
  onDeleteColumn: (columnId: number) => void
  onEditCard: (card: CardRecord) => void
  onDeleteCard: (cardId: number) => void
  onClickCard: (card: CardRecord) => void
  /** RBAC projects.create — the "add task" buttons. */
  canCreate?: boolean
  /** RBAC projects.edit — column/card drag & drop and "Edit" menu items. */
  canEdit?: boolean
  /** RBAC projects.delete — "Delete" menu items. */
  canDelete?: boolean
}

/** The column's name and how many cards it holds — both neutral; the board keeps no status colours. */
function ColumnTitle({ column }: { column: ColumnRecord }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{column.name}</h3>
      <span className="shrink-0 text-[12.5px] text-[var(--muted)] tabular-nums">{column.cards.length}</span>
    </div>
  )
}

/** The column that follows the pointer while it is dragged — a picture only, never registered with dnd-kit. */
export function KanbanColumnPreview({ column }: { column: ColumnRecord }) {
  return (
    <div className="kb-col flex max-h-[70vh] w-[calc(100vw-72px)] rotate-[1deg] flex-col overflow-hidden rounded-[18px] shadow-[var(--kb-lift-shadow)] sm:w-[296px]">
      <div className="flex shrink-0 items-center pt-3 pr-2 pb-2 pl-4">
        <div className="flex h-8 min-w-0 items-center">
          <ColumnTitle column={column} />
        </div>
      </div>
      <div className="flex min-h-[6px] flex-col gap-2 overflow-hidden px-2.5 pt-0.5 pb-2.5">
        {column.cards.slice(0, 6).map((card) => (
          <KanbanCardPreview key={card.id} card={card} lifted={false} />
        ))}
      </div>
    </div>
  )
}

/**
 * A board column: a soft borderless lane with its name and count, the cards in a scrolling stack and
 * a quiet "Add task" row at the bottom. It grows with its cards up to the board's height, then the
 * stack scrolls.
 */
export function KanbanColumn({
  column,
  onOpenAddCardModal,
  onEditColumn,
  onDeleteColumn,
  onEditCard,
  onDeleteCard,
  onClickCard,
  canCreate = false,
  canEdit = false,
  canDelete = false,
}: KanbanColumnProps) {
  const lt = translateCurrentLiteral
  const { t } = useLocale()
  const addTaskLabel = t('projects.kanban.add_task', 'Add task')

  const columnActions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: lt('Edit column'), onSelect: () => onEditColumn(column) }] : []),
    ...(canDelete ? [{ label: lt('Delete column'), tone: 'danger' as const, onSelect: () => onDeleteColumn(column.id) }] : []),
  ]

  const cardIds = useMemo(() => column.cards.map((c) => `card-${c.id}`), [column.cards])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
        'kb-col group/col flex max-h-full w-[calc(100vw-72px)] shrink-0 snap-start flex-col rounded-[18px] sm:w-[296px]',
        isDragging && 'opacity-40',
      )}
    >
      {/* Header — also the drag handle */}
      <div
        className={cn('flex shrink-0 items-center justify-between gap-2 pt-3 pr-2 pb-2 pl-4 select-none', canEdit && 'cursor-grab active:cursor-grabbing')}
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
      >
        <ColumnTitle column={column} />

        {canCreate || columnActions.length > 0 ? (
          <div
            className="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover/col:opacity-100 sm:group-focus-within/col:opacity-100"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {canCreate ? (
              <button
                type="button"
                onClick={() => onOpenAddCardModal(column.id)}
                aria-label={addTaskLabel}
                title={addTaskLabel}
                className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            ) : null}
            {columnActions.length > 0 ? <KanbanMenu label={lt('Column actions')} items={columnActions} /> : null}
          </div>
        ) : null}
      </div>

      {/* Cards */}
      <div className="kb-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2.5 pb-1">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-[6px] flex-col gap-2 pt-0.5 pb-1">
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

      {canCreate ? (
        <div className="shrink-0 px-2.5 pb-2.5">
          <button
            type="button"
            onClick={() => onOpenAddCardModal(column.id)}
            className="kb-ghost flex h-9 w-full items-center gap-2 rounded-[11px] px-2.5 text-[12.5px] font-medium"
          >
            <Plus size={15} strokeWidth={2} className="shrink-0" />
            {addTaskLabel}
          </button>
        </div>
      ) : column.cards.length === 0 ? (
        <p className="px-4 pb-3.5 text-[12px] text-[var(--caption)]">{t('projects.kanban.empty_column', 'No tasks')}</p>
      ) : null}
    </div>
  )
}
