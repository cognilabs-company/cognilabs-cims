import { computeLayout, freeSpot, hubChildDir, isHub, nextBranch } from './layout'
import type { Dir, EdgeStyle, MindMap, MindNode, MindRelation } from './types'

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
  return { id: uid(), title, rootId: root.id, nodes: { [root.id]: root }, relations: [], createdAt: now, updatedAt: now }
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

// The walks below stop on a repeated node, so even a broken document (a loop of parents) cannot hang the page.

export function depthOf(map: MindMap, id: string) {
  let depth = 0
  const seen = new Set<string>()
  let node = map.nodes[id]
  while (node?.parentId && !seen.has(node.id)) {
    seen.add(node.id)
    depth += 1
    node = map.nodes[node.parentId]
  }
  return depth
}

export function isDescendant(map: MindMap, id: string, ancestorId: string) {
  const seen = new Set<string>()
  let node = map.nodes[id]
  while (node?.parentId && !seen.has(node.id)) {
    seen.add(node.id)
    if (node.parentId === ancestorId) return true
    node = map.nodes[node.parentId]
  }
  return false
}

export function ancestorsOf(map: MindMap, id: string) {
  const list: string[] = []
  const seen = new Set<string>([id])
  let node = map.nodes[id]
  while (node?.parentId && !seen.has(node.parentId)) {
    list.push(node.parentId)
    seen.add(node.parentId)
    node = map.nodes[node.parentId]
  }
  return list
}

export function subtreeIds(map: MindMap, id: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const current = stack.pop()!
    if (seen.has(current) || !map.nodes[current]) continue
    seen.add(current)
    out.push(current)
    stack.push(...map.nodes[current].children)
  }
  return out
}

// ── Extra lines (relations) ─────────────────────────────────────────────────

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * The map's extra lines that can be drawn: both ends exist, no line to itself, no copy of a tree line
 * (parent ↔ child) and no second line between the same two nodes.
 */
export function relationsOf(map: MindMap): MindRelation[] {
  const list = map.relations ?? []
  if (!list.length) return list
  const seen = new Set<string>()
  const out = list.filter((relation) => {
    const from = map.nodes[relation.from]
    const to = map.nodes[relation.to]
    if (!from || !to || from.id === to.id || from.parentId === to.id || to.parentId === from.id) return false
    const key = pairKey(from.id, to.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return out.length === list.length ? list : out
}

/** Drops relations that are no longer valid (after nodes were removed or became parent and child). */
function withCleanRelations(map: MindMap): MindMap {
  if (!map.relations?.length) return map
  const clean = relationsOf(map)
  return clean === map.relations ? map : { ...map, relations: clean }
}

export function relationBetween(map: MindMap, a: string, b: string) {
  return relationsOf(map).find((relation) => pairKey(relation.from, relation.to) === pairKey(a, b)) ?? null
}

/** An extra line between two nodes. Nothing else changes: every node keeps its own line. */
export function addRelation(map: MindMap, from: string, to: string, id = uid()): MindMap {
  const a = map.nodes[from]
  const b = map.nodes[to]
  if (!a || !b || from === to || a.parentId === to || b.parentId === from || relationBetween(map, from, to)) return map
  return { ...map, relations: [...relationsOf(map), { id, from, to }] }
}

export function removeRelation(map: MindMap, id: string): MindMap {
  const list = map.relations ?? []
  if (!list.some((relation) => relation.id === id)) return map
  return { ...map, relations: list.filter((relation) => relation.id !== id) }
}

// ── Tree edits ──────────────────────────────────────────────────────────────

export function addChild(map: MindMap, parentId: string, text: string, id?: string, dir?: Dir): [MindMap, string] {
  if (!map.nodes[parentId]) return [map, parentId]
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
  if (!node?.parentId || !map.nodes[node.parentId]) return addChild(map, id, text, newId)
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
  if (!node?.parentId || !map.nodes[node.parentId]) return addChild(map, id, text, newId)
  const parentId = node.parentId
  const sibling = makeNode(parentId, text, newId)
  if (isHub(map, parentId)) sibling.dir = hubChildDir(map, parentId, id)
  if (parentId === map.rootId) sibling.branch = nextBranch(map)
  const next = edit(map, [parentId], (nodes) => {
    const list = nodes[parentId].children
    list.splice(Math.max(0, list.indexOf(id)), 0, sibling.id)
    nodes[sibling.id] = sibling
  })
  return [next, sibling.id]
}

/** New node between `id` and its parent (the node becomes its child). */
export function insertParent(map: MindMap, id: string, text: string, newId?: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node?.parentId || !map.nodes[node.parentId]) return [map, id]
  const parentId = node.parentId
  const middle: MindNode = {
    ...makeNode(parentId, text, newId),
    children: [id],
    ...(isHub(map, parentId) ? { dir: hubChildDir(map, parentId, id) } : {}),
    ...(parentId === map.rootId ? { branch: node.branch } : {}),
    // A hand-placed node keeps its spot: the new parent takes it.
    ...(node.px !== undefined && node.py !== undefined ? { px: node.px, py: node.py } : {}),
  }
  const next = edit(map, [parentId, id], (nodes) => {
    const list = nodes[parentId].children
    list.splice(list.indexOf(id), 1, middle.id)
    nodes[middle.id] = middle
    nodes[id] = { ...nodes[id], parentId: middle.id, dx: 0, dy: 0, px: undefined, py: undefined, dir: undefined, branch: undefined }
  })
  return [withCleanRelations(next), middle.id]
}

/** A free node at a canvas point (not connected to anything yet). */
export function addFloating(map: MindMap, x: number, y: number, text: string, newId?: string): [MindMap, string] {
  const node = { ...makeNode(null, text, newId), x: Math.round(x), y: Math.round(y) }
  const next = edit(map, [], (nodes) => { nodes[node.id] = node })
  return [next, node.id]
}

/**
 * Cut the line to the parent: the node (with its whole subtree) stays exactly where it is, as a free node.
 * Its branches keep growing the way they did (`dir`). Nothing else changes.
 */
export function detach(map: MindMap, id: string, center: { x: number; y: number }, dir: Dir = 'right'): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId || id === map.rootId) return map
  const parentId = node.parentId
  return edit(map, [parentId, id, ...node.children], (nodes) => {
    if (nodes[parentId]) nodes[parentId].children = nodes[parentId].children.filter((child) => child !== id)
    nodes[id] = {
      ...nodes[id],
      parentId: null,
      x: Math.round(center.x),
      y: Math.round(center.y),
      dx: 0,
      dy: 0,
      px: undefined,
      py: undefined,
      dir: undefined,
      branch: undefined,
      // A free node has no collapse button: its branches are always shown.
      collapsed: false,
    }
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

/** Removes the node and its subtree (and the extra lines that touch them); returns the node to select next. */
export function removeNode(map: MindMap, id: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node || id === map.rootId) return [map, id]
  const doomed = new Set(subtreeIds(map, id))
  doomed.delete(map.rootId)
  const parentId = node.parentId && map.nodes[node.parentId] ? node.parentId : null
  let nextSelected = map.rootId
  if (parentId) {
    const siblings = map.nodes[parentId].children
    const index = siblings.indexOf(id)
    nextSelected = siblings[index + 1] ?? siblings[index - 1] ?? parentId
  }
  const next = edit(map, parentId ? [parentId] : [], (nodes) => {
    if (parentId) nodes[parentId].children = nodes[parentId].children.filter((child) => child !== id)
    for (const key of doomed) delete nodes[key]
  })
  return [withCleanRelations(next), nextSelected]
}

export function updateNode(map: MindMap, id: string, patch: Partial<Omit<MindNode, 'id' | 'parentId' | 'children'>>): MindMap {
  if (!map.nodes[id]) return map
  return edit(map, [id], (nodes) => { nodes[id] = { ...nodes[id], ...patch } })
}

export function moveAmongSiblings(map: MindMap, id: string, delta: -1 | 1): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId || !map.nodes[node.parentId]) return map
  const parentId = node.parentId
  const list = map.nodes[parentId].children
  const index = list.indexOf(id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= list.length) return map
  return edit(map, [parentId], (nodes) => {
    const children = nodes[parentId].children
    children.splice(index, 1)
    children.splice(target, 0, id)
  })
}

/**
 * `id` (with its subtree) goes under `newParentId`. Only its own line changes: the old one is replaced by
 * the new one. Never onto itself, its own subtree or the parent it already has.
 */
export function reparent(map: MindMap, id: string, newParentId: string, dir?: Dir): MindMap {
  const node = map.nodes[id]
  if (!node || id === map.rootId || id === newParentId || !map.nodes[newParentId] || isDescendant(map, newParentId, id) || node.parentId === newParentId) return map
  const oldParentId = node.parentId && map.nodes[node.parentId] ? node.parentId : null
  const toHub = isHub(map, newParentId)
  const next = edit(map, oldParentId ? [id, oldParentId, newParentId] : [id, newParentId], (nodes) => {
    if (oldParentId) nodes[oldParentId].children = nodes[oldParentId].children.filter((child) => child !== id)
    nodes[newParentId].children = [...nodes[newParentId].children.filter((child) => child !== id), id]
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
      dir: toHub ? dir ?? pickDir(map, newParentId) : undefined,
      branch: newParentId === map.rootId ? (keepBranch ? node.branch : nextBranch(map, id)) : undefined,
    }
  })
  // An extra line between the two would now be a copy of the tree line.
  return withCleanRelations(next)
}

/** Collapse / expand every branch. Free nodes and the central topic are never collapsed (they have no toggle). */
export function setAllCollapsed(map: MindMap, collapsed: boolean): MindMap {
  const ids = Object.values(map.nodes)
    .filter((node) => (collapsed ? node.children.length > 0 && !isHub(map, node.id) && !node.collapsed : node.collapsed))
    .map((node) => node.id)
  if (!ids.length) return map
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key].collapsed = collapsed })
}

/** Auto layout: every node back to its automatic place (hand-placed spots and offsets are dropped). */
export function resetOffsets(map: MindMap): MindMap {
  const ids = Object.values(map.nodes).filter((node) => node.dx !== 0 || node.dy !== 0 || node.px !== undefined || node.py !== undefined).map((node) => node.id)
  if (!ids.length) return map
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key] = { ...nodes[key], dx: 0, dy: 0, px: undefined, py: undefined } })
}

export function expandPath(map: MindMap, id: string): MindMap {
  const collapsed = ancestorsOf(map, id).filter((key) => map.nodes[key]?.collapsed)
  if (!collapsed.length) return map
  return edit(map, collapsed, (nodes) => { for (const key of collapsed) nodes[key].collapsed = false })
}

/** Indented outline (used for Markdown export and task descriptions). */
export function outline(map: MindMap, id: string, depth = 0, seen = new Set<string>()): string[] {
  const node = map.nodes[id]
  if (!node || seen.has(id)) return []
  seen.add(id)
  const line = `${'  '.repeat(depth)}- ${node.text || '…'}${node.link ? ` (${node.link})` : ''}`
  return [line, ...node.children.flatMap((child) => outline(map, child, depth + 1, seen))]
}

// ── Import / repair ─────────────────────────────────────────────────────────

/**
 * Makes the parent links of a document consistent, in place. `parentId` is the source of truth:
 * a parent that does not exist (or a loop of parents) turns the node into a free node, and every
 * `children` list holds exactly the nodes that point to it — stored order first, missing ones appended.
 */
function repairTree(nodes: Record<string, MindNode>, rootId: string) {
  nodes[rootId].parentId = null
  for (const node of Object.values(nodes)) {
    if (node.parentId !== null && (!nodes[node.parentId] || node.parentId === node.id)) node.parentId = null
  }
  // Loops: walk up from every node; coming back to a node on the same walk means a loop — cut it there.
  const state = new Map<string, 'walking' | 'done'>()
  for (const start of Object.keys(nodes)) {
    const walk: string[] = []
    let current: string | null = start
    while (current !== null && !state.has(current)) {
      state.set(current, 'walking')
      walk.push(current)
      current = nodes[current].parentId
    }
    if (current !== null && state.get(current) === 'walking') nodes[current].parentId = null
    for (const id of walk) state.set(id, 'done')
  }
  const lists = new Map<string, string[]>()
  for (const node of Object.values(nodes)) {
    const seen = new Set<string>()
    const kept: string[] = []
    for (const child of node.children) {
      if (seen.has(child) || nodes[child]?.parentId !== node.id) continue
      seen.add(child)
      kept.push(child)
    }
    lists.set(node.id, kept)
  }
  for (const node of Object.values(nodes)) {
    if (node.parentId === null) continue
    const list = lists.get(node.parentId)!
    if (!list.includes(node.id)) list.push(node.id)
  }
  let lost = 0
  for (const node of Object.values(nodes)) {
    node.children = lists.get(node.id) ?? []
    if (node.parentId === null) {
      delete node.px
      delete node.py
      // A free node without a place (it lost its parent): line it up under the central topic.
      if (node.id !== rootId && (node.x === undefined || node.y === undefined)) {
        node.x = 0
        node.y = 220 + lost * 64
        lost += 1
      }
    } else {
      delete node.x
      delete node.y
    }
  }
}

const RELATION_ID = /^[A-Za-z0-9_-]{1,40}$/

function parseRelations(raw: unknown, nodes: Record<string, MindNode>): MindRelation[] {
  if (!Array.isArray(raw)) return []
  const out: MindRelation[] = []
  const pairs = new Set<string>()
  const ids = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, from, to } = item as Partial<MindRelation>
    if (typeof from !== 'string' || typeof to !== 'string' || from === to || !nodes[from] || !nodes[to]) continue
    if (nodes[from].parentId === to || nodes[to].parentId === from) continue
    const key = pairKey(from, to)
    if (pairs.has(key)) continue
    pairs.add(key)
    let relationId = typeof id === 'string' && RELATION_ID.test(id) ? id : uid()
    while (ids.has(relationId)) relationId = uid()
    ids.add(relationId)
    out.push({ id: relationId, from, to })
  }
  return out
}

/** Accepts a parsed JSON export; returns a fresh copy with a new id, or null if the shape is wrong. */
export function importMap(raw: unknown): MindMap | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<MindMap>
  if (typeof data.rootId !== 'string' || !data.nodes || typeof data.nodes !== 'object' || !data.nodes[data.rootId]) return null
  const nodes: Record<string, MindNode> = {}
  for (const [key, value] of Object.entries(data.nodes)) {
    if (!value || typeof value !== 'object') continue
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
  if (!nodes[data.rootId]) return null
  repairTree(nodes, data.rootId)
  const now = new Date().toISOString()
  const edgeStyle = data.edgeStyle === 'straight' || data.edgeStyle === 'elbow' ? data.edgeStyle : 'curved'
  return {
    id: uid(),
    title: nodes[data.rootId].text,
    rootId: data.rootId,
    nodes,
    relations: parseRelations((data as { relations?: unknown }).relations, nodes),
    edgeStyle,
    createdAt: now,
    updatedAt: now,
  }
}
