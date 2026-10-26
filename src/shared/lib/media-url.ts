import { env } from '../config/env'

/**
 * Resolves a media URL returned from the API.
 * - Absolute URLs (http/https/data) are returned as-is.
 * - Relative paths (starting with /) are prefixed with the API base URL.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const base = env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl.slice(0, -1) : env.apiBaseUrl
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}
