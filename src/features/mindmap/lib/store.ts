import { mindmapsService, type MindMapConflictDto, type MindMapDocumentDto, type MindMapDto, type MindMapListItemDto } from '../../../shared/api/services/mindmaps.service'
import { importMap } from './tree'
import type { MindMap, MindMapSummary, MindNode } from './types'

/** Everything the page needs from storage. */
export type MindMapStore = {
  list(): Promise<MindMapSummary[]>
  get(id: string): Promise<MindMap | null>
  /** A new map. `clientId` (a stable local id) makes the create safe to repeat. */
  create(map: MindMap, clientId?: string): Promise<MindMap>
  save(map: MindMap): Promise<MindMap>
  remove(id: string): Promise<void>
}

export function summarize(map: MindMap): MindMapSummary {
  return { id: map.id, title: map.title, nodeCount: Object.keys(map.nodes).length, updatedAt: map.updatedAt }
}

/** HTTP error thrown by `request` (status + parsed body). */
export type StoreError = { status?: number; details?: unknown }

export function errorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error ? Number((error as StoreError).status) : 0
}

/** Someone saved the map elsewhere first: `current` is the server copy. Never retried automatically. */
export class MindMapConflict extends Error {
  readonly conflict = true
  readonly current: MindMap
  readonly version: number
  constructor(current: MindMap, version: number) {
    super('Mind map was changed elsewhere.')
    this.current = current
    this.version = version
  }
}

export function isConflict(error: unknown): error is MindMapConflict {
  return error instanceof MindMapConflict
}

// ── Server store (/mindmaps) ────────────────────────────────────────────────

/**
 * The document as the API validates it: `dir` / `branch` only on direct children of the central topic or of a
 * free node, `x` / `y` only on free nodes, `px` / `py` only on connected nodes. Leftovers from earlier moves are dropped.
 */
export function toDocument(map: MindMap): MindMapDocumentDto {
  const nodes: Record<string, MindNode> = {}
  for (const [id, node] of Object.entries(map.nodes)) {
    const parent = node.parentId ? map.nodes[node.parentId] : undefined
    const isRootOrFree = (candidate: MindNode | undefined) => Boolean(candidate && (candidate.id === map.rootId || candidate.parentId === null))
    const hubChild = isRootOrFree(parent)
    const free = node.parentId === null && id !== map.rootId
    const clean: MindNode = { ...node }
    if (!hubChild) { delete clean.dir; delete clean.branch }
    if (!free) { delete clean.x; delete clean.y }
    if (node.parentId === null) { delete clean.px; delete clean.py }
    nodes[id] = clean
  }
  return { rootId: map.rootId, edgeStyle: map.edgeStyle ?? 'curved', nodes }
}

function fromDto(dto: MindMapDto): MindMap | null {
  const parsed = importMap(dto.document)
  if (!parsed) return null
  return { ...parsed, id: String(dto.id), title: dto.title || parsed.title, createdAt: dto.created_at, updatedAt: dto.updated_at }
}

function summaryOf(item: MindMapListItemDto): MindMapSummary {
  return { id: String(item.id), title: item.title, nodeCount: item.node_count, updatedAt: item.updated_at }
}

const PAGE_SIZE = 200
const MAX_PAGES = 20

/**
 * Mind maps on the server. Saves of one map run one after another, each with the version the
 * previous one returned, so a quick series of autosaves never conflicts with itself.
 * After a 409 the map stays blocked (every save rejects with the same conflict) until `resolveConflict`.
 */
export function createApiStore() {
  const versions = new Map<string, number>()
  const queues = new Map<string, Promise<unknown>>()
  const conflicts = new Map<string, MindMapConflict>()

  const remember = (dto: MindMapDto) => {
    // Versions only grow: a slow GET never takes a map back behind a save that already finished.
    versions.set(String(dto.id), Math.max(versions.get(String(dto.id)) ?? 0, dto.version))
    const map = fromDto(dto)
    if (!map) throw new Error('Invalid mind map document')
    return map
  }

  const store = {
    async list() {
      const all: MindMapSummary[] = []
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const response = await mindmapsService.list({ page, page_size: PAGE_SIZE })
        for (const item of response.items) {
          all.push(summaryOf(item))
          if (!versions.has(String(item.id))) versions.set(String(item.id), item.version)
        }
        if (page >= (response.pages || 1)) break
      }
      return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async get(id: string) {
      try {
        return remember(await mindmapsService.get(id))
      } catch (error) {
        if (errorStatus(error) === 404) return null
        throw error
      }
    },

    async create(map: MindMap, clientId?: string) {
      return remember(await mindmapsService.create({ title: map.title, ...(clientId ? { client_id: clientId } : {}), document: toDocument(map) }))
    },

    save(map: MindMap) {
      const id = map.id
      const run = (queues.get(id) ?? Promise.resolve()).then(async () => {
        const pending = conflicts.get(id)
        if (pending) throw pending
        try {
          return remember(await mindmapsService.replace(id, { title: map.title, version: versions.get(id) ?? 1, document: toDocument(map) }))
        } catch (error) {
          if (errorStatus(error) === 409) {
            const body = (error as StoreError).details as Partial<MindMapConflictDto> | null
            const current = body?.current ? fromDto(body.current) : null
            if (current && body?.current) {
              const conflict = new MindMapConflict(current, body.current.version)
              conflicts.set(id, conflict)
              throw conflict
            }
          }
          throw error
        }
      })
      queues.set(id, run.catch(() => undefined))
      return run
    },

    async remove(id: string) {
      await mindmapsService.remove(id)
      versions.delete(id)
      conflicts.delete(id)
    },

    /** The user chose: continue from the server's version (their next save overwrites it, or they load it). */
    resolveConflict(id: string) {
      const conflict = conflicts.get(id)
      if (!conflict) return null
      conflicts.delete(id)
      versions.set(id, conflict.version)
      return conflict
    },
  } satisfies MindMapStore & Record<string, unknown>
  return store
}

export type ApiMindMapStore = ReturnType<typeof createApiStore>

// ── Maps kept in this browser before the API existed ───────────────────────

const PREFIX = 'cims.mindmap.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Moves this user's localStorage maps to the server (once). The local id is sent as `client_id`, so a
 * repeated import returns the same server map. A map is removed locally only after the server has it.
 */
export async function migrateLocalMaps(userId: number | string, api: ApiMindMapStore) {
  const indexKey = `${PREFIX}.${userId}.index`
  const docKey = (id: string) => `${PREFIX}.${userId}.map.${id}`
  const index = read<MindMapSummary[]>(indexKey) ?? []
  const moved = new Map<string, string>()
  let failed = 0
  for (const summary of index) {
    const local = read<MindMap>(docKey(summary.id))
    const parsed = local ? importMap(local) : null
    if (!local || !parsed) continue
    try {
      const clientId = /^[A-Za-z0-9_-]{1,32}$/.test(local.id) ? local.id : undefined
      const created = await api.create({ ...parsed, title: local.title || parsed.title }, clientId)
      moved.set(local.id, created.id)
      try {
        localStorage.removeItem(docKey(local.id))
        const rest = (read<MindMapSummary[]>(indexKey) ?? []).filter((item) => item.id !== local.id)
        if (rest.length) localStorage.setItem(indexKey, JSON.stringify(rest))
        else localStorage.removeItem(indexKey)
      } catch { /* storage blocked — the server copy is what counts */ }
    } catch (error) {
      // No permission to create: leave the maps where they are, quietly.
      if (errorStatus(error) === 403) return { moved, failed: 0 }
      failed += 1
    }
  }
  return { moved, failed }
}

export function hasLocalMaps(userId: number | string) {
  return (read<MindMapSummary[]>(`${PREFIX}.${userId}.index`) ?? []).length > 0
}
