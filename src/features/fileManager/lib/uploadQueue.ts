import type { UploadProgress } from '../../../shared/api/http'
import { isAbortError } from './items'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled'

export type UploadItem = {
  id: string
  file: File
  folderId: string
  folderName: string
  status: UploadStatus
  loaded: number
  total: number
  error: unknown
}

export type UploadEvent =
  | { type: 'done'; item: UploadItem }
  | { type: 'error'; item: UploadItem }
  /** Nothing is queued or running any more; counts cover the batch that just finished. */
  | { type: 'idle'; done: number; failed: UploadItem[] }

type UploadFn = (item: UploadItem, onProgress: (progress: UploadProgress) => void, signal: AbortSignal) => Promise<unknown>

let sequence = 0

/**
 * Upload queue outside React: a few files upload in parallel, each with its own progress, cancel and retry.
 * Components read it with useSyncExternalStore (only the panel re-renders on progress).
 */
export function createUploadQueue(upload: UploadFn, concurrency = 3) {
  let items: UploadItem[] = []
  let running = 0
  let batchDone = 0
  let batchFailed: UploadItem[] = []
  const controllers = new Map<string, AbortController>()
  const listeners = new Set<() => void>()
  const eventListeners = new Set<(event: UploadEvent) => void>()

  const emit = () => listeners.forEach((listener) => listener())
  const notify = (event: UploadEvent) => eventListeners.forEach((listener) => listener(event))

  function patch(id: string, change: Partial<UploadItem>) {
    items = items.map((item) => (item.id === id ? { ...item, ...change } : item))
    emit()
  }

  function settle(id: string, change: Partial<UploadItem>) {
    patch(id, change)
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    if (item.status === 'done') {
      batchDone += 1
      notify({ type: 'done', item })
    } else if (item.status === 'error') {
      batchFailed.push(item)
      notify({ type: 'error', item })
    }
  }

  function pump() {
    while (running < concurrency) {
      const next = items.find((item) => item.status === 'queued')
      if (!next) break
      running += 1
      const controller = new AbortController()
      controllers.set(next.id, controller)
      patch(next.id, { status: 'uploading', loaded: 0, error: null })
      upload(
        next,
        (progress) => patch(next.id, { loaded: progress.loaded, total: progress.total || next.file.size }),
        controller.signal,
      )
        .then(() => settle(next.id, { status: 'done', loaded: next.file.size, total: next.file.size }))
        .catch((error: unknown) => settle(next.id, isAbortError(error) ? { status: 'cancelled' } : { status: 'error', error }))
        .finally(() => {
          running -= 1
          controllers.delete(next.id)
          pump()
        })
    }
    if (running === 0 && !items.some((item) => item.status === 'queued')) {
      if (batchDone || batchFailed.length) notify({ type: 'idle', done: batchDone, failed: batchFailed })
      batchDone = 0
      batchFailed = []
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => items,
    /** Upload events (done / error / idle) for toasts and reloading the listing. */
    onEvent(listener: (event: UploadEvent) => void) {
      eventListeners.add(listener)
      return () => {
        eventListeners.delete(listener)
      }
    },
    add(files: File[], target: { id: string; name: string }) {
      const added = files.map((file): UploadItem => ({
        id: `u${(sequence += 1)}`,
        file,
        folderId: target.id,
        folderName: target.name,
        status: 'queued',
        loaded: 0,
        total: file.size,
        error: null,
      }))
      items = [...items, ...added]
      emit()
      pump()
    },
    cancel(id: string) {
      const item = items.find((entry) => entry.id === id)
      if (!item) return
      if (item.status === 'queued') {
        patch(id, { status: 'cancelled' })
        pump()
      } else if (item.status === 'uploading') {
        controllers.get(id)?.abort()
      }
    },
    cancelAll() {
      items.filter((item) => item.status === 'queued').forEach((item) => patch(item.id, { status: 'cancelled' }))
      controllers.forEach((controller) => controller.abort())
    },
    retry(id: string) {
      const item = items.find((entry) => entry.id === id)
      if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return
      patch(id, { status: 'queued', loaded: 0, error: null })
      pump()
    },
    /** Drops finished rows (done / failed / cancelled); running uploads stay. */
    clearFinished() {
      items = items.filter((item) => item.status === 'queued' || item.status === 'uploading')
      emit()
    },
  }
}

export type UploadQueue = ReturnType<typeof createUploadQueue>
