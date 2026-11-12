import { BRANCH_COLORS, type Dir, type EdgeStyle, type MindMap } from './types'

export type NodeBox = {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** 1 = grows to the right, -1 = to the left (root: 1). */
  side: 1 | -1
  depth: number
  color: string
  lines: string[]
  /** Direction from the parent to this node (the way its branch grows). */
  dir: Dir
  /** Placed by hand (see MindNode.px). */
  pinned?: boolean
  /** A free node (no line to a parent). */
  floating?: boolean
}

export type Layout = {
  boxes: Map<string, NodeBox>
  /** Visible nodes, depth-first. */
  order: string[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const H_GAP = 64
export const V_GAP = 14
/** Distance parent → child and the gap between siblings for up / down branches. */
export const V_DIST = 56
export const H_SIB_GAP = 22
const ROOT_COLOR = '#2B59FF'
const FREE_COLOR = '#64748B'

let measureCtx: CanvasRenderingContext2D | null = null
let fontFamily = 'Onest, system-ui, sans-serif'

function ctx() {
  if (!measureCtx && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d')
    const family = getComputedStyle(document.body).fontFamily
    if (family) fontFamily = family
  }
  return measureCtx
}

export function nodeFont(depth: number) {
  return depth === 0 ? `700 17px ${fontFamily}` : depth === 1 ? `600 14.5px ${fontFamily}` : `500 13.5px ${fontFamily}`
}

const textCache = new Map<string, { w: number; lines: string[] }>()

/** Word-wrap `text` to `maxWidth` px; returns the widest line width and the lines. */
function wrap(text: string, depth: number, maxWidth: number) {
  const key = `${depth}|${maxWidth}|${text}`
  const hit = textCache.get(key)
  if (hit) return hit
  const context = ctx()
  const label = text.trim() || '…'
  if (!context) {
    const result = { w: Math.min(maxWidth, label.length * 8), lines: [label] }
    textCache.set(key, result)
    return result
  }
  context.font = nodeFont(depth)
  const lines: string[] = []
  let current = ''
  for (const word of label.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  // Very long single words: hard-break.
  const finalLines = lines.flatMap((line) => {
    if (context.measureText(line).width <= maxWidth) return [line]
    const parts: string[] = []
    let chunk = ''
    for (const char of line) {
      if (context.measureText(chunk + char).width > maxWidth && chunk) {
        parts.push(chunk)
        chunk = char
      } else {
        chunk += char
      }
    }
    if (chunk) parts.push(chunk)
    return parts
  })
  const w = Math.max(...finalLines.map((line) => context.measureText(line).width))
  const result = { w, lines: finalLines.slice(0, 6) }
  if (textCache.size > 4000) textCache.clear()
  textCache.set(key, result)
  return result
}

function nodeSize(text: string, depth: number) {
  const maxWidth = depth === 0 ? 260 : 220
  const padX = depth === 0 ? 24 : 16
  const padY = depth === 0 ? 15 : 10
  const lineHeight = depth === 0 ? 24 : 20
  const { w, lines } = wrap(text, depth, maxWidth)
  return { w: Math.max(depth === 0 ? 96 : 56, Math.ceil(w) + padX * 2), h: lines.length * lineHeight + padY * 2, lines }
}

export const isHorizontal = (dir: Dir) => dir === 'right' || dir === 'left'

/** Which way a point lies from the origin (the larger axis wins). */
export function dirOf(x: number, y: number): Dir {
  return Math.abs(x) >= Math.abs(y) ? (x >= 0 ? 'right' : 'left') : (y >= 0 ? 'down' : 'up')
}

/** Placed by hand (px / py relative to the parent). */
export function isPinned(map: MindMap, id: string) {
  const node = map.nodes[id]
  return Boolean(node && node.parentId !== null && Number.isFinite(node.px) && Number.isFinite(node.py))
}

/** The central topic and free nodes: their children carry their own direction. */
export function isHub(map: MindMap, id: string) {
  const node = map.nodes[id]
  return Boolean(node && (id === map.rootId || node.parentId === null))
}

/** Direction of a hub's child: stored, else the first half of the hub's children right, the rest left. */
export function hubChildDir(map: MindMap, hubId: string, childId: string): Dir {
  const child = map.nodes[childId]
  if (child?.dir) return child.dir
  const kids = map.nodes[hubId]?.children ?? []
  const unplaced = kids.filter((id) => !map.nodes[id]?.dir)
  const index = unplaced.indexOf(childId)
  return index < Math.ceil(unplaced.length / 2) ? 'right' : 'left'
}

/** Free palette slot for a new central-topic branch (the least used one, lowest first). */
export function nextBranch(map: MindMap, exceptId?: string) {
  const kids = (map.nodes[map.rootId]?.children ?? []).filter((id) => id !== exceptId)
  const used = new Array<number>(BRANCH_COLORS.length).fill(0)
  kids.forEach((id, index) => { used[(map.nodes[id]?.branch ?? index) % BRANCH_COLORS.length] += 1 })
  const least = Math.min(...used)
  return used.indexOf(least)
}

/** Top-left corner shifts that keep a free subtree off every other node (nearest first). */
export function freeSpot(layout: Layout, ids: Set<string>, margin = 18): { dx: number; dy: number } {
  const own = [...ids].map((id) => layout.boxes.get(id)).filter((box): box is NodeBox => Boolean(box))
  const others = [...layout.boxes.values()].filter((box) => !ids.has(box.id))
  if (!own.length) return { dx: 0, dy: 0 }
  const fits = (dx: number, dy: number) => own.every((a) => others.every((b) =>
    a.x + dx + a.w + margin <= b.x || b.x + b.w + margin <= a.x + dx || a.y + dy + a.h + margin <= b.y || b.y + b.h + margin <= a.y + dy))
  if (fits(0, 0)) return { dx: 0, dy: 0 }
  for (let r = 30; r <= 900; r += 30) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2
      const dx = Math.round(Math.cos(angle) * r)
      const dy = Math.round(Math.sin(angle) * r * 0.7)
      if (fits(dx, dy)) return { dx, dy }
    }
  }
  return { dx: 0, dy: 0 }
}

/**
 * Mind map layout. The central topic sits at (0, 0); each of its branches grows right, left, up or down
 * (its stored direction) and never changes side on its own. Free nodes stay where they were put.
 */
export function computeLayout(map: MindMap): Layout {
  const boxes = new Map<string, NodeBox>()
  const order: string[] = []
  const sizes = new Map<string, ReturnType<typeof nodeSize>>()
  const breadths = new Map<string, number>()

  const visibleChildren = (id: string) => {
    const node = map.nodes[id]
    return node && !node.collapsed ? node.children.filter((child) => map.nodes[child]) : []
  }
  const sizeOf = (id: string, depth: number) => {
    let size = sizes.get(id)
    if (!size) { size = nodeSize(map.nodes[id].text, depth); sizes.set(id, size) }
    return size
  }

  /** Size of a subtree across its growth direction (heights for left/right, widths for up/down). */
  const measure = (id: string, depth: number, dir: Dir): number => {
    const size = sizeOf(id, depth)
    const kids = visibleChildren(id).filter((child) => !isPinned(map, child))
    const gap = isHorizontal(dir) ? V_GAP : H_SIB_GAP
    const stack = kids.reduce((sum, child) => sum + measure(child, depth + 1, dir), 0) + Math.max(0, kids.length - 1) * gap
    const breadth = Math.max(isHorizontal(dir) ? size.h : size.w, stack)
    breadths.set(id, breadth)
    return breadth
  }

  const pushBox = (box: NodeBox) => {
    boxes.set(box.id, box)
    order.push(box.id)
  }

  /** Lays children out in one direction from `parent`; `colorOf` gives each child's branch colour. */
  /** A hand-placed node: at its spot next to the parent; its own children grow away from the parent. */
  const placePinned = (parent: NodeBox, child: string, depth: number, color: string) => {
    const node = map.nodes[child]
    const size = sizeOf(child, depth)
    const cx = parent.x + parent.w / 2 + (node.px ?? 0)
    const cy = parent.y + parent.h / 2 + (node.py ?? 0)
    const dir = dirOf(node.px ?? 0, node.py ?? 0)
    const box: NodeBox = { id: child, x: cx - size.w / 2 + node.dx, y: cy - size.h / 2 + node.dy, w: size.w, h: size.h, side: dir === 'left' ? -1 : 1, depth, color, lines: size.lines, dir, pinned: true }
    pushBox(box)
    placeGroup(box, visibleChildren(child), dir, depth + 1, () => node.color ?? box.color, isHorizontal(dir) ? H_GAP : V_DIST)
  }

  const placeGroup = (parent: NodeBox, all: string[], dir: Dir, depth: number, colorOf: (child: string) => string, distance: number) => {
    for (const child of all) if (isPinned(map, child)) placePinned(parent, child, depth, colorOf(child))
    const kids = all.filter((child) => !isPinned(map, child))
    if (!kids.length) return
    const horizontal = isHorizontal(dir)
    const gap = horizontal ? V_GAP : H_SIB_GAP
    kids.forEach((child) => measure(child, depth, dir))
    const total = kids.reduce((sum, child) => sum + breadths.get(child)!, 0) + (kids.length - 1) * gap
    let cursor = (horizontal ? parent.y + parent.h / 2 : parent.x + parent.w / 2) - total / 2
    for (const child of kids) {
      const node = map.nodes[child]
      const size = sizeOf(child, depth)
      const breadth = breadths.get(child)!
      const center = cursor + breadth / 2
      const x = horizontal ? (dir === 'right' ? parent.x + parent.w + distance : parent.x - distance - size.w) : center - size.w / 2
      const y = horizontal ? center - size.h / 2 : dir === 'down' ? parent.y + parent.h + distance : parent.y - distance - size.h
      const box: NodeBox = { id: child, x: x + node.dx, y: y + node.dy, w: size.w, h: size.h, side: dir === 'left' ? -1 : 1, depth, color: colorOf(child), lines: size.lines, dir }
      pushBox(box)
      placeGroup(box, visibleChildren(child), dir, depth + 1, () => node.color ?? box.color, horizontal ? H_GAP : V_DIST)
      cursor += breadth + gap
    }
  }

  /** A hub (central topic or free node) places each direction group around itself. */
  const placeHub = (hub: NodeBox, isRoot: boolean) => {
    const kids = visibleChildren(hub.id)
    const all = map.nodes[hub.id].children
    const colorOf = (child: string) => map.nodes[child].color ?? (isRoot ? BRANCH_COLORS[(map.nodes[child].branch ?? all.indexOf(child)) % BRANCH_COLORS.length] : hub.color)
    for (const child of kids) if (isPinned(map, child)) placePinned(hub, child, hub.depth + 1, colorOf(child))
    for (const dir of ['right', 'left', 'up', 'down'] as Dir[]) {
      const group = kids.filter((child) => !isPinned(map, child) && hubChildDir(map, hub.id, child) === dir)
      placeGroup(hub, group, dir, hub.depth + 1, colorOf, isHorizontal(dir) ? (isRoot ? H_GAP * 1.25 : H_GAP) : (isRoot ? V_DIST * 1.2 : V_DIST))
    }
  }

  // Central topic.
  const root = map.nodes[map.rootId]
  const rootSize = sizeOf(map.rootId, 0)
  const rootBox: NodeBox = { id: map.rootId, x: -rootSize.w / 2 + root.dx, y: -rootSize.h / 2 + root.dy, w: rootSize.w, h: rootSize.h, side: 1, depth: 0, color: root.color ?? ROOT_COLOR, lines: rootSize.lines, dir: 'right' }
  pushBox(rootBox)
  placeHub(rootBox, true)

  // Free nodes: where the user put them.
  for (const node of Object.values(map.nodes)) {
    if (node.parentId !== null || node.id === map.rootId) continue
    const size = sizeOf(node.id, 1)
    const box: NodeBox = {
      id: node.id,
      x: (node.x ?? 0) - size.w / 2 + node.dx,
      y: (node.y ?? 0) - size.h / 2 + node.dy,
      w: size.w,
      h: size.h,
      side: 1,
      depth: 1,
      color: node.color ?? FREE_COLOR,
      lines: size.lines,
      dir: 'right',
      floating: true,
    }
    pushBox(box)
    placeHub(box, false)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.w)
    maxY = Math.max(maxY, box.y + box.h)
  }
  return { boxes, order, bounds: { minX, minY, maxX, maxY } }
}

export function edgeEnds(parent: NodeBox, child: NodeBox) {
  switch (child.dir) {
    case 'left': return { x1: parent.x, y1: parent.y + parent.h / 2, x2: child.x + child.w, y2: child.y + child.h / 2 }
    case 'down': return { x1: parent.x + parent.w / 2, y1: parent.y + parent.h, x2: child.x + child.w / 2, y2: child.y }
    case 'up': return { x1: parent.x + parent.w / 2, y1: parent.y, x2: child.x + child.w / 2, y2: child.y + child.h }
    default: return { x1: parent.x + parent.w, y1: parent.y + parent.h / 2, x2: child.x, y2: child.y + child.h / 2 }
  }
}

/** Connector from a parent to a child (world coordinates): curved, straight or elbow (rounded corners). */
export function edgePath(parent: NodeBox, child: NodeBox, style: EdgeStyle = 'curved') {
  const { x1, y1, x2, y2 } = edgeEnds(parent, child)
  const horizontal = isHorizontal(child.dir)
  if (style === 'straight') return `M ${x1} ${y1} L ${x2} ${y2}`
  if (style === 'elbow') {
    if (horizontal) {
      const xm = x1 + (x2 - x1) / 2
      const dy = y2 - y1
      if (Math.abs(dy) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
      const sx = Math.sign(x2 - x1) || 1
      const sy = Math.sign(dy)
      const r = Math.min(10, Math.abs(dy) / 2, Math.abs(xm - x1))
      return `M ${x1} ${y1} L ${xm - sx * r} ${y1} Q ${xm} ${y1} ${xm} ${y1 + sy * r} L ${xm} ${y2 - sy * r} Q ${xm} ${y2} ${xm + sx * r} ${y2} L ${x2} ${y2}`
    }
    const ym = y1 + (y2 - y1) / 2
    const dx = x2 - x1
    if (Math.abs(dx) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
    const sy = Math.sign(y2 - y1) || 1
    const sx = Math.sign(dx)
    const r = Math.min(10, Math.abs(dx) / 2, Math.abs(ym - y1))
    return `M ${x1} ${y1} L ${x1} ${ym - sy * r} Q ${x1} ${ym} ${x1 + sx * r} ${ym} L ${x2 - sx * r} ${ym} Q ${x2} ${ym} ${x2} ${ym + sy * r} L ${x2} ${y2}`
  }
  if (horizontal) {
    const mid = (x2 - x1) * 0.5
    return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`
  }
  const mid = (y2 - y1) * 0.5
  return `M ${x1} ${y1} C ${x1} ${y1 + mid}, ${x2} ${y2 - mid}, ${x2} ${y2}`
}

/** The middle of a connector (all three styles pass through it) — where the "cut" button sits. */
export function edgeMidpoint(parent: NodeBox, child: NodeBox) {
  const { x1, y1, x2, y2 } = edgeEnds(parent, child)
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
}
