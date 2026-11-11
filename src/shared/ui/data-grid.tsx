import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown,
  Download, Eye, GripVertical, Minus, Pin, PinOff, RotateCcw, Star, X,
} from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../lib/cn'
import { gridButton, gridPanel } from './data-grid-styles'
import { SelectField } from './select-field'

/* ──────────────────────────────────────────────────────────────
   DataGrid — a clean CRM-style table each user can shape.
   • select rows (checkbox), star favourites, row numbers
   • sort (header or Sort menu), View menu: show/hide, pin, reorder,
     density, reset; drag a header to move it, drag its edge to resize
   • CSV export of the selection (or of every filtered row)
   Layout, favourites and density are remembered per grid (localStorage).
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
  /** Plain text for CSV export (falls back to sortValue). */
  exportValue?: (row: T) => string | number | null | undefined
  /** false keeps the column always visible. */
  hideable?: boolean
  /** Starts hidden (the user can turn it on). */
  defaultHidden?: boolean
  /** Always pinned to the left — stays in view while the table scrolls sideways. */
  frozen?: boolean
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
  /** Storage id — each grid remembers its own layout and favourites. */
  id: string
  columns: GridColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Toolbar, left side (before Sort / results). */
  toolbarStart?: ReactNode
  /** Toolbar, right side (before Export / View). */
  toolbarEnd?: ReactNode
  /** A row under the toolbar (e.g. active filter tokens). */
  belowToolbar?: ReactNode
  emptyState?: ReactNode
  loading?: boolean
  pageSize: number
  onPageSizeChange?: (size: number) => void
  page: number
  onPageChange: (page: number) => void
  rowNumbers?: boolean
  selectable?: boolean
  favorites?: boolean
  /** File name (without .csv) for the Export button; omit to hide it. */
  exportName?: string
  /** Buttons shown next to "N selected" (selectable grids): receive the selected row keys. */
  selectionActions?: (keys: string[], clear: () => void) => ReactNode
  className?: string
}

const STORAGE_PREFIX = 'cims-grid:'
const DEFAULT_WIDTH = 160
const MIN_WIDTH = 64
const CHECK_WIDTH = 42
const NUMBER_WIDTH = 46
const STAR_WIDTH = 38
const PAGE_SIZES = [20, 50, 110, 200]

const densityRow: Record<GridDensity, string> = {
  comfortable: 'h-[50px] text-[13.5px]',
  normal: 'h-[42px] text-[13px]',
  compact: 'h-[34px] text-[12.5px]',
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

function readJson<V>(key: string, fallback: V): V {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as V) : fallback
  } catch {
    return fallback
  }
}

function readState<T>(id: string, columns: GridColumn<T>[]): GridState {
  const fallback = defaultState(columns)
  const saved = readJson<Partial<GridState> | null>(STORAGE_PREFIX + id, null)
  if (!saved) return fallback
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
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) return 0
  if (left === null || left === undefined || left === '') return 1
  if (right === null || right === undefined || right === '') return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

/** Page buttons with ellipses: 1 … 4 5 6 … 16 */
function pageWindow(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page))
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((page) => pages.add(page))
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: Array<number | 'gap'> = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap')
    result.push(page)
  })
  return result
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref }
}

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(event) => { event.stopPropagation(); onChange() }}
      className={cn(
        'grid h-[16px] w-[16px] place-items-center rounded-[4px] border transition-all duration-150 active:scale-90',
        checked || indeterminate ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--control-border)] bg-[var(--surface)] hover:border-[var(--primary)]',
      )}
    >
      {indeterminate ? <Minus size={11} strokeWidth={3.2} /> : checked ? <Check size={11} strokeWidth={3.2} /> : null}
    </button>
  )
}


export function DataGrid<T>({
  id, columns, rows, getRowKey, onRowClick, toolbarStart, toolbarEnd, belowToolbar, emptyState, loading,
  pageSize, onPageSizeChange, page, onPageChange, rowNumbers = false, selectable = false, favorites = false, exportName, selectionActions, className,
}: DataGridProps<T>) {
  const { t } = useLocale()
  const [state, setState] = useState<GridState>(() => readState(id, columns))
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => readJson<string[]>(`${STORAGE_PREFIX}${id}:fav`, []))
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [resizing, setResizing] = useState<{ key: string; width: number } | null>(null)
  // True once the table is scrolled sideways: pinned columns then cast a shadow over the rest.
  const [scrolledX, setScrolledX] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const { open: viewOpen, setOpen: setViewOpen, ref: viewRef } = usePopover()
  const { open: sortOpen, setOpen: setSortOpen, ref: sortRef } = usePopover()
  const tableRef = useRef<HTMLTableElement>(null)
  const headerRefs = useRef(new Map<string, HTMLTableCellElement>())
  // True while a column edge is being dragged, so the header itself does not start a drag-to-move.
  const resizingRef = useRef(false)
  const scrollBoxRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const scrollBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state)) } catch { /* private mode */ }
  }, [id, state])
  useEffect(() => {
    try { window.localStorage.setItem(`${STORAGE_PREFIX}${id}:fav`, JSON.stringify(favoriteKeys)) } catch { /* private mode */ }
  }, [favoriteKeys, id])

  // The table grows with its rows and the page scrolls; keep the header row visible by
  // shifting it down while the table passes under the top of the scrolling area.
  useEffect(() => {
    const box = scrollBoxRef.current
    const head = headRef.current
    if (!box || !head) return
    let scroller: HTMLElement | null = box.parentElement
    while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    const target: HTMLElement | Window = scroller ?? window
    let frame = 0
    const place = () => {
      frame = 0
      const top = scroller ? scroller.getBoundingClientRect().top : 0
      const rect = box.getBoundingClientRect()
      // The scrollbar sits right above the table; both stick to the top together.
      const bar = scrollBarRef.current
      const barHeight = bar && bar.offsetParent !== null ? bar.offsetHeight : 0
      const shift = Math.max(0, Math.min(top - (rect.top - barHeight), rect.height - head.offsetHeight * 2))
      head.style.transform = shift > 0 ? `translateY(${shift}px)` : ''
      head.classList.toggle('grid-head-floating', shift > 0)
      if (bar) {
        bar.style.transform = shift > 0 ? `translateY(${shift}px)` : ''
        bar.classList.toggle('grid-head-floating', shift > 0)
      }
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(place) }
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    place()
    return () => {
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  })

  const columnMap = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns])
  const widthOf = useCallback((key: string) => state.widths[key] ?? columnMap.get(key)?.width ?? DEFAULT_WIDTH, [columnMap, state.widths])
  const favoriteSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys])

  // Frozen columns are always pinned (first); the user can pin more next to them.
  const frozenKeys = useMemo(() => columns.filter((column) => column.frozen).map((column) => column.key), [columns])
  const isPinned = useCallback((key: string) => frozenKeys.includes(key) || state.pinned.includes(key), [frozenKeys, state.pinned])

  const visibleKeys = useMemo(() => {
    const visible = state.order.filter((key) => columnMap.has(key) && (frozenKeys.includes(key) || !state.hidden.includes(key)))
    const frozen = visible.filter((key) => frozenKeys.includes(key))
    const pinned = visible.filter((key) => !frozenKeys.includes(key) && state.pinned.includes(key))
    return [...frozen, ...pinned, ...visible.filter((key) => !isPinned(key))]
  }, [columnMap, frozenKeys, isPinned, state.hidden, state.order, state.pinned])

  const leadWidth = (selectable ? CHECK_WIDTH : 0) + (rowNumbers ? NUMBER_WIDTH : 0) + (favorites ? STAR_WIDTH : 0)
  const pinnedOffsets = useMemo(() => {
    const offsets = new Map<string, number>()
    let left = leadWidth
    for (const key of visibleKeys) {
      if (!isPinned(key)) break
      offsets.set(key, left)
      left += widthOf(key)
    }
    return offsets
  }, [isPinned, leadWidth, visibleKeys, widthOf])

  const sortedRows = useMemo(() => {
    const sortColumn = state.sort ? columnMap.get(state.sort.key) : null
    if (!state.sort || !sortColumn?.sortValue) return rows
    const getValue = sortColumn.sortValue
    const direction = state.sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => compareValues(getValue(left), getValue(right)) * direction)
  }, [columnMap, rows, state.sort])

  const rowKeys = useMemo(() => new Set(rows.map(getRowKey)), [getRowKey, rows])
  // Only keys still in the list count as selected (filters may have hidden some).
  const selectedVisible = useMemo(() => [...selected].filter((key) => rowKeys.has(key)), [rowKeys, selected])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const firstIndex = (currentPage - 1) * pageSize
  const pageRows = sortedRows.slice(firstIndex, firstIndex + pageSize)
  const pageKeys = pageRows.map(getRowKey)
  const pageAllSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key))
  const pageSomeSelected = !pageAllSelected && pageKeys.some((key) => selected.has(key))
  const tableWidth = visibleKeys.reduce((sum, key) => sum + widthOf(key), leadWidth)
  const lastPinned = [...pinnedOffsets.keys()].at(-1)
  const sortableColumns = columns.filter((column) => column.sortValue)

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
  const togglePinned = (key: string) => {
    if (frozenKeys.includes(key)) return
    update((current) => ({ ...current, pinned: current.pinned.includes(key) ? current.pinned.filter((item) => item !== key) : [...current.pinned, key] }))
  }
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
  const setSort = (sort: GridState['sort']) => { update((current) => ({ ...current, sort })); onPageChange(1) }
  const toggleSort = (key: string) => {
    if (!columnMap.get(key)?.sortValue) return
    const current = state.sort
    setSort(current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : null)
  }
  const autoFit = (key: string) => {
    const table = tableRef.current
    if (!table) return
    let widest = 0
    table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(key)}"] [data-cell-content]`).forEach((element) => {
      widest = Math.max(widest, element.scrollWidth)
    })
    setWidth(key, widest + 30)
  }
  const reset = () => { setState(defaultState(columns)); onPageChange(1) }
  const toggleRow = (key: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const togglePage = () => setSelected((current) => {
    const next = new Set(current)
    if (pageAllSelected) pageKeys.forEach((key) => next.delete(key))
    else pageKeys.forEach((key) => next.add(key))
    return next
  })
  const toggleFavorite = (key: string) => setFavoriteKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))

  function exportCsv() {
    const chosen = selectedVisible.length > 0 ? sortedRows.filter((row) => selected.has(getRowKey(row))) : sortedRows
    const exportKeys = visibleKeys.filter((key) => {
      const column = columnMap.get(key)!
      return column.exportValue || column.sortValue
    })
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value)
      return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const lines = [
      exportKeys.map((key) => escape(columnMap.get(key)!.header)).join(','),
      ...chosen.map((row) => exportKeys.map((key) => {
        const column = columnMap.get(key)!
        return escape((column.exportValue ?? column.sortValue)?.(row))
      }).join(',')),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportName ?? id}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

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
  const sortLabel = state.sort ? columnMap.get(state.sort.key)?.header : null

  const stickyLead = (left: number, z = 2): CSSProperties => ({ position: 'sticky', left, zIndex: z })
  const stickyCell = (key: string): CSSProperties | undefined => {
    const left = pinnedOffsets.get(key)
    return left === undefined ? undefined : { position: 'sticky', left, zIndex: 2 }
  }
  const offsets = { check: 0, number: selectable ? CHECK_WIDTH : 0, star: (selectable ? CHECK_WIDTH : 0) + (rowNumbers ? NUMBER_WIDTH : 0) }

  return (
    <section className={cn('flex min-h-0 flex-col rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(14,21,37,0.04),0_10px_30px_-24px_rgba(14,21,37,0.3)]', className)}>
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        {toolbarStart}

        {selectedVisible.length > 0 ? (
          <span className="grid-row-in inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--blue-border)] bg-[var(--blue-dim)] pr-1 pl-2.5 text-[12.5px] font-semibold text-[var(--primary)]">
            {t('grid.selected', '{{count}} selected', { count: selectedVisible.length })}
            <button type="button" onClick={() => setSelected(new Set())} aria-label={t('grid.clear_selection', 'Clear selection')} className="grid h-6 w-6 place-items-center rounded-[6px] hover:bg-[var(--surface)]"><X size={13} /></button>
          </span>
        ) : null}
        {selectedVisible.length > 0 && selectionActions ? selectionActions(selectedVisible, () => setSelected(new Set())) : null}

        {sortableColumns.length > 0 ? (
          <div ref={sortRef} className="relative">
            <button type="button" onClick={() => setSortOpen((value) => !value)} aria-expanded={sortOpen} aria-haspopup="menu" className={cn(gridButton, state.sort && 'border-[var(--blue-border)] text-[var(--primary)]')}>
              <ArrowUpDown size={14} />
              {sortLabel ?? t('grid.sort', 'Sort')}
              {state.sort ? (state.sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
              <ChevronDown size={13} className={cn('opacity-50 transition-transform duration-200', sortOpen && 'rotate-180')} />
            </button>
            {sortOpen ? (
              <div role="menu" className={cn(gridPanel, 'left-0 w-[240px]')}>
                {sortableColumns.map((column) => (
                  <div key={column.key} className="flex items-center gap-1 rounded-[8px] px-2 py-0.5 hover:bg-[var(--muted-surface)]">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--foreground)]">{column.header}</span>
                    {(['asc', 'desc'] as const).map((dir) => {
                      const active = state.sort?.key === column.key && state.sort.dir === dir
                      return (
                        <button
                          key={dir}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          aria-label={`${column.header} ${dir === 'asc' ? '↑' : '↓'}`}
                          onClick={() => { setSort(active ? null : { key: column.key, dir }); setSortOpen(false) }}
                          className={cn('grid h-7 w-7 place-items-center rounded-[6px] transition-colors', active ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]')}
                        >
                          {dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {state.sort ? (
                  <button type="button" onClick={() => { setSort(null); setSortOpen(false) }} className="mt-1 w-full rounded-[8px] px-2 py-1.5 text-left text-[12.5px] font-semibold text-[var(--primary)] hover:bg-[var(--muted-surface)]">
                    {t('grid.clear_sort', 'Clear sorting')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <span className="px-1 text-[12.5px] font-medium text-[var(--muted)] tabular-nums">{t('grid.results', '{{count}} results', { count: rows.length })}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbarEnd}

          {exportName ? (
            <button type="button" onClick={exportCsv} disabled={rows.length === 0} className={cn(gridButton, 'disabled:opacity-40')} title={selectedVisible.length > 0 ? t('grid.export_selected', 'Export selected rows') : t('grid.export_all', 'Export all filtered rows')}>
              <Download size={14} />
              {t('grid.export', 'Export')}
            </button>
          ) : null}

          <div ref={viewRef} className="relative">
            <button type="button" onClick={() => setViewOpen((value) => !value)} aria-expanded={viewOpen} aria-haspopup="dialog" className={gridButton}>
              <Eye size={14} />
              {t('grid.view', 'View')}
              <span className="rounded-[5px] bg-[var(--muted-surface)] px-1 font-mono text-[10.5px] text-[var(--muted-strong)]">{visibleKeys.length}/{columns.length}</span>
            </button>
            {viewOpen ? (
              <div role="dialog" aria-label={t('grid.view', 'View')} className={cn(gridPanel, 'right-0 w-[300px]')}>
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">{t('grid.density.label', 'Row density')}</p>
                <div className="mx-1 mb-2 grid grid-cols-3 gap-1 rounded-[9px] bg-[var(--muted-surface)] p-[3px]">
                  {(Object.keys(densityLabels) as GridDensity[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update((current) => ({ ...current, density: value }))}
                      className={cn('h-7 rounded-[7px] text-[12px] font-medium transition-all', state.density === value ? 'bg-[var(--surface)] font-semibold text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}
                    >
                      {densityLabels[value]}
                    </button>
                  ))}
                </div>
                <p className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">{t('grid.columns', 'Columns')}</p>
                <ul className="no-scrollbar max-h-[300px] overflow-y-auto overscroll-contain">
                  {state.order.filter((key) => columnMap.has(key)).map((key, index, list) => {
                    const column = columnMap.get(key)!
                    const visible = !state.hidden.includes(key)
                    const pinned = isPinned(key)
                    const frozen = frozenKeys.includes(key)
                    return (
                      <li key={key} className="flex items-center gap-0.5 rounded-[8px] px-1 transition-colors hover:bg-[var(--muted-surface)]">
                        <button type="button" onClick={() => toggleHidden(key)} disabled={column.hideable === false} aria-pressed={visible} className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1.5 text-left text-[13px] disabled:opacity-60">
                          <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border transition-colors', visible ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[#CDD2DC] bg-[var(--surface)]')}>
                            {visible ? <Check size={11} strokeWidth={3.2} /> : null}
                          </span>
                          <span className={cn('truncate', visible ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]')}>{column.header}</span>
                        </button>
                        <button type="button" onClick={() => togglePinned(key)} disabled={frozen} aria-pressed={pinned} title={frozen ? t('grid.frozen', 'Always pinned') : pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')} aria-label={`${pinned ? t('grid.unpin', 'Unpin') : t('grid.pin', 'Pin to the left')}: ${column.header}`} className={cn('grid h-7 w-7 place-items-center rounded-[6px] transition-colors disabled:cursor-default', pinned ? 'text-[var(--primary)]' : 'text-[var(--caption)] hover:text-[var(--foreground)]')}>
                          {pinned ? <Pin size={13} /> : <PinOff size={13} />}
                        </button>
                        <button type="button" onClick={() => moveColumn(key, -1)} disabled={index === 0} aria-label={`${t('grid.move_up', 'Move up')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[6px] text-[var(--caption)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button type="button" onClick={() => moveColumn(key, 1)} disabled={index === list.length - 1} aria-label={`${t('grid.move_down', 'Move down')}: ${column.header}`} className="grid h-7 w-6 place-items-center rounded-[6px] text-[var(--caption)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowDown size={13} /></button>
                      </li>
                    )
                  })}
                </ul>
                <button type="button" onClick={() => { reset(); setViewOpen(false) }} className="mt-1 flex w-full items-center gap-2 rounded-[8px] border-t border-[var(--border)] px-2 pt-2 pb-1.5 text-left text-[12.5px] font-semibold text-[var(--muted-strong)] hover:text-[var(--foreground)]">
                  <RotateCcw size={13} /> {t('grid.reset', 'Reset')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {belowToolbar}

      {/* ── Table ──────────────────────────────────────── */}
      <GridScrollbar boxRef={scrollBoxRef} barRef={scrollBarRef} labels={{ left: t('grid.scroll_left', 'Scroll left'), right: t('grid.scroll_right', 'Scroll right') }} />
      <div ref={scrollBoxRef} onScroll={(event) => { const next = event.currentTarget.scrollLeft > 2; if (next !== scrolledX) setScrolledX(next) }} className="no-scrollbar relative overflow-x-auto overflow-y-hidden">
        <table ref={tableRef} className="border-separate border-spacing-0 text-left" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}>
          <colgroup>
            {selectable ? <col style={{ width: CHECK_WIDTH }} /> : null}
            {rowNumbers ? <col style={{ width: NUMBER_WIDTH }} /> : null}
            {favorites ? <col style={{ width: STAR_WIDTH }} /> : null}
            {visibleKeys.map((key) => <col key={key} style={{ width: resizing?.key === key ? resizing.width : widthOf(key) }} />)}
          </colgroup>
          <thead ref={headRef} className="relative z-10">
            <tr>
              {selectable ? (
                <th scope="col" style={{ ...stickyLead(offsets.check, 5), top: 0 }} className="h-10 border-r border-b border-[var(--border)] bg-[var(--surface)] px-0">
                  <span className="grid place-items-center"><Checkbox checked={pageAllSelected} indeterminate={pageSomeSelected} onChange={togglePage} label={t('grid.select_page', 'Select page')} /></span>
                </th>
              ) : null}
              {rowNumbers ? (
                <th scope="col" style={{ ...stickyLead(offsets.number, 5), top: 0 }} className="h-10 border-r border-b border-[var(--border)] bg-[var(--surface)] px-2 text-center text-[12px] font-medium text-[var(--caption)]">№</th>
              ) : null}
              {favorites ? (
                <th scope="col" style={{ ...stickyLead(offsets.star, 5), top: 0 }} className="h-10 border-r border-b border-[var(--border)] bg-[var(--surface)] px-0" aria-label={t('grid.favorites', 'Favourites')}>
                  <span className="grid place-items-center text-[var(--caption)]"><Star size={13} /></span>
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
                      'group/th relative h-10 border-r border-b border-[var(--border)] bg-[var(--surface)] px-3 text-[12.5px] font-medium whitespace-nowrap text-[var(--muted-strong)] select-none last:border-r-0',
                      'outline-none transition-colors focus-visible:bg-[var(--blue-dim)]',
                      column.sortValue ? 'cursor-pointer hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]' : 'cursor-grab',
                      sorted && 'text-[var(--primary)]',
                      dropKey === key && 'shadow-[inset_3px_0_0_var(--primary)]',
                      dragKey === key && 'opacity-40',
                      key === lastPinned && scrolledX && 'shadow-[inset_-1px_0_0_var(--border-hover),10px_0_16px_-12px_rgba(14,21,37,0.35)]',
                    )}
                  >
                    <span className={cn('flex min-w-0 items-center gap-1.5', column.align === 'right' && 'justify-end', column.align === 'center' && 'justify-center')}>
                      <GripVertical size={12} className="-ml-1.5 shrink-0 text-[var(--caption)] opacity-0 transition-opacity group-hover/th:opacity-100" aria-hidden="true" />
                      {pinned ? <Pin size={11} className="shrink-0 text-[var(--primary)]" aria-label={t('grid.pinned', 'Pinned')} /> : null}
                      <span className="truncate">{column.header}</span>
                      {column.sortValue ? (
                        <span className="ml-auto shrink-0 pl-1">
                          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ChevronsUpDown size={13} className="text-[var(--caption)]" />}
                        </span>
                      ) : null}
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
                      <span className={cn('w-[2px] rounded-full transition-colors', resizing?.key === key ? 'bg-[var(--primary)]' : 'bg-transparent hover:bg-[var(--primary)]')} />
                    </span>
                    {resizing?.key === key ? (
                      <span className="pointer-events-none absolute top-[calc(100%+6px)] right-0 z-20 translate-x-1/2 rounded-[6px] bg-[var(--primary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-white shadow-[var(--elev-md)]">
                        {resizing.width} px
                      </span>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          {/* keyed by page/sort so rows fade in again when the view changes */}
          <tbody key={`${currentPage}-${state.sort?.key ?? ''}-${state.sort?.dir ?? ''}`}>
            {pageRows.map((row, rowIndex) => {
              const key = getRowKey(row)
              const isSelected = selected.has(key)
              const isFavorite = favoriteSet.has(key)
              const zebra = rowIndex % 2 === 1
              const rowBg = isSelected ? 'bg-[var(--row-selected)]' : zebra ? 'bg-[var(--row-zebra)]' : 'bg-[var(--surface)]'
              const cellBase = cn('border-r border-b border-[var(--border-subtle)] transition-colors duration-150 group-hover/row:bg-[var(--row-hover)]', rowBg, densityRow[state.density])
              return (
                <tr
                  key={key}
                  data-row-key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('group/row grid-row-in', onRowClick && 'cursor-pointer')}
                  style={{ animationDelay: `${Math.min(rowIndex * 18, 300)}ms` }}
                >
                  {selectable ? (
                    <td style={stickyLead(offsets.check)} className={cn(cellBase, 'px-0')}>
                      <span className="grid place-items-center"><Checkbox checked={isSelected} onChange={() => toggleRow(key)} label={t('grid.select_row', 'Select row')} /></span>
                    </td>
                  ) : null}
                  {rowNumbers ? (
                    <td style={stickyLead(offsets.number)} className={cn(cellBase, 'px-1 text-center font-mono text-[11.5px] text-[var(--caption)] tabular-nums')}>
                      {firstIndex + rowIndex + 1}
                    </td>
                  ) : null}
                  {favorites ? (
                    <td style={stickyLead(offsets.star)} className={cn(cellBase, 'px-0')}>
                      <button
                        type="button"
                        aria-pressed={isFavorite}
                        aria-label={t('grid.favorite', 'Favourite')}
                        onClick={(event) => { event.stopPropagation(); toggleFavorite(key) }}
                        className={cn('mx-auto grid h-7 w-7 place-items-center rounded-[6px] transition-all duration-200 active:scale-75', isFavorite ? 'text-[#7C5CFC]' : 'text-[var(--control-border)] hover:text-[var(--muted-strong)]')}
                      >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} className={cn(isFavorite && 'drop-shadow-[0_2px_4px_rgba(124,92,252,0.35)]')} />
                      </button>
                    </td>
                  ) : null}
                  {visibleKeys.map((columnKey) => {
                    const column = columnMap.get(columnKey)!
                    return (
                      <td
                        key={columnKey}
                        data-col={columnKey}
                        style={stickyCell(columnKey)}
                        className={cn(
                          cellBase,
                          'px-3 align-middle text-[var(--foreground)] last:border-r-0',
                          resizing?.key === columnKey && 'shadow-[inset_-2px_0_0_var(--primary)]',
                          columnKey === lastPinned && (scrolledX
                            ? 'shadow-[inset_-1px_0_0_var(--border-hover),10px_0_16px_-12px_rgba(14,21,37,0.35)]'
                            : 'shadow-[inset_-1px_0_0_var(--border-hover)]'),
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
              )
            })}
          </tbody>
        </table>
        {pageRows.length === 0 ? (
          <div className="px-5 py-12">
            {loading ? (
              <div className="-my-7 flex flex-col" role="status" aria-busy="true">
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="flex items-center gap-4 border-b border-[var(--border-subtle)] py-3 last:border-b-0">
                    <span className="skeleton block h-7 w-7 shrink-0 rounded-full" />
                    <span className={cn('skeleton block h-3 rounded-full', index % 3 === 0 ? 'w-40' : index % 3 === 1 ? 'w-32' : 'w-48')} />
                    <span className="skeleton hidden h-3 w-28 rounded-full sm:block" />
                    <span className="skeleton hidden h-3 w-20 rounded-full md:block" />
                    <span className="ml-auto skeleton block h-5 w-24 rounded-[6px]" />
                  </div>
                ))}
              </div>
            ) : emptyState}
          </div>
        ) : null}
      </div>

      {/* ── Footer: range · page numbers · rows per page ── */}
      <div className="grid grid-cols-1 items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-[12.5px] text-[var(--muted)] sm:grid-cols-[1fr_auto_1fr] sm:pr-24">
        <span className="tabular-nums">
          {sortedRows.length === 0 ? '0' : `${firstIndex + 1}–${Math.min(firstIndex + pageSize, sortedRows.length)}`} / {sortedRows.length}
        </span>
        <nav aria-label={t('grid.pagination', 'Pagination')} className="flex items-center justify-center gap-0.5">
          <PageButton label={t('grid.first_page', 'First page')} disabled={currentPage <= 1} onClick={() => onPageChange(1)}><ChevronsLeft size={15} /></PageButton>
          <PageButton label={t('grid.prev_page', 'Previous page')} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={15} /></PageButton>
          {pageWindow(currentPage, pageCount).map((item, index) => item === 'gap'
            ? <span key={`gap-${index}`} className="grid h-8 w-6 place-items-center text-[var(--caption)]">…</span>
            : (
              <button
                key={item}
                type="button"
                aria-current={item === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={cn('grid h-8 min-w-8 place-items-center rounded-[8px] px-2 font-medium tabular-nums transition-colors', item === currentPage ? 'bg-[var(--blue-dim)] font-semibold text-[var(--primary)]' : 'text-[var(--muted-strong)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]')}
              >
                {item}
              </button>
            ))}
          <PageButton label={t('grid.next_page', 'Next page')} disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={15} /></PageButton>
          <PageButton label={t('grid.last_page', 'Last page')} disabled={currentPage >= pageCount} onClick={() => onPageChange(pageCount)}><ChevronsRight size={15} /></PageButton>
        </nav>
        {onPageSizeChange ? (
          <div className="flex items-center justify-end gap-2">
            <span>{t('grid.rows_per_page', 'Rows / page')}:</span>
            <SelectField
              size="sm"
              value={String(pageSize)}
              onValueChange={(value) => { onPageSizeChange(Number(value)); onPageChange(1) }}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              className="w-[76px] font-semibold"
              aria-label={t('grid.rows_per_page', 'Rows / page')}
            />
          </div>
        ) : <span />}
      </div>
    </section>
  )
}

/**
 * Designed horizontal scrollbar shown on top of the table (the native one is hidden).
 * Arrows nudge, the thumb drags, a click on the track pages. It floats with the header.
 */
function GridScrollbar({ boxRef, barRef, labels }: {
  boxRef: React.RefObject<HTMLDivElement | null>
  barRef: React.RefObject<HTMLDivElement | null>
  labels: { left: string; right: string }
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [edges, setEdges] = useState({ start: true, end: false })

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let frame = 0
    const update = () => {
      frame = 0
      const { scrollWidth, clientWidth, scrollLeft } = box
      const has = scrollWidth > clientWidth + 1
      setOverflow(has)
      setEdges((current) => {
        const next = { start: scrollLeft <= 1, end: scrollLeft >= scrollWidth - clientWidth - 1 }
        return current.start === next.start && current.end === next.end ? current : next
      })
      const track = trackRef.current
      const thumb = thumbRef.current
      if (!has || !track || !thumb) return
      const trackWidth = track.clientWidth
      const width = Math.max(48, (trackWidth * clientWidth) / scrollWidth)
      const x = (trackWidth - width) * (scrollLeft / Math.max(1, scrollWidth - clientWidth))
      thumb.style.width = `${width}px`
      thumb.style.transform = `translateX(${x}px)`
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    schedule()
    box.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(box)
    if (box.firstElementChild) observer.observe(box.firstElementChild)
    if (trackRef.current) observer.observe(trackRef.current)
    return () => {
      box.removeEventListener('scroll', schedule)
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [boxRef, overflow])

  function onThumbDown(event: ReactPointerEvent<HTMLDivElement>) {
    const box = boxRef.current
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!box || !track || !thumb) return
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startLeft = box.scrollLeft
    const ratio = (box.scrollWidth - box.clientWidth) / Math.max(1, track.clientWidth - thumb.offsetWidth)
    thumb.dataset.dragging = 'true'
    const move = (e: PointerEvent) => { box.scrollLeft = startLeft + (e.clientX - startX) * ratio }
    const up = () => {
      delete thumb.dataset.dragging
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onTrackDown(event: ReactPointerEvent<HTMLDivElement>) {
    const box = boxRef.current
    const thumb = thumbRef.current
    if (!box || !thumb) return
    const rect = thumb.getBoundingClientRect()
    box.scrollBy({ left: (event.clientX < rect.left ? -1 : 1) * box.clientWidth * 0.8, behavior: 'smooth' })
  }

  const nudge = (direction: -1 | 1) => boxRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  const arrow = 'grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30'

  return (
    <div ref={barRef} className={cn('relative z-20 border-b border-[var(--border)] bg-[var(--surface)]', !overflow && 'hidden')}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button type="button" onClick={() => nudge(-1)} disabled={edges.start} aria-label={labels.left} className={arrow}><ChevronLeft size={14} /></button>
        <div ref={trackRef} onPointerDown={onTrackDown} className="group/track relative h-2.5 flex-1 cursor-pointer rounded-full bg-[var(--muted-surface)]">
          <div
            ref={thumbRef}
            onPointerDown={onThumbDown}
            className="absolute inset-y-0 left-0 cursor-grab rounded-full bg-[var(--border-hover)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] transition-colors group-hover/track:bg-[var(--primary)]/60 data-[dragging=true]:cursor-grabbing data-[dragging=true]:bg-[var(--primary)]"
          />
        </div>
        <button type="button" onClick={() => nudge(1)} disabled={edges.end} aria-label={labels.right} className={arrow}><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-[8px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30">
      {children}
    </button>
  )
}
