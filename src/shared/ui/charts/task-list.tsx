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
  action?: ReactNode
  emptyState?: ReactNode
  className?: string
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

export function TaskList({ title, tasks, onToggle, onSelect, action, emptyState, className }: TaskListProps) {
  return (
    <div className={cn('flex flex-col gap-3.5 rounded-[24px] bg-[var(--card)] p-[22px]', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</span>
        {action}
      </div>

      {tasks.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const tone = task.tone ?? 'blue'

            return (
              <div
                key={task.key}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[16px] border p-3 transition-colors',
                  task.done
                    ? 'border-transparent bg-[var(--muted-surface)]'
                    : 'border-[#EEF0F4] bg-[var(--surface)]',
                )}
              >
                <button
                  type="button"
                  onClick={onToggle ? () => onToggle(task.key) : undefined}
                  disabled={!onToggle}
                  aria-pressed={Boolean(task.done)}
                  aria-label={task.title}
                  className={cn(
                    'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] transition-colors',
                    task.done ? 'bg-[var(--lime)]' : 'border-[1.6px] border-[#D3D7E0] bg-[var(--surface)]',
                    onToggle ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <Tick visible={Boolean(task.done)} />
                </button>

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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
