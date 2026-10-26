const ACCESS_TOKEN_KEY = 'cims_access_token'
const REFRESH_TOKEN_KEY = 'cims_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function removeAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function removeRefreshToken() {
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
