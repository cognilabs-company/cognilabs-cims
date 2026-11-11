import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { CheckSquareIcon, LinkSimpleIcon, NoteIcon, PlusIcon } from '@phosphor-icons/react'
import { cn } from '../../../shared/lib/cn'
import { computeLayout, edgePath, type Layout, type NodeBox } from '../lib/layout'
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
  labels: { addChild: string; collapse: string; expand: string; openLink: string; openTask: string; note: string }
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
}

const fontClass = (depth: number) =>
  depth === 0 ? 'text-[17px] leading-6 font-bold' : depth === 1 ? 'text-[14.5px] leading-5 font-semibold' : 'text-[13.5px] leading-5 font-medium'

function nodeStyle(node: MindNode, box: NodeBox): CSSProperties {
  const radius = node.shape === 'pill' ? box.h / 2 : node.shape === 'rect' ? 4 : box.depth === 0 ? 16 : 11
  const base: CSSProperties = { left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius }
  if (node.shape === 'outline') return { ...base, background: 'var(--card)', border: `2px solid ${box.color}`, color: box.depth === 0 ? box.color : 'var(--foreground)' }
  if (box.depth === 0) return { ...base, background: box.color, border: `1px solid ${box.color}`, color: '#fff', boxShadow: `0 10px 26px -12px ${box.color}` }
  return {
    ...base,
    background: `color-mix(in srgb, ${box.color} 14%, var(--card))`,
    border: `1px solid color-mix(in srgb, ${box.color} 45%, transparent)`,
    color: 'var(--foreground)',
  }
}

export function MindCanvas(props: Props) {
  const { map, layout, view, setView, selectedId, editingId, editSelectAll, matches, activeMatchId, spacePan, showMinimap, labels } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<DragState | null>(null)
  const [panning, setPanning] = useState(false)
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
    return parent && child ? [{ id, d: edgePath(parent, child), color: child.color, depth: child.depth }] : []
  })

  return (
    <div
      ref={containerRef}
      onPointerDown={onBackgroundPointerDown}
      className={cn(
        'mm-canvas relative h-full min-h-0 w-full touch-none overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] select-none',
        spacePan || panning ? 'cursor-grabbing' : 'cursor-default',
        spacePan && !panning && 'cursor-grab',
      )}
      style={{
        backgroundImage: 'radial-gradient(var(--mm-dot) 1.1px, transparent 1.3px)',
        backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
          {edges.map((edge) => (
            <path key={edge.id} d={edge.d} fill="none" stroke={edge.color} strokeOpacity={0.75} strokeWidth={edge.depth === 1 ? 3 : 2} strokeLinecap="round" />
          ))}
        </svg>

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
              )}
              style={{
                ...nodeStyle(node, box),
                paddingInline: box.depth === 0 ? 24 : 16,
                outline: isDropTarget ? '2px dashed var(--primary)' : undefined,
                outlineOffset: 4,
                boxShadow: [
                  selected ? `0 0 0 2px var(--card), 0 0 0 4px ${box.depth === 0 ? 'var(--foreground)' : box.color}` : null,
                  isMatch ? `0 0 0 ${id === activeMatchId ? 6 : 4}px rgba(245, 158, 11, ${id === activeMatchId ? 0.75 : 0.4})` : null,
                  !selected && !isMatch && box.depth === 0 ? `0 10px 26px -12px ${box.color}` : null,
                ].filter(Boolean).join(', ') || undefined,
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
                <span data-canvas-ui className="absolute -top-2.5 -right-2 flex items-center gap-0.5">
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
                    'absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 bg-[var(--card)] transition-[opacity,transform] hover:scale-110',
                    selected ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100',
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
