import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fileManagerService, type FmCrumb, type FmFolder } from '../../../shared/api/services/fileManager.service'
import { ROOT_KEY } from './explorer'

type Node = { gen: number; folders: FmFolder[] }

export type FolderTree = ReturnType<typeof useFolderTree>

/**
 * Lazily loaded folder tree for the navigation pane (and the address bar's sub-folder lists).
 * A node's children are fetched the first time it is expanded (or asked for) and fetched again
 * after every change (`generation` = the page's reload counter), keeping the old list until then.
 * The ancestors of the open folder are expanded automatically.
 */
export function useFolderTree({ enabled, generation, pathIds }: { enabled: boolean; generation: number; pathIds: string[] }) {
  const [cache, setCache] = useState<Record<string, Node>>({})
  const [failed, setFailed] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([ROOT_KEY, ...pathIds]))
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set())
  const inflight = useRef(new Set<string>())

  // Opening a folder (also by Back / Forward or a link) unfolds the tree down to it.
  const pathKey = pathIds.join('/')
  const [expandedFor, setExpandedFor] = useState(pathKey)
  if (expandedFor !== pathKey) {
    setExpandedFor(pathKey)
    if (pathIds.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ROOT_KEY, ...pathIds]))
  }

  const needed = useMemo(() => [...new Set([...expanded, ...requested])], [expanded, requested])

  useEffect(() => {
    if (!enabled) return
    for (const key of needed) {
      if (cache[key]?.gen === generation || failed[key] === generation) continue
      const tag = `${key}|${generation}`
      if (inflight.current.has(tag)) continue
      inflight.current.add(tag)
      fileManagerService.browse({ folderId: key === ROOT_KEY ? null : key, page: 1, pageSize: 1 })
        .then((data) => setCache((previous) => (previous[key]?.gen === generation ? previous : { ...previous, [key]: { gen: generation, folders: data.folders } })))
        .catch(() => setFailed((previous) => ({ ...previous, [key]: generation })))
        .finally(() => inflight.current.delete(tag))
    }
  }, [cache, enabled, failed, generation, needed])

  /** The main listing already has the sub-folders of the open folder — no second request. */
  const seed = useCallback((key: string, folders: FmFolder[], gen: number) => {
    setCache((previous) => ({ ...previous, [key]: { gen, folders } }))
  }, [])

  const toggle = useCallback((key: string, open?: boolean) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      const shouldOpen = open ?? !next.has(key)
      if (shouldOpen) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  /** Load a node's children without unfolding it (address bar drop-downs). */
  const request = useCallback((key: string) => {
    setRequested((previous) => (previous.has(key) ? previous : new Set([...previous, key])))
  }, [])

  const childrenOf = useCallback((key: string): FmFolder[] | null => cache[key]?.folders ?? null, [cache])
  const isLoading = useCallback((key: string) => !cache[key] && failed[key] !== generation, [cache, failed, generation])
  const hasFailed = useCallback((key: string) => !cache[key] && failed[key] === generation, [cache, failed, generation])

  /** Root → … → folder, from what the tree has loaded (null when a part is not known yet). */
  const pathTo = useCallback((id: string): FmCrumb[] | null => {
    const parents = new Map<string, { key: string; folder: FmFolder }>()
    for (const [key, node] of Object.entries(cache)) {
      for (const folder of node.folders) parents.set(folder.id, { key, folder })
    }
    const chain: FmCrumb[] = []
    let cursor = id
    for (let guard = 0; cursor !== ROOT_KEY && guard < 64; guard += 1) {
      const entry = parents.get(cursor)
      if (!entry) return null
      chain.unshift({ id: entry.folder.id, name: entry.folder.name, system: entry.folder.system })
      cursor = entry.key
    }
    return chain
  }, [cache])

  return { expanded, toggle, request, seed, childrenOf, isLoading, hasFailed, pathTo }
}
