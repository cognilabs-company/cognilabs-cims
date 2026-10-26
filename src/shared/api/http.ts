import { env } from '../config/env'
import { clearSession, getAccessToken, getRefreshToken, setSessionTokens } from '../lib/session'
import type { ApiRequestOptions, ApiResponseError, TokenResponse } from './types'

const defaultHeaders: HeadersInit = {
  Accept: 'application/json',
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  const apiBase = env.apiBaseUrl.replace(/\/$/, '')
  const isAbsolutePath = /^https?:\/\//i.test(path)
  const urlBase = apiBase.startsWith('http') ? apiBase : window.location.origin
  const fullPath = isAbsolutePath || apiBase.startsWith('http') ? path : `${apiBase}${path}`
  const url = new URL(fullPath, urlBase)

  if (!query) {
    return url.toString()
  }

  
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    let details: unknown

    if (contentType.includes('application/json')) {
      details = await response.json().catch(() => null)
    } else {
      details = await response.text().catch(() => null)
    }

    const error: ApiResponseError = {
      message: `Request failed with status ${response.status}`,
      status: response.status,
      details,
    }

    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }

  return response.text() as unknown as T
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    return null
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      const refreshedTokens = await parseResponse<TokenResponse>(response)
      setSessionTokens(refreshedTokens)

      return refreshedTokens.access_token
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function performRequest<T>(
  options: ApiRequestOptions,
  canRetry = true,
): Promise<T> {
  const {
    path,
    method = 'GET',
    query,
    body,
    headers,
    auth = true,
  } = options
  const requestHeaders = new Headers(defaultHeaders)

  if (!(body instanceof FormData) && !requestHeaders.has('Content-Type') && body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const accessToken = getAccessToken()

    if (accessToken) {
      requestHeaders.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      requestHeaders.set(key, value)
    })
  }

  if (method === 'GET' && auth !== false) {
    requestHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    requestHeaders.set('Pragma', 'no-cache')
    requestHeaders.set('Expires', '0')
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    cache: 'no-store',
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData || typeof body === 'string'
          ? body
          : JSON.stringify(body),
  })

  if (response.status === 401 && auth && canRetry) {
    try {
      const refreshedToken = await refreshAccessToken()

      if (refreshedToken) {
        return performRequest<T>(options, false)
      }
    } catch {
      clearSession()
    }
  }

  return parseResponse<T>(response)
}

export async function request<T>(options: ApiRequestOptions): Promise<T> {
  return performRequest<T>(options)
}
