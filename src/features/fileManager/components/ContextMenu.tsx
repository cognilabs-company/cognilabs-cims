import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeftIcon, CaretRightIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'

export type MenuAction = {
  kind?: 'action'
  id: string
  label: string
  icon?: ReactNode
  /** Shown on the right ("F2", "Del", "Ctrl+A"). */
  shortcut?: string
  disabled?: boolean
  /** Tooltip, e.g. why the entry is disabled. */
  hint?: string
  danger?: boolean
  /** The default action, drawn bold (like "Open" in Windows). */
  strong?: boolean
  check?: 'radio' | 'check'
  checked?: boolean
  onSelect: () => void
}

export type MenuSubmenu = { kind: 'submenu'; id: string; label: string; icon?: ReactNode; disabled?: boolean; entries: MenuEntry[] }

export type MenuEntry =
  | MenuAction
  | MenuSubmenu
  | { kind: 'separator'; id: string }
  | { kind: 'label'; id: string; label: string }

/** A pointer position (right click) or a button the menu drops down from. */
export type MenuAnchor = { x: number; y: number } | { rect: DOMRect; align?: 'start' | 'end' }

type Placement =
  | { type: 'point'; x: number; y: number }
  | { type: 'below'; rect: DOMRect; align: 'start' | 'end' }
  | { type: 'side'; rect: DOMRect }

const MARGIN = 8
const ITEM_SELECTOR = '[data-menu-item]:not([aria-disabled="true"])'

/** Puts a panel next to its anchor and keeps it inside the viewport (flips left / up when needed). */
function placePanel(panel: HTMLElement, placement: Placement) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  panel.style.maxHeight = `${vh - MARGIN * 2}px`
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  let left: number
  let top: number
  let originX = 'left'
  let originY = 'top'

  if (placement.type === 'point') {
    left = placement.x
    top = placement.y
    if (left + width > vw - MARGIN) {
      left = placement.x - width
      originX = 'right'
    }
    if (top + height > vh - MARGIN) {
      top = placement.y - height >= MARGIN ? placement.y - height : vh - MARGIN - height
      originY = 'bottom'
    }
  } else if (placement.type === 'below') {
    const { rect } = placement
    left = placement.align === 'end' ? rect.right - width : rect.left
    originX = placement.align === 'end' ? 'right' : 'left'
    top = rect.bottom + 4
    if (top + height > vh - MARGIN && rect.top - 4 - height >= MARGIN) {
      top = rect.top - 4 - height
      originY = 'bottom'
    }
  } else {
    const { rect } = placement
    left = rect.right - 3
    top = rect.top - 5
    if (left + width > vw - MARGIN) {
      left = rect.left - width + 3
      originX = 'right'
    }
  }

  panel.style.left = `${Math.round(Math.min(Math.max(MARGIN, left), vw - MARGIN - width))}px`
  panel.style.top = `${Math.round(Math.min(Math.max(MARGIN, top), vh - MARGIN - height))}px`
  panel.style.transformOrigin = `${originY} ${originX}`
}

function enabledItems(panel: HTMLElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>(`:scope > ${ITEM_SELECTOR}, :scope > [data-menu-group] > ${ITEM_SELECTOR}`) ?? [])
}

/** First letter jumps to the next entry starting with it (like native menus). */
function typeahead(items: HTMLElement[], current: number, key: string) {
  const letter = key.toLowerCase()
  for (let step = 1; step <= items.length; step += 1) {
    const item = items[(current + step) % items.length]
    if ((item.dataset.label ?? '').toLowerCase().startsWith(letter)) return item
  }
  return null
}

/**
 * Explorer context menu: right-click menus, the command bar drop-downs and the "⋯" buttons.
 * Submenus open on hover or →, the whole thing is keyboard driven (↑ ↓ → ← Home End Enter Esc and
 * first letters), it stays inside the viewport, and on phones it becomes a bottom sheet.
 * One menu at a time; the parent passes a stable `onClose`.
 */
export function ContextMenu({
  anchor,
  entries,
  label,
  title,
  trigger = null,
  focusFirst = false,
  onClose,
}: {
  anchor: MenuAnchor
  entries: MenuEntry[]
  /** Accessible name of the menu. */
  label: string
  /** Heading of the phone sheet (defaults to `label`). */
  title?: string
  /** The button that opened it: pressing it again toggles instead of re-opening. */
  trigger?: HTMLElement | null
  /** Opened from the keyboard: highlight the first entry right away. */
  focusFirst?: boolean
  onClose: () => void
}) {
  const sheet = useMediaQuery('(max-width: 639px)')
  const placement = useMemo<Placement>(() => (
    'rect' in anchor ? { type: 'below', rect: anchor.rect, align: anchor.align ?? 'start' } : { type: 'point', x: anchor.x, y: anchor.y }
  ), [anchor])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-fx-menu]')) return
      if (trigger && target instanceof Node && trigger.contains(target)) return
      onClose()
    }
    const onScroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-fx-menu]')) return
      onClose()
    }
    const close = () => onClose()
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      // Focus goes back to where the menu was opened from — unless something else (a dialog, an input) took it.
      const active = document.activeElement
      if (previous?.isConnected && (!active || active === document.body)) previous.focus({ preventScroll: true })
    }
  }, [onClose, trigger])

  if (sheet) return createPortal(<MenuSheet entries={entries} label={label} title={title ?? label} onClose={onClose} />, document.body)
  return createPortal(
    <MenuPanel entries={entries} placement={placement} depth={0} label={label} focusFirst={focusFirst} onCloseAll={onClose} />,
    document.body,
  )
}

type OpenSub = { id: string; placement: Placement; focusFirst: boolean }

function MenuPanel({
  entries,
  placement,
  depth,
  label,
  focusFirst,
  onCloseAll,
  onBack,
  onPanelEnter,
}: {
  entries: MenuEntry[]
  placement: Placement
  depth: number
  label: string
  focusFirst: boolean
  onCloseAll: () => void
  onBack?: () => void
  onPanelEnter?: () => void
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [sub, setSub] = useState<OpenSub | null>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    placePanel(panel, placement)
    // A submenu opened by hovering leaves the keyboard in its parent (like native menus).
    if (focusFirst) (enabledItems(panel)[0] ?? panel).focus({ preventScroll: true })
    else if (depth === 0) panel.focus({ preventScroll: true })
  }, [depth, focusFirst, placement])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const openSub = (id: string, element: HTMLElement, focus: boolean) => {
    window.clearTimeout(timer.current)
    setSub({ id, placement: { type: 'side', rect: element.getBoundingClientRect() }, focusFirst: focus })
  }

  const closeSub = (refocus: boolean) => {
    const id = sub?.id
    setSub(null)
    if (refocus && id) panelRef.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
  }

  function activate(entry: MenuEntry, element: HTMLElement, fromKeyboard: boolean) {
    if (entry.kind === 'separator' || entry.kind === 'label' || entry.disabled) return
    if (entry.kind === 'submenu') {
      openSub(entry.id, element, fromKeyboard)
      return
    }
    onCloseAll()
    entry.onSelect()
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Keys typed in an open submenu reach this panel too (React bubbles through portals).
    if (!(event.target instanceof Element) || event.target.closest('[data-fx-menu]') !== event.currentTarget) return
    const items = enabledItems(panelRef.current)
    const index = items.indexOf(document.activeElement as HTMLElement)
    const focused = index >= 0 ? items[index] : null
    const focusedEntry = focused ? entries.find((entry) => entry.id === focused.dataset.entry) : undefined
    let handled = true
    switch (event.key) {
      case 'ArrowDown':
        items[(index + 1) % items.length]?.focus()
        break
      case 'ArrowUp':
        items[index <= 0 ? items.length - 1 : index - 1]?.focus()
        break
      case 'Home':
      case 'PageUp':
        items[0]?.focus()
        break
      case 'End':
      case 'PageDown':
        items[items.length - 1]?.focus()
        break
      case 'ArrowRight':
        if (focused && focusedEntry?.kind === 'submenu') openSub(focusedEntry.id, focused, true)
        break
      case 'ArrowLeft':
        if (depth > 0) onBack?.()
        break
      case 'Escape':
        if (depth > 0) onBack?.()
        else onCloseAll()
        break
      case 'Tab':
        onCloseAll()
        break
      case 'Enter':
      case ' ':
        if (focused && focusedEntry) activate(focusedEntry, focused, true)
        break
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(items, index, event.key)?.focus()
        else handled = false
    }
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const subEntry = sub ? entries.find((entry): entry is MenuSubmenu => entry.kind === 'submenu' && entry.id === sub.id) : undefined

  return (
    <>
      <div
        ref={panelRef}
        role="menu"
        aria-label={label}
        tabIndex={-1}
        data-fx-menu=""
        data-i18n-skip="true"
        data-depth={depth}
        className="fx-menu"
        style={{ left: 0, top: 0 }}
        onKeyDown={onKeyDown}
        onPointerEnter={onPanelEnter}
        onContextMenu={(event) => event.preventDefault()}
      >
        {entries.map((entry) => {
          if (entry.kind === 'separator') return <div key={entry.id} role="separator" className="fx-menu__sep" />
          if (entry.kind === 'label') return <p key={entry.id} className="fx-menu__label">{entry.label}</p>
          const expanded = entry.kind === 'submenu' && sub?.id === entry.id
          return (
            <MenuItemButton
              key={entry.id}
              entry={entry}
              expanded={expanded}
              onActivate={(element) => activate(entry, element, false)}
              onHover={(element) => {
                window.clearTimeout(timer.current)
                if (entry.kind === 'submenu' && !entry.disabled) {
                  if (sub?.id !== entry.id) timer.current = window.setTimeout(() => openSub(entry.id, element, false), 110)
                } else if (sub) {
                  timer.current = window.setTimeout(() => setSub(null), 240)
                }
              }}
            />
          )
        })}
      </div>
      {sub && subEntry
        ? createPortal(
          <MenuPanel
            key={sub.id}
            entries={subEntry.entries}
            placement={sub.placement}
            depth={depth + 1}
            label={subEntry.label}
            focusFirst={sub.focusFirst}
            onCloseAll={onCloseAll}
            onBack={() => closeSub(true)}
            onPanelEnter={() => window.clearTimeout(timer.current)}
          />,
          document.body,
        )
        : null}
    </>
  )
}

function MenuItemButton({
  entry,
  expanded,
  large = false,
  onActivate,
  onHover,
}: {
  entry: MenuAction | MenuSubmenu
  expanded: boolean
  large?: boolean
  onActivate: (element: HTMLElement) => void
  onHover?: (element: HTMLElement) => void
}) {
  const action = entry.kind === 'submenu' ? null : entry
  const role = action?.check === 'radio' ? 'menuitemradio' : action?.check === 'check' ? 'menuitemcheckbox' : 'menuitem'
  return (
    <button
      type="button"
      role={role}
      tabIndex={-1}
      data-menu-item=""
      data-entry={entry.id}
      data-label={entry.label}
      data-danger={action?.danger || undefined}
      data-strong={action?.strong || undefined}
      data-large={large || undefined}
      aria-disabled={entry.disabled || undefined}
      aria-checked={action?.check ? Boolean(action.checked) : undefined}
      aria-haspopup={entry.kind === 'submenu' ? 'menu' : undefined}
      aria-expanded={entry.kind === 'submenu' ? expanded : undefined}
      title={action?.hint}
      className="fx-mi"
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        const element = event.currentTarget
        if (!entry.disabled) element.focus({ preventScroll: true })
        else if (document.activeElement instanceof HTMLElement && element.parentElement?.contains(document.activeElement)) element.parentElement.focus({ preventScroll: true })
        onHover?.(element)
      }}
      onClick={(event) => onActivate(event.currentTarget)}
    >
      <span className="fx-mi__icon" aria-hidden="true">
        {action?.check && action.checked
          ? action.check === 'radio' ? <span className="fx-mi__dot" /> : <CheckIcon size={14} weight="bold" />
          : entry.icon ?? null}
      </span>
      <span className="fx-mi__text">{entry.label}</span>
      {action?.shortcut ? <kbd className="fx-mi__kbd">{action.shortcut}</kbd> : null}
      {entry.kind === 'submenu' ? <CaretRightIcon size={12} weight="bold" className="fx-mi__caret" aria-hidden="true" /> : null}
    </button>
  )
}

/** Phones: the same entries as a bottom sheet; a submenu slides in with a back button. */
function MenuSheet({ entries, label, title, onClose }: { entries: MenuEntry[]; label: string; title: string; onClose: () => void }) {
  const { t } = useLocale()
  const [stack, setStack] = useState<MenuSubmenu[]>([])
  const level = stack[stack.length - 1]
  const shown = level ? level.entries : entries
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    listRef.current?.focus({ preventScroll: true })
  }, [level])

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = enabledItems(listRef.current)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (event.key === 'ArrowUp') items[index <= 0 ? items.length - 1 : index - 1]?.focus()
    else if (event.key === 'Escape' || (event.key === 'ArrowLeft' && stack.length)) {
      if (stack.length) setStack(stack.slice(0, -1))
      else onClose()
    } else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div data-fx-menu="" data-i18n-skip="true" className="fx-sheet-wrap" onContextMenu={(event) => event.preventDefault()}>
      <div className="fx-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div role="menu" aria-label={label} className="fx-sheet" onKeyDown={onKeyDown}>
        <div className="fx-sheet__grip" aria-hidden="true" />
        <header className="fx-sheet__head">
          {stack.length ? (
            <button type="button" className="fx-sheet__icon-btn" onClick={() => setStack(stack.slice(0, -1))} aria-label={t('files.back', 'Back')}>
              <CaretLeftIcon size={18} weight="bold" />
            </button>
          ) : null}
          <p className="fx-sheet__title">{level?.label ?? title}</p>
          <button type="button" className="fx-sheet__icon-btn" onClick={onClose} aria-label={t('files.close', 'Close')}>
            <XIcon size={17} weight="bold" />
          </button>
        </header>
        <div key={level?.id ?? 'root'} ref={listRef} tabIndex={-1} className="fx-sheet__list" data-menu-group="">
          {shown.map((entry) => {
            if (entry.kind === 'separator') return <div key={entry.id} role="separator" className="fx-menu__sep" />
            if (entry.kind === 'label') return <p key={entry.id} className="fx-menu__label">{entry.label}</p>
            return (
              <MenuItemButton
                key={entry.id}
                entry={entry}
                expanded={false}
                large
                onActivate={() => {
                  if (entry.disabled) return
                  if (entry.kind === 'submenu') setStack([...stack, entry])
                  else {
                    onClose()
                    entry.onSelect()
                  }
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
