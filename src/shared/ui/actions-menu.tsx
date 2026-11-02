import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'

export type ActionsMenuItem = {
  label: string
  onSelect: () => void
  tone?: 'default' | 'danger'
  icon?: ReactNode
}

type ActionsMenuProps = {
  items: ActionsMenuItem[]
  label?: ReactNode
  triggerVariant?: 'icon' | 'button'
  className?: string
}

type MenuPosition = {
  top: number
  left: number
}

function getMenuPosition(trigger: HTMLElement, itemCount: number): MenuPosition {
  const rect = trigger.getBoundingClientRect()
  const menuWidth = 220
  const menuHeight = itemCount * 40 + 12
  const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
  const openAbove = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top - menuHeight - 8 >= 8
  const top = openAbove
    ? Math.max(8, rect.top - menuHeight - 8)
    : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8)

  return { top, left }
}

const triggerBase =
  'inline-flex items-center justify-center rounded-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'

export function ActionsMenu({ items, label, triggerVariant = 'icon', className }: ActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)

  const openMenu = () => {
    if (triggerRef.current) {
      setPosition(getMenuPosition(triggerRef.current, items.length))
      setIsOpen(true)
    }
  }

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return
      }

      setPosition(getMenuPosition(triggerRef.current, items.length))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, items.length])

  if (items.length === 0) return null

  if (items.length === 1) {
    const item = items[0]
    return (
      <button
        type="button"
        onClick={item.onSelect}
        title={typeof label === 'string' ? label : item.label}
        className={cn(
          triggerBase,
          'h-9 px-3.5 text-[13px] font-semibold',
          item.tone === 'danger'
            ? 'bg-[var(--danger-dim)] text-[var(--danger-text)] hover:bg-[#FADFDF]'
            : 'border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
          className,
        )}
      >
        {item.icon && <span className="mr-2 flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span>}
        {item.label}
      </button>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={openMenu}
        title={typeof label === 'string' ? label : undefined}
        className={cn(
          triggerBase,
          triggerVariant === 'icon'
            ? 'h-9 w-9 text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]'
            : 'h-9 border border-[var(--border-hover)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]',
          className,
        )}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
          <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && position && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[119]" onClick={() => setIsOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="fixed z-[120] min-w-[220px] overflow-hidden rounded-[14px] bg-[var(--surface)] p-1.5 text-[var(--foreground)] shadow-[var(--elev-lg)] ring-1 ring-[var(--border)]"
                style={position}
              >
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false)
                      item.onSelect()
                    }}
                    className={cn(
                      'relative flex w-full items-center rounded-[9px] px-2.5 py-2 text-sm font-medium outline-none transition-colors select-none',
                      item.tone === 'danger'
                        ? 'text-[var(--danger-text)] hover:bg-[var(--danger-dim)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
                    )}
                  >
                    {item.icon && <span className="mr-2 flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span>}
                    {item.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
