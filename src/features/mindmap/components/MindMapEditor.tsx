import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
  ArrowDownIcon,
  ArrowElbowDownRightIcon,
  ArrowUpIcon,
  ArrowsInIcon,
  ArrowsInLineVerticalIcon,
  ArrowsOutLineVerticalIcon,
  BezierCurveIcon,
  CaretDownIcon,
  CornersOutIcon,
  FileCodeIcon,
  ImageIcon,
  ListBulletsIcon,
  QuestionIcon,
  CrosshairIcon,
  DownloadSimpleIcon,
  ListChecksIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  MapTrifoldIcon,
  MinusIcon,
  PlusIcon,
  SidebarSimpleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { exportJson, exportMarkdown, exportPng, exportSvg } from '../lib/export'
import { computeLayout, type Layout } from '../lib/layout'
import {
  addChild,
  addSibling,
  depthOf,
  expandPath,
  moveAmongSiblings,
  removeNode,
  reparent,
  resetOffsets,
  setAllCollapsed,
  uid,
  updateNode,
} from '../lib/tree'
import type { MindMap, MindNode, NodeTask } from '../lib/types'
import { useMapHistory } from '../lib/useMapHistory'
import { clampZoom, type View } from '../lib/view'
import { MindCanvas } from './MindCanvas'
import { NodeInspector } from './NodeInspector'
import { TaskFromNodeDialog } from './TaskFromNodeDialog'

type Props = {
  initial: MindMap
  /** Open the root in edit mode (a just-created map). */
  autoEditRoot?: boolean
  canCreateTask: boolean
  onSave: (map: MindMap) => Promise<unknown>
  onDelete: () => void
}

const PREFS_KEY = 'cims.mindmap.prefs'

function readPrefs(): { minimap: boolean; inspector: boolean } {
  try {
    return { minimap: true, inspector: true, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as object) }
  } catch {
    return { minimap: true, inspector: true }
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return Boolean(document.querySelector('[role="dialog"]'))
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ml-1 rounded-[5px] bg-[var(--muted-surface)] px-1.5 py-px font-mono text-[10.5px] font-semibold text-[var(--muted-strong)]">{children}</kbd>
}

function ToolButton({ icon, label, onClick, disabled, active, kbd, iconOnly, danger, flat, compact, trailing }: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  kbd?: string
  iconOnly?: boolean
  danger?: boolean
  /** Borderless (inside a floating bar). */
  flat?: boolean
  /** Label only on wide screens (icon + tooltip below 1536px). */
  compact?: boolean
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={kbd ? `${label} (${kbd})` : label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40',
        iconOnly ? 'w-[34px]' : compact ? 'w-[34px] 2xl:w-auto 2xl:px-2.5' : 'px-2.5 max-sm:w-[34px] max-sm:px-0',
        active ? 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
        danger && 'hover:border-[var(--danger-border)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]',
        flat && !active && 'border-transparent bg-transparent',
      )}
    >
      {icon}
      {iconOnly ? null : <span className={cn('max-sm:hidden', compact && 'hidden 2xl:inline')}>{label}</span>}
      {kbd && !iconOnly ? <span className="max-sm:hidden"><Kbd>{kbd}</Kbd></span> : null}
      {trailing}
    </button>
  )
}

export function MindMapEditor({ initial, autoEditRoot, canCreateTask, onSave, onDelete }: Props) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { map, apply, undo, redo, canUndo, canRedo } = useMapHistory(initial)
  const layout = useMemo(() => computeLayout(map), [map])

  const [selectedId, setSelectedId] = useState(initial.rootId)
  const selected = map.nodes[selectedId] ? selectedId : map.rootId
  const node = map.nodes[selected]

  const [editing, setEditing] = useState<{ id: string; original: string; selectAll: boolean } | null>(
    autoEditRoot ? { id: initial.rootId, original: initial.nodes[initial.rootId].text, selectAll: true } : null,
  )
  const editingRef = useRef(editing)
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 })
  const setView = useCallback((update: (view: View) => View) => setViewState(update), [])
  const sizeRef = useRef({ w: 0, h: 0 })
  const centeredRef = useRef(false)
  const [prefs, setPrefs] = useState(readPrefs)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [taskNode, setTaskNode] = useState<string | null>(null)
  const [spacePan, setSpacePan] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Phones: the node panel is an overlay opened on demand; desktop remembers its own preference.
  const [mobileInspector, setMobileInspector] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const newNodeText = t('mindmap.new_node', 'New idea')

  // ── Saving ────────────────────────────────────────────────────────────────
  const [savedMap, setSavedMap] = useState(initial)
  const pendingRef = useRef<MindMap | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => {
    if (map === initial) return
    pendingRef.current = map
    const timer = window.setTimeout(() => {
      pendingRef.current = null
      void onSaveRef.current(map).then(() => setSavedMap(map)).catch(() => showToast({ title: t('mindmap.save_failed', 'Could not save the mind map'), tone: 'error' }))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [initial, map, showToast, t])
  // Leaving the page (or switching maps) with unsaved edits: save right away.
  useEffect(() => () => { if (pendingRef.current) void onSaveRef.current(pendingRef.current) }, [])
  const isSaved = savedMap === map || map === initial

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  }, [prefs])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // ── View helpers ──────────────────────────────────────────────────────────
  const onSize = useCallback((size: { w: number; h: number }) => {
    sizeRef.current = size
    if (!centeredRef.current && size.w > 0) {
      centeredRef.current = true
      // First open: the whole map on screen, never zoomed in past 100%.
      // First open: the whole map if it fits at a readable size (≥ 70%), otherwise the centre topic.
      const first = computeLayout(initial)
      const { minX, minY, maxX, maxY } = first.bounds
      const fitK = Math.min(1, (size.w - 96) / Math.max(1, maxX - minX), (size.h - 120) / Math.max(1, maxY - minY))
      const k = clampZoom(Math.max(0.7, fitK))
      const root = first.boxes.get(initial.rootId)
      const [cx, cy] = fitK >= 0.7 || !root ? [(minX + maxX) / 2, (minY + maxY) / 2] : [root.x + root.w / 2, root.y + root.h / 2]
      setViewState({ k, x: size.w / 2 - cx * k, y: size.h / 2 - cy * k })
    }
  }, [initial])

  function centerOn(id: string, source: Layout = layout) {
    const box = source.boxes.get(id)
    if (!box) return
    const { w, h } = sizeRef.current
    setViewState((current) => ({ ...current, x: w / 2 - (box.x + box.w / 2) * current.k, y: h / 2 - (box.y + box.h / 2) * current.k }))
  }

  /** Pan just enough to keep a node on screen (after keyboard actions). */
  function ensureVisible(id: string, source: Layout) {
    const box = source.boxes.get(id)
    if (!box) return
    const { w, h } = sizeRef.current
    const margin = 48
    setViewState((current) => {
      const left = box.x * current.k + current.x
      const top = box.y * current.k + current.y
      const right = left + box.w * current.k
      const bottom = top + box.h * current.k
      let { x, y } = current
      if (left < margin) x += margin - left
      else if (right > w - margin) x -= right - (w - margin)
      if (top < margin) y += margin - top
      else if (bottom > h - margin) y -= bottom - (h - margin)
      return x === current.x && y === current.y ? current : { ...current, x, y }
    })
  }

  function fit() {
    const { minX, minY, maxX, maxY } = layout.bounds
    const { w, h } = sizeRef.current
    if (!w || !h) return
    const k = clampZoom(Math.min((w - 96) / Math.max(1, maxX - minX), (h - 96) / Math.max(1, maxY - minY), 1.25))
    setViewState({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k })
  }

  function zoomBy(factor: number) {
    const { w, h } = sizeRef.current
    setViewState((current) => {
      const k = clampZoom(current.k * factor)
      const ratio = k / current.k
      return { k, x: w / 2 - (w / 2 - current.x) * ratio, y: h / 2 - (h / 2 - current.y) * ratio }
    })
  }

  // ── Edits ─────────────────────────────────────────────────────────────────
  function commit(next: MindMap, key?: string) {
    apply(() => next, key)
    return next
  }

  function select(id: string) {
    setSelectedId(id)
  }

  function startEdit(id: string, typed?: string) {
    const current = map.nodes[id]
    if (!current) return
    const state = { id, original: current.text, selectAll: typed === undefined }
    if (typed !== undefined) apply((m) => updateNode(m, id, { text: typed }), `text:${id}`)
    editingRef.current = state
    setEditing(state)
    setSelectedId(id)
  }

  function finishEdit(mode: 'commit' | 'cancel' | 'child') {
    const state = editingRef.current
    if (!state) return
    editingRef.current = null
    setEditing(null)
    if (mode === 'cancel') {
      apply((m) => updateNode(m, state.id, { text: state.original }), `text:${state.id}`)
      return
    }
    if (!map.nodes[state.id]?.text.trim()) apply((m) => updateNode(m, state.id, { text: state.original.trim() || newNodeText }), `text:${state.id}`)
    if (mode === 'child') addNode('child', state.id)
    else ensureVisible(state.id, layout)
  }

  function addNode(kind: 'child' | 'sibling', from = selected) {
    const id = uid()
    const [next] = kind === 'child' ? addChild(map, from, newNodeText, id) : addSibling(map, from, newNodeText, id)
    commit(next)
    const nextLayout = computeLayout(next)
    const state = { id, original: newNodeText, selectAll: true }
    editingRef.current = state
    setEditing(state)
    setSelectedId(id)
    ensureVisible(id, nextLayout)
  }

  function deleteSelected() {
    if (selected === map.rootId) {
      showToast({ title: t('mindmap.root_delete', 'The central topic cannot be deleted'), tone: 'info' })
      return
    }
    const [next, nextSelected] = removeNode(map, selected)
    commit(next)
    setSelectedId(nextSelected)
  }

  function move(delta: -1 | 1) {
    commit(moveAmongSiblings(map, selected, delta))
  }

  function nudge(dx: number, dy: number) {
    const current = map.nodes[selected]
    apply((m) => updateNode(m, selected, { dx: current.dx + dx, dy: current.dy + dy }), `nudge:${selected}`)
  }

  function navigateSelection(key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') {
    const box = layout.boxes.get(selected)
    const current = map.nodes[selected]
    if (!box || !current) return
    const visibleKids = current.collapsed ? [] : current.children.filter((child) => layout.boxes.has(child))
    const towards = (side: 1 | -1) => {
      if (selected === map.rootId) return visibleKids.find((child) => layout.boxes.get(child)?.side === side) ?? null
      if (box.side === side) return visibleKids[0] ?? null
      return current.parentId
    }
    let target: string | null = null
    if (key === 'ArrowRight') target = towards(1)
    else if (key === 'ArrowLeft') target = towards(-1)
    else if (current.parentId) {
      const siblings = map.nodes[current.parentId].children
        .map((child) => layout.boxes.get(child))
        .filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.side === box.side)
        .sort((a, b) => a.y - b.y)
      const index = siblings.findIndex((item) => item.id === selected)
      target = siblings[index + (key === 'ArrowDown' ? 1 : -1)]?.id ?? null
    }
    if (target) {
      setSelectedId(target)
      ensureVisible(target, layout)
    }
  }

  function toggleCollapse(id: string) {
    const current = map.nodes[id]
    if (!current || !current.children.length) return
    commit(updateNode(map, id, { collapsed: !current.collapsed }))
  }

  function openTask(task: NodeTask) {
    navigate(`/boards/${task.boardId}`)
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const matchList = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return [] as string[]
    const out: string[] = []
    const walk = (id: string) => {
      const item = map.nodes[id]
      if (!item) return
      if (item.text.toLowerCase().includes(needle) || item.note.toLowerCase().includes(needle)) out.push(id)
      item.children.forEach(walk)
    }
    walk(map.rootId)
    return out
  }, [map, query])
  const matches = useMemo(() => new Set(matchList), [matchList])
  const activeMatchId = matchList.length ? matchList[matchIndex % matchList.length] : null

  function focusMatch(id: string) {
    const expanded = expandPath(map, id)
    if (expanded !== map) commit(expanded)
    setSelectedId(id)
    centerOn(id, expanded === map ? layout : computeLayout(expanded))
  }

  function onQueryChange(value: string) {
    setQuery(value)
    setMatchIndex(0)
    const needle = value.trim().toLowerCase()
    if (!needle) return
    const first = Object.values(map.nodes).find((item) => item.text.toLowerCase().includes(needle) || item.note.toLowerCase().includes(needle))
    if (first) focusMatch(first.id)
  }

  function nextMatch(step: 1 | -1) {
    if (!matchList.length) return
    const index = (matchIndex + step + matchList.length) % matchList.length
    setMatchIndex(index)
    focusMatch(matchList[index])
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (isTypingTarget(event.target) || editingRef.current) return
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      if (mod || event.key === 'Meta' || event.key === 'Control') return
      if (event.key === ' ') { event.preventDefault(); setSpacePan(true); return }
      if (event.key === 'Tab') { event.preventDefault(); addNode('child'); return }
      if (event.key === 'Enter') { event.preventDefault(); addNode('sibling'); return }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return }
      if (event.key === 'F2') { event.preventDefault(); startEdit(selected); return }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        if (event.altKey) {
          const step = event.shiftKey ? 40 : 10
          const [dx, dy] = event.key === 'ArrowLeft' ? [-step, 0] : event.key === 'ArrowRight' ? [step, 0] : event.key === 'ArrowUp' ? [0, -step] : [0, step]
          nudge(dx, dy)
        } else {
          navigateSelection(event.key as 'ArrowLeft')
        }
        return
      }
      if (event.key === 'Escape') { setQuery(''); return }
      if (event.key.length === 1 && !event.altKey) {
        event.preventDefault()
        startEdit(selected, event.key)
      }
    }
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyHandler.current(event)
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === ' ') setSpacePan(false) }
    const onBlur = () => setSpacePan(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  async function removeMap() {
    const ok = await confirm({
      title: t('mindmap.delete_title', 'Delete “{{title}}”?', { title: map.title }),
      description: t('mindmap.delete_text', 'The mind map and all its nodes are deleted. This cannot be undone.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok) onDelete()
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen?.()
  }

  const nodeCount = Object.keys(map.nodes).length
  const siblings = node.parentId ? map.nodes[node.parentId].children : []
  const siblingIndex = siblings.indexOf(selected)
  const hint = t(
    'mindmap.hint',
    'Drag a node (or move it with Alt+arrows) · drag empty space to pan (or hold Space) · wheel — zoom · drop onto another node to change its parent',
  )

  return (
    <div ref={rootRef} className={cn('flex h-full min-h-0 flex-col gap-2.5', isFullscreen && 'bg-[var(--background)] p-4')}>
      {/* Row 1: title, saved state, history, search, zoom, view, export, panels, delete */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={map.nodes[map.rootId].text}
          onChange={(event) => apply((m) => updateNode(m, m.rootId, { text: event.target.value }), `text:${map.rootId}`)}
          onBlur={(event) => { if (!event.target.value.trim()) apply((m) => updateNode(m, m.rootId, { text: t('mindmap.untitled', 'New mind map') }), `text:${map.rootId}`) }}
          aria-label={t('mindmap.title_label', 'Mind map name')}
          className="h-[34px] w-full min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13.5px] font-semibold text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none sm:w-[210px]"
        />
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]" aria-live="polite">
          <span className={cn('h-1.5 w-1.5 rounded-full', isSaved ? 'bg-[var(--success-text)]' : 'animate-pulse bg-[var(--warning-text)]')} />
          {isSaved ? t('mindmap.saved', 'Saved') : t('mindmap.saving', 'Saving…')}
          <span className="tabular-nums">· {t('mindmap.node_count', '{{count}} nodes', { count: nodeCount })}</span>
        </span>
        <div className="flex items-center gap-1">
          <ToolButton iconOnly icon={<ArrowArcLeftIcon size={16} />} label={t('mindmap.undo', 'Undo')} kbd="Ctrl+Z" onClick={undo} disabled={!canUndo} />
          <ToolButton iconOnly icon={<ArrowArcRightIcon size={16} />} label={t('mindmap.redo', 'Redo')} kbd="Ctrl+Shift+Z" onClick={redo} disabled={!canRedo} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <label className="relative flex h-[34px] items-center">
            <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-2.5 text-[var(--muted)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1) }
                if (event.key === 'Escape') { setQuery(''); event.currentTarget.blur() }
              }}
              placeholder={t('mindmap.search_short', 'Search')}
              title="Ctrl+F"
              aria-label={t('mindmap.search', 'Search (Ctrl+F)')}
              className="h-[34px] w-[140px] rounded-[10px] border border-[var(--border)] bg-[var(--card)] pr-14 pl-8 text-[12.5px] text-[var(--foreground)] transition-[width] placeholder:text-[var(--muted)] focus:w-[200px] focus:border-[var(--primary)] focus:outline-none"
            />
            {query ? (
              <span className="absolute right-1.5 flex items-center gap-0.5">
                <span className="text-[11px] text-[var(--muted)] tabular-nums">{matchList.length ? `${(matchIndex % matchList.length) + 1}/${matchList.length}` : '0'}</span>
                <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear', 'Clear')} className="grid h-5 w-5 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--muted-surface)]"><XIcon size={11} /></button>
              </span>
            ) : null}
          </label>
          <ToolButton iconOnly icon={isFullscreen ? <ArrowsInIcon size={16} /> : <CornersOutIcon size={16} />} label={isFullscreen ? t('mindmap.exit_fullscreen', 'Exit full screen') : t('mindmap.fullscreen', 'Full screen')} onClick={toggleFullscreen} active={isFullscreen} />
          <div className="relative">
            <ToolButton icon={<DownloadSimpleIcon size={15} />} label={t('mindmap.export', 'Export')} onClick={() => setExportOpen((open) => !open)} active={exportOpen} trailing={<CaretDownIcon size={12} />} />
            {exportOpen ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setExportOpen(false)} />
                <div role="menu" className="absolute top-[calc(100%+6px)] right-0 z-40 min-w-[210px] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--elev-lg)]">
                  {([
                    [ImageIcon, t('mindmap.export_png', 'Image (PNG)'), () => void exportPng(map)],
                    [BezierCurveIcon, t('mindmap.export_svg', 'Vector (SVG)'), () => exportSvg(map)],
                    [ListBulletsIcon, t('mindmap.export_md', 'Outline (Markdown)'), () => exportMarkdown(map)],
                    [FileCodeIcon, t('mindmap.export_json', 'Backup (JSON)'), () => exportJson(map)],
                  ] as const).map(([Icon, label, run]) => (
                    <button
                      key={label}
                      type="button"
                      role="menuitem"
                      onClick={() => { setExportOpen(false); run() }}
                      className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--input-surface)]"
                    >
                      <Icon size={16} weight="duotone" className="text-[var(--muted-strong)]" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <ToolButton iconOnly icon={<SidebarSimpleIcon size={16} className="-scale-x-100" />} label={t('mindmap.inspector_toggle', 'Node panel')} onClick={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) setPrefs((current) => ({ ...current, inspector: !current.inspector }))
            else setMobileInspector((open) => !open)
          }} active={prefs.inspector} />
          <ToolButton iconOnly danger icon={<TrashIcon size={16} />} label={t('mindmap.delete', 'Delete mind map')} onClick={() => void removeMap()} />
        </div>
      </div>

      {/* Row 2: node actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton icon={<ArrowElbowDownRightIcon size={15} />} label={t('mindmap.child', 'Child')} kbd="Tab" onClick={() => addNode('child')} />
        <ToolButton icon={<PlusIcon size={15} />} label={t('mindmap.sibling', 'Sibling')} kbd="Enter" onClick={() => addNode('sibling')} />
        <ToolButton icon={<TrashIcon size={15} />} label={t('mindmap.remove', 'Delete')} onClick={deleteSelected} disabled={selected === map.rootId} danger />
        <ToolButton iconOnly icon={<ArrowUpIcon size={15} />} label={t('mindmap.move_up', 'Move up')} onClick={() => move(-1)} disabled={siblingIndex <= 0} />
        <ToolButton iconOnly icon={<ArrowDownIcon size={15} />} label={t('mindmap.move_down', 'Move down')} onClick={() => move(1)} disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1} />
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
        {canCreateTask ? (
          <ToolButton icon={<ListChecksIcon size={15} />} label={t('mindmap.to_task', 'Turn into a task')} onClick={() => setTaskNode(selected)} disabled={Boolean(node.task)} />
        ) : null}
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
        <ToolButton compact icon={<MagicWandIcon size={15} />} label={t('mindmap.auto_layout', 'Auto layout')} onClick={() => { commit(resetOffsets(map)); window.setTimeout(fit, 0) }} />
        <ToolButton compact icon={<ArrowsInLineVerticalIcon size={15} />} label={t('mindmap.collapse_all', 'Collapse all')} onClick={() => { const next = commit(setAllCollapsed(map, true)); if (!next.nodes[selected] || depthOf(next, selected) > 1) setSelectedId(next.rootId) }} />
        <ToolButton compact icon={<ArrowsOutLineVerticalIcon size={15} />} label={t('mindmap.expand_all', 'Expand all')} onClick={() => commit(setAllCollapsed(map, false))} />
      </div>

      {/* Canvas + inspector */}
      <div className="relative flex min-h-0 flex-1 gap-2.5">
        <div className="relative min-w-0 flex-1">
          <MindCanvas
            map={map}
            layout={layout}
            view={view}
            setView={setView}
            selectedId={selected}
            editingId={editing?.id ?? null}
            editSelectAll={editing?.selectAll ?? true}
            matches={matches}
            activeMatchId={activeMatchId}
            spacePan={spacePan}
            showMinimap={prefs.minimap}
            labels={{
              addChild: t('mindmap.child', 'Child'),
              collapse: t('mindmap.collapse', 'Collapse'),
              expand: t('mindmap.expand', 'Expand'),
              openLink: t('mindmap.open_link', 'Open link'),
              openTask: t('mindmap.open_task', 'Open task'),
              note: t('mindmap.has_note', 'Has a note'),
            }}
            onSize={onSize}
            onSelect={select}
            onStartEdit={(id) => startEdit(id)}
            onEditText={(id, text) => apply((m) => updateNode(m, id, { text }), `text:${id}`)}
            onFinishEdit={finishEdit}
            onAddChild={(id) => addNode('child', id)}
            onToggleCollapse={toggleCollapse}
            onMoveNode={(id, dx, dy) => { const current = map.nodes[id]; if (current) commit(updateNode(map, id, { dx: current.dx + dx, dy: current.dy + dy })) }}
            onReparent={(id, targetId) => { commit(reparent(map, id, targetId)); setSelectedId(id) }}
            onOpenTask={openTask}
          />
          {/* View controls float over the canvas (bottom-left), the hint next to them. */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-3">
            <div data-canvas-ui className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-[12px] border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-[0_8px_24px_-12px_rgba(14,21,37,0.35)] backdrop-blur">
              <ToolButton iconOnly flat icon={<MinusIcon size={15} />} label={t('mindmap.zoom_out', 'Zoom out')} onClick={() => zoomBy(1 / 1.2)} />
              <button
                type="button"
                onClick={() => setViewState((current) => ({ ...current, k: 1 }))}
                title={t('mindmap.zoom_reset', 'Reset to 100%')}
                className="h-[34px] min-w-[50px] rounded-[10px] text-[12.5px] font-semibold text-[var(--foreground)] tabular-nums hover:bg-[var(--input-surface)]"
              >
                {Math.round(view.k * 100)}%
              </button>
              <ToolButton iconOnly flat icon={<PlusIcon size={15} />} label={t('mindmap.zoom_in', 'Zoom in')} onClick={() => zoomBy(1.2)} />
              <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />
              <ToolButton iconOnly flat icon={<ArrowsInIcon size={16} />} label={t('mindmap.fit', 'Fit to screen')} onClick={fit} />
              <ToolButton iconOnly flat icon={<CrosshairIcon size={16} />} label={t('mindmap.center', 'Centre on the selected node')} onClick={() => centerOn(selected)} />
              <ToolButton iconOnly flat icon={<MapTrifoldIcon size={16} />} label={t('mindmap.minimap', 'Minimap')} onClick={() => setPrefs((current) => ({ ...current, minimap: !current.minimap }))} active={prefs.minimap} />
              <span className="group/help relative">
                <ToolButton iconOnly flat icon={<QuestionIcon size={16} />} label={t('mindmap.help', 'How it works')} onClick={() => setHelpOpen((open) => !open)} active={helpOpen} />
                <span className={cn('absolute bottom-[calc(100%+10px)] left-0 w-[300px] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 text-[12px] leading-relaxed text-[var(--muted-strong)] shadow-[var(--elev-lg)]', helpOpen ? 'block' : 'hidden group-hover/help:block')}>
                  {hint.split(' · ').map((line) => <span key={line} className="block">• {line}</span>)}
                  <span className="mt-1.5 block text-[var(--muted)]">{t('mindmap.edit_tip', 'Double-click or start typing to edit')} · Tab / Enter / Delete · Ctrl+Z</span>
                </span>
              </span>
            </div>
          </div>
        </div>
        {prefs.inspector || mobileInspector ? (
          <aside
            className={cn(
              'absolute inset-y-0 right-0 z-10 w-[252px] shrink-0 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_40px_-24px_rgba(14,21,37,0.5)] lg:static lg:shadow-none',
              mobileInspector ? 'block' : 'hidden',
              prefs.inspector ? 'lg:block' : 'lg:hidden',
            )}
          >
            <NodeInspector
              key={selected}
              node={node as MindNode}
              depth={depthOf(map, selected)}
              branchColor={layout.boxes.get(selected)?.color ?? '#2B59FF'}
              canCreateTask={canCreateTask}
              onChange={(patch, field) => apply((m) => updateNode(m, selected, patch), `${field}:${selected}`)}
              onCreateTask={() => setTaskNode(selected)}
              onOpenTask={openTask}
            />
          </aside>
        ) : null}
      </div>

      {taskNode && map.nodes[taskNode] ? (
        <TaskFromNodeDialog
          map={map}
          node={map.nodes[taskNode]}
          onClose={() => setTaskNode(null)}
          onCreated={(task) => {
            commit(updateNode(map, taskNode, { task }))
            setTaskNode(null)
            showToast({ title: t('mindmap.task.done', 'Task created'), description: task.title, tone: 'success' })
          }}
        />
      ) : null}
    </div>
  )
}
