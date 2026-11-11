import { BRANCH_COLORS, type MindMap } from './types'

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
}

export type Layout = {
  boxes: Map<string, NodeBox>
  /** Visible nodes, depth-first. */
  order: string[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const H_GAP = 64
export const V_GAP = 14
const ROOT_COLOR = '#2B59FF'

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

/** Balanced left/right tree layout with the root at (0, 0). Manual offsets move a node together with its subtree. */
export function computeLayout(map: MindMap): Layout {
  const boxes = new Map<string, NodeBox>()
  const order: string[] = []
  const sizes = new Map<string, ReturnType<typeof nodeSize>>()
  const depths = new Map<string, number>()
  const heights = new Map<string, number>()

  const visibleChildren = (id: string) => {
    const node = map.nodes[id]
    return node && !node.collapsed ? node.children.filter((child) => map.nodes[child]) : []
  }

  // Sizes + subtree heights (post-order).
  const measure = (id: string, depth: number): number => {
    const node = map.nodes[id]
    depths.set(id, depth)
    const size = nodeSize(node.text, depth)
    sizes.set(id, size)
    const kids = visibleChildren(id)
    const stack = kids.reduce((sum, child) => sum + measure(child, depth + 1), 0) + Math.max(0, kids.length - 1) * V_GAP
    const height = Math.max(size.h, stack)
    heights.set(id, height)
    return height
  }
  measure(map.rootId, 0)

  const place = (id: string, x: number, centerY: number, side: 1 | -1, color: string) => {
    const node = map.nodes[id]
    const size = sizes.get(id)!
    const depth = depths.get(id)!
    const box: NodeBox = { id, x: x + node.dx, y: centerY - size.h / 2 + node.dy, w: size.w, h: size.h, side, depth, color, lines: size.lines }
    boxes.set(id, box)
    order.push(id)
    stackChildren(id, visibleChildren(id), side, box)
  }

  const stackChildren = (parentId: string, kids: string[], side: 1 | -1, parent: NodeBox) => {
    if (!kids.length) return
    const total = kids.reduce((sum, child) => sum + heights.get(child)!, 0) + (kids.length - 1) * V_GAP
    let top = parent.y + parent.h / 2 - total / 2
    for (const [index, child] of kids.entries()) {
      const height = heights.get(child)!
      const size = sizes.get(child)!
      const node = map.nodes[child]
      const color = node.color ?? (parentId === map.rootId ? BRANCH_COLORS[index % BRANCH_COLORS.length] : parent.color)
      const x = side === 1 ? parent.x + parent.w + H_GAP : parent.x - H_GAP - size.w
      place(child, x, top + height / 2, side, color)
      top += height + V_GAP
    }
  }

  // Root.
  const root = map.nodes[map.rootId]
  const rootSize = sizes.get(map.rootId)!
  const rootBox: NodeBox = { id: map.rootId, x: -rootSize.w / 2 + root.dx, y: -rootSize.h / 2 + root.dy, w: rootSize.w, h: rootSize.h, side: 1, depth: 0, color: root.color ?? ROOT_COLOR, lines: rootSize.lines }
  boxes.set(map.rootId, rootBox)
  order.push(map.rootId)

  // First half (by height) of the root's children to the right, the rest to the left.
  const kids = visibleChildren(map.rootId)
  const total = kids.reduce((sum, child) => sum + heights.get(child)!, 0)
  const right: string[] = []
  const left: string[] = []
  let acc = 0
  for (const child of kids) {
    if (kids.length < 3 || acc < total / 2) right.push(child)
    else left.push(child)
    acc += heights.get(child)!
  }
  // Keep branch colours stable by the child's index under the root.
  const colorOf = (child: string) => map.nodes[child].color ?? BRANCH_COLORS[kids.indexOf(child) % BRANCH_COLORS.length]
  const placeSide = (list: string[], side: 1 | -1) => {
    if (!list.length) return
    const sideTotal = list.reduce((sum, child) => sum + heights.get(child)!, 0) + (list.length - 1) * V_GAP
    let top = rootBox.y + rootBox.h / 2 - sideTotal / 2
    for (const child of list) {
      const height = heights.get(child)!
      const size = sizes.get(child)!
      const x = side === 1 ? rootBox.x + rootBox.w + H_GAP * 1.25 : rootBox.x - H_GAP * 1.25 - size.w
      place(child, x, top + height / 2, side, colorOf(child))
      top += height + V_GAP
    }
  }
  placeSide(right, 1)
  placeSide(left, -1)

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

/** Curved connector from a parent to a child (world coordinates). */
export function edgePath(parent: NodeBox, child: NodeBox) {
  const side = child.side
  const x1 = side === 1 ? parent.x + parent.w : parent.x
  const y1 = parent.y + parent.h / 2
  const x2 = side === 1 ? child.x : child.x + child.w
  const y2 = child.y + child.h / 2
  const mid = (x2 - x1) * 0.5
  return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`
}
