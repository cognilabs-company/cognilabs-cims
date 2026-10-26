import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
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

type MetaChipTone = 'neutral' | 'warning' | 'danger'

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
        'inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium leading-none',
        tone === 'danger' && 'border-[var(--danger-border)] bg-[var(--danger-dim)] text-[var(--danger-text)]',
        tone === 'warning' && 'border-[var(--warning-border)] bg-[var(--warning-dim)] text-[var(--warning-text)]',
        tone === 'neutral' && 'border-[var(--border)] bg-[var(--accent-soft)] text-[var(--muted-strong)]',
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
        className="min-h-[112px] w-full rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--accent-soft)]/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
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
        'group relative flex cursor-pointer select-none flex-col gap-2.5 overflow-hidden rounded-xl border p-2.5',
        'bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] border-[var(--border)] text-[var(--foreground)]',
        'shadow-[var(--shadow-sm)] transition-[transform,border-color,box-shadow,background-color,opacity] duration-150',
        'hover:-translate-y-px hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)]',
        'active:translate-y-0 active:scale-[0.995]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        isOverlay && 'rotate-[1.5deg] border-[var(--border-hover)] shadow-[var(--shadow-lg)] opacity-95',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.06),transparent_72%)] opacity-70" />

      <div className="relative z-10 flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {priority ? (
            <Badge
              variant={priority.badgeVariant}
              size="sm"
              dot
              className="max-w-full rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.01em]"
            >
              {priority.label}
            </Badge>
          ) : (
            <span className="inline-flex h-4 items-center rounded border border-transparent px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {lt('Task')}
            </span>
          )}
        </div>

        {!readOnly ? (
          <div
            className="relative z-20 shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={stopCardAction}
            onPointerDown={stopCardAction}
            onMouseDown={stopCardAction}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--accent-soft)] transition-colors">
              <ActionsMenu
                label={lt('Card actions')}
                items={[
                  { label: lt('Edit card'), onSelect: () => onEdit(card) },
                  { label: lt('Delete card'), onSelect: () => onDelete(card.id), tone: 'danger' },
                ]}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 space-y-1.5">
        <p className="text-[13px] font-semibold leading-tight tracking-tight text-[var(--foreground)] line-clamp-2">
          {card.title}
        </p>

        {card.description ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
            {card.description}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex items-end justify-between gap-2 border-t border-[var(--border)]/50 pt-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {card.due_date ? (
            <MetaChip
              tone={dueTone}
              className="h-5 px-1.5 text-[9px]"
              icon={(
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                   <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
                </svg>
              )}
            >
              {formatProjectDateTime(card.due_date)}
            </MetaChip>
          ) : null}

          {images.length > 0 ? (
            <MetaChip
              className="h-5 px-1.5 text-[9px]"
              icon={(
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                   <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
            >
              {images.length}
            </MetaChip>
          ) : null}
        </div>

        {assignees.length > 0 ? (
          assignees.length > 1 ? (
            <div
              className="inline-flex max-w-[55%] shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-1 py-0.5 shadow-sm"
              title={assigneeName}
            >
              <AvatarGroup users={assignees} max={3} size="xs" className="pr-0.5" />
              <span className="truncate text-[9px] font-bold uppercase tracking-tighter text-[var(--muted-strong)]">
                {assigneeName}
              </span>
            </div>
          ) : (
            <div
              className="inline-flex max-w-[50%] shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-1 py-0.5 shadow-sm"
              title={assigneeName}
            >
              <Avatar
                name={assignees[0]?.name}
                surname={assignees[0]?.surname}
                imageUrl={assignees[0]?.profile_image}
                size="xs"
                title={assigneeName}
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate text-[9px] font-bold uppercase tracking-tighter text-[var(--muted-strong)]">
                {assigneeName}
              </span>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
