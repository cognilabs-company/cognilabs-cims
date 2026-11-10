import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { toneSurface, toneText, type Tone } from '../tone'

export type TaskRow = {
  key: string
  title: string
  meta?: ReactNode
  tag?: ReactNode
  tone?: Tone
  done?: boolean
}

type TaskListProps = {
  title: ReactNode
  tasks: TaskRow[]
  onToggle?: (key: string) => void
  onSelect?: (key: string) => void
  /** Shows a delete button on each row (on hover, always on touch screens). */
  onDelete?: (key: string) => void
  deleteLabel?: string
  /** false hides the leading checkbox (plain list rows). */
  checkable?: boolean
  action?: ReactNode
  emptyState?: ReactNode
  className?: string
  /** Extra classes for the rows container, e.g. a max height with scrolling. */
  listClassName?: string
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </svg>
  )
}

function Tick({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="#0E1525"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-opacity duration-150', visible ? 'opacity-100' : 'opacity-0')}
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function TaskList({
  title, tasks, onToggle, onSelect, onDelete, deleteLabel = 'Delete', checkable = true, action, emptyState, className, listClassName,
}: TaskListProps) {
  return (
    <div className={cn('flex flex-col gap-3.5 rounded-[24px] bg-[var(--card)] p-[22px]', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</span>
        {action}
      </div>

      {tasks.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className={cn('flex flex-col gap-2', listClassName)}>
          {tasks.map((task) => {
            const tone = task.tone ?? 'blue'

            return (
              <div
                key={task.key}
                className={cn(
                  'group/row flex w-full items-center gap-3 rounded-[16px] border p-3 transition-colors',
                  task.done
                    ? 'border-transparent bg-[var(--muted-surface)]'
                    : 'border-[var(--border)] bg-[var(--surface)]',
                )}
              >
                {checkable ? (
                <button
                  type="button"
                  onClick={onToggle ? () => onToggle(task.key) : undefined}
                  disabled={!onToggle}
                  aria-pressed={Boolean(task.done)}
                  aria-label={task.title}
                  className={cn(
                    'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] transition-colors',
                    task.done ? 'bg-[var(--lime)]' : 'border-[1.6px] border-[var(--control-border)] bg-[var(--surface)]',
                    onToggle ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <Tick visible={Boolean(task.done)} />
                </button>
                ) : null}

                <button
                  type="button"
                  onClick={onSelect ? () => onSelect(task.key) : undefined}
                  disabled={!onSelect}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-[3px] text-left',
                    onSelect ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'truncate text-[13.5px] font-semibold',
                      task.done ? 'text-[var(--caption)] line-through' : 'text-[var(--foreground)]',
                    )}
                  >
                    {task.title}
                  </span>
                  {task.meta ? (
                    <span className="truncate text-xs text-[var(--muted)]">{task.meta}</span>
                  ) : null}
                </button>

                {task.tag ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-[9px] px-2 py-1 text-[11.5px] font-semibold',
                      toneSurface[tone],
                      toneText[tone],
                    )}
                  >
                    {task.tag}
                  </span>
                ) : null}

                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(task.key)}
                    aria-label={`${deleteLabel}: ${task.title}`}
                    title={deleteLabel}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] opacity-0 transition hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger-text)]/30 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <TrashGlyph />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
