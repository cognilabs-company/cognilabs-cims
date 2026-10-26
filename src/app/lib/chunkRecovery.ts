export const CHUNK_RELOAD_KEY = 'cims:chunk-reload'

export function isDynamicImportError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('chunk')
  )
}

export function tryRecoverFromChunkError() {
  if (typeof window === 'undefined') {
    return false
  }

  const currentPath = `${window.location.pathname}${window.location.search}`
  const lastAttempt = window.sessionStorage.getItem(CHUNK_RELOAD_KEY)

  if (lastAttempt === currentPath) {
    return false
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, currentPath)
  window.location.reload()
  return true
}
