import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { ColumnRecord, CardRecord, UserSummary } from '../../../shared/api/services/projects.service'
import { KanbanColumn, KanbanColumnPreview } from './KanbanColumn'
import { KanbanCardPreview } from './KanbanCard'

type KanbanBoardProps = {
  columns: ColumnRecord[]
  members: UserSummary[]
  onMoveCard: (cardId: number, columnId: number, order: number) => Promise<void>
  onMoveColumn: (columnId: number, order: number) => Promise<void>
  onOpenAddCardModal: (columnId: number) => void
  onEditCard: (card: CardRecord) => void
  onDeleteCard: (cardId: number) => void
  onClickCard: (card: CardRecord) => void
  onEditColumn: (column: ColumnRecord) => void
  onDeleteColumn: (columnId: number) => void
  onAddColumn: () => void
  /** RBAC projects.create — "add column" / "add task" buttons. */
  canCreate?: boolean
  /** RBAC projects.edit — drag & drop of cards/columns and "Edit" menu items. */
  canEdit?: boolean
  /** RBAC projects.delete — "Delete" menu items. */
  canDelete?: boolean
}

type ActiveDragState =
  | { type: 'card'; card: CardRecord }
  | { type: 'column'; column: ColumnRecord }
  | null

const columnKey = (column: ColumnRecord) => `col-${column.id}`
const cardKey = (card: CardRecord) => `card-${card.id}`
const isColumnKey = (id: UniqueIdentifier) => String(id).startsWith('col-')

/** Index of the column a sortable id belongs to: the column itself, or the column holding that card. */
function findColumnIndex(columns: ColumnRecord[], id: UniqueIdentifier) {
  if (isColumnKey(id)) return columns.findIndex((column) => columnKey(column) === id)
  return columns.findIndex((column) => column.cards.some((card) => cardKey(card) === id))
}

/** Same shape as the server order: card ids per column, to tell whether a drop changed anything. */
function cardPosition(columns: ColumnRecord[], cardId: number) {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === cardId)
    if (index !== -1) return { columnId: column.id, index }
  }
  return null
}

/**
 * Cards move between columns while dragging (onDragOver); inside a column the sortable transforms do
 * the moving and the order is committed on drop. This is dnd-kit's "multiple containers" recipe: a
 * card that just jumped columns keeps its last target for a frame, so the layout shift it causes
 * cannot bounce it back and forth (that bounce used to lock the board in an endless re-render).
 */
export function KanbanBoard({
  columns: propColumns,
  onMoveCard,
  onMoveColumn,
  onOpenAddCardModal,
  onEditCard,
  onDeleteCard,
  onClickCard,
  onEditColumn,
  onDeleteColumn,
  onAddColumn,
  canCreate = false,
  canEdit = false,
  canDelete = false,
}: KanbanBoardProps) {
  const { t } = useLocale()
  // Start from the given columns: an empty first render would leave the scroll-snapped board parked on "Add column".
  const [localColumns, setLocalColumns] = useState<ColumnRecord[]>(propColumns)
  const [activeDrag, setActiveDrag] = useState<ActiveDragState>(null)
  const preDragColumnsRef = useRef<ColumnRecord[]>(propColumns)
  const localColumnsRef = useRef<ColumnRecord[]>(propColumns)
  const activeTypeRef = useRef<'card' | 'column' | null>(null)
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null)
  const movedToNewColumnRef = useRef(false)

  const commitColumns = useCallback((next: ColumnRecord[]) => {
    localColumnsRef.current = next
    setLocalColumns(next)
  }, [])

  // New columns from the server replace the local copy (adjusted during render, not in an effect).
  const [sourceColumns, setSourceColumns] = useState(propColumns)
  if (sourceColumns !== propColumns) {
    setSourceColumns(propColumns)
    setLocalColumns(propColumns)
  }

  useEffect(() => {
    localColumnsRef.current = localColumns
  }, [localColumns])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      movedToNewColumnRef.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [localColumns])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const columnIds = useMemo(() => localColumns.map(columnKey), [localColumns])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    // Columns only ever land on columns.
    if (activeTypeRef.current === 'column') {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => isColumnKey(container.id)) })
    }

    // Only what is under the pointer counts. Falling back to rectangle overlap made a card in the gap
    // between two columns flip from one to the other on every layout pass.
    let overId = getFirstCollision(pointerWithin(args), 'id')

    if (overId != null) {
      // Over a column that has cards: aim at its closest card instead, so the drop has an exact place.
      if (isColumnKey(overId)) {
        const column = localColumnsRef.current.find((item) => columnKey(item) === overId)
        if (column && column.cards.length > 0) {
          const keys = new Set(column.cards.map(cardKey))
          const closest = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => keys.has(String(container.id))) })
          overId = closest[0]?.id ?? overId
        }
      }
      lastOverIdRef.current = overId
      return [{ id: overId }]
    }

    // Between columns or off the board: keep the last target (or the card itself right after a move).
    if (movedToNewColumnRef.current) lastOverIdRef.current = args.active.id
    return lastOverIdRef.current != null ? [{ id: lastOverIdRef.current }] : []
  }, [])

  const restorePreDrag = useCallback(() => {
    commitColumns(preDragColumnsRef.current)
  }, [commitColumns])

  const onDragStart = useCallback((event: DragStartEvent) => {
    preDragColumnsRef.current = localColumnsRef.current
    lastOverIdRef.current = null
    const data = event.active.data.current
    if (data?.type === 'card') {
      activeTypeRef.current = 'card'
      setActiveDrag({ type: 'card', card: data.card as CardRecord })
    } else if (data?.type === 'column') {
      activeTypeRef.current = 'column'
      setActiveDrag({ type: 'column', column: data.column as ColumnRecord })
    }
  }, [])

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    // One column change per frame: wait for the layout to settle before moving again.
    if (!over || active.data.current?.type !== 'card' || movedToNewColumnRef.current) return

    const columns = localColumnsRef.current
    const fromIndex = findColumnIndex(columns, active.id)
    const toIndex = findColumnIndex(columns, over.id)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

    const movedCard = columns[fromIndex].cards.find((card) => cardKey(card) === active.id)
    if (!movedCard) return

    const targetCards = columns[toIndex].cards
    let insertAt = targetCards.length
    if (!isColumnKey(over.id)) {
      const overCardIndex = targetCards.findIndex((card) => cardKey(card) === over.id)
      const translated = active.rect.current.translated
      const isBelow = Boolean(translated && translated.top > over.rect.top + over.rect.height / 2)
      insertAt = overCardIndex >= 0 ? overCardIndex + (isBelow ? 1 : 0) : targetCards.length
    }

    movedToNewColumnRef.current = true
    commitColumns(columns.map((column, index) => {
      if (index === fromIndex) return { ...column, cards: column.cards.filter((card) => card.id !== movedCard.id) }
      if (index === toIndex) {
        const cards = [...column.cards]
        cards.splice(insertAt, 0, { ...movedCard, column_id: column.id })
        return { ...column, cards }
      }
      return column
    }))
  }, [commitColumns])

  const onDragCancel = useCallback(() => {
    activeTypeRef.current = null
    setActiveDrag(null)
    restorePreDrag()
  }, [restorePreDrag])

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const type = activeTypeRef.current
    activeTypeRef.current = null
    setActiveDrag(null)

    if (!over) {
      restorePreDrag()
      return
    }

    if (type === 'column') {
      const columns = localColumnsRef.current
      const from = columns.findIndex((column) => columnKey(column) === active.id)
      const to = columns.findIndex((column) => columnKey(column) === over.id)
      if (from === -1 || to === -1 || from === to) return
      const moved = columns[from]
      commitColumns(arrayMove(columns, from, to))
      onMoveColumn(moved.id, to).catch(restorePreDrag)
      return
    }

    if (type !== 'card') return
    const activeCard = active.data.current?.card as CardRecord | undefined
    if (!activeCard) return

    // Within one column the cards were only shifted visually — apply that order now.
    let columns = localColumnsRef.current
    const columnIndex = findColumnIndex(columns, active.id)
    if (columnIndex !== -1 && findColumnIndex(columns, over.id) === columnIndex && !isColumnKey(over.id)) {
      const cards = columns[columnIndex].cards
      const from = cards.findIndex((card) => cardKey(card) === active.id)
      const to = cards.findIndex((card) => cardKey(card) === over.id)
      if (from !== -1 && to !== -1 && from !== to) {
        columns = columns.map((column, index) => (index === columnIndex ? { ...column, cards: arrayMove(column.cards, from, to) } : column))
        commitColumns(columns)
      }
    }

    const before = cardPosition(preDragColumnsRef.current, activeCard.id)
    const after = cardPosition(columns, activeCard.id)
    if (!after || (before && before.columnId === after.columnId && before.index === after.index)) return

    onMoveCard(activeCard.id, after.columnId, after.index).catch(restorePreDrag)
  }, [commitColumns, onMoveCard, onMoveColumn, restorePreDrag])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {/* The board scrolls sideways; each column scrolls its own cards. */}
      <div className="kb-surface kb-scroll h-full w-full snap-x snap-proximity overflow-x-auto overflow-y-hidden sm:snap-none">
        <div className="flex h-full w-max items-start gap-3 p-3 sm:p-4">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {localColumns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                onOpenAddCardModal={onOpenAddCardModal}
                onEditColumn={onEditColumn}
                onDeleteColumn={onDeleteColumn}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onClickCard={onClickCard}
                canCreate={canCreate}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </SortableContext>

          {canCreate ? (
            <button
              type="button"
              onClick={onAddColumn}
              className="kb-ghost flex h-11 w-[calc(100vw-72px)] shrink-0 items-center gap-2 rounded-[14px] px-4 text-[13px] font-medium sm:w-[296px]"
            >
              <Plus size={16} strokeWidth={2} />
              {t('projects.kanban.add_column', 'Add column')}
            </button>
          ) : null}
        </div>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {activeDrag?.type === 'card' ? <KanbanCardPreview card={activeDrag.card} /> : null}
          {activeDrag?.type === 'column' ? <KanbanColumnPreview column={activeDrag.column} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
