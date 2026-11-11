import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { CheckSquareIcon, LinkSimpleIcon, NoteIcon, PlusIcon, ScissorsIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '../../../shared/lib/cn'
import { computeLayout, edgeMidpoint, edgePath, type Layout, type NodeBox } from '../lib/layout'
import { subtreeIds, updateNode } from '../lib/tree'
import type { MindMap, MindNode, NodeTask } from '../lib/types'
import { clampZoom, type View } from '../lib/view'
import { Minimap } from './Minimap'


type DragState = { id: string; dx: number; dy: number; targetId: string | null }

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
  /** Nodes playing their exit animation (removed right after). */
  leavingIds: Set<string>
  /** Glide the camera (button-driven moves); wheel and drag stay instant. */
  animateView: boolean
  labels: { addChild: string; addAbove: string; addBelow: string; collapse: string; expand: string; openLink: string; openTask: string; note: string; remove: string; cut: string }
  onSize: (size: { w: number; h: number }) => void
  onSelect: (id: string) => void
  onStartEdit: (id: string) => void
  onEditText: (id: string, text: string) => void
  onFinishEdit: (mode: 'commit' | 'cancel' | 'child') => void
  onAddChild: (id: string) => void
  onToggleCollapse: (id: string) => void
  onMoveNode: (id: string, dx: number, dy: number) => void
  onReparent: (id: string, targetId: string) => void
  onOpenTask: (task: NodeTask) => void
  onDeleteNode: (id: string) => void
  onAddSibling: (id: string, where: 'above' | 'below') => void
  /** Cut the line between this node and its parent. */
  onDetach: (id: string) => void
  /** Double-click on empty canvas: a free node at that point (world coordinates). */
  onCreateFree: (x: number, y: number) => void
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

export function MindCanvas(props: Props) {
  const { map, layout, view, setView, selectedId, editingId, editSelectAll, matches, activeMatchId, spacePan, showMinimap, leavingIds, animateView, labels } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<DragState | null>(null)
  const [panning, setPanning] = useState(false)
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)
  const { onSize } = props

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
    if ((event.target as HTMLElement).closest('[data-node-id],[data-canvas-ui]')) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    props.onCreateFree((event.clientX - rect.left - view.x) / view.k, (event.clientY - rect.top - view.y) / view.k)
  }

  function onBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('[data-node-id],[data-canvas-ui]') && !spacePan && event.button !== 1) return
    event.preventDefault()
    startPan(event)
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0 || spacePan || editingId === id) return
    if ((event.target as HTMLElement).closest('button,a,textarea')) return
    event.stopPropagation()
    props.onSelect(id)
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
      let targetId: string | null = null
      if (id !== map.rootId) {
        for (const element of document.elementsFromPoint(e.clientX, e.clientY)) {
          const candidate = (element as HTMLElement).closest?.('[data-node-id]')?.getAttribute('data-node-id')
          if (candidate && !dragged.has(candidate)) { targetId = candidate; break }
        }
      }
      last = { id, dx: dxScreen / k, dy: dyScreen / k, targetId }
      setDrag(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDrag(null)
      if (!moved) return
      if (last.targetId) props.onReparent(id, last.targetId)
      else props.onMoveNode(id, last.dx, last.dy)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const edges = shown.order.flatMap((id) => {
    const node = map.nodes[id]
    const parent = node?.parentId ? shown.boxes.get(node.parentId) : undefined
    const child = shown.boxes.get(id)
    return parent && child ? [{ id, d: edgePath(parent, child, map.edgeStyle), color: child.color, depth: child.depth, mid: edgeMidpoint(parent, child) }] : []
  })
  // The cut button: on the hovered line, or on the line of the selected node.
  const cutEdge = edges.find((edge) => edge.id === hoverEdge) ?? (drag ? undefined : edges.find((edge) => edge.id === selectedId))

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
      )}
      style={{
        backgroundImage: 'radial-gradient(var(--mm-dot) 1.1px, transparent 1.3px)',
        backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className={cn('absolute top-0 left-0 origin-top-left will-change-transform', animateView && 'mm-world-animate')} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
          {edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.d}
              pathLength={1}
              className={cn('mm-edge', leavingIds.has(edge.id) && 'mm-edge-leave')}
              style={{ d: `path("${edge.d}")` } as CSSProperties}
              fill="none"
              stroke={edge.color}
              strokeOpacity={hoverEdge === edge.id ? 1 : 0.7}
              strokeWidth={(edge.depth === 1 ? 3 : 2) + (hoverEdge === edge.id ? 1.5 : 0)}
              strokeLinecap="round"
            />
          ))}
          {/* Wide invisible lines for hovering (cut button) */}
          {edges.map((edge) => (
            <path
              key={`hit-${edge.id}`}
              d={edge.d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-[stroke] cursor-pointer"
              onPointerEnter={() => setHoverEdge(edge.id)}
              onPointerLeave={() => setHoverEdge((current) => (current === edge.id ? null : current))}
            />
          ))}
        </svg>

        {cutEdge && !leavingIds.has(cutEdge.id) ? (
          <button
            type="button"
            data-canvas-ui
            onPointerEnter={() => setHoverEdge(cutEdge.id)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => { setHoverEdge(null); props.onDetach(cutEdge.id) }}
            title={labels.cut}
            aria-label={labels.cut}
            className="mm-pop absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] shadow-[0_2px_8px_rgba(14,21,37,0.18)] transition-colors hover:border-transparent hover:bg-[var(--danger)] hover:text-white"
            style={{ left: cutEdge.mid.x, top: cutEdge.mid.y }}
          >
            <ScissorsIcon size={13} weight="bold" />
          </button>
        ) : null}

        {shown.order.map((id) => {
          const box = shown.boxes.get(id)!
          const node = map.nodes[id]
          if (!node) return null
          const selected = id === selectedId
          const editing = id === editingId
          const isDropTarget = drag?.targetId === id
          const isMatch = matches.has(id)
          const hasChildren = node.children.length > 0
          const outer = box.side === 1 ? 'right' : 'left'
          return (
            <div
              key={id}
              data-node-id={id}
              onPointerDown={(event) => onNodePointerDown(event, id)}
              onDoubleClick={(event) => { event.stopPropagation(); props.onStartEdit(id) }}
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

              {/* Small markers: note, link, task */}
              {node.note || node.link || node.task ? (
                <span data-canvas-ui className={cn('absolute -bottom-2.5 flex items-center gap-0.5', box.side === 1 ? '-left-2' : '-right-2')}>
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

              {/* Collapse / expand */}
              {hasChildren && id !== map.rootId ? (
                <button
                  type="button"
                  data-canvas-ui
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => props.onToggleCollapse(id)}
                  aria-label={node.collapsed ? labels.expand : labels.collapse}
                  title={node.collapsed ? labels.expand : labels.collapse}
                  className={cn(
                    'absolute top-1/2 grid h-[18px] min-w-[18px] -translate-y-1/2 place-items-center rounded-full border px-1 text-[10px] leading-none font-bold transition-opacity',
                    node.collapsed ? 'text-white opacity-100' : 'bg-[var(--card)] opacity-0 group-hover/node:opacity-100',
                    selected && 'opacity-100',
                  )}
                  style={{ [outer]: -10, borderColor: box.color, background: node.collapsed ? box.color : undefined, color: node.collapsed ? '#fff' : box.color }}
                >
                  {node.collapsed ? node.children.length : '−'}
                </button>
              ) : null}

              {/* Delete (not the central topic) */}
              {!editing && id !== map.rootId ? (
                <button
                  type="button"
                  data-canvas-ui
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => props.onDeleteNode(id)}
                  aria-label={labels.remove}
                  title={`${labels.remove} (Delete)`}
                  className={cn(
                    'absolute -top-2.5 grid h-5 w-5 scale-75 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] opacity-0 shadow-[0_2px_6px_rgba(14,21,37,0.15)] transition-[opacity,transform,background-color,color] duration-200 hover:border-transparent hover:bg-[var(--danger)] hover:text-white',
                    selected ? 'scale-100 opacity-100' : 'group-hover/node:scale-100 group-hover/node:opacity-100',
                    box.side === 1 ? '-left-2.5' : '-right-2.5',
                  )}
                >
                  <XIcon size={10} weight="bold" />
                </button>
              ) : null}

              {/* Sibling above / below (not for the central topic or free nodes) */}
              {!editing && node.parentId ? (
                <>
                  {(['above', 'below'] as const).map((where) => (
                    <button
                      key={where}
                      type="button"
                      data-canvas-ui
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => props.onAddSibling(id, where)}
                      aria-label={where === 'above' ? labels.addAbove : labels.addBelow}
                      title={where === 'above' ? `${labels.addAbove} (Shift+Enter)` : `${labels.addBelow} (Enter)`}
                      className={cn(
                        'absolute left-1/2 grid h-[18px] w-[18px] -translate-x-1/2 place-items-center rounded-full border-[1.5px] bg-[var(--card)] transition-[opacity,scale] duration-200 hover:scale-125',
                        where === 'above' ? '-top-[11px]' : '-bottom-[11px]',
                        selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0 group-hover/node:scale-100 group-hover/node:opacity-100',
                      )}
                      style={{ borderColor: box.color, color: box.color }}
                    >
                      <PlusIcon size={10} weight="bold" />
                    </button>
                  ))}
                </>
              ) : null}

              {/* Add child */}
              {!editing ? (
                <button
                  type="button"
                  data-canvas-ui
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => props.onAddChild(id)}
                  aria-label={labels.addChild}
                  title={`${labels.addChild} (Tab)`}
                  className={cn(
                    'absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 bg-[var(--card)] transition-[opacity,scale] duration-200 hover:scale-125',
                    selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0 group-hover/node:scale-100 group-hover/node:opacity-100',
                  )}
                  style={{ [outer]: hasChildren && id !== map.rootId ? -34 : -11, borderColor: box.depth === 0 ? box.color : box.color, color: box.color }}
                >
                  <PlusIcon size={11} weight="bold" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {showMinimap && size.w > 0 ? <Minimap map={map} layout={shown} view={view} size={size} setView={setView} /> : null}

    </div>
  )
}
