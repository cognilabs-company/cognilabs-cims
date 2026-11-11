const ACCESS_TOKEN_KEY = 'cims_access_token'
const REFRESH_TOKEN_KEY = 'cims_refresh_token'

/*
 * Memory-only session (Telegram Mini App): the JWT lives in this module only and is never
 * written to localStorage. When it expires, `renew` creates a new session (POST /miniapp/session).
 */
let memorySession: { token: string | null; renew: () => Promise<string | null> } | null = null

export function startMemorySession(renew: () => Promise<string | null>) {
  memorySession = { token: null, renew }
}

export function setMemoryAccessToken(token: string | null) {
  if (memorySession) memorySession.token = token
}

export function isMemorySession() {
  return memorySession !== null
}

let renewing: Promise<string | null> | null = null

/** New token for a memory session (null when renewing failed). Parallel 401s share one renewal. */
export function renewMemorySession(): Promise<string | null> {
  const session = memorySession
  if (!session) return Promise.resolve(null)
  if (!renewing) {
    renewing = session.renew()
      .then((token) => { session.token = token; return token })
      .finally(() => { renewing = null })
  }
  return renewing
}

export function getAccessToken() {
  if (memorySession) return memorySession.token
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  if (memorySession) { memorySession.token = token; return }
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function removeAccessToken() {
  if (memorySession) { memorySession.token = null; return }
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (memorySession) return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string) {
  if (memorySession) return
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function removeRefreshToken() {
  if (memorySession) return
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function setSessionTokens(tokens: { access_token: string; refresh_token?: string }) {
  setAccessToken(tokens.access_token)

  if (tokens.refresh_token) {
    setRefreshToken(tokens.refresh_token)
  }
}

export function clearSession() {
  removeAccessToken()
  removeRefreshToken()
}
