import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { Calendar, Paperclip } from 'lucide-react'
import { CSS } from '@dnd-kit/utilities'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { tonePill, type Tone } from '../../../shared/ui/tone'
import type { CardRecord } from '../../../shared/api/services/projects.service'
import { Avatar, AvatarGroup } from './Avatar'
import { formatProjectDateTime, getPriorityConfig, isDueDateOverdue, isDueDateSoon } from '../lib/format'

type KanbanCardProps = {
  card: CardRecord
  onEdit: (card: CardRecord) => void
  onDelete: (cardId: number) => void
  onClick: (card: CardRecord) => void
  isOverlay?: boolean
  readOnly?: boolean
}

type MetaChipTone = Extract<Tone, 'neutral' | 'warning' | 'danger'>

function MetaChip({
  icon,
  tone = 'neutral',
  children,
  className,
}: {
  icon?: ReactNode
  tone?: MetaChipTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold leading-none',
        tonePill(tone),
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function KanbanCard({ card, onEdit, onDelete, onClick, isOverlay, readOnly = false }: KanbanCardProps) {
  const lt = translateCurrentLiteral
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
    disabled: readOnly,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priorityConfig = getPriorityConfig()
  const priority = card.priority ? priorityConfig[card.priority] : null
  const overdue = card.due_date ? isDueDateOverdue(card.due_date) : false
  const soon = card.due_date ? isDueDateSoon(card.due_date) : false
  const images = Array.isArray(card.images)
    ? card.images
    : Array.isArray(card.files)
      ? card.files
      : []
  const assignees = Array.isArray(card.assignees) && card.assignees.length > 0
    ? card.assignees
    : card.assignee
      ? [card.assignee]
      : []
  const assigneeName = assignees
    .map((assignee) => [assignee.name, assignee.surname].filter(Boolean).join(' ').trim())
    .join(', ')
  const dueTone: MetaChipTone = overdue ? 'danger' : soon ? 'warning' : 'neutral'

  function stopCardAction(event: SyntheticEvent) {
    event.stopPropagation()
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(card)
    }
  }

  if (isDragging && !isOverlay) {
    return (
      <div
        data-slot="card"
        ref={setNodeRef}
        style={style}
        className="min-h-[112px] w-full rounded-[14px] border border-dashed border-[var(--border-hover)] bg-[var(--muted-surface)]"
      />
    )
  }

  return (
    <div
      data-slot="card"
      ref={setNodeRef}
      style={style}
      {...(!readOnly ? attributes : {})}
      {...(!readOnly ? listeners : {})}
      onClick={() => onClick(card)}
      onKeyDown={handleKeyDown}
      tabIndex={readOnly ? 0 : attributes.tabIndex}
      className={cn(
        'group relative flex cursor-pointer select-none flex-col gap-2.5 overflow-hidden rounded-[14px] p-3',
        'bg-[var(--surface)] text-[var(--foreground)]',
        'transition-[background-color,opacity] duration-150',
        'hover:bg-[var(--card-hover)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent-soft)]',
        isOverlay && 'shadow-[var(--elev-lg)]',
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {priority ? (
            <Badge variant={priority.badgeVariant} size="sm" dot className="max-w-full">
              {priority.label}
            </Badge>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[var(--muted-surface)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--muted)]">
              {lt('Task')}
            </span>
          )}
        </div>

        {!readOnly ? (
          <div
            className="relative z-20 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={stopCardAction}
            onPointerDown={stopCardAction}
            onMouseDown={stopCardAction}
          >
            <ActionsMenu
              label={lt('Card actions')}
              className="h-8 w-8 rounded-[9px]"
              items={[
                { label: lt('Edit card'), onSelect: () => onEdit(card) },
                { label: lt('Delete card'), onSelect: () => onDelete(card.id), tone: 'danger' },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)] line-clamp-2">
          {card.title}
        </p>

        {card.description ? (
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
            {card.description}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex items-end justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {card.due_date ? (
            <MetaChip
              tone={dueTone}
              icon={(
                <Calendar strokeWidth={1.8} className="h-3 w-3" aria-hidden="true" />
              )}
            >
              {formatProjectDateTime(card.due_date)}
            </MetaChip>
          ) : null}

          {images.length > 0 ? (
            <MetaChip
              className="tabular-nums"
              icon={(
                <Paperclip strokeWidth={1.8} className="h-3 w-3" aria-hidden="true" />
              )}
            >
              {images.length}
            </MetaChip>
          ) : null}
        </div>

        {assignees.length > 0 ? (
          assignees.length > 1 ? (
            <div
              className="inline-flex max-w-[55%] shrink-0 items-center gap-1.5 rounded-full bg-[var(--muted-surface)] px-1.5 py-1"
              title={assigneeName}
            >
              <AvatarGroup users={assignees} max={3} size="xs" className="pr-0.5" />
              <span className="truncate text-[11px] font-semibold leading-none text-[var(--muted-strong)]">
                {assigneeName}
              </span>
            </div>
          ) : (
            <div
              className="inline-flex max-w-[50%] shrink-0 items-center gap-1.5 rounded-full bg-[var(--muted-surface)] px-1.5 py-1"
              title={assigneeName}
            >
              <Avatar
                name={assignees[0]?.name}
                surname={assignees[0]?.surname}
                imageUrl={assignees[0]?.profile_image}
                size="xs"
                title={assigneeName}
              />
              <span className="truncate text-[11px] font-semibold leading-none text-[var(--muted-strong)]">
                {assigneeName}
              </span>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
