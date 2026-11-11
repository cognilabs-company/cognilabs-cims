import { request, requestFile, uploadWithProgress, type FileResponse, type UploadProgress } from '../http'
import type { ApiResponseError } from '../types'

/* ──────────────────────────────────────────────────────────────
   File manager — /file-manager (contract: PLATFORM_FEATURES_FRONTEND.md, "File Manager").
   CEO-only private storage. Response schemas are untyped in OpenAPI, so every response is
   normalised here into the camelCase models below (unknown / missing fields stay null).
   ────────────────────────────────────────────────────────────── */

export type FmFolder = {
  kind: 'folder'
  id: string
  name: string
  parentId: string | null
  /** System folders (e.g. `Registrations / <Link> / <Applicant>`) cannot be renamed, moved or deleted. */
  system: boolean
  sourceType: string | null
  createdAt: string | null
  updatedAt: string | null
  fileCount: number | null
  folderCount: number | null
  size: number | null
  /** Human path ("Registrations / Developers"), mostly present in search results. */
  path: string | null
}

export type FmFile = {
  kind: 'file'
  id: string
  name: string
  folderId: string | null
  /** Lower case, without the dot ("pdf"). */
  extension: string
  mimeType: string | null
  size: number | null
  sourceType: string | null
  createdAt: string | null
  updatedAt: string | null
  system: boolean
  uploadedBy: string | null
  path: string | null
}

export type FmItem = FmFolder | FmFile

export type FmCrumb = { id: string; name: string; system: boolean }

export type FmBrowseResult = {
  /** The opened folder; null at the root. */
  folder: FmFolder | null
  /** Root → … → opened folder (the root itself is not included). */
  breadcrumbs: FmCrumb[]
  folders: FmFolder[]
  files: FmFile[]
  totalFiles: number
  page: number
  pageSize: number
}

export type FmSearchResult = { folders: FmFolder[]; files: FmFile[] }

export type FmDocBlock =
  | { type: 'paragraph'; text: string; style: string | null; level: number | null }
  | { type: 'table'; rows: string[][] }

export type FmSheet = {
  name: string
  rows: string[][]
  truncated: boolean
  totalRows: number | null
  totalColumns: number | null
}

export type FmPreview =
  /** PDF / image bytes: show them through an object URL. */
  | { type: 'binary'; blob: Blob; contentType: string }
  /** TXT / MD / CSV */
  | { type: 'text'; format: string; content: string; truncated: boolean }
  | { type: 'docx'; blocks: FmDocBlock[]; truncated: boolean }
  | { type: 'xlsx'; sheets: FmSheet[]; truncated: boolean }
  /** 415 — the file cannot be shown inline; offer a download instead. */
  | { type: 'unsupported' }

export type FmBrowseParams = {
  folderId?: string | null
  search?: string
  extension?: string
  sourceType?: string
  page?: number
  pageSize?: number
}

export type FmSearchParams = {
  query: string
  itemType?: 'all' | 'folder' | 'file'
  extension?: string
  sourceType?: string
  limit?: number
}

/* ── defensive readers ─────────────────────────────────────── */

type Raw = Record<string, unknown>

function record(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const nested = record(value)
  for (const key of ['items', 'results', 'data']) {
    if (Array.isArray(nested[key])) return nested[key] as unknown[]
  }
  return []
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return ''
}

function first(raw: Raw, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key]
  }
  return undefined
}

function firstText(raw: Raw, keys: string[]): string | null {
  const value = text(first(raw, keys)).trim()
  return value || null
}

function firstNumber(raw: Raw, keys: string[]): number | null {
  const value = first(raw, keys)
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function truthy(value: unknown): boolean {
  if (typeof value === 'string') return !['', '0', 'false', 'no', 'none', 'null'].includes(value.trim().toLowerCase())
  return Boolean(value)
}

function isSystem(raw: Raw) {
  return ['is_system', 'system', 'is_protected', 'protected', 'is_locked', 'locked', 'is_readonly', 'readonly', 'system_key']
    .some((key) => truthy(raw[key]))
}

function personName(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  const raw = record(value)
  const full = [text(raw.name), text(raw.surname)].filter(Boolean).join(' ').trim()
  return full || firstText(raw, ['full_name', 'email', 'username'])
}

/** A path given as text or as a list of crumbs / names. */
function pathText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!Array.isArray(value)) return null
  const names = value.map((part) => (typeof part === 'string' ? part : firstText(record(part), ['name', 'title']) ?? '')).filter(Boolean)
  return names.length ? names.join(' / ') : null
}

export function extensionOf(name: string) {
  const match = /\.([a-z0-9]{1,12})$/i.exec(name.trim())
  return match ? match[1].toLowerCase() : ''
}

function normalizeFolder(value: unknown): FmFolder | null {
  const raw = record(value)
  const id = firstText(raw, ['id', 'uuid', 'folder_id'])
  if (!id) return null
  return {
    kind: 'folder',
    id,
    name: firstText(raw, ['name', 'title', 'display_name']) ?? '—',
    parentId: firstText(raw, ['parent_id', 'parentId', 'parent_folder_id']),
    system: isSystem(raw),
    sourceType: firstText(raw, ['source_type', 'sourceType', 'source']),
    createdAt: firstText(raw, ['created_at', 'createdAt']),
    updatedAt: firstText(raw, ['updated_at', 'updatedAt', 'modified_at', 'created_at']),
    fileCount: firstNumber(raw, ['file_count', 'files_count', 'total_files']),
    folderCount: firstNumber(raw, ['folder_count', 'folders_count', 'subfolder_count', 'subfolders_count', 'children_count']),
    size: firstNumber(raw, ['size', 'size_bytes', 'total_size']),
    path: pathText(first(raw, ['path', 'full_path', 'breadcrumbs', 'path_names'])),
  }
}

function normalizeFile(value: unknown): FmFile | null {
  const raw = record(value)
  const id = firstText(raw, ['id', 'uuid', 'file_id'])
  if (!id) return null
  const name = firstText(raw, ['name', 'original_name', 'original_filename', 'filename', 'file_name', 'display_name', 'title']) ?? '—'
  const extension = (firstText(raw, ['extension', 'ext', 'file_extension']) ?? '').replace(/^\./, '').toLowerCase() || extensionOf(name)
  return {
    kind: 'file',
    id,
    name,
    folderId: firstText(raw, ['folder_id', 'folderId', 'parent_id']),
    extension,
    mimeType: firstText(raw, ['mime_type', 'content_type', 'mimetype', 'mime']),
    size: firstNumber(raw, ['size', 'size_bytes', 'file_size', 'bytes']),
    sourceType: firstText(raw, ['source_type', 'sourceType', 'source']),
    createdAt: firstText(raw, ['created_at', 'createdAt', 'uploaded_at']),
    updatedAt: firstText(raw, ['updated_at', 'updatedAt', 'modified_at', 'uploaded_at', 'created_at']),
    system: isSystem(raw),
    uploadedBy: personName(first(raw, ['uploaded_by', 'created_by', 'owner', 'uploader'])),
    path: pathText(first(raw, ['path', 'folder_path', 'location', 'breadcrumbs', 'folder_name'])),
  }
}

function folders(value: unknown) {
  return list(value).map(normalizeFolder).filter((item): item is FmFolder => item !== null)
}

function files(value: unknown) {
  return list(value).map(normalizeFile).filter((item): item is FmFile => item !== null)
}

function parseBrowse(value: unknown, params: FmBrowseParams): FmBrowseResult {
  const raw = record(value)
  const fileSource = raw.files
  const fileBox = record(fileSource)
  const folder = normalizeFolder(first(raw, ['folder', 'current_folder', 'current']))
  const breadcrumbs = list(first(raw, ['breadcrumbs', 'path']))
    .map((crumb) => {
      const item = record(crumb)
      const id = firstText(item, ['id', 'folder_id', 'uuid'])
      return id ? { id, name: firstText(item, ['name', 'title']) ?? '—', system: isSystem(item) } : null
    })
    .filter((crumb): crumb is FmCrumb => crumb !== null)

  // Some APIs leave the opened folder out of its own breadcrumbs.
  if (folder && breadcrumbs[breadcrumbs.length - 1]?.id !== folder.id) {
    breadcrumbs.push({ id: folder.id, name: folder.name, system: folder.system })
  }

  const fileList = files(fileSource)
  const last = breadcrumbs[breadcrumbs.length - 1]
  const parentCrumb = breadcrumbs[breadcrumbs.length - 2]
  const current: FmFolder | null = folder
    ? { ...folder, parentId: folder.parentId ?? parentCrumb?.id ?? null }
    : params.folderId && last?.id === params.folderId
      ? {
          kind: 'folder', id: last.id, name: last.name, parentId: parentCrumb?.id ?? null, system: last.system, sourceType: null,
          createdAt: null, updatedAt: null, fileCount: null, folderCount: null, size: null, path: null,
        }
      : null
  return {
    folder: current,
    breadcrumbs,
    folders: folders(first(raw, ['folders', 'subfolders', 'children'])),
    files: fileList,
    totalFiles: firstNumber(raw, ['total_files', 'files_total', 'total']) ?? firstNumber(fileBox, ['total', 'count']) ?? fileList.length,
    page: firstNumber(raw, ['page']) ?? firstNumber(fileBox, ['page']) ?? params.page ?? 1,
    pageSize: firstNumber(raw, ['page_size', 'pageSize', 'limit']) ?? firstNumber(fileBox, ['page_size', 'limit']) ?? params.pageSize ?? 100,
  }
}

function parseSearch(value: unknown): FmSearchResult {
  const raw = record(value)
  if (raw.folders !== undefined || raw.files !== undefined) {
    return { folders: folders(raw.folders), files: files(raw.files) }
  }
  // A single mixed list: [{ type: "folder" | "file", ... }]
  const result: FmSearchResult = { folders: [], files: [] }
  for (const entry of list(value)) {
    const item = record(entry)
    const type = (firstText(item, ['type', 'item_type', 'kind']) ?? '').toLowerCase()
    const payload = item.item ?? item.data ?? item
    if (type === 'folder') {
      const folder = normalizeFolder(payload)
      if (folder) result.folders.push(folder)
    } else {
      const file = normalizeFile(payload)
      if (file) result.files.push(file)
    }
  }
  return result
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const raw = record(value)
  return text(first(raw, ['text', 'value', 'content', 'display']))
}

function rowsOf(value: unknown): string[][] {
  return list(value).map((row) => {
    if (Array.isArray(row)) return row.map(cellText)
    const raw = record(row)
    const cells = first(raw, ['cells', 'values', 'columns'])
    if (Array.isArray(cells)) return cells.map(cellText)
    return Object.values(raw).map(cellText)
  })
}

function parseDocBlocks(value: unknown): FmDocBlock[] {
  return list(value).flatMap((entry): FmDocBlock[] => {
    if (typeof entry === 'string') return [{ type: 'paragraph', text: entry, style: null, level: null }]
    const raw = record(entry)
    const type = (firstText(raw, ['type', 'kind']) ?? 'paragraph').toLowerCase()
    if (type === 'table') return [{ type: 'table', rows: rowsOf(first(raw, ['rows', 'data', 'cells'])) }]
    const style = firstText(raw, ['style', 'style_name'])
    const headingLevel = /heading\s*(\d)/i.exec(style ?? '')?.[1]
    return [{
      type: 'paragraph',
      text: cellText(first(raw, ['text', 'content', 'value'])),
      style,
      level: firstNumber(raw, ['level', 'heading_level']) ?? (headingLevel ? Number(headingLevel) : type === 'heading' ? 2 : null),
    }]
  })
}

function parseSheets(value: unknown): FmSheet[] {
  return list(value).map((entry, index) => {
    const raw = record(entry)
    return {
      name: firstText(raw, ['name', 'title', 'sheet']) ?? `Sheet ${index + 1}`,
      rows: rowsOf(first(raw, ['rows', 'data', 'cells', 'values'])),
      truncated: truthy(raw.truncated),
      totalRows: firstNumber(raw, ['max_row', 'total_rows', 'row_count', 'rows_total']),
      totalColumns: firstNumber(raw, ['max_column', 'max_col', 'total_columns', 'column_count', 'columns_total']),
    }
  })
}

function statusOf(error: unknown) {
  const status = (error as Partial<ApiResponseError> | null)?.status
  return typeof status === 'number' ? status : null
}

async function parsePreview(id: string, response: FileResponse): Promise<FmPreview> {
  const contentType = (response.contentType || '').toLowerCase()
  if (!contentType.includes('json')) {
    return { type: 'binary', blob: response.blob, contentType: contentType || response.blob.type }
  }

  const raw = record(JSON.parse(await response.blob.text()) as unknown)
  const type = (firstText(raw, ['type', 'kind', 'format']) ?? '').toLowerCase()
  const truncated = truthy(raw.truncated)

  if (type === 'docx' || type === 'doc' || raw.blocks !== undefined) {
    return { type: 'docx', blocks: parseDocBlocks(raw.blocks ?? raw.content), truncated }
  }
  if (type === 'xlsx' || type === 'xlsm' || type === 'xls' || raw.sheets !== undefined) {
    return { type: 'xlsx', sheets: parseSheets(raw.sheets), truncated }
  }
  if (typeof raw.content === 'string' || typeof raw.text === 'string') {
    return { type: 'text', format: type || 'txt', content: text(raw.content ?? raw.text), truncated }
  }
  if (type === 'pdf' || type === 'image' || type.startsWith('image/')) {
    // A JSON pointer instead of bytes: read the inline content (still with the bearer token).
    const content = await requestFile({ path: `/file-manager/files/${encodeURIComponent(id)}/content` })
    return { type: 'binary', blob: content.blob, contentType: content.contentType || content.blob.type }
  }
  return { type: 'unsupported' }
}

/* ── endpoints ─────────────────────────────────────────────── */

const fileUrl = (id: string) => `/file-manager/files/${encodeURIComponent(id)}`
const folderUrl = (id: string) => `/file-manager/folders/${encodeURIComponent(id)}`

export const fileManagerService = {
  async browse(params: FmBrowseParams = {}): Promise<FmBrowseResult> {
    const data = await request<unknown>({
      path: '/file-manager',
      query: {
        folder_id: params.folderId ?? undefined,
        search: params.search?.trim() || undefined,
        extension: params.extension || undefined,
        source_type: params.sourceType || undefined,
        page: params.page,
        page_size: params.pageSize,
      },
    })
    return parseBrowse(data, params)
  },

  async search(params: FmSearchParams): Promise<FmSearchResult> {
    const data = await request<unknown>({
      path: '/file-manager/search',
      query: {
        query: params.query.trim(),
        item_type: params.itemType ?? 'all',
        extension: params.extension || undefined,
        source_type: params.sourceType || undefined,
        limit: params.limit,
      },
    })
    return parseSearch(data)
  },

  async createFolder(name: string, parentId: string | null) {
    const data = await request<unknown>({ path: '/file-manager/folders', method: 'POST', body: { name: name.trim(), parent_id: parentId } })
    return normalizeFolder(record(data).folder ?? data)
  },

  /** One multipart request; each file is a repeated `uploads` part. */
  async uploadFiles(folderId: string, uploads: File[], options: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {}) {
    const body = new FormData()
    uploads.forEach((file) => body.append('uploads', file, file.name))
    const data = await uploadWithProgress<unknown>({
      path: '/file-manager/files',
      query: { folder_id: folderId },
      body,
      onProgress: options.onProgress,
      signal: options.signal,
    })
    return files(record(data).files ?? data)
  },

  renameFolder(id: string, name: string) {
    return request<unknown>({ path: `${folderUrl(id)}/rename`, method: 'PATCH', body: { name: name.trim() } })
  },

  renameFile(id: string, name: string) {
    return request<unknown>({ path: `${fileUrl(id)}/rename`, method: 'PATCH', body: { name: name.trim() } })
  },

  /** `folderId: null` moves to the root. */
  moveFolder(id: string, folderId: string | null) {
    return request<unknown>({ path: `${folderUrl(id)}/move`, method: 'PATCH', body: { folder_id: folderId } })
  },

  moveFile(id: string, folderId: string | null) {
    return request<unknown>({ path: `${fileUrl(id)}/move`, method: 'PATCH', body: { folder_id: folderId } })
  },

  deleteFolder(id: string) {
    return request<void>({ path: folderUrl(id), method: 'DELETE' })
  },

  deleteFile(id: string) {
    return request<void>({ path: fileUrl(id), method: 'DELETE' })
  },

  download(id: string, signal?: AbortSignal) {
    return requestFile({ path: `${fileUrl(id)}/download`, signal })
  },

  content(id: string, signal?: AbortSignal) {
    return requestFile({ path: `${fileUrl(id)}/content`, signal })
  },

  /** Structured or binary preview; a 415 resolves to `{ type: 'unsupported' }`. */
  async preview(id: string, signal?: AbortSignal): Promise<FmPreview> {
    try {
      return await parsePreview(id, await requestFile({ path: `${fileUrl(id)}/preview`, signal }))
    } catch (error) {
      if (statusOf(error) === 415) return { type: 'unsupported' }
      throw error
    }
  },

  /** Built and streamed by the server right away (not stored). */
  downloadZip(body: { folderIds: string[]; fileIds: string[]; filename: string }) {
    return requestFile({
      path: '/file-manager/download-zip',
      method: 'POST',
      body: { folder_ids: body.folderIds, file_ids: body.fileIds, filename: body.filename },
    })
  },
}
