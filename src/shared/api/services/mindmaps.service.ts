import { request } from '../http'

/* ──────────────────────────────────────────────────────────────
   Mind maps — /mindmaps (contract: MINDMAP_FRONTEND_API.md).
   The document is stored and returned in the frontend's own camelCase.
   ────────────────────────────────────────────────────────────── */

export type MindMapDocumentDto = {
  rootId: string
  edgeStyle?: string
  nodes: Record<string, unknown>
  /** Extra lines between nodes ({ id, from, to }); stored by the API as an unknown document key. */
  relations?: Array<{ id: string; from: string; to: string }>
}

export type MindMapListItemDto = {
  id: string
  title: string
  node_count: number
  version: number
  created_at: string
  updated_at: string
}

export type MindMapDto = MindMapListItemDto & {
  client_id: string | null
  document: MindMapDocumentDto
}

export type MindMapListDto = {
  items: MindMapListItemDto[]
  total: number
  page: number
  page_size: number
  pages: number
}

/** 409 body: the server's current copy is at the top level. */
export type MindMapConflictDto = { detail: string; current: MindMapDto }

const path = (id: string) => `/mindmaps/${encodeURIComponent(id)}`

export const mindmapsService = {
  list(params: { search?: string; page?: number; page_size?: number } = {}) {
    return request<MindMapListDto>({ path: '/mindmaps', query: params })
  },

  get(id: string) {
    return request<MindMapDto>({ path: path(id) })
  },

  /** `client_id`: a stable local id — repeating it returns the already-created map (200) instead of a copy. */
  create(body: { title: string; client_id?: string; document: MindMapDocumentDto }) {
    return request<MindMapDto>({ path: '/mindmaps', method: 'POST', body })
  },

  /** Full autosave. A stale `version` → 409 with `current`. */
  replace(id: string, body: { title: string; version: number; document: MindMapDocumentDto }) {
    return request<MindMapDto>({ path: path(id), method: 'PUT', body })
  },

  remove(id: string) {
    return request<void>({ path: path(id), method: 'DELETE' })
  },
}
