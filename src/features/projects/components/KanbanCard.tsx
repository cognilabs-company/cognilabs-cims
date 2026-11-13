import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, SyntheticEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import type { CardPriority, CardRecord } from '../../../shared/api/services/projects.service'
import { Avatar } from './Avatar'
import { formatProjectDateTime, formatProjectDueShort, getPriorityConfig, isDueDateOverdue, isDueDateSoon } from '../lib/format'

type KanbanCardProps = {
  card: CardRecord
  onEdit: (card: CardRecord) => void
  onDelete: (cardId: number) => void
  onClick: (card: CardRecord) => void
  /** RBAC projects.edit — drag & drop and the "Edit card" menu item. */
  canEdit?: boolean
  /** RBAC projects.delete — the "Delete card" menu item. */
  canDelete?: boolean
}

/**
 * The "⋯" menu of a card or column. With a single permitted action the shared menu turns into a text
 * button, which does not fit in a card corner, so a lone action becomes an icon button instead.
 */
export function KanbanMenu({ items, label, className }: { items: ActionsMenuItem[]; label: string; className?: string }) {
  if (items.length === 1) {
    const item = items[0]
    return (
      <button
        type="button"
        onClick={item.onSelect}
        aria-label={item.label}
        title={item.label}
        className={cn(
          'grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)]',
          item.tone === 'danger' ? 'hover:text-[var(--danger-text)]' : 'hover:text-[var(--foreground)]',
          className,
        )}
      >
        {item.tone === 'danger' ? <Trash2 size={14} strokeWidth={2} /> : <Pencil size={14} strokeWidth={2} />}
      </button>
    )
  }
  return <ActionsMenu label={label} items={items} className={className} />
}

const PRIORITY_LEVEL: Record<CardPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 }

/** Signal bars: one bar for low, two for medium, three for high; a filled "!" tile for urgent. */
function PriorityIcon({ priority, color }: { priority: CardPriority; color: string }) {
  const level = PRIORITY_LEVEL[priority]
  if (level === 4) {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
        <rect width="12" height="12" rx="3" fill={color} />
        <path d="M6 3v3.6M6 8.6v.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={1 + index * 3.75}
          y={8 - index * 3}
          width="2.5"
          height={3 + index * 3}
          rx="0.9"
          fill={index < level ? color : 'currentColor'}
          opacity={index < level ? 1 : 0.22}
        />
      ))}
    </svg>
  )
}

function Chip({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'warning' | 'danger'; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] max-w-full items-center gap-1 rounded-[6px] px-1.5 text-[11px] leading-none font-medium whitespace-nowrap tabular-nums',
        tone === 'danger'
          ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]'
          : tone === 'warning'
            ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]'
            : 'kb-chip text-[var(--muted-strong)]',
      )}
    >
      {children}
    </span>
  )
}

/** What a card shows: title, a short description, then priority, due date, files and the assignees. */
function CardContent({ card, reserveMenuSpace }: { card: CardRecord; reserveMenuSpace: boolean }) {
  const priority = card.priority ? getPriorityConfig()[card.priority] : null
  const overdue = card.due_date ? isDueDateOverdue(card.due_date) : false
  const soon = !overdue && card.due_date ? isDueDateSoon(card.due_date) : false
  const images = Array.isArray(card.images) ? card.images : Array.isArray(card.files) ? card.files : []
  const assignees = Array.isArray(card.assignees) && card.assignees.length > 0 ? card.assignees : card.assignee ? [card.assignee] : []
  const assigneeNames = assignees.map((assignee) => [assignee.name, assignee.surname].filter(Boolean).join(' ').trim()).join(', ')
  const visibleAssignees = assignees.slice(0, 3)
  const hasFooter = Boolean(priority || card.due_date || images.length > 0 || assignees.length > 0)

  return (
    <>
      <p className={cn('text-[13.5px] leading-[19px] font-medium tracking-[-0.005em] break-words line-clamp-3', reserveMenuSpace && 'pr-6')}>
        {card.title}
      </p>

      {card.description ? (
        <p className="mt-1 line-clamp-2 text-[12px] leading-[17px] break-words text-[var(--muted)]">{card.description}</p>
      ) : null}

      {hasFooter ? (
        <div className="mt-2.5 flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {priority && card.priority ? (
              <Chip title={priority.label}>
                <PriorityIcon priority={card.priority} color={priority.color} />
                {priority.label}
              </Chip>
            ) : null}
            {card.due_date ? (
              <Chip tone={overdue ? 'danger' : soon ? 'warning' : 'neutral'} title={formatProjectDateTime(card.due_date)}>
                <CalendarDays size={12} strokeWidth={2.2} className="shrink-0" />
                {formatProjectDueShort(card.due_date)}
              </Chip>
            ) : null}
            {images.length > 0 ? (
              <span className="inline-flex h-[22px] items-center gap-0.5 px-1 text-[11px] font-medium text-[var(--muted)] tabular-nums">
                <Paperclip size={12} strokeWidth={2.2} />
                {images.length}
              </span>
            ) : null}
          </div>

          {assignees.length > 0 ? (
            <span className="flex shrink-0 items-center" title={assigneeNames}>
              {visibleAssignees.map((assignee, index) => (
                <span key={assignee.id} className="relative rounded-full ring-2 ring-[var(--kb-card)]" style={{ marginLeft: index ? -3 : 0, zIndex: visibleAssignees.length - index }}>
                  <Avatar name={assignee.name} surname={assignee.surname} imageUrl={assignee.profile_image} size="xs" className="h-[22px] w-[22px] text-[9px]" />
                </span>
              ))}
              {assignees.length > visibleAssignees.length ? (
                <span className="relative grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[var(--input-surface)] px-1 text-[9.5px] font-semibold text-[var(--muted-strong)] ring-2 ring-[var(--kb-card)]" style={{ marginLeft: -3 }}>
                  +{assignees.length - visibleAssignees.length}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

const cardClassName = 'kb-card group relative flex flex-col rounded-[12px] p-3 text-[var(--foreground)] select-none'

/**
 * The card that follows the pointer while dragging. It is only a picture: it must not register with
 * dnd-kit, or it would take over the dragged card's id and the board would re-measure itself forever.
 */
export function KanbanCardPreview({ card, lifted = true }: { card: CardRecord; lifted?: boolean }) {
  return (
    <div data-slot="card" className={cn(cardClassName, lifted && 'kb-card--lifted rotate-[1.5deg] cursor-grabbing')}>
      <CardContent card={card} reserveMenuSpace={false} />
    </div>
  )
}

export function KanbanCard({ card, onEdit, onDelete, onClick, canEdit = false, canDelete = false }: KanbanCardProps) {
  const lt = translateCurrentLiteral
  const cardActions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: lt('Edit card'), onSelect: () => onEdit(card) }] : []),
    ...(canDelete ? [{ label: lt('Delete card'), onSelect: () => onDelete(card.id), tone: 'danger' as const }] : []),
  ]
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function stopCardAction(event: SyntheticEvent) {
    event.stopPropagation()
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(card)
    }
  }

  if (isDragging) {
    return (
      <div
        data-slot="card"
        ref={setNodeRef}
        style={style}
        className="min-h-[76px] w-full rounded-[12px] border border-dashed border-[var(--blue-border)] bg-[var(--blue-dim)] opacity-80"
      />
    )
  }

  return (
    <div
      data-slot="card"
      ref={setNodeRef}
      style={style}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
      onClick={() => onClick(card)}
      onKeyDown={handleKeyDown}
      tabIndex={canEdit ? attributes.tabIndex : 0}
      className={cn(cardClassName, 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none')}
    >
      <CardContent card={card} reserveMenuSpace={cardActions.length > 0} />

      {cardActions.length > 0 ? (
        <div
          className="absolute top-2 right-2 z-20 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={stopCardAction}
          onPointerDown={stopCardAction}
          onMouseDown={stopCardAction}
        >
          <KanbanMenu label={lt('Card actions')} items={cardActions} className="h-7 w-7 rounded-[8px] bg-[var(--kb-card)]" />
        </div>
      ) : null}
    </div>
  )
}
