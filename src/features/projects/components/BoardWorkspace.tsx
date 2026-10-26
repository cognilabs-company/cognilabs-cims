import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { StateBlock } from '../../../shared/ui/state-block'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import {
  projectsService,
  type BoardDetail,
  type CardRecord,
  type ColumnRecord,
} from '../../../shared/api/services/projects.service'
import { useAuth } from '../../auth/hooks/useAuth'
import { BoardFormModal } from './BoardFormModal'
import { CardDetailModal } from './CardDetailModal'
import { CardFormModal } from './CardFormModal'
import { ColumnFormModal } from './ColumnFormModal'
import { KanbanBoard } from './KanbanBoard'

type BoardWorkspaceMode = 'embedded' | 'fullscreen'
type AddCardState = { columnId: number } | null

type EditCardState = { card: CardRecord } | null
type EditColumnState = { column: ColumnRecord } | null

type BoardWorkspaceProps = {
  boardId: number
  projectId?: number | null
  mode?: BoardWorkspaceMode
  onBoardsChanged?: () => Promise<unknown> | unknown
}

function moveCardInBoard(board: BoardDetail, cardId: number, columnId: number, order: number): BoardDetail {
  const sourceColumnIndex = board.columns.findIndex((column) => column.cards.some((card) => card.id === cardId))
  const targetColumnIndex = board.columns.findIndex((column) => column.id === columnId)

  if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
    return board
  }

  const sourceColumn = board.columns[sourceColumnIndex]
  const sourceCardIndex = sourceColumn.cards.findIndex((card) => card.id === cardId)

  if (sourceCardIndex === -1) {
    return board
  }

  const movedCard = sourceColumn.cards[sourceCardIndex]
  const nextColumns = board.columns.map((column) => ({
    ...column,
    cards: [...column.cards],
  }))

  nextColumns[sourceColumnIndex].cards.splice(sourceCardIndex, 1)

  const targetCards = nextColumns[targetColumnIndex].cards
  const nextOrder = Math.max(0, Math.min(order, targetCards.length))
  targetCards.splice(nextOrder, 0, {
    ...movedCard,
    column_id: columnId,
    order: nextOrder,
  })

  return {
    ...board,
    columns: nextColumns.map((column) => ({
      ...column,
      cards: column.cards.map((card, index) => ({
        ...card,
        column_id: column.id,
        order: index,
      })),
    })),
  }
}

function moveColumnInBoard(board: BoardDetail, columnId: number, order: number): BoardDetail {
  const sourceIndex = board.columns.findIndex((column) => column.id === columnId)

  if (sourceIndex === -1) {
    return board
  }

  const targetIndex = Math.max(0, Math.min(order, board.columns.length - 1))

  if (sourceIndex === targetIndex) {
    return board
  }

  const nextColumns = [...board.columns]
  const [movedColumn] = nextColumns.splice(sourceIndex, 1)
  nextColumns.splice(targetIndex, 0, movedColumn)

  return {
    ...board,
    columns: nextColumns.map((column, index) => ({
      ...column,
      order: index,
    })),
  }
}

function parsePositiveId(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function findCardInBoard(board: BoardDetail, cardId: number) {
  for (const column of board.columns) {
    const card = column.cards.find((item) => item.id === cardId)
    if (card) {
      return card
    }
  }

  return null
}

export function BoardWorkspace({
  boardId,
  projectId = null,
  mode = 'fullscreen',
  onBoardsChanged,
}: BoardWorkspaceProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user } = useAuth()
  const lt = translateCurrentLiteral

  const canManageProjects = Boolean(user)
  const isEmbedded = mode === 'embedded'

  const boardQuery = useAsyncData(
    async () => {
      if (!user) {
        throw new Error('User session is unavailable')
      }

      return projectsService.getReadableBoardDetail(boardId, projectId, user.id)
    },
    [boardId, projectId, user?.id],
    { enabled: boardId > 0 && Boolean(user) },
  )

  const usersQuery = useAsyncData(
    () => projectsService.getAllUsers(),
    [],
    { enabled: canManageProjects },
  )

  const [isEditBoardOpen, setIsEditBoardOpen] = useState(false)
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false)
  const [editColumnState, setEditColumnState] = useState<EditColumnState>(null)
  const [addCardState, setAddCardState] = useState<AddCardState>(null)
  const [editCardState, setEditCardState] = useState<EditCardState>(null)
  const [detailCard, setDetailCard] = useState<CardRecord | null>(null)

  const [isBoardSubmitting, setIsBoardSubmitting] = useState(false)
  const [isColumnSubmitting, setIsColumnSubmitting] = useState(false)
  const [isCardSubmitting, setIsCardSubmitting] = useState(false)

  const board = boardQuery.data
  const allUsers = canManageProjects ? usersQuery.data ?? [] : []
  const isReadOnlyBoard = !canManageProjects || Boolean(board?.is_archived)
  const selectedCardId = parsePositiveId(searchParams.get('card'))

  useEffect(() => {
    if (!board) {
      return
    }

    const matchingCard = selectedCardId === null ? null : findCardInBoard(board, selectedCardId)
    if (matchingCard) {
      if (matchingCard.id !== detailCard?.id) {
        setDetailCard(matchingCard)
      }
      return
    }

    if (detailCard && !findCardInBoard(board, detailCard.id)) {
      setDetailCard(null)
    }
  }, [board, detailCard?.id, selectedCardId])

  const boardStats = useMemo(() => {
    if (!board) {
      return { columnCount: 0, cardCount: 0 }
    }

    return {
      columnCount: board.columns.length,
      cardCount: board.columns.reduce((sum, column) => sum + column.cards.length, 0),
    }
  }, [board])

  async function notifyBoardsChanged() {
    await Promise.resolve(onBoardsChanged?.())
  }

  async function handleUpdateBoard(values: { name: string; description?: string }) {
    if (!canManageProjects || !board) {
      return
    }

    setIsBoardSubmitting(true)
    try {
      await projectsService.updateBoard(board.id, values)
      showToast({ title: lt('Board updated'), tone: 'success' })
      setIsEditBoardOpen(false)
      await Promise.allSettled([boardQuery.refetch(), notifyBoardsChanged()])
    } catch {
      showToast({ title: lt('Failed to update board'), tone: 'error' })
    } finally {
      setIsBoardSubmitting(false)
    }
  }

  async function handleDeleteBoard() {
    if (!canManageProjects || !board) {
      return
    }

    const ok = await confirm({
      title: lt('Delete board?'),
      description: `"${board.name}" ${lt('will be permanently deleted. This action cannot be undone.')}`,
      tone: 'danger',
    })

    if (!ok) {
      return
    }

    try {
      await projectsService.deleteBoard(board.id)
      showToast({ title: lt('Board deleted'), tone: 'success' })
      await notifyBoardsChanged()

      if (isEmbedded) {
        return
      }

      navigate(`/projects/${board.project_id}`)
    } catch {
      showToast({ title: lt('Failed to delete board'), tone: 'error' })
    }
  }

  async function handleCreateColumn(values: { name: string; color: string }) {
    if (!canManageProjects || !board || board.is_archived) {
      return
    }

    setIsColumnSubmitting(true)
    try {
      await projectsService.createColumn(board.id, values)
      showToast({ title: lt('Column added'), tone: 'success' })
      setIsAddColumnOpen(false)
      await boardQuery.refetch()
    } catch {
      showToast({ title: lt('Failed to create column'), tone: 'error' })
    } finally {
      setIsColumnSubmitting(false)
    }
  }

  async function handleUpdateColumn(values: { name: string; color: string }) {
    if (!canManageProjects || !editColumnState || board?.is_archived) {
      return
    }

    setIsColumnSubmitting(true)
    try {
      await projectsService.updateColumn(editColumnState.column.id, values)
      showToast({ title: lt('Column updated'), tone: 'success' })
      setEditColumnState(null)
      await boardQuery.refetch()
    } catch {
      showToast({ title: lt('Failed to update column'), tone: 'error' })
    } finally {
      setIsColumnSubmitting(false)
    }
  }

  async function handleDeleteColumn(columnId: number) {
    if (!canManageProjects || board?.is_archived) {
      return
    }

    const ok = await confirm({
      title: lt('Delete column?'),
      description: lt('All cards in this column will also be deleted.'),
      tone: 'danger',
    })

    if (!ok) {
      return
    }

    try {
      await projectsService.deleteColumn(columnId)
      showToast({ title: lt('Column deleted'), tone: 'success' })
      await boardQuery.refetch()
    } catch {
      showToast({ title: lt('Failed to delete column'), tone: 'error' })
    }
  }

  function openCardDetail(card: CardRecord) {
    setDetailCard(card)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('card', String(card.id))
      return next
    })
  }

  function closeCardDetail() {
    setDetailCard(null)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('card')
      return next
    })
  }

  async function handleCreateCard(fd: FormData) {
    if (!canManageProjects || !addCardState || board?.is_archived) {
      return
    }

    setIsCardSubmitting(true)
    try {
      await projectsService.createCard(addCardState.columnId, fd)
      showToast({ title: lt('Card created'), tone: 'success' })
      setAddCardState(null)
      await boardQuery.refetch()
    } catch (error) {
      showToast({ title: lt('Failed to create card'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsCardSubmitting(false)
    }
  }

  async function handleUpdateCard(fd: FormData) {
    if (!canManageProjects || !editCardState || board?.is_archived) {
      return
    }

    setIsCardSubmitting(true)
    try {
      await projectsService.updateCard(editCardState.card.id, fd)
      showToast({ title: lt('Card updated'), tone: 'success' })
      setEditCardState(null)
      if (detailCard?.id === editCardState.card.id) {
        closeCardDetail()
      }
      await boardQuery.refetch()
    } catch {
      showToast({ title: lt('Failed to update card'), tone: 'error' })
    } finally {
      setIsCardSubmitting(false)
    }
  }

  async function handleDeleteCard(cardId: number) {
    if (!canManageProjects || board?.is_archived) {
      return
    }

    const ok = await confirm({
      title: lt('Delete card?'),
      description: lt('This card will be permanently removed.'),
      tone: 'danger',
    })

    if (!ok) {
      return
    }

    try {
      await projectsService.deleteCard(cardId)
      showToast({ title: lt('Card deleted'), tone: 'success' })
      if (detailCard?.id === cardId) {
        closeCardDetail()
      }
      await boardQuery.refetch()
    } catch {
      showToast({ title: lt('Failed to delete card'), tone: 'error' })
    }
  }

  async function handleMoveCard(cardId: number, columnId: number, order: number) {
    if (!canManageProjects || board?.is_archived) {
      return
    }

    try {
      await projectsService.moveCard(cardId, columnId, order)
      boardQuery.setData((current) => (current ? moveCardInBoard(current, cardId, columnId, order) : current))
    } catch {
      showToast({ title: lt('Failed to move card, changes reverted.'), tone: 'error' })
      await boardQuery.refetch()
      throw new Error('moveCard failed')
    }
  }

  async function handleMoveColumn(columnId: number, order: number) {
    if (!canManageProjects || board?.is_archived) {
      return
    }

    try {
      await projectsService.moveColumn(columnId, order)
      boardQuery.setData((current) => (current ? moveColumnInBoard(current, columnId, order) : current))
    } catch {
      showToast({ title: lt('Failed to reorder column, changes reverted.'), tone: 'error' })
      await boardQuery.refetch()
      throw new Error('moveColumn failed')
    }
  }

  if (boardQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={isEmbedded
                ? 'h-[520px] w-72 shrink-0 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]'
                : 'h-[calc(100vh-200px)] w-72 shrink-0 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]'}
            />
          ))}
        </div>
      </div>
    )
  }

  if (boardQuery.isError || !board) {
    return (
      <StateBlock
        tone="error"
        eyebrow={lt('Error')}
        title={lt('Failed to load board')}
        description={lt('The board could not be found or an error occurred.')}
        actionLabel={isEmbedded ? undefined : lt('Go back')}
        onAction={isEmbedded ? undefined : () => navigate(-1)}
      />
    )
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--shell-header-bg)] px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="min-w-0 flex flex-col gap-0.5">
        {!isEmbedded ? (
          <Link
            to={`/projects/${board.project_id}`}
            className="inline-flex w-fit items-center gap-1 text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {lt('Back to project')}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className={isEmbedded ? 'text-base font-semibold tracking-tight text-[var(--foreground)]' : 'text-sm font-semibold tracking-tight text-[var(--foreground)]'}>
            {board.name}
          </h2>
          {board.is_archived ? (
            <Badge variant="secondary" size="sm" dot>
              {lt('Archived')}
            </Badge>
          ) : null}
        </div>

        <p className="text-[10px] text-[var(--muted)]">
          {`${boardStats.columnCount} ${lt('columns')} · ${boardStats.cardCount} ${lt('cards')}`}
        </p>
      </div>

      {!isReadOnlyBoard ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddColumnOpen(true)}
            leftIcon={(
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
            )}
          >
            {lt('Add column')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditBoardOpen(true)}>
            {lt('Edit')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteBoard}>
            {lt('Delete')}
          </Button>
        </div>
      ) : null}
    </div>
  )

  const content = board.columns.length === 0 ? (
    <div className={isEmbedded ? 'p-6' : 'flex flex-1 items-center justify-center'}>
      <StateBlock
        tone="empty"
        eyebrow={lt('No boards')}
        title={lt('No columns yet')}
        description={
          isReadOnlyBoard
            ? lt('This board has no visible columns yet.')
            : lt('Add your first column to start organizing cards.')
        }
        actionLabel={!isReadOnlyBoard ? lt('Add column') : undefined}
        onAction={!isReadOnlyBoard ? () => setIsAddColumnOpen(true) : undefined}
      />
    </div>
  ) : (
    <div
      className={isEmbedded ? 'flex-1 min-h-0 overflow-hidden boards-section' : 'overflow-hidden boards-section'}
      style={!isEmbedded ? { height: 'calc(100vh - 162px)' } : undefined}
    >
      <KanbanBoard
        columns={board.columns}
        members={allUsers}
        onMoveCard={handleMoveCard}
        onMoveColumn={handleMoveColumn}
        onOpenAddCardModal={(columnId) => setAddCardState({ columnId })}
        onEditCard={(card) => setEditCardState({ card })}
        onDeleteCard={handleDeleteCard}
        onClickCard={openCardDetail}
        onEditColumn={(column) => setEditColumnState({ column })}
        onDeleteColumn={handleDeleteColumn}
        onAddColumn={() => setIsAddColumnOpen(true)}
        readOnly={isReadOnlyBoard}
      />
    </div>
  )

  return (
    <>
      {isEmbedded ? (
        <div className="flex-1 flex flex-col min-h-0">
          {content}
        </div>
      ) : (
        <div className="flex flex-col md:-mx-6 lg:-mx-8">
          {header}
          {content}
        </div>
      )}

      {!isReadOnlyBoard ? (
        <>
          <BoardFormModal
            open={isEditBoardOpen}
            onClose={() => setIsEditBoardOpen(false)}
            onSubmit={handleUpdateBoard}
            initial={board}
            title={lt('Edit board')}
            submitLabel={lt('Save changes')}
            isSubmitting={isBoardSubmitting}
          />

          <ColumnFormModal
            open={isAddColumnOpen}
            onClose={() => setIsAddColumnOpen(false)}
            onSubmit={handleCreateColumn}
            title={lt('Add column')}
            submitLabel={lt('Add column')}
            isSubmitting={isColumnSubmitting}
          />

          <ColumnFormModal
            open={editColumnState !== null}
            onClose={() => setEditColumnState(null)}
            onSubmit={handleUpdateColumn}
            initial={editColumnState?.column ?? null}
            title={lt('Edit column')}
            submitLabel={lt('Save changes')}
            isSubmitting={isColumnSubmitting}
          />

          <CardFormModal
            open={addCardState !== null}
            onClose={() => setAddCardState(null)}
            onSubmit={handleCreateCard}
            members={allUsers}
            title={lt('Create card')}
            submitLabel={lt('Create card')}
            isSubmitting={isCardSubmitting}
          />

          <CardFormModal
            open={editCardState !== null}
            onClose={() => setEditCardState(null)}
            onSubmit={handleUpdateCard}
            initial={editCardState?.card ?? null}
            members={allUsers}
            title={lt('Edit card')}
            submitLabel={lt('Save changes')}
            isSubmitting={isCardSubmitting}
          />
        </>
      ) : null}

      <CardDetailModal
        card={detailCard}
        open={detailCard !== null}
        onClose={closeCardDetail}
        onEdit={() => {
          if (detailCard && !isReadOnlyBoard) {
            setEditCardState({ card: detailCard })
            closeCardDetail()
          }
        }}
        onDelete={() => {
          if (detailCard && !isReadOnlyBoard) {
            closeCardDetail()
            void handleDeleteCard(detailCard.id)
          }
        }}
        boardName={board.name}
        canManage={!isReadOnlyBoard}
      />
    </>
  )
}
