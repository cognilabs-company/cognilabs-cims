import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Columns3, GripVertical, Pin, PinOff, RotateCcw } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../lib/cn'

/* ──────────────────────────────────────────────────────────────
   DataGrid — a table the user can shape to their liking:
   show/hide columns, drag to reorder, drag the edge to resize,
   pin to the left, sort, three row densities, reset.
   Everything is remembered per grid in localStorage.
   Keyboard (focus a header): ←/→ move focus · Alt+←/→ move column ·
   Shift+←/→ width · F pin · H hide · Enter fit to content.
   ────────────────────────────────────────────────────────────── */

export type GridColumn<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Default width in px. */
  width?: number
  minWidth?: number
  align?: 'left' | 'right' | 'center'
  /** Enables sorting by this column. */
  sortValue?: (row: T) => string | number | null | undefined
  /** false keeps the column always visible. */
  hideable?: boolean
  /** Starts hidden (the user can turn it on). */
  defaultHidden?: boolean
}

export type GridDensity = 'comfortable' | 'normal' | 'compact'

type GridState = {
  order: string[]
  hidden: string[]
  pinned: string[]
  widths: Record<string, number>
  density: GridDensity
  sort: { key: string; dir: 'asc' | 'desc' } | null
}

type DataGridProps<T> = {
  /** Storage id — each grid remembers its own layout. */
  id: string
  columns: GridColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  title?: ReactNode
  eyebrow?: ReactNode
  /** Rendered under the header bar (filters). */
  filters?: ReactNode
  emptyState?: ReactNode
  loading?: boolean
  pageSize: number
  onPageSizeChange?: (size: number) => void
  page: number
  onPageChange: (page: number) => void
  className?: string
}

const STORAGE_PREFIX = 'cims-grid:'
const DEFAULT_WIDTH = 160
const MIN_WIDTH = 64
const PAGE_SIZES = [10, 20, 50, 75, 100]

const densityRow: Record<GridDensity, string> = {
  comfortable: 'py-3.5 text-[14px]',
  normal: 'py-2.5 text-[13.5px]',
  compact: 'py-1.5 text-[13px]',
}

function defaultState<T>(columns: GridColumn<T>[]): GridState {
  return {
    order: columns.map((column) => column.key),
    hidden: columns.filter((column) => column.defaultHidden).map((column) => column.key),
    pinned: [],
    widths: {},
    density: 'normal',
    sort: null,
  }
}

function readState<T>(id: string, columns: GridColumn<T>[]): GridState {
  const fallback = defaultState(columns)
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<GridState>
    const known = new Set(columns.map((column) => column.key))
    // Keep the saved order for known columns, append columns added since.
    const order = [...(saved.order ?? []).filter((key) => known.has(key)), ...fallback.order.filter((key) => !(saved.order ?? []).includes(key))]
    return {
      order,
      hidden: (saved.hidden ?? fallback.hidden).filter((key) => known.has(key)),
      pinned: (saved.pinned ?? []).filter((key) => known.has(key)),
      widths: saved.widths ?? {},
      density: saved.density ?? 'normal',
      sort: saved.sort && known.has(saved.sort.key) ? saved.sort : null,
    }
  } catch {
    return fallback
  }
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) return 0
  if (left === null || left === undefined || left === '') return 1
  if (right === null || right === undefined || right === '') return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-px font-mono text-[10.5px] text-[var(--muted-strong)]">{children}</kbd>
}

export function DataGrid<T>({
  id, columns, rows, getRowKey, onRowClick, title, eyebrow, filters, emptyState, loading, pageSize, onPageSizeChange, page, onPageChange, className,
}: DataGridProps<T>) {
  const { t } = useLocale()
  const [state, setState] = useState<GridState>(() => readState(id, columns))
  const [menuOpen, setMenuOpen] = useState(false)
  const [resizing, setResizing] = useState<{ key: string; width: number } | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const headerRefs = useRef(new Map<string, HTMLTableCellElement>())
  // True while a column edge is being dragged, so the header itself does not start a drag-to-move.
  const resizingRef = useRef(false)

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state)) } catch { /* private mode */ }
  }, [id, state])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    const esc = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [menuOpen])

  const columnMap = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns])
  const widthOf = useCallback((key: string) => state.widths[key] ?? columnMap.get(key)?.width ?? DEFAULT_WIDTH, [columnMap, state.widths])

  // Pinned columns come first, in their pin order; then the rest in the user's order.
  const visibleKeys = useMemo(() => {
    const visible = state.order.filter((key) => columnMap.has(key) && !state.hidden.includes(key))
    const pinned = visible.filter((key) => state.pinned.includes(key))
    return [...pinned, ...visible.filter((key) => !state.pinned.includes(key))]
  }, [columnMap, state.hidden, state.order, state.pinned])

  const pinnedOffsets = useMemo(() => {
    const offsets = new Map<string, number>()
    let left = 0
    for (const key of visibleKeys) {
      if (!state.pinned.includes(key)) break
      offsets.set(key, left)
      left += widthOf(key)
    }
    return offsets
  }, [state.pinned, visibleKeys, widthOf])

  const sortedRows = useMemo(() => {
    const sortColumn = state.sort ? columnMap.get(state.sort.key) : null
    if (!state.sort || !sortColumn?.sortValue) return rows
    const getValue = sortColumn.sortValue
    const direction = state.sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => compareValues(getValue(left), getValue(right)) * direction)
  }, [columnMap, rows, state.sort])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const tableWidth = visibleKeys.reduce((sum, key) => sum + widthOf(key), 0)
  const hideableCount = columns.length

  /* ── state helpers ─────────────────────────────────────── */
  const update = (patch: (current: GridState) => GridState) => setState((current) => patch(current))
  const setWidth = (key: string, width: number) => update((current) => ({ ...current, widths: { ...current.widths, [key]: Math.round(Math.max(columnMap.get(key)?.minWidth ?? MIN_WIDTH, Math.min(800, width))) } }))
  const toggleHidden = (key: string) => {
    if (columnMap.get(key)?.hideable === false) return
    update((current) => {
      const hidden = current.hidden.includes(key) ? current.hidden.filter((item) => item !== key) : [...current.hidden, key]
      // Never hide the last visible column.
      if (current.order.filter((item) => !hidden.includes(item)).length === 0) return current
      return { ...current, hidden }
    })
  }
  const togglePinned = (key: string) => update((current) => ({ ...current, pinned: current.pinned.includes(key) ? current.pinned.filter((item) => item !== key) : [...current.pinned, key] }))
  const moveColumn = (key: string, delta: number) => update((current) => {
    const order = [...current.order]
    const from = order.indexOf(key)
    // Move past hidden neighbours so the step is visible.
    let to = from + delta
    while (to >= 0 && to < order.length && current.hidden.includes(order[to])) to += delta
    if (from < 0 || to < 0 || to >= order.length) return current
    order.splice(from, 1)
    order.splice(to, 0, key)
    return { ...current, order }
  })
  const moveColumnTo = (key: string, targetKey: string) => update((current) => {
    if (key === targetKey) return current
    const order = current.order.filter((item) => item !== key)
    order.splice(order.indexOf(targetKey), 0, key)
    return { ...current, order }
  })
  const toggleSort = (key: string) => {
    if (!columnMap.get(key)?.sortValue) return
    update((current) => {
      if (current.sort?.key !== key) return { ...current, sort: { key, dir: 'asc' } }
      if (current.sort.dir === 'asc') return { ...current, sort: { key, dir: 'desc' } }
      return { ...current, sort: null }
    })
    onPageChange(1)
  }
  const autoFit = (key: string) => {
    const table = tableRef.current
    if (!table) return
    let widest = 0
    table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(key)}"] [data-cell-content]`).forEach((element) => {
      widest = Math.max(widest, element.scrollWidth)
    })
    setWidth(key, widest + 36)
  }
  const reset = () => { setState(defaultState(columns)); onPageChange(1) }

  /* ── resize by dragging the header edge ────────────────── */
  function startResize(event: ReactPointerEvent, key: string) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widthOf(key)
    const min = columnMap.get(key)?.minWidth ?? MIN_WIDTH
    resizingRef.current = true
    setResizing({ key, width: startWidth })
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.round(Math.max(min, Math.min(800, startWidth + moveEvent.clientX - startX)))
      setResizing({ key, width: next })
    }
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setWidth(key, startWidth + upEvent.clientX - startX)
      setResizing(null)
      resizingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ── header keyboard ───────────────────────────────────── */
  function onHeaderKeyDown(event: KeyboardEvent<HTMLTableCellElement>, key: string) {
    const index = visibleKeys.indexOf(key)
    const focus = (target?: string) => { if (target) window.requestAnimationFrame(() => headerRefs.current.get(target)?.focus()) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const step = event.key === 'ArrowLeft' ? -1 : 1
      if (event.altKey) { moveColumn(key, step); focus(key) }
      else if (event.shiftKey) setWidth(key, widthOf(key) + step * 16)
      else focus(visibleKeys[index + step])
      return
    }
    if (event.key === 'Enter') { event.preventDefault(); autoFit(key); return }
    if (event.key === ' ') { event.preventDefault(); toggleSort(key); return }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); togglePinned(key); focus(key); return }
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); toggleHidden(key); focus(visibleKeys[index + 1] ?? visibleKeys[index - 1]) }
  }

  const densityLabels: Record<GridDensity, string> = {
    comfortable: t('grid.density.comfortable', 'Comfortable'),
    normal: t('grid.density.normal', 'Normal'),
    compact: t('grid.density.compact', 'Compact'),
  }

  const stickyStyle = (key: string): CSSProperties | undefined => {
    const left = pinnedOffsets.get(key)
    return left === undefined ? undefined : { position: 'sticky', left, zIndex: 2 }
  }
  const lastPinned = [...pinnedOffsets.keys()].at(-1)

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-[var(--card)] ring-1 ring-inset ring-[var(--border)]', className)}>
      {/* ── Header bar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--blue-text)] uppercase">{eyebrow}</p> : null}
          {title ? <h2 className="mt-1 text-[22px] leading-7 font-bold tracking-[-0.02em] text-[var(--foreground)]">{title}</h2> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] shadow-[var(--pill-shadow)] transition-colors hover:bg-[var(--input-surface)]"
            >
              <Columns3 size={16} className="text-[var(--blue-text)]" />
              {t('grid.columns', 'Columns')}
              <span className="rounded-[6px] bg-[var(--input-surface)] px-1.5 py-px font-mono text-[11px] text-[var(--muted-strong)]">{visibleKeys.length}/{hideableCount}</span>
              <ChevronDown size={14} className={cn('text-[var(--muted)] transition-transform', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen ? (
              <div role="dialog" aria-label={t('grid.columns', 'Columns')} className="absolute top-[calc(100%+6px)] right-0 z-30 w-[300px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--elev-xl)] sm:left-0 sm:right-auto">
                <p className="px-2 pt-1 pb-2 text-[11.5px] text-[var(--muted)]">{t('grid.columns_hint', 'Show, pin or reorder columns. Drag a header to move it.')}</p>
                <ul className="max-h-[340px] overflow-y-auto">
                  {state.order.filter((key) => columnMap.has(key)).map((key, index, list) => {
                    const column = columnMap.get(key)!
                    const visible = !state.hidden.includes(key)
                    const pinned = state.pinned.includes(key)
                    return (
                      <li key={key} className="flex items-center gap-1 rounded-[10px] px-1.5 py-1 hover:bg-[var(--input-surface)]">
                        <button
                          type="button"
                          onClick={() => toggleHidden(key)}
                          disabled={column.hideable === false}
                          aria-pressed={visible}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-1 py-1 text-left text-[13px] disabled:opacity-60"
                        >
                          <span className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors', visible ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[#D3D7E0] bg-[var(--surface)] text-transparent')}>
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          </span>
                          <span className={cn('truncate', visible ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]')}>{column.header}</span>
                        </button>
                        <button type="button" onClick={() => togglePinned(key)} aria-pressed={pinned} title={pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')} aria-label={`${pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')}: ${column.header}`} className={cn('grid h-7 w-7 place-items-center rounded-[8px] transition-colors', pinned ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}>
                          {pinned ? <Pin size={14} /> : <PinOff size={14} />}
                        </button>
                        <button type="button" onClick={() => moveColumn(key, -1)} disabled={index === 0} aria-label={`${t('grid.move_up', 'Move up')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[8px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button type="button" onClick={() => moveColumn(key, 1)} disabled={index === list.length - 1} aria-label={`${t('grid.move_down', 'Move down')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[8px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowDown size={14} /></button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div role="radiogroup" aria-label={t('grid.density.label', 'Row density')} className="inline-flex h-9 rounded-[12px] bg-[var(--input-surface)] p-[3px]">
            {(Object.keys(densityLabels) as GridDensity[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={state.density === value}
                onClick={() => update((current) => ({ ...current, density: value }))}
                className={cn('rounded-[9px] px-3 text-[12.5px] font-medium transition', state.density === value ? 'bg-[var(--surface)] font-semibold text-[var(--foreground)] shadow-[var(--elev-seg)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}
              >
                {densityLabels[value]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-[13px] font-medium text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <RotateCcw size={14} /> {t('grid.reset', 'Reset')}
          </button>
        </div>
      </div>

      {filters ? <div className="border-t border-[var(--border)] px-5 py-3.5">{filters}</div> : null}

      {/* ── Table ──────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-auto border-t border-[var(--border)]">
        <table ref={tableRef} className="border-separate border-spacing-0 text-left" style={{ tableLayout: 'fixed', width: Math.max(tableWidth, 0), minWidth: '100%' }}>
          <colgroup>
            {visibleKeys.map((key) => <col key={key} style={{ width: resizing?.key === key ? resizing.width : widthOf(key) }} />)}
          </colgroup>
          <thead>
            <tr>
              {visibleKeys.map((key) => {
                const column = columnMap.get(key)!
                const sorted = state.sort?.key === key ? state.sort.dir : null
                const pinned = pinnedOffsets.has(key)
                return (
                  <th
                    key={key}
                    ref={(element) => { if (element) headerRefs.current.set(key, element); else headerRefs.current.delete(key) }}
                    scope="col"
                    tabIndex={0}
                    draggable
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    onKeyDown={(event) => onHeaderKeyDown(event, key)}
                    onClick={() => toggleSort(key)}
                    onDragStart={(event) => {
                      if (resizingRef.current) { event.preventDefault(); return }
                      setDragKey(key)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', key)
                    }}
                    onDragOver={(event) => { if (dragKey && dragKey !== key) { event.preventDefault(); setDropKey(key) } }}
                    onDragLeave={() => setDropKey((current) => (current === key ? null : current))}
                    onDrop={(event) => { event.preventDefault(); if (dragKey) moveColumnTo(dragKey, key); setDragKey(null); setDropKey(null) }}
                    onDragEnd={() => { setDragKey(null); setDropKey(null) }}
                    data-col={key}
                    style={{ position: 'sticky', top: 0, zIndex: pinned ? 4 : 3, ...(pinned ? { left: pinnedOffsets.get(key) } : {}) }}
                    className={cn(
                      'group/th relative border-b border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap text-[var(--muted-strong)] select-none',
                      'outline-none focus-visible:bg-[var(--blue-dim)] focus-visible:text-[var(--primary)]',
                      column.sortValue ? 'cursor-pointer hover:text-[var(--foreground)]' : 'cursor-grab',
                      dropKey === key && 'shadow-[inset_3px_0_0_var(--primary)]',
                      dragKey === key && 'opacity-50',
                      key === lastPinned && 'shadow-[inset_-1px_0_0_var(--border-hover)]',
                    )}
                  >
                    <span className={cn('flex min-w-0 items-center gap-1.5', column.align === 'right' && 'justify-end', column.align === 'center' && 'justify-center')}>
                      <GripVertical size={12} className="-ml-1 shrink-0 text-[var(--caption)] opacity-0 transition-opacity group-hover/th:opacity-100" aria-hidden="true" />
                      {pinned ? <Pin size={11} className="shrink-0 text-[var(--primary)]" aria-label={t('grid.pinned', 'Pinned')} /> : null}
                      <span className="truncate">{column.header}</span>
                      {sorted === 'asc' ? <ArrowUp size={12} className="shrink-0 text-[var(--primary)]" /> : sorted === 'desc' ? <ArrowDown size={12} className="shrink-0 text-[var(--primary)]" /> : null}
                    </span>
                    {/* resize handle */}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('grid.resize', 'Resize column')}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => { event.stopPropagation(); autoFit(key) }}
                      onPointerDown={(event) => startResize(event, key)}
                      className="absolute top-0 -right-[5px] z-10 flex h-full w-[10px] cursor-col-resize justify-center"
                    >
                      <span className={cn('h-full w-[2px] rounded-full transition-colors', resizing?.key === key ? 'bg-[var(--primary)]' : 'bg-transparent group-hover/th:bg-[var(--border-hover)] hover:bg-[var(--primary)]!')} />
                    </span>
                    {resizing?.key === key ? (
                      <span className="pointer-events-none absolute top-[calc(100%+6px)] right-0 z-20 translate-x-1/2 rounded-[7px] bg-[var(--primary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-white shadow-[var(--elev-md)]">
                        {resizing.width} px
                      </span>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row)}
                data-row-key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('group/row', onRowClick && 'cursor-pointer')}
              >
                {visibleKeys.map((key) => {
                  const column = columnMap.get(key)!
                  const pinned = pinnedOffsets.has(key)
                  return (
                    <td
                      key={key}
                      data-col={key}
                      style={stickyStyle(key)}
                      className={cn(
                        'border-b border-[var(--border-subtle)] px-3 align-middle text-[var(--foreground)] transition-colors',
                        densityRow[state.density],
                        rowIndex % 2 === 1 ? 'bg-[#FAFBFD]' : 'bg-[var(--card)]',
                        'group-hover/row:bg-[var(--accent-soft)]',
                        resizing?.key === key && 'shadow-[inset_-2px_0_0_var(--primary)]',
                        pinned && key === lastPinned && 'shadow-[inset_-1px_0_0_var(--border-hover)]',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                      )}
                    >
                      <div data-cell-content className="w-max max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap [&>*]:max-w-full" style={{ marginLeft: column.align === 'right' ? 'auto' : column.align === 'center' ? 'auto' : undefined, marginRight: column.align === 'center' ? 'auto' : undefined }}>
                        {column.render(row)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 ? <div className="px-5 py-10">{loading ? <p className="text-center text-sm text-[var(--muted)]">{t('common.loading', 'Loading...')}</p> : emptyState}</div> : null}
      </div>

      {/* ── Footer: layout summary, keyboard help, pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-[var(--border)] py-3 pr-24 pl-5 text-[12px] text-[var(--muted)]">
        <p className="min-w-0">
          <b className="font-semibold text-[var(--foreground)]">{visibleKeys.length}</b>/{hideableCount} {t('grid.footer.columns', 'columns')}
          {' · '}{state.pinned.length > 0 ? t('grid.footer.pinned', '{{count}} pinned', { count: state.pinned.length }) : t('grid.footer.none_pinned', 'none pinned')}
          {' · '}{t('grid.footer.rows', '{{density}} rows', { density: densityLabels[state.density].toLowerCase() })}
        </p>
        <p className="hidden items-center gap-1.5 2xl:flex">
          {t('grid.footer.focus_header', 'Focus a header:')}
          <Kbd>←</Kbd><Kbd>→</Kbd> {t('grid.footer.navigate', 'navigate')}
          <Kbd>Alt</Kbd><Kbd>←→</Kbd> {t('grid.footer.move', 'move')}
          <Kbd>Shift</Kbd><Kbd>←→</Kbd> {t('grid.footer.width', 'width')}
          <Kbd>F</Kbd> {t('grid.footer.pin', 'pin')}
          <Kbd>H</Kbd> {t('grid.footer.hide', 'hide')}
          <Kbd>Enter</Kbd> {t('grid.footer.fit', 'fit')}
        </p>
        <div className="flex items-center gap-2">
          {onPageSizeChange ? (
            <label className="flex items-center gap-1.5">
              <span className="sr-only">{t('grid.page_size', 'Rows per page')}</span>
              <select
                value={pageSize}
                onChange={(event) => { onPageSizeChange(Number(event.target.value)); onPageChange(1) }}
                className="h-8 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12.5px] text-[var(--foreground)]"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{t('common.per_page', '{{count}} per page', { count: size })}</option>)}
              </select>
            </label>
          ) : null}
          <span className="tabular-nums">
            {sortedRows.length === 0 ? '0' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedRows.length)}`} / {sortedRows.length}
          </span>
          <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label={t('grid.prev_page', 'Previous page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] disabled:opacity-40"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount} aria-label={t('grid.next_page', 'Next page')} className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] disabled:opacity-40"><ChevronRight size={15} /></button>
        </div>
      </div>
    </section>
  )
}

