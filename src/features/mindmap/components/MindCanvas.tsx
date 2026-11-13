import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { CheckSquareIcon, LineSegmentIcon, LinkSimpleIcon, NoteIcon, PlusIcon, ScissorsIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '../../../shared/lib/cn'
import { borderPoint, computeLayout, edgeCutPoint, edgeEnds, edgePath, isHub, relationGeometry, type Layout, type NodeBox } from '../lib/layout'
import { relationsOf, subtreeIds, updateNode } from '../lib/tree'
import type { Dir, MindMap, MindNode, NodeTask } from '../lib/types'
import { clampZoom, type View } from '../lib/view'
import { Minimap } from './Minimap'

type Point = { x: number; y: number }
type DragState = { id: string; dx: number; dy: number; targetId: string | null }
/** A line being drawn or moved: from a fixed point to the pointer (world coordinates). */
type LineDrag = { from: Point; to: Point; targetId: string | null; color: string; /** The tree line being moved (hidden meanwhile). */ edgeId: string | null }
/** A line on the canvas: a tree line (by its child's id) or an extra line (by its id). */
type LineRef = { kind: 'edge' | 'rel'; id: string }

type Props = {
  map: MindMap
  layout: Layout
  view: View
  setView: (update: (view: View) => View) => void
  selectedId: string
  editingId: string | null
  /** Select the whole text when editing starts (false when editing was started by typing a letter). */
  editSelectAll: boolean
  matches: Set<string>
  activeMatchId: string | null
  spacePan: boolean
  showMinimap: boolean
  /** View only: no adding, editing, dragging or cutting. */
  readOnly?: boolean
  /** Nodes playing their exit animation (removed right after). */
  leavingIds: Set<string>
  /** Glide the camera (button-driven moves); wheel and drag stay instant. */
  animateView: boolean
  labels: {
    collapse: string
    expand: string
    openLink: string
    openTask: string
    note: string
    remove: string
    cut: string
    cutRelation: string
    side: (id: string, side: Dir) => string
    drawLine: string
    moveLine: string
  }
  onSize: (size: { w: number; h: number }) => void
  onSelect: (id: string) => void
  onStartEdit: (id: string) => void
  onEditText: (id: string, text: string) => void
  onFinishEdit: (mode: 'commit' | 'cancel' | 'child') => void
  onToggleCollapse: (id: string) => void
  /** A node was dragged and released: `center` = where it ended (world), `targetId` = the node it was dropped on. */
  onDropNode: (id: string, center: { x: number; y: number }, targetId: string | null) => void
  onOpenTask: (task: NodeTask) => void
  onDeleteNode: (id: string) => void
  /** "+" on a side of the selected node. */
  onSideAdd: (id: string, side: Dir) => void
  /** Cut the line between this node and its parent. */
  onDetach: (id: string) => void
  /** A tree line (by its child's id) was pulled onto another node: the child moves under `targetId`. */
  onReconnect: (edgeId: string, targetId: string) => void
  /** A new line was drawn from one node to another. */
  onConnect: (sourceId: string, targetId: string) => void
  /** A tree line is selected (by its child's id), or nothing. */
  selectedEdge: string | null
  onSelectEdge: (id: string | null) => void
  /** An extra line is selected (by its id), or nothing. */
  selectedRelation: string | null
  onSelectRelation: (id: string | null) => void
  onRemoveRelation: (id: string) => void
  /** Double-click on empty canvas: a free node at that point (world coordinates). */
  onCreateFree: (x: number, y: number) => void
}

/** Absolute position of a control centred on a side of the node, `offset` px outside it. */
function sidePosition(side: Dir, offset: number, size: number): CSSProperties {
  const half = size / 2
  if (side === 'up') return { top: -offset - half + 2, left: `calc(50% - ${half}px)` }
  if (side === 'down') return { bottom: -offset - half + 2, left: `calc(50% - ${half}px)` }
  if (side === 'left') return { left: -offset - half + 2, top: `calc(50% - ${half}px)` }
  return { right: -offset - half + 2, top: `calc(50% - ${half}px)` }
}

const fontClass = (depth: number) =>
  depth === 0 ? 'text-[17px] leading-6 font-bold' : depth === 1 ? 'text-[14.5px] leading-5 font-semibold' : 'text-[13.5px] leading-5 font-medium'

function nodeStyle(node: MindNode, box: NodeBox): CSSProperties {
  const radius = node.shape === 'pill' ? box.h / 2 : node.shape === 'rect' ? 4 : box.depth === 0 ? 16 : 11
  const base: CSSProperties = { left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius }
  if (node.shape === 'outline') return { ...base, background: 'var(--card)', border: `2px solid ${box.color}`, color: box.depth === 0 ? box.color : 'var(--foreground)' }
  if (box.depth === 0) return { ...base, background: box.color, border: `1px solid ${box.color}`, color: '#fff' }
  if (box.floating) return { ...base, background: 'var(--card)', border: `1.5px dashed color-mix(in srgb, ${box.color} 70%, transparent)`, color: 'var(--foreground)' }
  return {
    ...base,
    background: `color-mix(in srgb, ${box.color} 12%, var(--card))`,
    border: `1px solid color-mix(in srgb, ${box.color} 40%, transparent)`,
    color: 'var(--foreground)',
  }
}

/** A straight dashed preview between two boxes (border to border). */
function linkBetween(a: NodeBox, b: NodeBox) {
  const start = borderPoint(a, b.x + b.w / 2, b.y + b.h / 2, 3)
  const end = borderPoint(b, a.x + a.w / 2, a.y + a.h / 2, 3)
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
}

const sameLine = (a: LineRef | null, b: LineRef | null) => Boolean(a && b && a.kind === b.kind && a.id === b.id)

/** How long a hovered line keeps its ✂ button after the pointer leaves it (time to reach the button). */
const HOVER_GRACE_MS = 260

export function MindCanvas(props: Props) {
  const { map, layout, view, setView, selectedId, editingId, editSelectAll, matches, activeMatchId, spacePan, showMinimap, leavingIds, animateView, labels } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef(view)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<DragState | null>(null)
  const [panning, setPanning] = useState(false)
  const [hoverLine, setHoverLine] = useState<LineRef | null>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const [lineDrag, setLineDrag] = useState<LineDrag | null>(null)
  const { onSize } = props

  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  // Container size (fit / centre / minimap need it).
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const next = { w: entry.contentRect.width, h: entry.contentRect.height }
      setSize(next)
      onSize(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onSize])

  // Wheel = zoom around the cursor (also trackpad pinch, which arrives as ctrl+wheel).
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015))
      setView((current) => {
        const k = clampZoom(current.k * factor)
        const ratio = k / current.k
        return { k, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio }
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [setView])

  // While dragging, show the node (and its subtree) where it would land.
  const shown = useMemo(() => {
    if (!drag || (drag.dx === 0 && drag.dy === 0)) return layout
    const node = map.nodes[drag.id]
    return node ? computeLayout(updateNode(map, drag.id, { dx: node.dx + drag.dx, dy: node.dy + drag.dy })) : layout
  }, [drag, layout, map])

  function hover(line: LineRef) {
    window.clearTimeout(hoverTimer.current)
    setHoverLine((current) => (sameLine(current, line) ? current : line))
  }

  function unhover(line: LineRef) {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHoverLine((current) => (sameLine(current, line) ? null : current)), HOVER_GRACE_MS)
  }

  function toWorld(event: { clientX: number; clientY: number }): Point {
    const rect = containerRef.current?.getBoundingClientRect()
    const current = viewRef.current
    return { x: (event.clientX - (rect?.left ?? 0) - current.x) / current.k, y: (event.clientY - (rect?.top ?? 0) - current.y) / current.k }
  }

  /** The node under the pointer (not one of `exclude`). */
  function nodeAt(event: { clientX: number; clientY: number }, exclude: Set<string>) {
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      const id = (element as HTMLElement).closest?.('[data-node-id]')?.getAttribute('data-node-id')
      if (id && !exclude.has(id)) return id
    }
    return null
  }

  function startPan(event: ReactPointerEvent) {
    const start = { cx: event.clientX, cy: event.clientY, x: view.x, y: view.y }
    setPanning(true)
    const move = (e: PointerEvent) => setView((current) => ({ ...current, x: start.x + e.clientX - start.cx, y: start.y + e.clientY - start.cy }))
    const up = () => {
      setPanning(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function onBackgroundDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (props.readOnly || (event.target as HTMLElement).closest('[data-node-id],[data-canvas-ui],[data-edge-id],[data-rel-id]')) return
    const point = toWorld(event)
    props.onCreateFree(point.x, point.y)
  }

  function onBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('[data-node-id],[data-canvas-ui]') && !spacePan && event.button !== 1) return
    event.preventDefault()
    if (props.selectedEdge) props.onSelectEdge(null)
    if (props.selectedRelation) props.onSelectRelation(null)
    startPan(event)
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0 || spacePan || editingId === id) return
    if ((event.target as HTMLElement).closest('button,a,textarea')) return
    event.stopPropagation()
    props.onSelect(id)
    if (props.readOnly) return
    const k = view.k
    const start = { cx: event.clientX, cy: event.clientY }
    const dragged = new Set(subtreeIds(map, id))
    let moved = false
    let last: DragState = { id, dx: 0, dy: 0, targetId: null }
    const move = (e: PointerEvent) => {
      const dxScreen = e.clientX - start.cx
      const dyScreen = e.clientY - start.cy
      if (!moved && Math.hypot(dxScreen, dyScreen) < 4) return
      moved = true
      // The central topic is never connected to anything: it only moves.
      const targetId = id === map.rootId ? null : nodeAt(e, dragged)
      last = { id, dx: dxScreen / k, dy: dyScreen / k, targetId }
      setDrag(last)
    }
    const finish = (drop: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', onKey, true)
      setDrag(null)
      if (!drop || !moved) return
      const box = layout.boxes.get(id)
      if (!box) return
      props.onDropNode(id, { x: box.x + box.w / 2 + last.dx, y: box.y + box.h / 2 + last.dy }, last.targetId)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onKey, true)
  }

  /**
   * Pull a line from a fixed point to a node. `exclude`: nodes it may not land on. `threshold`: screen px the
   * pointer must move before the drag starts (a plain click stays a click). Released over a node → `done(id)`;
   * over empty space, or Escape → nothing changes.
   */
  function startLineDrag(
    event: ReactPointerEvent,
    options: { from: Point; color: string; exclude: Set<string>; edgeId?: string | null; threshold?: number; done: (targetId: string) => void },
  ) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const threshold = options.threshold ?? 0
    let active = threshold === 0
    let last: LineDrag = { from: options.from, to: toWorld(event), targetId: null, color: options.color, edgeId: options.edgeId ?? null }
    if (active) setLineDrag(last)
    const move = (e: PointerEvent) => {
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return
        active = true
      }
      last = { ...last, to: toWorld(e), targetId: nodeAt(e, options.exclude) }
      setLineDrag(last)
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', onKey, true)
      setLineDrag(null)
      if (commit && active && last.targetId) options.done(last.targetId)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onKey, true)
  }

  // A dragged node held over another node: its line will go there — show that line, hide the old one.
  const dragTarget = drag?.targetId ? shown.boxes.get(drag.targetId) : undefined
  const draggedBox = drag ? shown.boxes.get(drag.id) : undefined
  const changesParent = Boolean(drag?.targetId && map.nodes[drag.id]?.parentId !== drag.targetId)

  const edges = shown.order.flatMap((id) => {
    const node = map.nodes[id]
    const parent = node?.parentId ? shown.boxes.get(node.parentId) : undefined
    const child = shown.boxes.get(id)
    if (!parent || !child) return []
    if (lineDrag?.edgeId === id || (changesParent && drag?.id === id)) return []
    return [{ id, d: edgePath(parent, child, map.edgeStyle), color: child.color, depth: child.depth, cut: edgeCutPoint(parent, child, map.edgeStyle), ends: edgeEnds(parent, child), parentId: parent.id }]
  })
  const relations = relationsOf(map).flatMap((relation) => {
    const from = shown.boxes.get(relation.from)
    const to = shown.boxes.get(relation.to)
    return from && to ? [{ ...relation, ...relationGeometry(from, to) }] : []
  })
  const pad = 400
  const svgBox = {
    x: Math.floor(shown.bounds.minX - pad),
    y: Math.floor(shown.bounds.minY - pad),
    w: Math.ceil(shown.bounds.maxX - shown.bounds.minX + pad * 2),
    h: Math.ceil(shown.bounds.maxY - shown.bounds.minY + pad * 2),
  }
  const busy = Boolean(drag || lineDrag)
  const selectedLineRef: LineRef | null = props.selectedRelation ? { kind: 'rel', id: props.selectedRelation } : props.selectedEdge ? { kind: 'edge', id: props.selectedEdge } : null
  const isActiveLine = (line: LineRef) => sameLine(selectedLineRef, line) || sameLine(hoverLine, line)
  // The selected tree line shows a handle at its parent end: pull it (or the line itself) onto another node.
  const selectedEdgeShape = busy || props.readOnly ? undefined : edges.find((edge) => edge.id === props.selectedEdge)
  // ✂ buttons (beside the line, not on it): for the selected line and for the one under the pointer.
  const cutButtons = busy || props.readOnly ? [] : [selectedLineRef, sameLine(hoverLine, selectedLineRef) ? null : hoverLine].flatMap((line) => {
    if (!line) return []
    if (line.kind === 'edge') {
      const edge = edges.find((item) => item.id === line.id)
      return edge && !leavingIds.has(edge.id) ? [{ line, at: edge.cut, label: labels.cut }] : []
    }
    const relation = relations.find((item) => item.id === line.id)
    return relation && !leavingIds.has(relation.from) && !leavingIds.has(relation.to) ? [{ line, at: relation.cut, label: labels.cutRelation }] : []
  })
  const lineDragTarget = lineDrag?.targetId ? shown.boxes.get(lineDrag.targetId) : undefined
  const lineDragEnd = lineDrag ? (lineDragTarget ? borderPoint(lineDragTarget, lineDrag.from.x, lineDrag.from.y, 3) : lineDrag.to) : null

  /** Pull a tree line (from its child end) onto another node. */
  function grabEdge(event: ReactPointerEvent, edge: (typeof edges)[number], threshold: number) {
    startLineDrag(event, {
      from: { x: edge.ends.x2, y: edge.ends.y2 },
      color: edge.color,
      // Never into its own branch; its current parent changes nothing.
      exclude: new Set([...subtreeIds(map, edge.id), edge.parentId]),
      edgeId: edge.id,
      threshold,
      done: (targetId) => props.onReconnect(edge.id, targetId),
    })
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onBackgroundPointerDown}
      onDoubleClick={onBackgroundDoubleClick}
      className={cn(
        'mm-canvas relative h-full min-h-0 w-full touch-none overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] select-none',
        !drag && 'mm-animated',
        animateView && 'mm-bg-animate',
        spacePan || panning ? 'cursor-grabbing' : 'cursor-default',
        spacePan && !panning && 'cursor-grab',
        lineDrag && 'cursor-crosshair',
      )}
      style={{
        backgroundImage: 'radial-gradient(var(--mm-dot) 1.1px, transparent 1.3px)',
        backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className={cn('absolute top-0 left-0 origin-top-left will-change-transform', animateView && 'mm-world-animate')} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {/* Sized to the whole map: the browser only lets you click lines inside the svg's own box. */}
        <svg
          className="pointer-events-none absolute overflow-visible"
          style={{ left: svgBox.x, top: svgBox.y }}
          width={svgBox.w}
          height={svgBox.h}
          viewBox={`${svgBox.x} ${svgBox.y} ${svgBox.w} ${svgBox.h}`}
          aria-hidden="true"
        >
          {/* Halo under the selected tree line */}
          {edges.filter((edge) => edge.id === props.selectedEdge).map((edge) => (
            <path key={`halo-${edge.id}`} d={edge.d} fill="none" stroke="var(--primary)" strokeOpacity={0.18} strokeWidth={10} strokeLinecap="round" />
          ))}
          {edges.map((edge) => {
            const active = isActiveLine({ kind: 'edge', id: edge.id })
            return (
              <path
                key={edge.id}
                d={edge.d}
                pathLength={1}
                className={cn('mm-edge', leavingIds.has(edge.id) && 'mm-edge-leave')}
                style={{ d: `path("${edge.d}")` } as CSSProperties}
                fill="none"
                stroke={props.selectedEdge === edge.id ? 'var(--primary)' : edge.color}
                strokeOpacity={active ? 1 : 0.7}
                strokeWidth={(edge.depth === 1 ? 3 : 2) + (active ? 1.5 : 0)}
                strokeLinecap="round"
              />
            )
          })}
          {relations.map((relation) => {
            const line: LineRef = { kind: 'rel', id: relation.id }
            const selected = sameLine(selectedLineRef, line)
            const color = selected || sameLine(hoverLine, line) ? 'var(--primary)' : 'var(--muted-strong)'
            const fading = leavingIds.has(relation.from) || leavingIds.has(relation.to)
            return (
              <g key={relation.id} className={cn('mm-rel', fading && 'mm-edge-leave')}>
                {selected ? <path d={relation.d} fill="none" stroke="var(--primary)" strokeOpacity={0.16} strokeWidth={10} strokeLinecap="round" /> : null}
                <path d={relation.d} fill="none" stroke={color} strokeOpacity={selected ? 1 : 0.75} strokeWidth={selected ? 2.5 : 2} strokeDasharray="7 6" strokeLinecap="round" />
                <path d={relation.arrow} fill={color} fillOpacity={selected ? 1 : 0.85} />
              </g>
            )
          })}
          {/* Wide invisible lines: hover shows ✂, click selects, press and pull moves the line to another node */}
          {edges.map((edge) => (
            <path
              key={`hit-${edge.id}`}
              d={edge.d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              data-edge-id={edge.id}
              className={props.readOnly ? undefined : 'cursor-pointer'}
              // Inline: Tailwind has no class for SVG's "stroke" value, and only the line itself should be clickable.
              style={{ pointerEvents: props.readOnly ? 'none' : 'stroke' }}
              onPointerDown={(event) => {
                if (event.button !== 0 || spacePan) return
                event.stopPropagation()
                props.onSelectEdge(edge.id)
                grabEdge(event, edge, 5)
              }}
              onPointerEnter={() => hover({ kind: 'edge', id: edge.id })}
              onPointerLeave={() => unhover({ kind: 'edge', id: edge.id })}
            />
          ))}
          {relations.map((relation) => (
            <path
              key={`hit-${relation.id}`}
              d={relation.d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              data-rel-id={relation.id}
              className={props.readOnly ? undefined : 'cursor-pointer'}
              style={{ pointerEvents: props.readOnly ? 'none' : 'stroke' }}
              onPointerDown={(event) => {
                if (event.button !== 0 || spacePan) return
                event.stopPropagation()
                event.preventDefault()
                props.onSelectRelation(relation.id)
              }}
              onPointerEnter={() => hover({ kind: 'rel', id: relation.id })}
              onPointerLeave={() => unhover({ kind: 'rel', id: relation.id })}
            />
          ))}
          {/* A dragged node over another node: the line it will get */}
          {dragTarget && draggedBox && changesParent ? (
            <path d={linkBetween(dragTarget, draggedBox)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="7 6" strokeLinecap="round" />
          ) : null}
          {lineDrag && lineDragEnd ? (
            <>
              <path
                d={`M ${lineDrag.from.x} ${lineDrag.from.y} L ${lineDragEnd.x} ${lineDragEnd.y}`}
                fill="none"
                stroke={lineDrag.targetId ? 'var(--primary)' : lineDrag.color}
                strokeWidth={2.5}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
              <circle cx={lineDragEnd.x} cy={lineDragEnd.y} r={4.5} fill={lineDrag.targetId ? 'var(--primary)' : lineDrag.color} />
            </>
          ) : null}
        </svg>

        {selectedEdgeShape ? (
          <button
            type="button"
            data-canvas-ui
            data-line-end="parent"
            title={labels.moveLine}
            aria-label={labels.moveLine}
            onPointerDown={(event) => { if (event.button === 0) grabEdge(event, selectedEdgeShape, 0) }}
            className="mm-pop absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[var(--primary)] bg-[var(--card)] shadow-[0_1px_4px_rgba(14,21,37,0.3)] transition-transform hover:scale-150 active:cursor-grabbing"
            style={{ left: selectedEdgeShape.ends.x1, top: selectedEdgeShape.ends.y1 }}
          />
        ) : null}

        {cutButtons.map(({ line, at, label }) => (
          <button
            key={`${line.kind}:${line.id}`}
            type="button"
            data-canvas-ui
            onPointerEnter={() => hover(line)}
            onPointerLeave={() => unhover(line)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              window.clearTimeout(hoverTimer.current)
              setHoverLine(null)
              if (line.kind === 'edge') {
                props.onSelectEdge(null)
                props.onDetach(line.id)
              } else {
                props.onSelectRelation(null)
                props.onRemoveRelation(line.id)
              }
            }}
            title={label}
            aria-label={label}
            className="mm-pop absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] shadow-[0_2px_8px_rgba(14,21,37,0.18)] transition-colors hover:border-transparent hover:bg-[var(--danger)] hover:text-white"
            style={{ left: at.x, top: at.y }}
          >
            <ScissorsIcon size={13} weight="bold" />
          </button>
        ))}

        {shown.order.map((id) => {
          const box = shown.boxes.get(id)!
          const node = map.nodes[id]
          if (!node) return null
          const selected = id === selectedId
          const editing = id === editingId
          const isDropTarget = drag?.targetId === id || lineDrag?.targetId === id
          const isMatch = matches.has(id)
          const hasChildren = node.children.length > 0
          const hub = isHub(map, id)
          return (
            <div
              key={id}
              data-node-id={id}
              onPointerDown={(event) => onNodePointerDown(event, id)}
              onDoubleClick={(event) => { event.stopPropagation(); if (!props.readOnly) props.onStartEdit(id) }}
              className={cn(
                'group/node mm-node absolute flex flex-col items-center justify-center text-center',
                drag?.id === id ? 'cursor-grabbing opacity-90' : 'cursor-pointer',
                leavingIds.has(id) && 'mm-node-leave',
              )}
              style={{
                ...nodeStyle(node, box),
                paddingInline: box.depth === 0 ? 24 : 16,
                outline: isDropTarget ? '2px dashed var(--primary)' : undefined,
                outlineOffset: 4,
                boxShadow: [
                  selected ? `0 0 0 3px var(--card), 0 0 0 5px color-mix(in srgb, ${box.color} 55%, transparent)` : null,
                  isMatch ? `0 0 0 ${id === activeMatchId ? 6 : 4}px rgba(245, 158, 11, ${id === activeMatchId ? 0.75 : 0.4})` : null,
                  box.depth === 0 ? `0 12px 28px -14px ${box.color}` : '0 1px 2px rgba(14, 21, 37, 0.06)',
                ].filter(Boolean).join(', '),
              }}
            >
              {editing ? (
                <textarea
                  autoFocus
                  defaultValue={node.text}
                  onFocus={(event) => {
                    const input = event.currentTarget
                    if (editSelectAll) input.select()
                    else input.setSelectionRange(input.value.length, input.value.length)
                  }}
                  onChange={(event) => props.onEditText(id, event.currentTarget.value.replace(/\s*\n\s*/g, ' '))}
                  onBlur={() => props.onFinishEdit('commit')}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); props.onFinishEdit('commit') }
                    else if (event.key === 'Escape') { event.preventDefault(); props.onFinishEdit('cancel') }
                    else if (event.key === 'Tab') { event.preventDefault(); props.onFinishEdit('child') }
                  }}
                  className={cn('absolute inset-0 resize-none overflow-hidden rounded-[inherit] bg-transparent px-3 text-center outline-none', fontClass(box.depth))}
                  style={{ color: 'inherit', paddingTop: box.depth === 0 ? 15 : 10 }}
                />
              ) : (
                box.lines.map((line, index) => (
                  <span key={index} className={cn('block max-w-full whitespace-nowrap', fontClass(box.depth))} data-i18n-skip="true">{line}</span>
                ))
              )}

              {/* Small markers: note, link, task (bottom-right corner) */}
              {node.note || node.link || node.task ? (
                <span data-canvas-ui className="absolute -right-2 -bottom-2.5 flex items-center gap-0.5">
                  {node.note ? (
                    <span title={labels.note} className="grid h-5 w-5 place-items-center rounded-full bg-[var(--card)] text-[var(--muted-strong)] shadow-[0_1px_3px_rgba(14,21,37,0.2)]"><NoteIcon size={11} weight="bold" /></span>
                  ) : null}
                  {node.link ? (
                    <a href={node.link} target="_blank" rel="noopener noreferrer" title={`${labels.openLink}: ${node.link}`} onPointerDown={(event) => event.stopPropagation()} className="grid h-5 w-5 place-items-center rounded-full bg-[var(--card)] text-[var(--primary)] shadow-[0_1px_3px_rgba(14,21,37,0.2)] hover:bg-[var(--blue-dim)]"><LinkSimpleIcon size={11} weight="bold" /></a>
                  ) : null}
                  {node.task ? (
                    <button type="button" title={`${labels.openTask}: ${node.task.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onOpenTask(node.task!)} className="grid h-5 w-5 place-items-center rounded-full bg-[var(--success-text)] text-white shadow-[0_1px_3px_rgba(14,21,37,0.2)]"><CheckSquareIcon size={11} weight="bold" /></button>
                  ) : null}
                </span>
              ) : null}

              {/* Collapse / expand — on the outer side of a branch node */}
              {hasChildren && !hub ? (
                <button
                  type="button"
                  data-canvas-ui
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => props.onToggleCollapse(id)}
                  aria-label={node.collapsed ? labels.expand : labels.collapse}
                  title={node.collapsed ? labels.expand : labels.collapse}
                  className={cn(
                    'absolute grid h-[18px] min-w-[18px] place-items-center rounded-full border px-1 text-[10px] leading-none font-bold transition-opacity',
                    // Hidden controls never take clicks (they sit right on the child lines).
                    node.collapsed || selected ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/node:pointer-events-auto group-hover/node:opacity-100',
                    node.collapsed ? 'text-white' : 'bg-[var(--card)]',
                  )}
                  style={{ ...sidePosition(box.dir, 10, 18), borderColor: box.color, background: node.collapsed ? box.color : undefined, color: node.collapsed ? '#fff' : box.color }}
                >
                  {node.collapsed ? node.children.length : '−'}
                </button>
              ) : null}

              {/* Draw a new line from this node — bottom-left corner */}
              {selected && !editing && !busy && !props.readOnly ? (
                <button
                  type="button"
                  data-canvas-ui
                  data-draw-line
                  title={labels.drawLine}
                  aria-label={labels.drawLine}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    startLineDrag(event, { from: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, color: box.color, exclude: new Set([id]), done: (targetId) => props.onConnect(id, targetId) })
                  }}
                  className="mm-pop absolute -bottom-2.5 -left-2.5 grid h-5 w-5 cursor-crosshair place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--primary)] shadow-[0_2px_6px_rgba(14,21,37,0.15)] transition-transform hover:scale-125"
                >
                  <LineSegmentIcon size={11} weight="bold" />
                </button>
              ) : null}

              {/* Delete (not the central topic) — top-right corner */}
              {!editing && !props.readOnly && id !== map.rootId ? (
                <button
                  type="button"
                  data-canvas-ui
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => props.onDeleteNode(id)}
                  aria-label={labels.remove}
                  title={`${labels.remove} (Delete)`}
                  className={cn(
                    'absolute -top-2.5 -right-2.5 grid h-5 w-5 scale-75 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] opacity-0 shadow-[0_2px_6px_rgba(14,21,37,0.15)] transition-[opacity,scale,background-color,color] duration-200 hover:border-transparent hover:bg-[var(--danger)] hover:text-white',
                    selected ? 'scale-100 opacity-100' : 'pointer-events-none group-hover/node:pointer-events-auto group-hover/node:scale-100 group-hover/node:opacity-100',
                  )}
                >
                  <XIcon size={10} weight="bold" />
                </button>
              ) : null}

              {/* "+" on every side: outer = child, sides = sibling before / after, inner = parent; around a hub every side adds a branch that way */}
              {!editing && !busy && !props.readOnly && props.selectedEdge !== id ? (['up', 'right', 'down', 'left'] as Dir[]).map((side) => {
                const outer = hub || side === box.dir
                // Past the collapse toggle, touching it — so the pointer can travel node → toggle → "+" without losing hover.
                const offset = !hub && side === box.dir && hasChildren ? 28 : 12
                return (
                  <button
                    key={side}
                    type="button"
                    data-canvas-ui
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => props.onSideAdd(id, side)}
                    aria-label={labels.side(id, side)}
                    title={labels.side(id, side)}
                    className={cn(
                      'absolute grid place-items-center rounded-full bg-[var(--card)] shadow-[0_2px_6px_rgba(14,21,37,0.12)] transition-[opacity,scale] duration-200 hover:scale-125',
                      outer ? 'h-5 w-5 border-2' : 'h-[18px] w-[18px] border-[1.5px]',
                      selected ? 'scale-100 opacity-100' : outer && !hub ? 'pointer-events-none scale-50 opacity-0 group-hover/node:pointer-events-auto group-hover/node:scale-100 group-hover/node:opacity-100' : 'pointer-events-none scale-50 opacity-0',
                    )}
                    style={{ ...sidePosition(side, offset, outer ? 20 : 18), borderColor: box.color, color: box.color }}
                  >
                    <PlusIcon size={outer ? 11 : 10} weight="bold" />
                  </button>
                )
              }) : null}
            </div>
          )
        })}
      </div>

      {showMinimap && size.w > 0 ? <Minimap map={map} layout={shown} view={view} size={size} setView={setView} /> : null}

    </div>
  )
}
