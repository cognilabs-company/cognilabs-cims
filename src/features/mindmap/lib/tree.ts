import type { MindMap, MindNode } from './types'

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

export function addChild(map: MindMap, parentId: string, text: string, id?: string): [MindMap, string] {
  const child = makeNode(parentId, text, id)
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
  const next = edit(map, [parentId], (nodes) => {
    const list = nodes[parentId].children
    list.splice(list.indexOf(id) + 1, 0, sibling.id)
    nodes[sibling.id] = sibling
  })
  return [next, sibling.id]
}

/** Removes the node and its subtree; returns the node to select next. */
export function removeNode(map: MindMap, id: string): [MindMap, string] {
  const node = map.nodes[id]
  if (!node?.parentId) return [map, id]
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
export function reparent(map: MindMap, id: string, newParentId: string): MindMap {
  const node = map.nodes[id]
  if (!node?.parentId || id === newParentId || isDescendant(map, newParentId, id) || node.parentId === newParentId) return map
  const oldParentId = node.parentId
  return edit(map, [id, oldParentId, newParentId], (nodes) => {
    nodes[oldParentId].children = nodes[oldParentId].children.filter((child) => child !== id)
    nodes[newParentId].children.push(id)
    nodes[newParentId].collapsed = false
    nodes[id] = { ...nodes[id], parentId: newParentId, dx: 0, dy: 0 }
  })
}

export function setAllCollapsed(map: MindMap, collapsed: boolean): MindMap {
  const ids = Object.values(map.nodes).filter((node) => node.children.length > 0 && node.id !== map.rootId).map((node) => node.id)
  if (!collapsed) ids.push(map.rootId)
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key].collapsed = collapsed })
}

/** Forget manual offsets — back to the automatic layout. */
export function resetOffsets(map: MindMap): MindMap {
  const ids = Object.values(map.nodes).filter((node) => node.dx !== 0 || node.dy !== 0).map((node) => node.id)
  return edit(map, ids, (nodes) => { for (const key of ids) nodes[key] = { ...nodes[key], dx: 0, dy: 0 } })
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
      task: node.task && typeof node.task === 'object' ? node.task : null,
    }
  }
  // Drop dangling child references.
  for (const node of Object.values(nodes)) node.children = node.children.filter((child) => nodes[child])
  const now = new Date().toISOString()
  return { id: uid(), title: nodes[data.rootId].text, rootId: data.rootId, nodes, createdAt: now, updatedAt: now }
}
