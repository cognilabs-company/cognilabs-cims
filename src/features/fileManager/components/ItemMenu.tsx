import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../shared/lib/cn'

export type ItemMenuEntry = {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
  /** Draw a divider above this entry. */
  separated?: boolean
}

export type MenuAnchor = { top: number; left: number }

/**
 * The "…" / right-click menu of a folder or file. One menu at a time — the page owns which item it
 * belongs to and where it opens (the position is worked out when it opens, see `menuAnchor`).
 */
export function ItemMenu({ anchor, title, entries, onClose }: { anchor: MenuAnchor; title: string; entries: ItemMenuEntry[]; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus()
    const close = () => onClose()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [])
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowDown' ? (index + 1) % buttons.length
          : (index - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return createPortal(
    <div data-floating-layer="true" data-i18n-skip="true">
      <div
        className="fixed inset-0 z-[119]"
        aria-hidden="true"
        onPointerDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label={title}
        onKeyDown={onKeyDown}
        className="popover-panel fixed z-[120] w-[224px] overflow-hidden rounded-[14px] bg-[var(--surface)] p-1.5 text-[var(--foreground)] shadow-[var(--elev-lg)] ring-1 ring-[var(--border)]"
        style={anchor}
      >
        <p className="truncate px-2.5 pt-1 pb-1.5 text-[11.5px] font-semibold text-[var(--muted)]" title={title}>{title}</p>
        {entries.map((entry) => (
          <div key={entry.key}>
            {entry.separated ? <div className="mx-1.5 my-1 h-px bg-[var(--border)]" aria-hidden="true" /> : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                entry.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-colors select-none',
                entry.tone === 'danger'
                  ? 'text-[var(--danger-text)] hover:bg-[var(--danger-dim)] focus-visible:bg-[var(--danger-dim)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--input-surface)] focus-visible:bg-[var(--input-surface)]',
              )}
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center">{entry.icon}</span>
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
