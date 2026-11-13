import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowArcLeftIcon,
  ArrowCounterClockwiseIcon,
  EyeIcon,
  ArrowArcRightIcon,
  ArrowDownIcon,
  ArrowElbowDownRightIcon,
  ArrowUpIcon,
  ArrowsInIcon,
  ArrowsInLineVerticalIcon,
  ArrowsOutLineVerticalIcon,
  BezierCurveIcon,
  CircleDashedIcon,
  FlowArrowIcon,
  LineSegmentIcon,
  ScissorsIcon,
  TreeStructureIcon,
  WaveSineIcon,
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
import { computeLayout, dirOf, H_SIB_GAP, isHorizontal, isHub, V_GAP, type Layout } from '../lib/layout'
import {
  addChild,
  addRelation,
  relationBetween,
  relationsOf,
  removeRelation,
  addSibling,
  depthOf,
  expandPath,
  moveAmongSiblings,
  removeNode,
  reparent,
  resetOffsets,
  setAllCollapsed,
  setEdgeStyle,
  subtreeIds,
  uid,
  addFloating,
  addSiblingAbove,
  detach,
  ensureDirs,
  floatingIds,
  insertParent,
  moveInHub,
  settleFree,
  updateNode,
} from '../lib/tree'
import type { Dir, MindMap, MindNode, NodeTask } from '../lib/types'
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
  /** No `mind_map:edit`: the map can be looked at (and collapsed locally), never changed or saved. */
  readOnly?: boolean
  canExport?: boolean
  canDelete?: boolean
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
        'mm-press inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border text-[12.5px] font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-40',
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

export function MindMapEditor({ initial, autoEditRoot, canCreateTask, onSave, onDelete, readOnly = false, canExport = true, canDelete = true }: Props) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { map, apply, undo, redo, canUndo, canRedo } = useMapHistory(useMemo(() => ensureDirs(initial), [initial]))
  const layout = useMemo(() => computeLayout(map), [map])

  const [selectedId, setSelectedId] = useState(initial.rootId)
  const selected = map.nodes[selectedId] ? selectedId : map.rootId
  const node = map.nodes[selected]

  // `fresh`: a node just created by Tab/Enter/+ — Escape removes it instead of reverting the text.
  const [editing, setEditing] = useState<{ id: string; original: string; selectAll: boolean; fresh?: boolean } | null>(
    autoEditRoot ? { id: initial.rootId, original: initial.nodes[initial.rootId].text, selectAll: true } : null,
  )
  const editingRef = useRef(editing)
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 })
  const setView = useCallback((update: (view: View) => View) => setViewState(update), [])
  const sizeRef = useRef({ w: 0, h: 0 })
  const centeredRef = useRef(false)
  // Camera glides for button-driven moves (fit, centre, zoom buttons, keeping a new node in view).
  const [animateView, setAnimateView] = useState(false)
  const animateTimer = useRef<number | undefined>(undefined)
  const [leavingIds, setLeavingIds] = useState<Set<string>>(() => new Set())
  // A selected tree line (by its child's id): Delete / ✂ cuts it. Only while that line is still on the canvas
  // (undo, a cut or a collapse can take it away; Delete then acts on the highlighted node, as everywhere else).
  const [selectedEdgeId, setSelectedEdge] = useState<string | null>(null)
  const selectedEdge = selectedEdgeId && map.nodes[selectedEdgeId]?.parentId && layout.boxes.has(selectedEdgeId) ? selectedEdgeId : null
  // A selected extra line (by its id): Delete / ✂ removes it.
  const [selectedRelationId, setSelectedRelation] = useState<string | null>(null)
  const relations = useMemo(() => relationsOf(map), [map])
  const selectedRelation = selectedRelationId && relations.some((relation) => relation.id === selectedRelationId) ? selectedRelationId : null
  const [prefs, setPrefs] = useState(readPrefs)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [taskNode, setTaskNode] = useState<string | null>(null)
  const [spacePan, setSpacePan] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Phones: the node panel is an overlay opened on demand; desktop remembers its own preference.
  const [mobileInspector, setMobileInspector] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const newNodeText = t('mindmap.new_node', 'New idea')

  // ── Saving ────────────────────────────────────────────────────────────────
  const [savedMap, setSavedMap] = useState(initial)
  const [saveError, setSaveError] = useState(false)
  const pendingRef = useRef<MindMap | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => {
    // Compare with what was saved last (not with the first version): undoing back to it must be saved too.
    if (readOnly || map === savedMap) return
    pendingRef.current = map
    const timer = window.setTimeout(() => {
      pendingRef.current = null
      void onSaveRef.current(map)
        .then(() => { setSavedMap(map); setSaveError(false) })
        .catch((error: unknown) => {
          setSaveError(true)
          // The page already explained it (conflict dialog / error toast).
          if (!(error as { handled?: boolean } | null)?.handled) showToast({ title: t('mindmap.save_failed', 'Could not save the mind map'), tone: 'error' })
        })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [map, readOnly, savedMap, showToast, t])
  // Leaving the page (or switching maps) with unsaved edits: save right away.
  useEffect(() => () => { if (pendingRef.current) void onSaveRef.current(pendingRef.current) }, [])
  const isSaved = savedMap === map

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

  function glide(update: View | ((current: View) => View)) {
    window.clearTimeout(animateTimer.current)
    setAnimateView(true)
    setViewState(update)
    animateTimer.current = window.setTimeout(() => setAnimateView(false), 450)
  }
  useEffect(() => () => window.clearTimeout(animateTimer.current), [])

  function centerOn(id: string, source: Layout = layout) {
    const box = source.boxes.get(id)
    if (!box) return
    const { w, h } = sizeRef.current
    glide((current) => ({ ...current, x: w / 2 - (box.x + box.w / 2) * current.k, y: h / 2 - (box.y + box.h / 2) * current.k }))
  }

  /** Pan just enough to keep a node on screen (after keyboard actions). */
  function ensureVisible(id: string, source: Layout) {
    const box = source.boxes.get(id)
    if (!box) return
    const { w, h } = sizeRef.current
    const margin = 48
    glide((current) => {
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
    glide({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k })
  }

  function zoomBy(factor: number) {
    const { w, h } = sizeRef.current
    glide((current) => {
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
    setSelectedEdge(null)
    setSelectedRelation(null)
  }

  function selectEdge(id: string | null) {
    setSelectedEdge(id)
    setSelectedRelation(null)
    if (id) setSelectedId(id)
  }

  function selectRelation(id: string | null) {
    setSelectedRelation(id)
    setSelectedEdge(null)
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
      if (state.fresh) removeWithAnimation(state.id)
      else apply((m) => updateNode(m, state.id, { text: state.original }), `text:${state.id}`)
      return
    }
    if (!map.nodes[state.id]?.text.trim()) apply((m) => updateNode(m, state.id, { text: state.original.trim() || newNodeText }), `text:${state.id}`)
    if (mode === 'child') addNode('child', state.id)
    else ensureVisible(state.id, layout)
  }

  function addNode(kind: 'child' | 'sibling' | 'above' | 'parent', from = selected, dir?: Dir) {
    const id = uid()
    if (!map.nodes[from]) return
    // Around a hub (central topic / free node) every add is a new branch.
    if (kind !== 'child' && isHub(map, from)) { addNode('child', from, dir); return }
    let [next] = kind === 'child'
      ? addChild(map, from, newNodeText, id, dir)
      : kind === 'above'
        ? addSiblingAbove(map, from, newNodeText, id)
        : kind === 'parent'
          ? insertParent(map, from, newNodeText, id)
          : addSibling(map, from, newNodeText, id)
    if (!next.nodes[id]) return
    // A sibling of a hand-placed node appears right next to it (not somewhere in the automatic column).
    const reference = map.nodes[from]
    const referenceBox = layout.boxes.get(from)
    if ((kind === 'sibling' || kind === 'above') && reference.px !== undefined && reference.py !== undefined && referenceBox) {
      const added = computeLayout(next).boxes.get(id)
      if (added) {
        const sign = kind === 'sibling' ? 1 : -1
        const along = isHorizontal(referenceBox.dir)
          ? { px: reference.px, py: reference.py + sign * (referenceBox.h / 2 + V_GAP + added.h / 2) }
          : { px: reference.px + sign * (referenceBox.w / 2 + H_SIB_GAP + added.w / 2), py: reference.py }
        next = updateNode(next, id, { px: Math.round(along.px), py: Math.round(along.py) })
      }
    }
    commit(next)
    const nextLayout = computeLayout(next)
    const state = { id, original: newNodeText, selectAll: true, fresh: true }
    editingRef.current = state
    setEditing(state)
    setSelectedId(id)
    ensureVisible(id, nextLayout)
  }

  /** "+" on a side of a node: around a hub a branch that way; otherwise child (outer), parent (inner), sibling (sides). */
  function sideAdd(id: string, side: Dir) {
    const box = layout.boxes.get(id)
    if (!box) return
    if (isHub(map, id)) { addNode('child', id, side); return }
    const opposite: Record<Dir, Dir> = { right: 'left', left: 'right', up: 'down', down: 'up' }
    if (side === box.dir) addNode('child', id)
    else if (side === opposite[box.dir]) addNode('parent', id)
    else addNode(side === 'up' || side === 'left' ? 'above' : 'sibling', id)
  }

  function sideLabel(id: string, side: Dir) {
    const box = layout.boxes.get(id)
    const names: Record<Dir, string> = {
      right: t('mindmap.dir.right', 'right'), left: t('mindmap.dir.left', 'left'), up: t('mindmap.dir.up', 'up'), down: t('mindmap.dir.down', 'down'),
    }
    if (!box || isHub(map, id)) return t('mindmap.add_branch', 'New branch ({{side}})', { side: names[side] })
    const opposite: Record<Dir, Dir> = { right: 'left', left: 'right', up: 'down', down: 'up' }
    if (side === box.dir) return `${t('mindmap.add_child', 'Child (to the side)')} · Tab`
    if (side === opposite[box.dir]) return `${t('mindmap.add_parent', 'Parent (in between)')} · Shift+Tab`
    return side === 'up' || side === 'left' ? `${t('mindmap.add_above', 'Above (sibling)')} · Shift+Enter` : `${t('mindmap.add_below', 'Below (sibling)')} · Enter`
  }

  /**
   * A dragged node was released. On a node → it is connected there. In empty space it stays exactly where it
   * was put (a connected node keeps its line; a branch of the central topic also turns to that side).
   */
  function dropNode(id: string, center: { x: number; y: number }, targetId: string | null) {
    const node = map.nodes[id]
    const box = layout.boxes.get(id)
    if (!node || !box) return
    if (targetId && targetId === node.parentId && !isHub(map, targetId)) return
    if (targetId) {
      const target = layout.boxes.get(targetId)
      let dir: Dir | undefined
      if (target && isHub(map, targetId)) {
        const dx = center.x - (target.x + target.w / 2)
        const dy = center.y - (target.y + target.h / 2)
        dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up')
      }
      // Dropped on its own hub: it only changes side.
      commit(targetId === node.parentId && dir ? moveInHub(map, id, dir, null) : reparent(map, id, targetId, dir))
      setSelectedId(id)
      return
    }
    if (id === map.rootId || !node.parentId) {
      commit(updateNode(map, id, { dx: node.dx + center.x - (box.x + box.w / 2), dy: node.dy + center.y - (box.y + box.h / 2) }))
      return
    }
    // A connected node stays exactly where it was dropped (still connected; it moves with its parent).
    const parent = layout.boxes.get(node.parentId)
    if (!parent) return
    const px = Math.round(center.x - (parent.x + parent.w / 2))
    const py = Math.round(center.y - (parent.y + parent.h / 2))
    commit(updateNode(map, id, { px, py, dx: 0, dy: 0, ...(isHub(map, node.parentId) ? { dir: dirOf(px, py) } : {}) }))
    setSelectedId(id)
  }

  /** A hand-placed node goes back to its automatic place in the branch. */
  function unpin(id = selected) {
    if (!map.nodes[id]) return
    commit(updateNode(map, id, { px: undefined, py: undefined, dx: 0, dy: 0 }))
  }

  /** A free node at a canvas point (double-click on empty space, or the centre of the view). */
  function addFree(x?: number, y?: number) {
    const { w, h } = sizeRef.current
    const px = x ?? (w / 2 - view.x) / view.k
    const py = y ?? (h / 2 - view.y) / view.k
    const id = uid()
    const [added] = addFloating(map, px, py, newNodeText, id)
    // From the toolbar (centre of the view): next to whatever is there, not on top of it.
    const next = x === undefined ? settleFree(added, id) : added
    commit(next)
    const state = { id, original: newNodeText, selectAll: true, fresh: true }
    editingRef.current = state
    setEditing(state)
    setSelectedId(id)
  }

  /** Cut the line to the parent; the node keeps its place as a free node. */
  function detachNode(id = selected) {
    const box = layout.boxes.get(id)
    if (!box || !map.nodes[id]?.parentId) return
    // Only the line goes away: the node stays exactly where it is.
    commit(detach(map, id, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, box.dir))
    setSelectedEdge(null)
    setSelectedRelation(null)
    setSelectedId(id)
    showToast({
      title: t('mindmap.cut_done_v3', 'Line cut — the node stays where it is'),
      description: t('mindmap.cut_done_v3_hint', 'To connect it again, pull a line from its corner handle onto another node, or drag the node onto one. Ctrl+Z undoes it.'),
      tone: 'info',
    })
  }

  /** Connects `id` under `parentId` without moving it: it keeps its spot (hand-placed next to the new parent). */
  function attachKeeping(current: MindMap, id: string, parentId: string): MindMap {
    const box = layout.boxes.get(id)
    const parent = layout.boxes.get(parentId)
    if (!box || !parent) return current
    const px = Math.round(box.x + box.w / 2 - (parent.x + parent.w / 2))
    const py = Math.round(box.y + box.h / 2 - (parent.y + parent.h / 2))
    const next = reparent(current, id, parentId, isHub(current, parentId) ? dirOf(px, py) : undefined)
    return next === current ? current : updateNode(next, id, { px, py, dx: 0, dy: 0 })
  }

  /**
   * A tree line was pulled onto another node: its child (with its whole branch) is now connected there and keeps
   * its spot on the canvas. Only this one line changes — no other node loses its line.
   */
  function reconnectLine(edgeId: string, targetId: string) {
    const child = map.nodes[edgeId]
    if (!child?.parentId || targetId === child.parentId || targetId === edgeId) return
    const next = attachKeeping(map, edgeId, targetId)
    if (next === map) {
      showToast({ title: t('mindmap.line_invalid', 'This line cannot go there (it would make a loop)'), tone: 'error' })
      return
    }
    commit(next)
    setSelectedId(edgeId)
    setSelectedEdge(edgeId)
    setSelectedRelation(null)
  }

  /**
   * A new line from `sourceId` to `targetId`. A node without a line (a free node) gets connected by it. When both
   * nodes already have their lines, the new one is an extra link: the tree stays exactly as it is, nothing is cut.
   */
  function connectNodes(sourceId: string, targetId: string) {
    const source = map.nodes[sourceId]
    const target = map.nodes[targetId]
    if (!source || !target || sourceId === targetId) return
    if (target.parentId === sourceId || source.parentId === targetId || relationBetween(map, sourceId, targetId)) {
      showToast({ title: t('mindmap.line_exists', 'These nodes are already connected'), tone: 'info' })
      return
    }
    const free = (id: string) => id !== map.rootId && map.nodes[id]?.parentId === null
    // The node the line was drawn to joins first; a free source joins the target otherwise.
    const attempts: Array<[string, string]> = []
    if (free(targetId)) attempts.push([targetId, sourceId])
    if (free(sourceId)) attempts.push([sourceId, targetId])
    for (const [child, parent] of attempts) {
      const next = attachKeeping(map, child, parent)
      if (next !== map) {
        commit(next)
        setSelectedId(child)
        setSelectedEdge(child)
        setSelectedRelation(null)
        return
      }
    }
    const id = uid()
    const next = addRelation(map, sourceId, targetId, id)
    if (next === map) return
    commit(next)
    setSelectedEdge(null)
    setSelectedRelation(id)
    showToast({ title: t('mindmap.relation_added', 'Link added'), description: t('mindmap.relation_added_hint', 'Both nodes keep their own lines. Click the dashed link and press Delete to remove it.'), tone: 'info' })
  }

  function removeRelationById(id: string) {
    commit(removeRelation(map, id))
    setSelectedRelation(null)
  }

  /** Fade the node (and its subtree) out, then remove it — one undo step. */
  function removeWithAnimation(id: string) {
    if (id === map.rootId) {
      showToast({ title: t('mindmap.root_delete', 'The central topic cannot be deleted'), tone: 'info' })
      return
    }
    if (!map.nodes[id] || leavingIds.has(id)) return
    const [, nextSelected] = removeNode(map, id)
    const doomed = subtreeIds(map, id)
    setLeavingIds((current) => new Set([...current, ...doomed]))
    setSelectedId(nextSelected)
    setSelectedEdge(null)
    setSelectedRelation(null)
    window.setTimeout(() => {
      apply((current) => removeNode(current, id)[0])
      setLeavingIds((current) => {
        const next = new Set(current)
        for (const key of doomed) next.delete(key)
        return next
      })
    }, 190)
  }

  function deleteSelected() {
    removeWithAnimation(selected)
  }

  function move(delta: -1 | 1) {
    commit(moveAmongSiblings(map, selected, delta))
  }

  function nudge(dx: number, dy: number) {
    const current = map.nodes[selected]
    if (!current) return
    if (current.parentId) {
      // A connected node becomes hand-placed at its current spot, then moves.
      const box = layout.boxes.get(selected)
      const parent = layout.boxes.get(current.parentId)
      if (!box || !parent) return
      const px = Math.round(box.x + box.w / 2 - (parent.x + parent.w / 2) + dx)
      const py = Math.round(box.y + box.h / 2 - (parent.y + parent.h / 2) + dy)
      apply((m) => updateNode(m, selected, { px, py, dx: 0, dy: 0, ...(isHub(m, current.parentId!) ? { dir: dirOf(px, py) } : {}) }), `nudge:${selected}`)
      return
    }
    apply((m) => updateNode(m, selected, { dx: current.dx + dx, dy: current.dy + dy }), `nudge:${selected}`)
  }

  /** Arrow keys: the nearest node in that direction (works the same on every side of the map). */
  function navigateSelection(key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') {
    const box = layout.boxes.get(selected)
    if (!box) return
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const [ux, uy] = key === 'ArrowRight' ? [1, 0] : key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowDown' ? [0, 1] : [0, -1]
    let best: { id: string; score: number } | null = null
    for (const other of layout.boxes.values()) {
      if (other.id === selected) continue
      const dx = other.x + other.w / 2 - cx
      const dy = other.y + other.h / 2 - cy
      const along = dx * ux + dy * uy
      if (along <= 4) continue
      const across = Math.abs(dx * uy - dy * ux)
      const score = along + across * 2
      if (!best || score < best.score) best = { id: other.id, score }
    }
    if (best) {
      setSelectedId(best.id)
      ensureVisible(best.id, layout)
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
    floatingIds(map).forEach(walk)
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
      if (readOnly) {
        if (event.key === ' ' && !mod) { event.preventDefault(); setSpacePan(true) }
        else if (event.key.startsWith('Arrow') && !event.altKey && !mod) { event.preventDefault(); navigateSelection(event.key as 'ArrowLeft') }
        else if (event.key === 'Escape') setQuery('')
        return
      }
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      if (mod || event.key === 'Meta' || event.key === 'Control') return
      if (event.key === ' ') { event.preventDefault(); setSpacePan(true); return }
      if (event.key === 'Tab') { event.preventDefault(); addNode(event.shiftKey ? 'parent' : 'child'); return }
      if (event.key === 'Enter') { event.preventDefault(); addNode(event.shiftKey ? 'above' : 'sibling'); return }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        if (selectedRelation) removeRelationById(selectedRelation)
        else if (selectedEdge) detachNode(selectedEdge)
        else deleteSelected()
        return
      }
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
      if (event.key === 'Escape') { setQuery(''); setSelectedEdge(null); setSelectedRelation(null); return }
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
    <div ref={rootRef} className={cn('mm-fade-up flex h-full min-h-0 flex-col gap-2.5', isFullscreen && 'bg-[var(--background)] p-4')}>
      {/* Row 1: title, saved state, history, search, zoom, view, export, panels, delete */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={map.nodes[map.rootId].text}
          onChange={(event) => apply((m) => updateNode(m, m.rootId, { text: event.target.value }), `text:${map.rootId}`)}
          onBlur={(event) => { if (!event.target.value.trim()) apply((m) => updateNode(m, m.rootId, { text: t('mindmap.untitled', 'New mind map') }), `text:${map.rootId}`) }}
          aria-label={t('mindmap.title_label', 'Mind map name')}
          readOnly={readOnly}
          className="h-[34px] w-full min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13.5px] font-semibold text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none sm:w-[210px]"
        />
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]" aria-live="polite">
          {readOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted-surface)] px-2 py-0.5 font-semibold text-[var(--muted-strong)]">
              <EyeIcon size={13} weight="bold" />
              {t('mindmap.read_only', 'View only')}
            </span>
          ) : (
            <>
              <span className={cn('h-1.5 w-1.5 rounded-full', saveError && !isSaved ? 'bg-[var(--danger)]' : isSaved ? 'bg-[var(--success-text)]' : 'animate-pulse bg-[var(--warning-text)]')} />
              <span className={cn(saveError && !isSaved && 'font-semibold text-[var(--danger-text)]')}>
                {saveError && !isSaved ? t('mindmap.not_saved', 'Not saved') : isSaved ? t('mindmap.saved', 'Saved') : t('mindmap.saving', 'Saving…')}
              </span>
            </>
          )}
          <span className="tabular-nums">· {t('mindmap.node_count', '{{count}} nodes', { count: nodeCount })}</span>
        </span>
        {!readOnly ? (
          <div className="flex items-center gap-1">
            <ToolButton iconOnly icon={<ArrowArcLeftIcon size={16} />} label={t('mindmap.undo', 'Undo')} kbd="Ctrl+Z" onClick={undo} disabled={!canUndo} />
            <ToolButton iconOnly icon={<ArrowArcRightIcon size={16} />} label={t('mindmap.redo', 'Redo')} kbd="Ctrl+Shift+Z" onClick={redo} disabled={!canRedo} />
          </div>
        ) : null}

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
          {canExport ? <div className="relative">
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
          </div> : null}
          <ToolButton iconOnly icon={<SidebarSimpleIcon size={16} className="-scale-x-100" />} label={t('mindmap.inspector_toggle', 'Node panel')} onClick={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) setPrefs((current) => ({ ...current, inspector: !current.inspector }))
            else setMobileInspector((open) => !open)
          }} active={prefs.inspector} />
          {canDelete ? <ToolButton iconOnly danger icon={<TrashIcon size={16} />} label={t('mindmap.delete', 'Delete mind map')} onClick={() => void removeMap()} /> : null}
        </div>
      </div>

      {/* Row 2: node actions */}
      {!readOnly ? <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton icon={<ArrowElbowDownRightIcon size={15} />} label={t('mindmap.child', 'Child')} kbd="Tab" onClick={() => addNode('child')} />
        <div className="relative">
          <ToolButton icon={<PlusIcon size={15} />} label={t('mindmap.add', 'Add')} onClick={() => setAddOpen((open) => !open)} active={addOpen} trailing={<CaretDownIcon size={12} />} />
          {addOpen ? (
            <>
              <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setAddOpen(false)} />
              <div role="menu" className="mm-pop absolute top-[calc(100%+6px)] left-0 z-40 min-w-[250px] rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--elev-lg)]">
                {([
                  ['child', ArrowElbowDownRightIcon, t('mindmap.add_child', 'Child (to the side)'), 'Tab', false],
                  ['sibling', ArrowDownIcon, t('mindmap.add_below', 'Below (sibling)'), 'Enter', !node.parentId],
                  ['above', ArrowUpIcon, t('mindmap.add_above', 'Above (sibling)'), 'Shift+Enter', !node.parentId],
                  ['parent', TreeStructureIcon, t('mindmap.add_parent', 'Parent (in between)'), 'Shift+Tab', !node.parentId],
                  ['free', CircleDashedIcon, t('mindmap.add_free', 'Free node (anywhere)'), t('mindmap.double_click', 'Double-click'), false],
                ] as const).map(([kind, Icon, label, kbd, disabled]) => (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    onClick={() => { setAddOpen(false); if (kind === 'free') addFree(); else addNode(kind) }}
                    className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--input-surface)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Icon size={16} weight="duotone" className="text-[var(--muted-strong)]" />
                    <span className="flex-1">{label}</span>
                    <Kbd>{kbd}</Kbd>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <ToolButton icon={<TrashIcon size={15} />} label={t('mindmap.remove', 'Delete')} onClick={deleteSelected} disabled={selected === map.rootId} danger />
        {selectedRelation ? (
          <ToolButton iconOnly icon={<ScissorsIcon size={15} />} label={t('mindmap.cut_relation', 'Remove this link')} onClick={() => removeRelationById(selectedRelation)} danger />
        ) : (
          <ToolButton iconOnly icon={<ScissorsIcon size={15} />} label={t('mindmap.cut', 'Remove the line to the parent')} onClick={() => detachNode()} disabled={!node.parentId} />
        )}
        {node.px !== undefined && node.py !== undefined ? (
          <ToolButton compact icon={<ArrowCounterClockwiseIcon size={15} />} label={t('mindmap.unpin', 'Back to its place')} onClick={() => unpin()} />
        ) : null}
        <ToolButton iconOnly icon={<ArrowUpIcon size={15} />} label={t('mindmap.move_up', 'Move up')} onClick={() => move(-1)} disabled={siblingIndex <= 0} />
        <ToolButton iconOnly icon={<ArrowDownIcon size={15} />} label={t('mindmap.move_down', 'Move down')} onClick={() => move(1)} disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1} />
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
        {canCreateTask ? (
          <ToolButton icon={<ListChecksIcon size={15} />} label={t('mindmap.to_task', 'Turn into a task')} onClick={() => setTaskNode(selected)} disabled={Boolean(node.task)} />
        ) : null}
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
        <div role="radiogroup" aria-label={t('mindmap.edge_style', 'Line style')} className="inline-flex h-[34px] shrink-0 items-center gap-0.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-0.5">
          {([
            ['curved', WaveSineIcon, t('mindmap.edge_curved', 'Curved lines')],
            ['straight', LineSegmentIcon, t('mindmap.edge_straight', 'Straight lines')],
            ['elbow', FlowArrowIcon, t('mindmap.edge_elbow', 'Elbow lines')],
          ] as const).map(([value, Icon, label]) => {
            const active = (map.edgeStyle ?? 'curved') === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                title={label}
                aria-label={label}
                onClick={() => commit(setEdgeStyle(map, value))}
                className={cn('mm-press grid h-[28px] w-[30px] place-items-center rounded-[8px]', active ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)]')}
              >
                <Icon size={15} weight={active ? 'bold' : 'regular'} />
              </button>
            )
          })}
        </div>
        <ToolButton compact icon={<MagicWandIcon size={15} />} label={t('mindmap.auto_layout', 'Auto layout')} onClick={() => { commit(resetOffsets(map)); window.setTimeout(fit, 0) }} />
        <ToolButton compact icon={<ArrowsInLineVerticalIcon size={15} />} label={t('mindmap.collapse_all', 'Collapse all')} onClick={() => { const next = commit(setAllCollapsed(map, true)); if (!next.nodes[selected] || depthOf(next, selected) > 1) setSelectedId(next.rootId) }} />
        <ToolButton compact icon={<ArrowsOutLineVerticalIcon size={15} />} label={t('mindmap.expand_all', 'Expand all')} onClick={() => commit(setAllCollapsed(map, false))} />
      </div> : null}

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
            readOnly={readOnly}
            labels={{
              collapse: t('mindmap.collapse', 'Collapse'),
              expand: t('mindmap.expand', 'Expand'),
              openLink: t('mindmap.open_link', 'Open link'),
              openTask: t('mindmap.open_task', 'Open task'),
              note: t('mindmap.has_note', 'Has a note'),
              remove: t('mindmap.remove', 'Delete'),
              cut: t('mindmap.cut', 'Remove the line to the parent'),
              cutRelation: t('mindmap.cut_relation', 'Remove this link'),
              side: sideLabel,
              drawLine: t('mindmap.draw_line', 'Draw a line: drag onto another node'),
              moveLine: t('mindmap.move_line', 'Drag onto another node — this branch moves there'),
            }}
            onSideAdd={sideAdd}
            selectedEdge={selectedEdge}
            onSelectEdge={selectEdge}
            selectedRelation={selectedRelation}
            onSelectRelation={selectRelation}
            onRemoveRelation={removeRelationById}
            onDetach={detachNode}
            onReconnect={reconnectLine}
            onConnect={connectNodes}
            onCreateFree={(x, y) => addFree(x, y)}
            leavingIds={leavingIds}
            animateView={animateView}
            onDeleteNode={removeWithAnimation}
            onSize={onSize}
            onSelect={select}
            onStartEdit={(id) => startEdit(id)}
            onEditText={(id, text) => apply((m) => updateNode(m, id, { text }), `text:${id}`)}
            onFinishEdit={finishEdit}
            onToggleCollapse={toggleCollapse}
            onDropNode={dropNode}
            onOpenTask={openTask}
          />
          {/* View controls float over the canvas (bottom-left), the hint next to them. */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-3">
            <div data-canvas-ui className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-[12px] border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-[0_8px_24px_-12px_rgba(14,21,37,0.35)] backdrop-blur">
              <ToolButton iconOnly flat icon={<MinusIcon size={15} />} label={t('mindmap.zoom_out', 'Zoom out')} onClick={() => zoomBy(1 / 1.2)} />
              <button
                type="button"
                onClick={() => {
                  const { w, h } = sizeRef.current
                  glide((current) => ({ k: 1, x: w / 2 - (w / 2 - current.x) / current.k, y: h / 2 - (h / 2 - current.y) / current.k }))
                }}
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
                  {t('mindmap.hint_v3', 'Select a node — “+” on every side adds there (around the central topic: a branch that way) · drag a node anywhere — it stays there and keeps its line; drop it onto another node to move it there · click a line: ✂ or Delete cuts it, pulling the line onto another node moves that branch there · pull the handle at a selected node’s corner onto another node: a free node gets connected, two connected nodes get a dashed link — no line is ever cut by it · “Back to its place” or Auto layout tidies nodes up').split(' · ').map((line) => <span key={line} className="block">• {line}</span>)}
                  <span className="mt-1.5 block text-[var(--muted)]">{t('mindmap.edit_tip', 'Double-click or start typing to edit')} · Tab / Enter / Delete · Ctrl+Z</span>
                </span>
              </span>
            </div>
          </div>
        </div>
        {prefs.inspector || mobileInspector ? (
          <aside
            className={cn(
              'mm-panel-in absolute inset-y-0 right-0 z-10 w-[252px] shrink-0 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_40px_-24px_rgba(14,21,37,0.5)] lg:static lg:shadow-none',
              mobileInspector ? 'block' : 'hidden',
              prefs.inspector ? 'lg:block' : 'lg:hidden',
            )}
          >
            <fieldset disabled={readOnly} className="m-0 h-full min-w-0 border-0 p-0">
            <NodeInspector
              key={selected}
              node={node as MindNode}
              depth={layout.boxes.get(selected)?.depth ?? depthOf(map, selected)}
              branchColor={layout.boxes.get(selected)?.color ?? '#2B59FF'}
              canCreateTask={canCreateTask}
              onChange={(patch, field) => apply((m) => updateNode(m, selected, patch), `${field}:${selected}`)}
              onCreateTask={() => setTaskNode(selected)}
              onOpenTask={openTask}
            />
            </fieldset>
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
