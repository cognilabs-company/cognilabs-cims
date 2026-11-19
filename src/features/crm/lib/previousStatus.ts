/*
 * The lead list has no "previous status" field, so it is read from each lead's /status-history.
 * Rows ask only when they scroll into view; answers are cached per lead + current status and at
 * most a few requests run at once, so a 110-row page doesn't fire 110 calls together.
 */
import { normalizeStatusHistory } from './statusHistory'

type Loader = (customerId: number) => Promise<unknown>

const MAX_PARALLEL = 4
const cache = new Map<string, Promise<string | null>>()
const queue: Array<() => void> = []
let running = 0

const statusKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const cacheKey = (scope: string, customerId: number, status: string) => `${scope}:${customerId}:${statusKey(status)}`

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running += 1
      task().then(resolve, reject).finally(() => {
        running -= 1
        queue.shift()?.()
      })
    }
    if (running < MAX_PARALLEL) run()
    else queue.push(run)
  })
}

/** The status the lead had right before `status` (null when it never changed or the history can't be read). */
export function loadPreviousStatus(scope: string, customerId: number, status: string, load: Loader): Promise<string | null> {
  const key = cacheKey(scope, customerId, status)
  const cached = cache.get(key)
  if (cached) return cached
  const promise = schedule(() => load(customerId))
    .then((raw) => {
      const steps = normalizeStatusHistory(raw)
      const last = steps[steps.length - 1]
      if (!last) return null
      // The history may not include the latest change yet; then its last status is the previous one.
      const previous = statusKey(last.to) === statusKey(status) ? last.from : last.to
      return previous && statusKey(previous) !== statusKey(status) ? previous : null
    })
    .catch(() => {
      cache.delete(key)
      return null
    })
  cache.set(key, promise)
  return promise
}

/** Known right away after an inline status change, so the row doesn't have to ask the backend. */
export function rememberPreviousStatus(scope: string, customerId: number, status: string, previous: string) {
  if (statusKey(previous) === statusKey(status)) return
  cache.set(cacheKey(scope, customerId, status), Promise.resolve(previous))
}
