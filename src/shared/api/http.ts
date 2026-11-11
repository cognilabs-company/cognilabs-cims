import { env } from '../config/env'
import { clearSession, getAccessToken, getRefreshToken, isMemorySession, renewMemorySession, setSessionTokens } from '../lib/session'
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
  // Mini App: no refresh token — a new session is created from Telegram initData.
  if (isMemorySession()) return renewMemorySession()

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

export async function requestBlob(path: string): Promise<Blob> {
  async function load(canRetry: boolean): Promise<Blob> {
    const headers = new Headers(defaultHeaders)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(buildUrl(path), { headers, cache: 'no-store' })
    if (response.status === 401 && canRetry) {
      try {
        if (await refreshAccessToken()) return load(false)
      } catch {
        clearSession()
      }
    }
    if (!response.ok) return parseResponse<Blob>(response)
    return response.blob()
  }
  return load(true)
}

/* ──────────────────────────────────────────────────────────────
   Binary downloads and uploads with progress (private files).
   Same bearer token and 401 → refresh → retry as `request`; failures throw `{ message, status, details }`.
   ────────────────────────────────────────────────────────────── */

export type FileResponse = {
  blob: Blob
  /** From Content-Disposition (`filename*=` preferred); null when the header is missing or not exposed. */
  filename: string | null
  contentType: string
}

export type UploadProgress = {
  loaded: number
  /** 0 when the browser cannot tell the total size. */
  total: number
}

/** `attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf; filename="resume.pdf"` → `résumé.pdf` */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null

  const extended = header.match(/filename\*\s*=\s*([^;]+)/i)
  if (extended) {
    let value = extended[1].trim().replace(/^"(.*)"$/, '$1')
    const encoded = value.match(/^[\w-]+'[^']*'(.*)$/)
    if (encoded) value = encoded[1]
    try {
      value = decodeURIComponent(value)
    } catch {
      /* keep the raw value */
    }
    if (value.trim()) return value.trim()
  }

  const plain = header.match(/filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i)
  const value = (plain?.[1] ?? plain?.[2])?.replace(/\\(.)/g, '$1').trim()
  return value || null
}

function isRawBody(body: unknown): body is BodyInit {
  return body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams || typeof body === 'string'
}

/** Authenticated request whose response is a file (any method, optional JSON body): Blob + filename + content type. */
export async function requestFile(options: ApiRequestOptions & { signal?: AbortSignal }): Promise<FileResponse> {
  const { path, method = 'GET', query, body, headers, signal } = options

  async function load(canRetry: boolean): Promise<FileResponse> {
    const requestHeaders = new Headers({ Accept: '*/*' })
    const token = getAccessToken()
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
    if (body !== undefined && !isRawBody(body)) requestHeaders.set('Content-Type', 'application/json')
    if (headers) Object.entries(headers).forEach(([key, value]) => requestHeaders.set(key, value))

    const response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      cache: 'no-store',
      signal,
      body: body === undefined ? undefined : isRawBody(body) ? body : JSON.stringify(body),
    })

    if (response.status === 401 && canRetry) {
      try {
        if (await refreshAccessToken()) return load(false)
      } catch {
        clearSession()
      }
    }

    if (!response.ok) return parseResponse<FileResponse>(response)

    const blob = await response.blob()
    return {
      blob,
      filename: filenameFromContentDisposition(response.headers.get('content-disposition')),
      contentType: response.headers.get('content-type') || blob.type,
    }
  }

  return load(true)
}

type RawXhrResponse = { status: number; contentType: string; text: string }

function parseXhrResponse<T>(response: RawXhrResponse): T {
  const isJson = response.contentType.includes('application/json')
  const parse = () => {
    try {
      return JSON.parse(response.text) as unknown
    } catch {
      return response.text
    }
  }

  if (response.status < 200 || response.status >= 300) {
    const error: ApiResponseError = {
      message: response.status ? `Request failed with status ${response.status}` : 'Network error',
      status: response.status,
      details: isJson ? parse() : response.text || null,
    }
    throw error
  }

  if (response.status === 204 || !response.text) return undefined as T
  return (isJson ? parse() : response.text) as T
}

/**
 * Multipart upload through XMLHttpRequest so the caller gets upload progress.
 * Aborting `signal` rejects with a DOMException named "AbortError".
 */
export async function uploadWithProgress<T>(options: {
  path: string
  body: FormData
  method?: 'POST' | 'PUT' | 'PATCH'
  query?: ApiRequestOptions['query']
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}): Promise<T> {
  const { path, body, method = 'POST', query, onProgress, signal } = options

  function send(): Promise<RawXhrResponse> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Upload aborted', 'AbortError'))
        return
      }

      const xhr = new XMLHttpRequest()
      const abort = () => xhr.abort()
      const done = () => signal?.removeEventListener('abort', abort)

      xhr.open(method, buildUrl(path, query))
      xhr.setRequestHeader('Accept', 'application/json')
      const token = getAccessToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => onProgress?.({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 })
      xhr.onload = () => {
        done()
        resolve({ status: xhr.status, contentType: xhr.getResponseHeader('content-type') ?? '', text: xhr.responseText })
      }
      xhr.onerror = () => {
        done()
        resolve({ status: 0, contentType: '', text: '' })
      }
      xhr.onabort = () => {
        done()
        reject(new DOMException('Upload aborted', 'AbortError'))
      }

      signal?.addEventListener('abort', abort, { once: true })
      xhr.send(body)
    })
  }

  let response = await send()

  if (response.status === 401) {
    try {
      if (await refreshAccessToken()) response = await send()
    } catch {
      clearSession()
    }
  }

  return parseXhrResponse<T>(response)
}
