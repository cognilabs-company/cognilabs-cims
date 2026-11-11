export type NodeShape = 'rounded' | 'pill' | 'rect' | 'outline'

/** A task (project card) created from a node. */
export type NodeTask = {
  cardId: number | null
  projectId: number
  boardId: number
  title: string
}

export type MindNode = {
  id: string
  parentId: string | null
  /** Ordered child ids. */
  children: string[]
  text: string
  note: string
  link: string
  /** Palette colour (hex) or null = inherit the branch colour. */
  color: string | null
  shape: NodeShape
  collapsed: boolean
  /** Manual offset from the auto-layout position (drag / Alt+arrows). Children move with their parent. */
  dx: number
  dy: number
  task: NodeTask | null
}

export type MindMap = {
  id: string
  /** Same as the root node's text. */
  title: string
  rootId: string
  nodes: Record<string, MindNode>
  createdAt: string
  updatedAt: string
}

export type MindMapSummary = {
  id: string
  title: string
  nodeCount: number
  updatedAt: string
}

export const NODE_NOTE_LIMIT = 5000

/** Swatches offered in the inspector (null = automatic branch colour). */
export const NODE_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#64748B'] as const

/** Colours given to first-level branches in turn when a node has no colour of its own. */
export const BRANCH_COLORS = ['#2B59FF', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#0EA5E9', '#EF4444', '#14B8A6'] as const

export const NODE_SHAPES: NodeShape[] = ['rounded', 'pill', 'rect', 'outline']
