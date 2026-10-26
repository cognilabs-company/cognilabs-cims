import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCorners,
  pointerWithin,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnRecord, CardRecord, UserSummary } from '../../../shared/api/services/projects.service'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'

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
  readOnly?: boolean
}

type ActiveDragState =
  | { type: 'card'; card: CardRecord }
  | { type: 'column'; column: ColumnRecord }
  | null

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
  readOnly = false,
}: KanbanBoardProps) {
  const [localColumns, setLocalColumns] = useState<ColumnRecord[]>([])
  const [activeDrag, setActiveDrag] = useState<ActiveDragState>(null)
  const preDragColumnsRef = useRef<ColumnRecord[]>([])
  const localColumnsRef = useRef<ColumnRecord[]>([])

  useEffect(() => {
    localColumnsRef.current = localColumns
  }, [localColumns])

  useEffect(() => {
    setLocalColumns(propColumns)
    localColumnsRef.current = propColumns
  }, [propColumns])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const columnIds = useMemo(() => localColumns.map((c) => `col-${c.id}`), [localColumns])
  const collisionDetectionStrategy = useCallback((args: Parameters<typeof closestCorners>[0]) => {
    const pointerIntersections = pointerWithin(args)
    return pointerIntersections.length > 0 ? pointerIntersections : closestCorners(args)
  }, [])

  const onDragStart = useCallback((event: DragStartEvent) => {
    preDragColumnsRef.current = localColumnsRef.current
    const data = event.active.data.current
    if (data?.type === 'card') {
      setActiveDrag({ type: 'card', card: data.card as CardRecord })
    } else if (data?.type === 'column') {
      setActiveDrag({ type: 'column', column: data.column as ColumnRecord })
    }
  }, [])

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const isActiveCard = active.data.current?.type === 'card'
    if (!isActiveCard) return

    const activeCard = active.data.current?.card as CardRecord
    const isOverCard = over.data.current?.type === 'card'
    const isOverColumn = over.data.current?.type === 'column'

    setLocalColumns((prev) => {
      const sourceColIdx = prev.findIndex((col) => col.cards.some((c) => c.id === activeCard.id))
      if (sourceColIdx === -1) return prev

      if (isOverCard) {
        const overCard = over.data.current?.card as CardRecord
        const targetColIdx = prev.findIndex((col) => col.cards.some((c) => c.id === overCard.id))
        if (targetColIdx === -1) return prev

        if (sourceColIdx === targetColIdx) {
          const activeIdx = prev[sourceColIdx].cards.findIndex((c) => c.id === activeCard.id)
          const overIdx = prev[targetColIdx].cards.findIndex((c) => c.id === overCard.id)
          if (activeIdx === overIdx) return prev
          const nextColumns = prev.map((col, i) =>
            i === sourceColIdx ? { ...col, cards: arrayMove(col.cards, activeIdx, overIdx) } : col,
          )
          localColumnsRef.current = nextColumns
          return nextColumns
        }

        const movedCard = prev[sourceColIdx].cards.find((c) => c.id === activeCard.id)
        if (!movedCard) return prev
        const overCardIdx = prev[targetColIdx].cards.findIndex((c) => c.id === overCard.id)
        const isBelowOverCard =
          Boolean(active.rect.current.translated) &&
          active.rect.current.translated!.top > over.rect.top + over.rect.height / 2
        const insertIndex = Math.max(
          0,
          Math.min(overCardIdx + (isBelowOverCard ? 1 : 0), prev[targetColIdx].cards.length),
        )

        const nextColumns = prev.map((col, i) => {
          if (i === sourceColIdx) return { ...col, cards: col.cards.filter((c) => c.id !== activeCard.id) }
          if (i === targetColIdx) {
            const newCards = [...col.cards]
            newCards.splice(insertIndex, 0, { ...movedCard, column_id: col.id })
            return { ...col, cards: newCards }
          }
          return col
        })
        localColumnsRef.current = nextColumns
        return nextColumns
      }

      if (isOverColumn) {
        const overColumnId = over.data.current?.column.id as number
        const targetColIdx = prev.findIndex((col) => col.id === overColumnId)
        if (targetColIdx === -1 || sourceColIdx === targetColIdx) return prev

        const movedCard = prev[sourceColIdx].cards.find((c) => c.id === activeCard.id)
        if (!movedCard) return prev

        const nextColumns = prev.map((col, i) => {
          if (i === sourceColIdx) return { ...col, cards: col.cards.filter((c) => c.id !== activeCard.id) }
          if (i === targetColIdx) return { ...col, cards: [...col.cards, { ...movedCard, column_id: col.id }] }
          return col
        })
        localColumnsRef.current = nextColumns
        return nextColumns
      }

      return prev
    })
  }, [])

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDrag(null)

      const isActiveColumn = active.data.current?.type === 'column'
      const isActiveCard = active.data.current?.type === 'card'

      if (!over) {
        setLocalColumns(preDragColumnsRef.current)
        localColumnsRef.current = preDragColumnsRef.current
        return
      }

      if (isActiveColumn) {
        if (active.id === over.id) return

        setLocalColumns((prev) => {
          const activeIdx = prev.findIndex((c) => `col-${c.id}` === active.id)
          const overIdx = prev.findIndex((c) => `col-${c.id}` === over.id)
          if (activeIdx === overIdx) return prev
          const newCols = arrayMove(prev, activeIdx, overIdx)
          localColumnsRef.current = newCols
          const movedCol = prev[activeIdx]
          onMoveColumn(movedCol.id, overIdx).catch(() => {
            setLocalColumns(preDragColumnsRef.current)
            localColumnsRef.current = preDragColumnsRef.current
          })
          return newCols
        })
        return
      }

      if (isActiveCard) {
        const activeCard = active.data.current?.card as CardRecord
        const initialCols = preDragColumnsRef.current
        const initialCol = initialCols.find((col) => col.cards.some((c) => c.id === activeCard.id))
        const initialIdx = initialCol?.cards.findIndex((c) => c.id === activeCard.id) ?? -1
        const finalCols = localColumnsRef.current
        const targetCol = finalCols.find((col) => col.cards.some((c) => c.id === activeCard.id))
        if (!targetCol) return
        const cardIdx = targetCol.cards.findIndex((c) => c.id === activeCard.id)
        const positionChanged = initialCol?.id !== targetCol.id || initialIdx !== cardIdx

        if (!positionChanged) {
          return
        }

        onMoveCard(activeCard.id, targetCol.id, cardIdx).catch(() => {
          setLocalColumns(preDragColumnsRef.current)
          localColumnsRef.current = preDragColumnsRef.current
        })
      }
    },
    [onMoveCard, onMoveColumn],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {/* Horizontal + vertical scroll canvas — Trello-like */}
      <div className="h-full w-full overflow-x-auto overflow-y-auto horizontal-scrollbar-visible">
        <div className="flex min-h-full items-start gap-3 sm:gap-4 px-3 py-3 sm:px-8 sm:py-5">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {localColumns.map((col) => (
              <div key={col.id} className="shrink-0 self-start">
                <KanbanColumn
                  column={col}
                  onOpenAddCardModal={onOpenAddCardModal}
                  onEditColumn={onEditColumn}
                  onDeleteColumn={onDeleteColumn}
                  onEditCard={onEditCard}
                  onDeleteCard={onDeleteCard}
                  onClickCard={onClickCard}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </SortableContext>

          {/* Add column ghost button */}
          {!readOnly ? (
            <button
              type="button"
              onClick={onAddColumn}
              className="flex h-10 w-64 shrink-0 items-center gap-2 self-start rounded-xl border border-dashed border-white/10 bg-white/5 px-4 text-xs font-medium text-white/40 transition hover:border-white/20 hover:bg-white/8 hover:text-white/70"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Add another list
            </button>
          ) : null}
        </div>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeDrag?.type === 'card' && (
            <KanbanCard
              card={activeDrag.card}
              onEdit={() => {}}
              onDelete={() => {}}
              onClick={() => {}}
              isOverlay
              readOnly
            />
          )}
          {activeDrag?.type === 'column' && (
            <KanbanColumn
              column={activeDrag.column}
              onOpenAddCardModal={() => {}}
              onEditColumn={() => {}}
              onDeleteColumn={() => {}}
              onEditCard={() => {}}
              onDeleteCard={() => {}}
              onClickCard={() => {}}
              isOverlay
              readOnly
            />
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
