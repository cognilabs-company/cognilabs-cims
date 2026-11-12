import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { CaretDownIcon, CaretUpIcon, CheckIcon, DotsThreeIcon, LockSimpleIcon, MinusIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { FmItem } from '../../../shared/api/services/fileManager.service'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { formatShortDate, formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { dropKey, isLocked, typeLabel, type DropHandlers, type DropTarget, type SortKey, type SortState, type ViewMode } from '../lib/explorer'
import { formatBytes, itemKey, kindOf, type Translate } from '../lib/items'
import type { MenuAnchor } from './ContextMenu'
import { InlineRename } from './InlineRename'
import { ItemGlyph } from './ItemGlyph'

export type SelectionChange = { keys: Set<string>; anchor: string | null; focus: string | null }

type Band = { left: number; top: number; width: number; height: number }

type Marquee = {
  originX: number
  originY: number
  clientX: number
  clientY: number
  base: ReadonlySet<string>
  additive: boolean
  rects: { key: string; left: number; top: number; right: number; bottom: number }[]
  started: boolean
  frame: number
  lastHits: string
}

const GLYPH_SIZE: Record<ViewMode, number> = { large: 72, medium: 40, details: 20 }

function folderMeta(item: FmItem, t: Translate) {
  if (item.kind !== 'folder') return formatBytes(item.size)
  if (item.fileCount !== null || item.folderCount !== null) {
    return t('files.items_count', '{{count}} items', { count: (item.fileCount ?? 0) + (item.folderCount ?? 0) })
  }
  return ''
}

/**
 * The right-hand pane of the explorer: large / medium icons or the details list.
 * Desktop: click selects, Ctrl/⌘ toggles, Shift selects a range, dragging on empty space draws a
 * selection rectangle, double-click / Enter opens, arrows / Home / End / letters move the focus,
 * right-click opens the item (or empty space) menu, items can be dragged onto folders.
 * Touch: tap opens, long press selects, check boxes and "⋯" buttons are always shown.
 */
export function ItemsPane({
  items,
  view,
  sort,
  onSort,
  showLocation,
  selected,
  anchorKey,
  focusKey,
  onSelect,
  checkboxes,
  cutKeys,
  busyKeys,
  draggingKeys,
  dropHover,
  renamingKey,
  onRenameCommit,
  onRenameCancel,
  onOpen,
  onItemMenu,
  onEmptyMenu,
  getDropProps,
  folderAncestors,
  canDrag,
  onDragItems,
  onDragEnd,
  animateKey,
  ready,
  dimmed,
  banner,
  footer,
  empty,
  label,
}: {
  items: FmItem[]
  view: ViewMode
  sort: SortState
  onSort: (key: SortKey) => void
  /** Search results: show where every item lives. */
  showLocation: boolean
  selected: ReadonlySet<string>
  anchorKey: string | null
  focusKey: string | null
  onSelect: (change: SelectionChange) => void
  checkboxes: boolean
  cutKeys: ReadonlySet<string>
  busyKeys: ReadonlySet<string>
  draggingKeys: ReadonlySet<string>
  dropHover: string | null
  renamingKey: string | null
  onRenameCommit: (item: FmItem, name: string) => Promise<boolean>
  onRenameCancel: () => void
  onOpen: (item: FmItem) => void
  onItemMenu: (item: FmItem, anchor: MenuAnchor, fromKeyboard: boolean) => void
  onEmptyMenu: (anchor: MenuAnchor) => void
  getDropProps: (target: DropTarget) => DropHandlers | null
  /** Ancestors of the listed folder (a folder can never be dropped into its own sub-folder). */
  folderAncestors: string[]
  canDrag: (item: FmItem) => boolean
  onDragItems: (event: DragEvent<HTMLElement>, item: FmItem) => void
  onDragEnd: () => void
  /** Changes when another folder / search opens: the items play their entrance again. */
  animateKey: string
  /** The listing has arrived (the focus moves into it). */
  ready: boolean
  dimmed: boolean
  banner?: ReactNode
  footer?: ReactNode
  /** Shown instead of the items when there are none. */
  empty?: ReactNode
  label: string
}) {
  const { t, locale } = useLocale()
  const coarse = useMediaQuery('(pointer: coarse)')
  const showChecks = checkboxes || coarse
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const marquee = useRef<Marquee | null>(null)
  const [band, setBand] = useState<Band | null>(null)
  const pointerKind = useRef<string>('mouse')
  const press = useRef<{ x: number; y: number; timer: number } | null>(null)
  const suppressClick = useRef(false)
  const typed = useRef({ text: '', at: 0 })
  const order = items.map(itemKey)

  useEffect(() => () => {
    if (press.current) window.clearTimeout(press.current.timer)
    if (marquee.current) cancelAnimationFrame(marquee.current.frame)
  }, [])

  // After opening a folder the keyboard keeps working in the new listing (the focus is not left on <body>).
  const focusRef = useRef(focusKey)
  useEffect(() => {
    focusRef.current = focusKey
  })
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || !ready) return
    const active = document.activeElement
    if (active && active !== document.body && !scroll.contains(active)) return
    const key = focusRef.current
    const target = key ? scroll.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null
    if (target) {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'nearest' })
    } else {
      scroll.focus({ preventScroll: true })
    }
  }, [animateKey, ready])

  /* ── selection helpers ─────────────────────────────────────── */
  const selectOnly = (key: string) => onSelect({ keys: new Set([key]), anchor: key, focus: key })
  const toggle = (key: string) => {
    const keys = new Set(selected)
    if (keys.has(key)) keys.delete(key)
    else keys.add(key)
    onSelect({ keys, anchor: key, focus: key })
  }
  const selectRange = (key: string, additive: boolean) => {
    const anchor = anchorKey && order.includes(anchorKey) ? anchorKey : key
    const [from, to] = [order.indexOf(anchor), order.indexOf(key)].sort((a, b) => a - b)
    const keys = additive ? new Set(selected) : new Set<string>()
    order.slice(from, to + 1).forEach((value) => keys.add(value))
    onSelect({ keys, anchor, focus: key })
  }

  function elementOf(key: string) {
    return contentRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null
  }

  function focusItem(key: string) {
    const element = elementOf(key)
    element?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: 'nearest' })
  }

  function columns() {
    if (view === 'details') return 1
    const elements = contentRef.current?.querySelectorAll<HTMLElement>('[data-key]')
    if (!elements?.length) return 1
    const top = elements[0].offsetTop
    let count = 0
    for (const element of elements) {
      if (element.offsetTop !== top) break
      count += 1
    }
    return Math.max(1, count)
  }

  /* ── keyboard ──────────────────────────────────────────────── */
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, button, [data-fx-menu]') || !order.length) return
    const index = focusKey ? order.indexOf(focusKey) : -1
    const cols = columns()
    const rowsPerPage = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / (view === 'details' ? 34 : view === 'large' ? 140 : 104)))
    let next = -1
    const arrows = event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End' || event.key === 'PageDown' || event.key === 'PageUp'
    if (arrows && event.altKey) return
    switch (event.key) {
      case 'ArrowDown': next = index < 0 ? 0 : Math.min(order.length - 1, index + cols); break
      case 'ArrowUp': next = index < 0 ? 0 : Math.max(0, index - cols); break
      case 'ArrowRight': if (view === 'details') return; next = index < 0 ? 0 : Math.min(order.length - 1, index + 1); break
      case 'ArrowLeft': if (view === 'details') return; next = index < 0 ? 0 : Math.max(0, index - 1); break
      case 'PageDown': next = Math.min(order.length - 1, Math.max(0, index) + cols * rowsPerPage); break
      case 'PageUp': next = Math.max(0, index - cols * rowsPerPage); break
      case 'Home': next = 0; break
      case 'End': next = order.length - 1; break
      case ' ': {
        if (!focusKey) return
        event.preventDefault()
        if (event.ctrlKey || event.metaKey) toggle(focusKey)
        else if (!selected.has(focusKey)) selectOnly(focusKey)
        return
      }
      case 'Enter': {
        if (event.altKey || !focusKey) return
        const item = items[index]
        if (item) {
          event.preventDefault()
          onOpen(item)
        }
        return
      }
      case 'ContextMenu':
      case 'F10': {
        if (event.key === 'F10' && !event.shiftKey) return
        event.preventDefault()
        const key = focusKey ?? order[0]
        const item = items[order.indexOf(key)]
        const element = elementOf(key)
        if (!item || !element) return
        if (!selected.has(key)) selectOnly(key)
        const rect = element.getBoundingClientRect()
        onItemMenu(item, { x: rect.left + Math.min(rect.width / 2, 60), y: rect.top + Math.min(rect.height, 40) }, true)
        return
      }
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.key === ' ') return
        // Type the first letters of a name to jump to it.
        const now = event.timeStamp
        const text = now - typed.current.at < 800 ? typed.current.text + event.key.toLowerCase() : event.key.toLowerCase()
        typed.current = { text, at: now }
        const start = text.length > 1 ? Math.max(0, index) : index + 1
        for (let step = 0; step < order.length; step += 1) {
          const candidate = (start + step) % order.length
          if (items[candidate].name.toLowerCase().startsWith(text)) {
            next = candidate
            break
          }
        }
        if (next < 0) return
      }
    }
    if (next < 0) return
    event.preventDefault()
    const key = order[next]
    if (event.shiftKey && arrows) selectRange(key, event.ctrlKey || event.metaKey)
    else if ((event.ctrlKey || event.metaKey) && arrows) onSelect({ keys: new Set(selected), anchor: anchorKey, focus: key })
    else selectOnly(key)
    focusItem(key)
  }

  /* ── rubber-band selection on empty space ──────────────────── */
  function contentPoint(clientX: number, clientY: number) {
    const rect = contentRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }

  function updateMarquee() {
    const state = marquee.current
    const scroll = scrollRef.current
    if (!state || !scroll) return
    const point = contentPoint(state.clientX, state.clientY)
    const content = contentRef.current
    const maxX = content?.scrollWidth ?? point.x
    const maxY = content?.scrollHeight ?? point.y
    const x = Math.min(Math.max(0, point.x), maxX)
    const y = Math.min(Math.max(0, point.y), maxY)
    const next: Band = {
      left: Math.min(state.originX, x),
      top: Math.min(state.originY, y),
      width: Math.abs(x - state.originX),
      height: Math.abs(y - state.originY),
    }
    setBand(next)
    const hits = state.rects
      .filter((rect) => rect.left < next.left + next.width && rect.right > next.left && rect.top < next.top + next.height && rect.bottom > next.top)
      .map((rect) => rect.key)
    const signature = hits.join('|')
    if (signature === state.lastHits) return
    state.lastHits = signature
    const keys = new Set(state.additive ? state.base : [])
    for (const key of hits) {
      if (state.additive && state.base.has(key)) keys.delete(key)
      else keys.add(key)
    }
    const last = hits[hits.length - 1] ?? null
    onSelect({ keys, anchor: hits[0] ?? anchorKey, focus: last ?? focusKey })
  }

  function autoScroll() {
    const state = marquee.current
    const scroll = scrollRef.current
    if (!state || !scroll) return
    const rect = scroll.getBoundingClientRect()
    const edge = 36
    let delta = 0
    if (state.clientY < rect.top + edge) delta = -Math.ceil((rect.top + edge - state.clientY) / 3)
    else if (state.clientY > rect.bottom - edge) delta = Math.ceil((state.clientY - (rect.bottom - edge)) / 3)
    if (delta) {
      scroll.scrollTop += Math.max(-24, Math.min(24, delta))
      updateMarquee()
    }
    state.frame = requestAnimationFrame(autoScroll)
  }

  function onPanePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerKind.current = event.pointerType
    const scroll = scrollRef.current
    if (!scroll || event.button !== 0 || event.pointerType !== 'mouse') return
    const target = event.target as HTMLElement
    if (target.closest('[data-key], [data-no-marquee], button, input, textarea, a')) return
    // A press on the scroll bar is not a press on empty space.
    const rect = scroll.getBoundingClientRect()
    if (event.clientX - rect.left > scroll.clientWidth || event.clientY - rect.top > scroll.clientHeight) return
    event.preventDefault()
    scroll.focus({ preventScroll: true })
    const contentRect = contentRef.current?.getBoundingClientRect()
    const origin = contentPoint(event.clientX, event.clientY)
    const rects = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-key]') ?? []).map((element) => {
      const box = element.getBoundingClientRect()
      const left = box.left - (contentRect?.left ?? 0)
      const top = box.top - (contentRect?.top ?? 0)
      return { key: element.dataset.key ?? '', left, top, right: left + box.width, bottom: top + box.height }
    })
    marquee.current = {
      originX: origin.x,
      originY: origin.y,
      clientX: event.clientX,
      clientY: event.clientY,
      base: new Set(selected),
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      rects,
      started: false,
      frame: 0,
      lastHits: '',
    }
    scroll.setPointerCapture(event.pointerId)
  }

  function onPanePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = marquee.current
    if (!state) return
    state.clientX = event.clientX
    state.clientY = event.clientY
    if (!state.started) {
      const point = contentPoint(event.clientX, event.clientY)
      if (Math.hypot(point.x - state.originX, point.y - state.originY) < 5) return
      state.started = true
      state.frame = requestAnimationFrame(autoScroll)
    }
    updateMarquee()
  }

  function endMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const state = marquee.current
    if (!state) return
    marquee.current = null
    cancelAnimationFrame(state.frame)
    setBand(null)
    if (scrollRef.current?.hasPointerCapture(event.pointerId)) scrollRef.current.releasePointerCapture(event.pointerId)
    // A plain click on empty space clears the selection.
    if (!state.started && !state.additive && selected.size) onSelect({ keys: new Set(), anchor: null, focus: focusKey })
  }

  /* ── item handlers ─────────────────────────────────────────── */
  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }

  function itemHandlers(item: FmItem, key: string) {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        pointerKind.current = event.pointerType
        if (event.pointerType === 'mouse') {
          if (event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !selected.has(key)) selectOnly(key)
          return
        }
        if (event.pointerType === 'touch') {
          cancelPress()
          const x = event.clientX
          const y = event.clientY
          press.current = {
            x,
            y,
            timer: window.setTimeout(() => {
              press.current = null
              suppressClick.current = true
              navigator.vibrate?.(8)
              if (!selected.has(key)) {
                const keys = new Set(selected)
                keys.add(key)
                onSelect({ keys, anchor: key, focus: key })
              }
            }, 480),
          }
        }
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) cancelPress()
      },
      onPointerUp: cancelPress,
      onPointerCancel: cancelPress,
      onClick: (event: ReactMouseEvent<HTMLElement>) => {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        if (pointerKind.current !== 'mouse') {
          if (selected.size) toggle(key)
          else onOpen(item)
          return
        }
        if (event.shiftKey) selectRange(key, event.ctrlKey || event.metaKey)
        else if (event.ctrlKey || event.metaKey) toggle(key)
        else selectOnly(key)
      },
      onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
        if (pointerKind.current === 'mouse' && !event.shiftKey && !event.ctrlKey && !event.metaKey) onOpen(item)
      },
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (pointerKind.current === 'touch') return
        if (!selected.has(key)) selectOnly(key)
        onItemMenu(item, { x: event.clientX, y: event.clientY }, false)
      },
    }
  }

  function moreButton(item: FmItem, key: string) {
    return (
      <button
        type="button"
        className="fx-more"
        tabIndex={-1}
        aria-label={t('files.menu.label', 'Actions for “{{name}}”', { name: item.name })}
        aria-haspopup="menu"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onItemMenu(item, { rect: event.currentTarget.getBoundingClientRect(), align: 'end' }, false)
          if (!selected.has(key) && !selected.size) selectOnly(key)
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <DotsThreeIcon size={18} weight="bold" />
      </button>
    )
  }

  function checkbox(item: FmItem, key: string) {
    const on = selected.has(key)
    return (
      <span
        role="checkbox"
        aria-checked={on}
        aria-label={t('files.select_item', 'Select “{{name}}”', { name: item.name })}
        className="fx-check"
        data-on={on || undefined}
        onPointerDown={(event) => {
          event.stopPropagation()
          pointerKind.current = event.pointerType
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (event.shiftKey) selectRange(key, true)
          else toggle(key)
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {on ? <CheckIcon size={11} weight="bold" /> : null}
      </span>
    )
  }

  /* ── render ────────────────────────────────────────────────── */
  const allSelected = order.length > 0 && order.every((key) => selected.has(key))
  const check = showChecks ? '30px ' : ''
  // Full set of columns; a narrower pane drops Type / Location first (see .fx-col-type in the CSS).
  const style = {
    '--fx-cols': `${check}minmax(180px, 1fr) minmax(140px, 168px) minmax(110px, 150px) ${showLocation ? 'minmax(120px, 0.7fr) ' : ''}minmax(72px, 96px) 34px`,
    '--fx-cols-mid': `${check}minmax(150px, 1fr) minmax(136px, 160px) minmax(84px, 104px) 34px`,
  } as CSSProperties

  // After renaming with Enter / Esc the keyboard stays on the item (the text box is gone, focus would fall to <body>).
  const refocus = (key: string) => requestAnimationFrame(() => {
    const active = document.activeElement
    if (!active || active === document.body) elementOf(key)?.focus({ preventScroll: true })
  })

  const renderName = (item: FmItem, key: string) => (
    renamingKey === key ? (
      <InlineRename
        initialValue={item.name}
        selectBaseName={item.kind === 'file'}
        multiline={view !== 'details'}
        onCommit={async (name) => {
          const saved = await onRenameCommit(item, name)
          if (saved) refocus(key)
          return saved
        }}
        onCancel={() => {
          onRenameCancel()
          refocus(key)
        }}
      />
    ) : (
      <span className="fx-name" title={item.name}>{item.name}</span>
    )
  )

  return (
    <div
      ref={scrollRef}
      className={cn('fx-pane-scroll', dimmed && 'fx-pane-scroll--dim')}
      tabIndex={-1}
      style={style}
      data-coarse={coarse || undefined}
      data-checks={showChecks || undefined}
      onPointerDown={onPanePointerDown}
      onPointerMove={onPanePointerMove}
      onPointerUp={endMarquee}
      onPointerCancel={endMarquee}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest('[data-key], input, textarea')) return
        event.preventDefault()
        if (selected.size) onSelect({ keys: new Set(), anchor: null, focus: focusKey })
        onEmptyMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {banner}
      {view === 'details' && items.length ? (
        <div className="fx-dhead" role="presentation" data-no-marquee="">
          {showChecks ? (
            <span className="fx-dhead__check">
              <SelectAllBox
                checked={allSelected}
                mixed={!allSelected && selected.size > 0}
                label={allSelected ? t('files.clear_selection', 'Clear selection') : t('files.select_all', 'Select all')}
                onToggle={() => onSelect(allSelected ? { keys: new Set(), anchor: null, focus: focusKey } : { keys: new Set(order), anchor: order[0] ?? null, focus: focusKey ?? order[0] ?? null })}
              />
            </span>
          ) : null}
          <HeaderCell label={t('files.column.name', 'Name')} column="name" sort={sort} onSort={onSort} />
          <HeaderCell label={t('files.column.modified_long', 'Date modified')} column="modified" sort={sort} onSort={onSort} className="fx-col-wide" />
          <HeaderCell label={t('files.column.type', 'Type')} column="type" sort={sort} onSort={onSort} className="fx-col-wide fx-col-type" />
          {showLocation ? <span className="fx-dhead__cell fx-col-wide fx-col-type">{t('files.column.location', 'Location')}</span> : null}
          <HeaderCell label={t('files.column.size', 'Size')} column="size" sort={sort} onSort={onSort} align="end" className="fx-col-wide" />
          <span aria-hidden="true" />
        </div>
      ) : null}

      <div ref={contentRef} className="fx-content">
        {items.length === 0 ? empty : (
          <div
            key={animateKey}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className={cn('fx-items', `fx-items--${view}`)}
          >
            {items.map((item, index) => {
              const key = itemKey(item)
              const kind = kindOf(item)
              const isSelected = selected.has(key)
              const locked = isLocked(item)
              const drop = item.kind === 'folder' && !draggingKeys.has(key)
                ? getDropProps({ id: item.id, name: item.name, ancestors: folderAncestors })
                : null
              const draggable = renamingKey !== key && !coarse && canDrag(item)
              const common = {
                role: 'option' as const,
                'aria-selected': isSelected,
                tabIndex: (focusKey ? focusKey === key : index === 0) ? 0 : -1,
                'data-key': key,
                'data-selected': isSelected || undefined,
                'data-cut': cutKeys.has(key) || undefined,
                'data-dragging': draggingKeys.has(key) || undefined,
                'data-drop': (item.kind === 'folder' && dropHover === dropKey(item.id)) || undefined,
                'data-busy': busyKeys.has(key) || undefined,
                style: { '--i': Math.min(index, 18) } as CSSProperties,
                draggable,
                onDragStart: draggable ? (event: DragEvent<HTMLElement>) => onDragItems(event, item) : undefined,
                onDragEnd: draggable ? onDragEnd : undefined,
                ...(drop ?? {}),
                ...itemHandlers(item, key),
              }
              const glyph = (
                <ItemGlyph
                  kind={kind}
                  extension={item.kind === 'file' ? item.extension : ''}
                  size={GLYPH_SIZE[view]}
                  system={locked && view !== 'details'}
                  filled={item.kind === 'folder' && ((item.fileCount ?? 0) + (item.folderCount ?? 0) > 0 || (item.size ?? 0) > 0)}
                />
              )

              if (view === 'details') {
                const meta = [item.kind === 'folder' ? folderMeta(item, t) : formatBytes(item.size), item.updatedAt ? formatShortDate(item.updatedAt, locale) : '']
                  .filter(Boolean).join(' · ')
                return (
                  <div key={key} className="fx-row" {...common}>
                    {showChecks ? <span className="fx-row__check">{checkbox(item, key)}</span> : null}
                    <span className="fx-row__name">
                      <span className="fx-row__glyph">
                        {glyph}
                        {busyKeys.has(key) ? <span className="fx-spin" /> : null}
                      </span>
                      <span className="fx-row__label">
                        {renderName(item, key)}
                        <span className="fx-row__meta">{showLocation && item.path ? `${item.path} · ${meta}` : meta}</span>
                      </span>
                      {locked ? <LockSimpleIcon size={12} weight="bold" className="fx-row__lock" aria-label={t('files.system_folder', 'System folder')} /> : null}
                    </span>
                    <span className="fx-cell fx-col-wide">{item.updatedAt ? formatShortDateTime(item.updatedAt, locale) : '—'}</span>
                    <span className="fx-cell fx-col-wide fx-col-type">{typeLabel(item, t)}</span>
                    {showLocation ? <span className="fx-cell fx-col-wide fx-col-type" title={item.path ?? undefined}>{item.path ?? '—'}</span> : null}
                    <span className="fx-cell fx-cell--num fx-col-wide">{item.kind === 'folder' ? folderMeta(item, t) : formatBytes(item.size)}</span>
                    <span className="fx-row__more">{moreButton(item, key)}</span>
                  </div>
                )
              }

              const meta = view === 'large'
                ? item.kind === 'folder' ? folderMeta(item, t) || (item.updatedAt ? formatShortDate(item.updatedAt, locale) : '') : formatBytes(item.size)
                : ''
              return (
                <div key={key} className="fx-tile" {...common}>
                  {showChecks ? <span className="fx-tile__check">{checkbox(item, key)}</span> : null}
                  <span className="fx-tile__glyph">
                    {glyph}
                    {busyKeys.has(key) ? <span className="fx-spin fx-spin--tile" /> : null}
                  </span>
                  <span className="fx-tile__label">
                    {renderName(item, key)}
                    {meta && renamingKey !== key ? <span className="fx-tile__meta">{meta}</span> : null}
                    {showLocation && item.path && renamingKey !== key ? <span className="fx-tile__meta" title={item.path}>{item.path}</span> : null}
                  </span>
                  <span className="fx-tile__more">{moreButton(item, key)}</span>
                </div>
              )
            })}
          </div>
        )}
        {band ? <div className="fx-band" style={{ left: band.left, top: band.top, width: band.width, height: band.height }} aria-hidden="true" /> : null}
      </div>
      {footer}
    </div>
  )
}

function HeaderCell({
  label,
  column,
  sort,
  onSort,
  align = 'start',
  className,
}: {
  label: string
  column: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: 'start' | 'end'
  className?: string
}) {
  const active = sort.key === column
  return (
    <button
      type="button"
      className={cn('fx-dhead__cell fx-dhead__sort', align === 'end' && 'justify-end', className)}
      data-active={active || undefined}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      onClick={() => onSort(column)}
    >
      <span className="truncate">{label}</span>
      <span className="fx-dhead__caret" aria-hidden="true">
        {active && sort.dir === 'desc' ? <CaretDownIcon size={10} weight="bold" /> : <CaretUpIcon size={10} weight="bold" />}
      </span>
    </button>
  )
}

/** Tri-state "select all" box drawn like the item check boxes. */
export function SelectAllBox({ checked, mixed, onToggle, label }: { checked: boolean; mixed: boolean; onToggle: () => void; label: string }) {
  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={checked ? true : mixed ? 'mixed' : false}
      aria-label={label}
      title={label}
      className="fx-check"
      data-on={checked || mixed || undefined}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      {checked ? <CheckIcon size={11} weight="bold" /> : mixed ? <MinusIcon size={11} weight="bold" /> : null}
    </span>
  )
}
