import type { ApiResponseError } from '../../../shared/api/types'
import type { FmFile, FmItem } from '../../../shared/api/services/fileManager.service'
import { getApiErrorStatus } from '../../../shared/lib/api-error'

export type Translate = (key: string, fallback?: string, params?: Record<string, string | number | boolean | null | undefined>) => string

/** Colour family and icon of a card / row. */
export type FileKind = 'folder' | 'pdf' | 'doc' | 'sheet' | 'image' | 'text' | 'archive' | 'media' | 'file'

const IMAGE = /^(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif|tiff?)$/
const DOC = /^(docx?|rtf|odt|pages)$/
const SHEET = /^(xlsx?|xlsm|ods|numbers)$/
const TEXT = /^(txt|md|markdown|csv|tsv|json|xml|log|ya?ml)$/
const ARCHIVE = /^(zip|rar|7z|tar|gz|tgz|bz2)$/
const MEDIA = /^(mp3|wav|ogg|m4a|aac|flac|mp4|mov|avi|mkv|webm)$/

export function kindOf(item: FmItem): FileKind {
  return item.kind === 'folder' ? 'folder' : fileKind(item.extension, item.mimeType)
}

export function fileKind(extension: string, mimeType?: string | null): Exclude<FileKind, 'folder'> {
  const ext = extension.toLowerCase()
  const mime = mimeType ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (IMAGE.test(ext) || mime.startsWith('image/')) return 'image'
  if (DOC.test(ext)) return 'doc'
  if (SHEET.test(ext)) return 'sheet'
  if (TEXT.test(ext) || mime.startsWith('text/')) return 'text'
  if (ARCHIVE.test(ext)) return 'archive'
  if (MEDIA.test(ext) || mime.startsWith('audio/') || mime.startsWith('video/')) return 'media'
  return 'file'
}

/** Selection / React key: folders and files never collide. */
export function itemKey(item: Pick<FmItem, 'kind' | 'id'>) {
  return `${item.kind === 'folder' ? 'd' : 'f'}:${item.id}`
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** "Contract.final.pdf" → selection range of "Contract.final" (rename dialogs pre-select the base name). */
export function baseNameRange(name: string): [number, number] {
  const dot = name.lastIndexOf('.')
  return [0, dot > 0 ? dot : name.length]
}

/** Extensions offered by the type filter (plus every extension seen in the data). */
export const COMMON_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'zip'] as const

const UPLOAD_SOURCES = ['upload', 'uploaded', 'manual', 'user', 'ceo', 'file_manager']

/** Plain uploads are the default, so rows only mention other sources (e.g. registrations). */
export function isUploadSource(source: string | null | undefined) {
  return !source || UPLOAD_SOURCES.includes(source.toLowerCase())
}

export function sourceLabel(source: string, t: Translate) {
  const key = source.toLowerCase()
  if (key.includes('registration')) return t('files.source.registration', 'Registration')
  if (UPLOAD_SOURCES.includes(key)) return t('files.source.upload', 'Uploaded')
  const pretty = source.replace(/[_-]+/g, ' ').trim()
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function detailMessage(error: unknown): string | undefined {
  const details = (error as Partial<ApiResponseError> | null)?.details
  if (typeof details === 'string') return details.trim().slice(0, 240) || undefined
  const detail = (details as { detail?: unknown; message?: unknown } | null | undefined)?.detail ?? (details as { message?: unknown } | null | undefined)?.message
  if (typeof detail === 'string') return detail.trim() || undefined
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === 'string' ? item : typeof (item as { msg?: unknown })?.msg === 'string' ? (item as { msg: string }).msg : ''))
      .filter(Boolean)
    return messages.length ? messages.join('; ') : undefined
  }
  return undefined
}

/** A toast for a failed request — clear wording per status, the server's own message as the description. */
export function errorToast(error: unknown, fallback: string, t: Translate): { title: string; description?: string; tone: 'error' } {
  const status = getApiErrorStatus(error)
  const description = detailMessage(error)
  const title = status === 403
    ? t('files.error.forbidden', 'You do not have permission for this action')
    : status === 404
      ? t('files.error.not_found', 'Not found — it may have been moved or deleted')
      : status === 409
        ? t('files.error.conflict', 'An item with this name already exists here')
        : status === 413
          ? t('files.error.too_large', 'The file is too large for the server')
          : status === 415
            ? t('files.error.unsupported', 'This file type cannot be previewed')
            : status === 422
              ? t('files.error.invalid', 'The request has invalid data')
              : status === 0
                ? t('files.error.network', 'Network error — check the connection')
                : fallback
  return { title, description: description && description !== title ? description : undefined, tone: 'error' }
}

/** Starts a browser download of an in-memory file and frees the object URL afterwards. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** "Registrations / Q4 — Developers" → "Registrations-Q4-Developers.zip" */
export function zipName(base: string | null | undefined) {
  const safe = (base ?? '').normalize('NFKC').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `${safe || 'cims-files'}.zip`
}

export function previewNeighbours(files: FmFile[], id: string) {
  const index = files.findIndex((file) => file.id === id)
  return {
    previous: index > 0 ? files[index - 1] : null,
    next: index >= 0 && index < files.length - 1 ? files[index + 1] : null,
    index,
  }
}
