import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
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
  /** Embedded mode: shown at the left of the board toolbar (the project's board tabs). */
  toolbarStart?: ReactNode
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
  toolbarStart,
}: BoardWorkspaceProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user, can } = useAuth()
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
  // Archived boards stay read-only; otherwise RBAC (projects.*) decides which actions show up.
  const isBoardLocked = !canManageProjects || Boolean(board?.is_archived)
  const canCreate = !isBoardLocked && can('projects', 'create')
  const canEdit = !isBoardLocked && can('projects', 'edit')
  const canDelete = !isBoardLocked && can('projects', 'delete')
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
    if (!can('projects', 'edit') || !board) {
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
    if (!can('projects', 'delete') || !board) {
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
    if (!can('projects', 'create') || !board || board.is_archived) {
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
    if (!can('projects', 'edit') || !editColumnState || board?.is_archived) {
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
    if (!can('projects', 'delete') || board?.is_archived) {
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
    if (!can('projects', 'create') || !addCardState || board?.is_archived) {
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
    if (!can('projects', 'edit') || !editCardState || board?.is_archived) {
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
    if (!can('projects', 'delete') || board?.is_archived) {
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
    if (!can('projects', 'edit') || board?.is_archived) {
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
    if (!can('projects', 'edit') || board?.is_archived) {
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

  const statsLabel = board
    ? `${t('projects.columns_n', '{{count}} columns', { count: boardStats.columnCount })} · ${t('projects.tasks_n', '{{count}} tasks', { count: boardStats.cardCount })}`
    : null

  const addColumnButton = canCreate ? (
    <Button variant="secondary" size="sm" onClick={() => setIsAddColumnOpen(true)} leftIcon={<Plus size={14} strokeWidth={2.2} />}>
      {t('projects.kanban.add_column', 'Add column')}
    </Button>
  ) : null

  const body = boardQuery.isLoading ? (
    <div className="flex h-full gap-3 overflow-hidden p-3 sm:p-4">
      {[5, 3, 4, 2].map((count, index) => (
        <div key={index} className="kb-col flex w-[calc(100vw-72px)] shrink-0 flex-col gap-2 self-start rounded-[16px] p-2 sm:w-[296px]">
          <Skeleton rounded="full" className="mx-1.5 my-1.5 h-3.5 w-24" />
          {Array.from({ length: count }).map((__, cardIndex) => (
            <Skeleton key={cardIndex} rounded="md" className="h-[76px] w-full" />
          ))}
        </div>
      ))}
    </div>
  ) : boardQuery.isError || !board ? (
    <div className="grid h-full place-items-center p-6">
      <StateBlock
        tone="error"
        eyebrow={lt('Error')}
        title={lt('Failed to load board')}
        description={lt('The board could not be found or an error occurred.')}
        actionLabel={isEmbedded ? undefined : lt('Go back')}
        onAction={isEmbedded ? undefined : () => navigate(-1)}
      />
    </div>
  ) : board.columns.length === 0 ? (
    <div className="grid h-full place-items-center p-6">
      <StateBlock
        tone="empty"
        eyebrow={lt('No boards')}
        title={lt('No columns yet')}
        description={canCreate ? lt('Add your first column to start organizing cards.') : lt('This board has no visible columns yet.')}
        actionLabel={canCreate ? t('projects.kanban.add_column', 'Add column') : undefined}
        onAction={canCreate ? () => setIsAddColumnOpen(true) : undefined}
      />
    </div>
  ) : (
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
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  )

  const layout = isEmbedded ? (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar: the project's board tabs on the left, this board's size and "Add column" on the right */}
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--border)] pr-3 pl-1.5 sm:pr-4 sm:pl-2.5">
        <div className="min-w-0 flex-1">{toolbarStart}</div>
        {statsLabel ? <span className="hidden shrink-0 text-[12.5px] text-[var(--muted)] tabular-nums lg:inline">{statsLabel}</span> : null}
        {board?.is_archived ? <Badge variant="secondary" size="sm" dot>{lt('Archived')}</Badge> : null}
        {addColumnButton ? <span className="hidden shrink-0 sm:inline-flex">{addColumnButton}</span> : null}
      </div>
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  ) : (
    <div className="flex h-[calc(100dvh-132px)] flex-col gap-4 lg:h-[var(--page-h)]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {board ? (
            <Link
              to={`/projects/${board.project_id}`}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              <ChevronLeft size={15} strokeWidth={2} />
              {lt('Back to project')}
            </Link>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] leading-7 font-semibold tracking-[-0.025em] text-[var(--foreground)]">{board?.name ?? ' '}</h1>
            {board?.is_archived ? <Badge variant="secondary" size="sm" dot>{lt('Archived')}</Badge> : null}
          </div>
          {statsLabel ? <p className="mt-0.5 text-[12.5px] text-[var(--muted)] tabular-nums">{statsLabel}</p> : null}
        </div>
        {board && (canCreate || canEdit || canDelete) ? (
          <div className="flex shrink-0 items-center gap-2">
            {addColumnButton}
            {canEdit ? <Button variant="ghost" size="sm" onClick={() => setIsEditBoardOpen(true)}>{lt('Edit')}</Button> : null}
            {canDelete ? <Button variant="danger" size="sm" onClick={handleDeleteBoard}>{lt('Delete')}</Button> : null}
          </div>
        ) : null}
      </header>
      <section className="min-h-0 flex-1 overflow-hidden rounded-[20px] bg-[var(--card)] ring-1 ring-[var(--border)]">{body}</section>
    </div>
  )

  if (!board) {
    return layout
  }

  return (
    <>
      {layout}

      {canEdit ? (
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
            open={editColumnState !== null}
            onClose={() => setEditColumnState(null)}
            onSubmit={handleUpdateColumn}
            initial={editColumnState?.column ?? null}
            title={lt('Edit column')}
            submitLabel={lt('Save changes')}
            isSubmitting={isColumnSubmitting}
          />

          <CardFormModal
            open={editCardState !== null}
            onClose={() => setEditCardState(null)}
            onSubmit={handleUpdateCard}
            initial={editCardState?.card ?? null}
            members={allUsers}
            title={t('projects.kanban.edit_task', 'Edit task')}
            submitLabel={lt('Save changes')}
            isSubmitting={isCardSubmitting}
          />
        </>
      ) : null}

      {canCreate ? (
        <>
          <ColumnFormModal
            open={isAddColumnOpen}
            onClose={() => setIsAddColumnOpen(false)}
            onSubmit={handleCreateColumn}
            title={lt('Add column')}
            submitLabel={lt('Add column')}
            isSubmitting={isColumnSubmitting}
          />

          <CardFormModal
            open={addCardState !== null}
            onClose={() => setAddCardState(null)}
            onSubmit={handleCreateCard}
            members={allUsers}
            title={t('projects.kanban.add_task', 'Add task')}
            submitLabel={t('projects.kanban.add_task', 'Add task')}
            isSubmitting={isCardSubmitting}
          />
        </>
      ) : null}

      <CardDetailModal
        card={detailCard}
        open={detailCard !== null}
        onClose={closeCardDetail}
        onEdit={() => {
          if (detailCard && canEdit) {
            setEditCardState({ card: detailCard })
            closeCardDetail()
          }
        }}
        onDelete={() => {
          if (detailCard && canDelete) {
            closeCardDetail()
            void handleDeleteCard(detailCard.id)
          }
        }}
        boardName={board.name}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </>
  )
}
