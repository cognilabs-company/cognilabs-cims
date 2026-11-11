import { computeLayout, freeSpot, hubChildDir, isHub, nextBranch } from './layout'
import type { Dir, EdgeStyle, MindMap, MindNode } from './types'

export function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14)
}

export function makeNode(parentId: string | null, text: string, id = uid()): MindNode {
  return { id, parentId, children: [], text, note: '', link: '', color: null, shape: 'rounded', collapsed: false, dx: 0, dy: 0, task: null }
}

export function createMap(title: string): MindMap {
  const root = makeNode(null, title)
  const now = new Date().toISOString()
  return { id: uid(), title, rootId: root.id, nodes: { [root.id]: root }, createdAt: now, updatedAt: now }
}

/** Shallow-copies the map and the nodes that are about to change. */
function edit(map: MindMap, ids: string[], fn: (nodes: Record<string, MindNode>) => void): MindMap {
  const nodes = { ...map.nodes }
  for (const id of ids) if (nodes[id]) nodes[id] = { ...nodes[id], children: [...nodes[id].children] }
  fn(nodes)
  const root = nodes[map.rootId]
  return { ...map, nodes, title: root?.text ?? map.title }
}

/** Free nodes: no parent and not the central topic. */
export function isFloating(map: MindMap, id: string) {
  const node = map.nodes[id]
  return Boolean(node && node.parentId === null && id !== map.rootId)
}

export function floatingIds(map: MindMap) {
  return Object.values(map.nodes).filter((node) => node.parentId === null && node.id !== map.rootId).map((node) => node.id)
}

/** Side for a new branch of a hub: right or left, whichever has fewer branches (right first). */
export function pickDir(map: MindMap, hubId: string): Dir {
  const kids = map.nodes[hubId]?.children ?? []
  const count = (dir: Dir) => kids.filter((child) => hubChildDir(map, hubId, child) === dir).length
  return count('left') < count('right') ? 'left' : 'right'
}

/** Old maps: write the current side of every hub branch, so branches never jump when others are added. */
export function ensureDirs(map: MindMap): MindMap {
  const hubs = Object.values(map.nodes).filter((node) => isHub(map, node.id))
  const missing = hubs.flatMap((hub) => hub.children.filter((child) => map.nodes[child] && !map.nodes[child].dir).map((child) => [hub.id, child] as const))
  const rootKids = map.nodes[map.rootId]?.children ?? []
  const noBranch = rootKids.filter((child) => map.nodes[child] && map.nodes[child].branch === undefined)
  if (!missing.length && !noBranch.length) return map
  const nodes = { ...map.nodes }
  for (const [hubId, child] of missing) nodes[child] = { ...nodes[child], dir: hubChildDir(map, hubId, child) }
  for (const child of noBranch) nodes[child] = { ...nodes[child], branch: rootKids.indexOf(child) }
  return { ...map, nodes }
}

export function depthOf(map: MindMap, id: string) {
  let depth = 0
  let node = map.nodes[id]
  while (node?.parentId) {
    depth += 1
    node = map.nodes[node.parentId]
  }
  return depth
}

export function isDescendant(map: MindMap, id: string, ancestorId: string) {
  let node = map.nodes[id]
  while (node?.parentId) {
    if (node.parentId === ancestorId) return true
    node = map.nodes[node.parentId]
  }
  return false
}

export function ancestorsOf(map: MindMap, id: string) {
  const list: string[] = []
  let node = map.nodes[id]
  while (node?.parentId) {
    list.push(node.parentId)
    node = map.nodes[node.parentId]
  }
  return list
}

export function subtreeIds(map: MindMap, id: string): string[] {
  const out: string[] = []
  const stack = [id]
  while (stack.length) {
    const current = stack.pop()!
    out.push(current)
    stack.push(...(map.nodes[current]?.children ?? []))
  }
  return out
}

export function addChild(map: MindMap, parentId: string, text: string, id?: string, dir?: Dir): [MindMap, string] {
  const child = makeNode(parentId, text, id)
  if (isHub(map, parentId)) child.dir = dir ?? pickDir(map, parentId)
  if (parentId === map.rootId) child.branch = nextBranch(map)
  const next = edit(map, [parentId], (nodes) => {
    nodes[parentId].children.push(child.id)
    nodes[parentId].collapsed = false
    nodes[child.id] = child
  })
  return [next, child.id]
}

export function addSibling(map: MindMap, id: string, text: string, newId?: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node?.parentId) return addChild(map, id, text, newId)
  const parentId = node.parentId
  const sibling = makeNode(parentId, text, newId)
  if (isHub(map, parentId)) sibling.dir = hubChildDir(map, parentId, id)
  if (parentId === map.rootId) sibling.branch = nextBranch(map)
  const next = edit(map, [parentId], (nodes) => {
    const list = nodes[parentId].children
    list.splice(list.indexOf(id) + 1, 0, sibling.id)
    nodes[sibling.id] = sibling
  })
  return [next, sibling.id]
}

/** New sibling right above `id` (for the central topic or a free node: a child). */
export function addSiblingAbove(map: MindMap, id: string, text: string, newId?: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node?.parentId) return addChild(map, id, text, newId)
  const parentId = node.parentId
  const sibling = makeNode(parentId, text, newId)
  if (isHub(map, parentId)) sibling.dir = hubChildDir(map, parentId, id)
  if (parentId === map.rootId) sibling.branch = nextBranch(map)
  const next = edit(map, [parentId], (nodes) => {
    const list = nodes[parentId].children
    list.splice(list.indexOf(id), 0, sibling.id)
    nodes[sibling.id] = sibling
  })
  return [next, sibling.id]
}

/** New node between `id` and its parent (the node becomes its child). */
export function insertParent(map: MindMap, id: string, text: string, newId?: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node?.parentId) return [map, id]
  const parentId = node.parentId
  const middle = {
    ...makeNode(parentId, text, newId),
    children: [id],
    ...(isHub(map, parentId) ? { dir: hubChildDir(map, parentId, id) } : {}),
    ...(parentId === map.rootId ? { branch: node.branch } : {}),
  }
  const next = edit(map, [parentId, id], (nodes) => {
    const list = nodes[parentId].children
    list.splice(list.indexOf(id), 1, middle.id)
    nodes[middle.id] = middle
    nodes[id] = { ...nodes[id], parentId: middle.id, dx: 0, dy: 0, px: undefined, py: undefined }
    if (node.px !== undefined && node.py !== undefined) nodes[middle.id] = { ...nodes[middle.id], px: node.px, py: node.py }
  })
  return [next, middle.id]
}

/** A free node at a canvas point (not connected to anything yet). */
export function addFloating(map: MindMap, x: number, y: number, text: string, newId?: string): [MindMap, string] {
  const node = { ...makeNode(null, text, newId), x: Math.round(x), y: Math.round(y) }
  const next = edit(map, [], (nodes) => { nodes[node.id] = node })
  return [next, node.id]
}

/** Cut the line to the parent: the node (with its subtree) stays where it is as a free node. */
export function detach(map: MindMap, id: string, center: { x: number; y: number }, dir: Dir = 'right'): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId) return map
  const parentId = node.parentId
  return edit(map, [parentId, id, ...node.children], (nodes) => {
    nodes[parentId].children = nodes[parentId].children.filter((child) => child !== id)
    nodes[id] = { ...nodes[id], parentId: null, x: Math.round(center.x), y: Math.round(center.y), dx: 0, dy: 0, px: undefined, py: undefined, dir: undefined }
    // It is a hub now: its branches keep growing the way they did.
    for (const child of node.children) if (nodes[child]) nodes[child] = { ...nodes[child], dir }
  })
}

/** Moves a free node (with its subtree) to the nearest place where it overlaps nothing. */
export function settleFree(map: MindMap, id: string): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId !== null || id === map.rootId) return map
  const { dx, dy } = freeSpot(computeLayout(map), new Set(subtreeIds(map, id)))
  if (!dx && !dy) return map
  return edit(map, [id], (nodes) => { nodes[id] = { ...nodes[id], x: (nodes[id].x ?? 0) + dx, y: (nodes[id].y ?? 0) + dy } })
}

/** A hub branch moves to another side (or place within its side): `beforeId` = the sibling it goes before. */
export function moveInHub(map: MindMap, id: string, dir: Dir, beforeId: string | null): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId || !isHub(map, node.parentId)) return map
  const parentId = node.parentId
  return edit(map, [parentId, id], (nodes) => {
    const list = nodes[parentId].children.filter((child) => child !== id)
    const at = beforeId ? list.indexOf(beforeId) : -1
    list.splice(at === -1 ? list.length : at, 0, id)
    nodes[parentId].children = list
    nodes[id] = { ...nodes[id], dir, dx: 0, dy: 0, px: undefined, py: undefined }
  })
}

export function setEdgeStyle(map: MindMap, edgeStyle: EdgeStyle): MindMap {
  return map.edgeStyle === edgeStyle ? map : { ...map, edgeStyle }
}

/** Removes the node and its subtree; returns the node to select next. */
export function removeNode(map: MindMap, id: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node || id === map.rootId) return [map, id]
  if (!node.parentId) {
    const doomedFree = new Set(subtreeIds(map, id))
    return [edit(map, [], (nodes) => { for (const key of doomedFree) delete nodes[key] }), map.rootId]
  }
  const parentId = node.parentId
  const siblings = map.nodes[parentId].children
  const index = siblings.indexOf(id)
  const nextSelected = siblings[index + 1] ?? siblings[index - 1] ?? parentId
  const doomed = new Set(subtreeIds(map, id))
  const next = edit(map, [parentId], (nodes) => {
    nodes[parentId].children = nodes[parentId].children.filter((child) => child !== id)
    for (const key of doomed) delete nodes[key]
  })
  return [next, nextSelected]
}

export function updateNode(map: MindMap, id: string, patch: Partial<Omit<MindNode, 'id' | 'parentId' | 'children'>>): MindMap {
  if (!map.nodes[id]) return map
  return edit(map, [id], (nodes) => { nodes[id] = { ...nodes[id], ...patch } })
}

export function moveAmongSiblings(map: MindMap, id: string, delta: -1 | 1): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId) return map
  const parentId = node.parentId
  const list = map.nodes[parentId].children
  const index = list.indexOf(id)
  const target = index + delta
  if (target < 0 || target >= list.length) return map
  return edit(map, [parentId], (nodes) => {
    const children = nodes[parentId].children
    children.splice(index, 1)
    children.splice(target, 0, id)
  })
}

/** Drop `id` onto `newParentId` (not onto itself or its own subtree). */
export function reparent(map: MindMap, id: string, newParentId: string, dir?: Dir): MindMap {
  const node = map.nodes[id]
  if (!node || id === map.rootId || id === newParentId || !map.nodes[newParentId] || isDescendant(map, newParentId, id) || node.parentId === newParentId) return map
  const oldParentId = node.parentId
  return edit(map, oldParentId ? [id, oldParentId, newParentId] : [id, newParentId], (nodes) => {
    if (oldParentId) nodes[oldParentId].children = nodes[oldParentId].children.filter((child) => child !== id)
    nodes[newParentId].children.push(id)
    nodes[newParentId].collapsed = false
    const keepBranch = node.branch !== undefined && !nodes[newParentId].children.some((child) => child !== id && map.nodes[child]?.branch === node.branch)
    nodes[id] = {
      ...nodes[id],
      parentId: newParentId,
      dx: 0,
      dy: 0,
      x: undefined,
      y: undefined,
      px: undefined,
      py: undefined,
      dir: isHub(map, newParentId) ? dir ?? pickDir(map, newParentId) : undefined,
      branch: newParentId === map.rootId ? (keepBranch ? node.branch : nextBranch(map, id)) : node.branch,
    }
  })
}

export function setAllCollapsed(map: MindMap, collapsed: boolean): MindMap {
  const ids = Object.values(map.nodes).filter((node) => node.children.length > 0 && node.id !== map.rootId).map((node) => node.id)
  if (!collapsed) ids.push(map.rootId)
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key].collapsed = collapsed })
}

/** Forget manual offsets — back to the automatic layout. */
/** Auto layout: every node back to its automatic place (hand-placed spots and offsets are dropped). */
export function resetOffsets(map: MindMap): MindMap {
  const ids = Object.values(map.nodes).filter((node) => node.dx !== 0 || node.dy !== 0 || node.px !== undefined || node.py !== undefined).map((node) => node.id)
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key] = { ...nodes[key], dx: 0, dy: 0, px: undefined, py: undefined } })
}

export function expandPath(map: MindMap, id: string): MindMap {
  const collapsed = ancestorsOf(map, id).filter((key) => map.nodes[key]?.collapsed)
  if (!collapsed.length) return map
  return edit(map, collapsed, (nodes) => { for (const key of collapsed) nodes[key].collapsed = false })
}

/** Indented outline (used for Markdown export and task descriptions). */
export function outline(map: MindMap, id: string, depth = 0): string[] {
  const node = map.nodes[id]
  if (!node) return []
  const line = `${'  '.repeat(depth)}- ${node.text || '…'}${node.link ? ` (${node.link})` : ''}`
  return [line, ...node.children.flatMap((child) => outline(map, child, depth + 1))]
}

/** Accepts a parsed JSON export; returns a fresh copy with a new id, or null if the shape is wrong. */
export function importMap(raw: unknown): MindMap | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<MindMap>
  if (typeof data.rootId !== 'string' || !data.nodes || typeof data.nodes !== 'object' || !data.nodes[data.rootId]) return null
  const nodes: Record<string, MindNode> = {}
  for (const [key, value] of Object.entries(data.nodes)) {
    const node = value as Partial<MindNode>
    nodes[key] = {
      id: key,
      parentId: typeof node.parentId === 'string' ? node.parentId : null,
      children: Array.isArray(node.children) ? node.children.filter((child): child is string => typeof child === 'string') : [],
      text: String(node.text ?? ''),
      note: String(node.note ?? ''),
      link: String(node.link ?? ''),
      color: typeof node.color === 'string' ? node.color : null,
      shape: node.shape === 'pill' || node.shape === 'rect' || node.shape === 'outline' ? node.shape : 'rounded',
      collapsed: Boolean(node.collapsed),
      dx: Number(node.dx) || 0,
      dy: Number(node.dy) || 0,
      ...(node.x != null && node.y != null && Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)) ? { x: Number(node.x), y: Number(node.y) } : {}),
      ...(node.dir === 'right' || node.dir === 'left' || node.dir === 'up' || node.dir === 'down' ? { dir: node.dir } : {}),
      ...(node.px != null && node.py != null && Number.isFinite(Number(node.px)) && Number.isFinite(Number(node.py)) ? { px: Number(node.px), py: Number(node.py) } : {}),
      ...(Number.isInteger(node.branch) && Number(node.branch) >= 0 && Number(node.branch) <= 7 ? { branch: Number(node.branch) } : {}),
      task: node.task && typeof node.task === 'object' ? node.task : null,
    }
  }
  // Drop dangling child references.
  for (const node of Object.values(nodes)) node.children = node.children.filter((child) => nodes[child])
  const now = new Date().toISOString()
  const edgeStyle = data.edgeStyle === 'straight' || data.edgeStyle === 'elbow' ? data.edgeStyle : 'curved'
  return { id: uid(), title: nodes[data.rootId].text, rootId: data.rootId, nodes, edgeStyle, createdAt: now, updatedAt: now }
}
