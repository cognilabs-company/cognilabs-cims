import type { MindMap, MindMapSummary } from './types'

/**
 * Mind map storage.
 *
 * The backend has no mind-map API yet, so maps are kept in this browser (localStorage), per user.
 * Everything goes through this async interface — when the API appears, only this file changes.
 */
export type MindMapStore = {
  list(): Promise<MindMapSummary[]>
  get(id: string): Promise<MindMap | null>
  save(map: MindMap): Promise<MindMap>
  remove(id: string): Promise<void>
}

const PREFIX = 'cims.mindmap.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function summarize(map: MindMap): MindMapSummary {
  return { id: map.id, title: map.title, nodeCount: Object.keys(map.nodes).length, updatedAt: map.updatedAt }
}

export function createLocalStore(userId: number | string): MindMapStore {
  const indexKey = `${PREFIX}.${userId}.index`
  const docKey = (id: string) => `${PREFIX}.${userId}.map.${id}`
  const index = () => read<MindMapSummary[]>(indexKey) ?? []

  return {
    async list() {
      return [...index()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async get(id) {
      return read<MindMap>(docKey(id))
    },
    async save(map) {
      const saved = { ...map, updatedAt: new Date().toISOString() }
      write(docKey(saved.id), saved)
      write(indexKey, [summarize(saved), ...index().filter((item) => item.id !== saved.id)])
      return saved
    },
    async remove(id) {
      localStorage.removeItem(docKey(id))
      write(indexKey, index().filter((item) => item.id !== id))
    },
  }
}
