import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Columns3, GripVertical, Pin, PinOff, RotateCcw, Rows2, Rows3, Rows4 } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../lib/cn'

/* ──────────────────────────────────────────────────────────────
   DataGrid — a table each user can shape:
   show/hide columns, drag (or Alt+←/→) to reorder, drag the edge to
   resize (double-click = fit), pin left, sort, three densities, reset.
   Layout is remembered per grid in localStorage.
   Keyboard on a focused header: ←/→ focus · Alt+←/→ move ·
   Shift+←/→ width · F pin · H hide · Enter fit · Space sort.
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
  /** Left side of the control bar (search, filter buttons). */
  toolbar?: ReactNode
  /** A row under the control bar (e.g. active filter tokens). */
  belowToolbar?: ReactNode
  emptyState?: ReactNode
  loading?: boolean
  pageSize: number
  onPageSizeChange?: (size: number) => void
  page: number
  onPageChange: (page: number) => void
  /** Adds a "№" column with the row's position in the (sorted, filtered) list. */
  rowNumbers?: boolean
  className?: string
}

const STORAGE_PREFIX = 'cims-grid:'
const DEFAULT_WIDTH = 160
const MIN_WIDTH = 64
const NUMBER_WIDTH = 56
const PAGE_SIZES = [10, 20, 50, 75, 100]

const densityRow: Record<GridDensity, string> = {
  comfortable: 'h-[56px] text-[14px]',
  normal: 'h-[46px] text-[13.5px]',
  compact: 'h-[36px] text-[13px]',
}
const densityIcons: Record<GridDensity, typeof Rows2> = { comfortable: Rows2, normal: Rows3, compact: Rows4 }

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
    const savedOrder = (saved.order ?? []).filter((key) => known.has(key))
    return {
      order: [...savedOrder, ...fallback.order.filter((key) => !savedOrder.includes(key))],
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
  return <kbd className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-px font-mono text-[10.5px] text-[var(--muted-strong)]">{children}</kbd>
}

const controlButton = 'inline-flex h-9 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--input-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30'

export function DataGrid<T>({
  id, columns, rows, getRowKey, onRowClick, toolbar, belowToolbar, emptyState, loading, pageSize, onPageSizeChange, page, onPageChange, rowNumbers = false, className,
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
    let left = rowNumbers ? NUMBER_WIDTH : 0
    for (const key of visibleKeys) {
      if (!state.pinned.includes(key)) break
      offsets.set(key, left)
      left += widthOf(key)
    }
    return offsets
  }, [rowNumbers, state.pinned, visibleKeys, widthOf])

  const sortedRows = useMemo(() => {
    const sortColumn = state.sort ? columnMap.get(state.sort.key) : null
    if (!state.sort || !sortColumn?.sortValue) return rows
    const getValue = sortColumn.sortValue
    const direction = state.sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => compareValues(getValue(left), getValue(right)) * direction)
  }, [columnMap, rows, state.sort])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const firstIndex = (currentPage - 1) * pageSize
  const pageRows = sortedRows.slice(firstIndex, firstIndex + pageSize)
  const tableWidth = visibleKeys.reduce((sum, key) => sum + widthOf(key), rowNumbers ? NUMBER_WIDTH : 0)
  const lastPinned = [...pinnedOffsets.keys()].at(-1)

  /* ── state helpers ─────────────────────────────────────── */
  const update = (patch: (current: GridState) => GridState) => setState((current) => patch(current))
  const setWidth = (key: string, width: number) => update((current) => ({ ...current, widths: { ...current.widths, [key]: Math.round(Math.max(columnMap.get(key)?.minWidth ?? MIN_WIDTH, Math.min(800, width))) } }))
  const toggleHidden = (key: string) => {
    if (columnMap.get(key)?.hideable === false) return
    update((current) => {
      const hidden = current.hidden.includes(key) ? current.hidden.filter((item) => item !== key) : [...current.hidden, key]
      if (current.order.filter((item) => !hidden.includes(item)).length === 0) return current
      return { ...current, hidden }
    })
  }
  const togglePinned = (key: string) => update((current) => ({ ...current, pinned: current.pinned.includes(key) ? current.pinned.filter((item) => item !== key) : [...current.pinned, key] }))
  const moveColumn = (key: string, delta: number) => update((current) => {
    const order = [...current.order]
    const from = order.indexOf(key)
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
    setWidth(key, widest + 32)
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
      setResizing({ key, width: Math.round(Math.max(min, Math.min(800, startWidth + moveEvent.clientX - startX))) })
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

  const stickyCell = (key: string): CSSProperties | undefined => {
    const left = pinnedOffsets.get(key)
    return left === undefined ? undefined : { position: 'sticky', left, zIndex: 2 }
  }

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden bg-[var(--card)]', className)}>
      {/* ── Control bar: page filters on the left, table controls on the right ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>

        <div className="flex shrink-0 items-center gap-2">
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-haspopup="dialog" className={controlButton}>
              <Columns3 size={15} className="text-[var(--primary)]" />
              <span className="hidden sm:inline">{t('grid.columns', 'Columns')}</span>
              <span className="rounded-[4px] bg-[var(--input-surface)] px-1.5 py-px font-mono text-[11px] text-[var(--muted-strong)]">{visibleKeys.length}/{columns.length}</span>
              <ChevronDown size={14} className={cn('text-[var(--muted)] transition-transform duration-200', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen ? (
              <div role="dialog" aria-label={t('grid.columns', 'Columns')} className="modal-pop absolute top-[calc(100%+6px)] right-0 z-30 w-[300px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--elev-xl)]">
                <p className="px-2.5 pt-1.5 pb-2 text-[11.5px] leading-4 text-[var(--muted)]">{t('grid.columns_hint', 'Show, pin or reorder columns. Drag a header to move it.')}</p>
                <ul className="max-h-[340px] overflow-y-auto overscroll-contain">
                  {state.order.filter((key) => columnMap.has(key)).map((key, index, list) => {
                    const column = columnMap.get(key)!
                    const visible = !state.hidden.includes(key)
                    const pinned = state.pinned.includes(key)
                    return (
                      <li key={key} className="flex items-center gap-1 rounded-[8px] px-1 py-0.5 transition-colors hover:bg-[var(--input-surface)]">
                        <button type="button" onClick={() => toggleHidden(key)} disabled={column.hideable === false} aria-pressed={visible} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[6px] px-1.5 py-1.5 text-left text-[13px] disabled:opacity-60">
                          <span className={cn('grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[4px] border-[1.5px] transition-colors', visible ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[#D3D7E0] bg-[var(--surface)] text-transparent')}>
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          </span>
                          <span className={cn('truncate', visible ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]')}>{column.header}</span>
                        </button>
                        <button type="button" onClick={() => togglePinned(key)} aria-pressed={pinned} title={pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')} aria-label={`${pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')}: ${column.header}`} className={cn('grid h-7 w-7 place-items-center rounded-[6px] transition-colors', pinned ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'text-[var(--caption)] hover:text-[var(--foreground)]')}>
                          {pinned ? <Pin size={14} /> : <PinOff size={14} />}
                        </button>
                        <button type="button" onClick={() => moveColumn(key, -1)} disabled={index === 0} aria-label={`${t('grid.move_up', 'Move up')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[6px] text-[var(--caption)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button type="button" onClick={() => moveColumn(key, 1)} disabled={index === list.length - 1} aria-label={`${t('grid.move_down', 'Move down')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[6px] text-[var(--caption)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowDown size={14} /></button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div role="radiogroup" aria-label={t('grid.density.label', 'Row density')} className="inline-flex h-9 items-center gap-0.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-[3px]">
            {(Object.keys(densityLabels) as GridDensity[]).map((value) => {
              const Icon = densityIcons[value]
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={state.density === value}
                  aria-label={densityLabels[value]}
                  title={densityLabels[value]}
                  onClick={() => update((current) => ({ ...current, density: value }))}
                  className={cn('grid h-[28px] w-[30px] place-items-center rounded-[6px] transition-colors', state.density === value ? 'bg-[var(--surface-inverse)] text-white' : 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]')}
                >
                  <Icon size={15} />
                </button>
              )
            })}
          </div>

          <button type="button" onClick={reset} title={t('grid.reset', 'Reset')} aria-label={t('grid.reset', 'Reset')} className={cn(controlButton, 'w-9 justify-center px-0 font-medium text-[var(--muted-strong)]')}>
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {belowToolbar}

      {/* ── Table ──────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
        <table ref={tableRef} className="border-separate border-spacing-0 text-left" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}>
          <colgroup>
            {rowNumbers ? <col style={{ width: NUMBER_WIDTH }} /> : null}
            {visibleKeys.map((key) => <col key={key} style={{ width: resizing?.key === key ? resizing.width : widthOf(key) }} />)}
          </colgroup>
          <thead>
            <tr>
              {rowNumbers ? (
                <th scope="col" style={{ position: 'sticky', top: 0, left: 0, zIndex: 5 }} className="h-10 border-b border-[var(--border)] bg-[#F7F8FB] px-2 text-center text-[11px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">
                  №
                </th>
              ) : null}
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
                      'group/th relative h-10 border-b border-[var(--border)] bg-[#F7F8FB] px-3 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-[var(--muted-strong)] uppercase select-none',
                      'outline-none transition-colors focus-visible:bg-[var(--blue-dim)] focus-visible:text-[var(--primary)]',
                      column.sortValue ? 'cursor-pointer hover:text-[var(--foreground)]' : 'cursor-grab',
                      sorted && 'text-[var(--primary)]',
                      dropKey === key && 'shadow-[inset_3px_0_0_var(--primary)]',
                      dragKey === key && 'opacity-40',
                      key === lastPinned && 'shadow-[inset_-1px_0_0_var(--border-hover)]',
                    )}
                  >
                    <span className={cn('flex min-w-0 items-center gap-1.5', column.align === 'right' && 'justify-end', column.align === 'center' && 'justify-center')}>
                      <GripVertical size={12} className="-ml-1.5 shrink-0 text-[var(--caption)] opacity-0 transition-opacity group-hover/th:opacity-100" aria-hidden="true" />
                      {pinned ? <Pin size={11} className="shrink-0 text-[var(--primary)]" aria-label={t('grid.pinned', 'Pinned')} /> : null}
                      <span className="truncate">{column.header}</span>
                      {sorted === 'asc' ? <ArrowUp size={12} className="shrink-0" /> : sorted === 'desc' ? <ArrowDown size={12} className="shrink-0" /> : null}
                    </span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('grid.resize', 'Resize column')}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => { event.stopPropagation(); autoFit(key) }}
                      onPointerDown={(event) => startResize(event, key)}
                      className="absolute top-0 -right-[5px] z-10 flex h-full w-[10px] cursor-col-resize justify-center"
                    >
                      <span className={cn('my-2 w-[2px] rounded-full transition-colors', resizing?.key === key ? 'bg-[var(--primary)]' : 'bg-[var(--border)] group-hover/th:bg-[var(--border-hover)] hover:bg-[var(--primary)]!')} />
                    </span>
                    {resizing?.key === key ? (
                      <span className="pointer-events-none absolute top-[calc(100%+6px)] right-0 z-20 translate-x-1/2 rounded-[6px] bg-[var(--primary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-white normal-case shadow-[var(--elev-md)]">
                        {resizing.width} px
                      </span>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          {/* keyed by page/sort so rows cascade in again when the view changes */}
          <tbody key={`${currentPage}-${state.sort?.key ?? ''}-${state.sort?.dir ?? ''}`}>
            {pageRows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row)}
                data-row-key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('group/row grid-row-in', onRowClick && 'cursor-pointer')}
                style={{ animationDelay: `${Math.min(rowIndex * 22, 360)}ms` }}
              >
                {rowNumbers ? (
                  <td style={{ position: 'sticky', left: 0, zIndex: 2 }} className={cn('border-b border-[var(--border-subtle)] bg-[var(--card)] px-2 text-center font-mono text-[12px] text-[var(--caption)] tabular-nums transition-colors group-hover/row:bg-[#F5F8FF] group-hover/row:text-[var(--primary)] group-hover/row:shadow-[inset_2px_0_0_var(--primary)]', densityRow[state.density])}>
                    {firstIndex + rowIndex + 1}
                  </td>
                ) : null}
                {visibleKeys.map((key) => {
                  const column = columnMap.get(key)!
                  return (
                    <td
                      key={key}
                      data-col={key}
                      style={stickyCell(key)}
                      className={cn(
                        'border-b border-[var(--border-subtle)] bg-[var(--card)] px-3 align-middle text-[var(--foreground)] transition-colors group-hover/row:bg-[#F5F8FF]',
                        densityRow[state.density],
                        resizing?.key === key && 'shadow-[inset_-2px_0_0_var(--primary)]',
                        key === lastPinned && 'shadow-[inset_-1px_0_0_var(--border-hover)]',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                      )}
                    >
                      <div data-cell-content className={cn('w-max max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap', column.align === 'right' && 'ml-auto', column.align === 'center' && 'mx-auto')}>
                        {column.render(row)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 ? (
          <div className="px-5 py-12">
            {loading ? (
              <div className="mx-auto flex max-w-[520px] flex-col gap-2.5" aria-busy="true">
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-[6px] bg-[var(--input-surface)]" style={{ animationDelay: `${index * 80}ms` }} />)}
              </div>
            ) : emptyState}
          </div>
        ) : null}
      </div>

      {/* ── Footer: layout summary, keyboard help, pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-[var(--border)] bg-[#FBFBFD] py-2.5 pr-24 pl-4 text-[12px] text-[var(--muted)]">
        <p className="min-w-0">
          <b className="font-semibold text-[var(--foreground)]">{visibleKeys.length}</b>/{columns.length} {t('grid.footer.columns', 'columns')}
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
                className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12.5px] text-[var(--foreground)]"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{t('common.per_page', '{{count}} per page', { count: size })}</option>)}
              </select>
            </label>
          ) : null}
          <span className="tabular-nums">
            {sortedRows.length === 0 ? '0' : `${firstIndex + 1}–${Math.min(firstIndex + pageSize, sortedRows.length)}`} / {sortedRows.length}
          </span>
          <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label={t('grid.prev_page', 'Previous page')} className="grid h-8 w-8 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] disabled:opacity-40"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount} aria-label={t('grid.next_page', 'Next page')} className="grid h-8 w-8 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] disabled:opacity-40"><ChevronRight size={15} /></button>
        </div>
      </div>
    </section>
  )
}
