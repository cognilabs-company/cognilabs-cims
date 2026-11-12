import type { DragEvent } from 'react'
import type { FmFile, FmFolder, FmItem } from '../../../shared/api/services/fileManager.service'
import { kindOf, type Translate } from './items'

/* Explorer-wide types and helpers: view / sort preferences, sorting, type names, drag & drop. */

export type ViewMode = 'large' | 'medium' | 'details'
export type SortKey = 'name' | 'modified' | 'type' | 'size'
export type SortDir = 'asc' | 'desc'
export type SortState = { key: SortKey; dir: SortDir }
export type SearchScope = 'folder' | 'all'

export type ExplorerPrefs = {
  view: ViewMode
  sort: SortState
  /** The right details / preview pane is open. */
  details: boolean
  /** Item check boxes in every view (always on with touch). */
  checkboxes: boolean
  /** Navigation pane width in px (desktop). */
  treeWidth: number
}

const PREFS_KEY = 'cims.files.explorer'
const OLD_VIEW_KEY = 'cims.files.view'
export const TREE_MIN = 188
export const TREE_MAX = 380

const VIEWS: ViewMode[] = ['large', 'medium', 'details']
const SORT_KEYS: SortKey[] = ['name', 'modified', 'type', 'size']

const DEFAULT_PREFS: ExplorerPrefs = { view: 'large', sort: { key: 'name', dir: 'asc' }, details: false, checkboxes: false, treeWidth: 236 }

export function readPrefs(): ExplorerPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<ExplorerPrefs> | null
    if (!raw) {
      // The previous file manager remembered grid / list only.
      const old = localStorage.getItem(OLD_VIEW_KEY)
      return { ...DEFAULT_PREFS, view: old === 'list' ? 'details' : DEFAULT_PREFS.view }
    }
    return {
      view: VIEWS.includes(raw.view as ViewMode) ? (raw.view as ViewMode) : DEFAULT_PREFS.view,
      sort: {
        key: SORT_KEYS.includes(raw.sort?.key as SortKey) ? (raw.sort?.key as SortKey) : 'name',
        dir: raw.sort?.dir === 'desc' ? 'desc' : 'asc',
      },
      details: raw.details === true,
      checkboxes: raw.checkboxes === true,
      treeWidth: clampTreeWidth(Number(raw.treeWidth) || DEFAULT_PREFS.treeWidth),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writePrefs(prefs: ExplorerPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* private mode */
  }
}

export function clampTreeWidth(value: number) {
  return Math.round(Math.min(TREE_MAX, Math.max(TREE_MIN, value)))
}

export function isLocked(item: FmItem) {
  return item.system
}

/** Where an item lives; undefined when not known (some search results). */
export function parentOf(item: FmItem): string | null | undefined {
  const parent = item.kind === 'folder' ? item.parentId : item.folderId
  return parent ?? undefined
}

/** "PDF document", "PNG image", "Folder" — the Type column. */
export function typeLabel(item: FmItem, t: Translate) {
  if (item.kind === 'folder') return item.system ? t('files.system_folder', 'System folder') : t('files.kind.folder', 'File folder')
  const ext = item.extension.toUpperCase()
  switch (kindOf(item)) {
    case 'pdf': return t('files.kind.pdf', 'PDF document')
    case 'doc': return t('files.kind.doc', 'Word document')
    case 'sheet': return t('files.kind.sheet', 'Spreadsheet')
    case 'image': return t('files.kind.image', '{{ext}} image', { ext: ext || '—' })
    case 'text': return t('files.kind.text', '{{ext}} text file', { ext: ext || 'TXT' })
    case 'archive': return t('files.kind.archive', '{{ext}} archive', { ext: ext || 'ZIP' })
    case 'media': return t('files.kind.media', '{{ext}} media file', { ext: ext || '—' })
    default: return ext ? t('files.kind.file_ext', '{{ext}} file', { ext }) : t('files.kind.file', 'File')
  }
}

function time(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

/** Folders first (like Explorer), then files; both by the chosen column, ties by natural name order. */
export function sortItems(folders: FmFolder[], files: FmFile[], sort: SortState, locale: string, t: Translate): FmItem[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  const sign = sort.dir === 'asc' ? 1 : -1
  const labels = new Map<FmItem, string>()
  const label = (item: FmItem) => {
    let value = labels.get(item)
    if (value === undefined) {
      value = typeLabel(item, t)
      labels.set(item, value)
    }
    return value
  }
  const byName = (a: FmItem, b: FmItem) => collator.compare(a.name, b.name)
  const compare = (a: FmItem, b: FmItem) => {
    let result = 0
    if (sort.key === 'modified') result = time(a.updatedAt) - time(b.updatedAt)
    else if (sort.key === 'size') result = (a.size ?? -1) - (b.size ?? -1)
    else if (sort.key === 'type') result = collator.compare(label(a), label(b))
    return result !== 0 ? result * sign : byName(a, b) * (sort.key === 'name' ? sign : 1)
  }
  return [...[...folders].sort(compare), ...[...files].sort(compare)]
}

export function totalSize(items: FmItem[]) {
  let total = 0
  let known = false
  for (const item of items) {
    if (typeof item.size === 'number' && Number.isFinite(item.size)) {
      total += item.size
      known = true
    }
  }
  return known ? total : null
}

/* ── drag & drop ─────────────────────────────────────────────── */

/** Data type of an item dragged inside the explorer (never set by the OS). */
export const DRAG_TYPE = 'application/x-cims-files'

export function dragHasFiles(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'))
}

export function dragIsInternal(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes(DRAG_TYPE))
}

/** A folder something can be dropped on: id null is the top level; ancestors are its parents up to the root. */
export type DropTarget = { id: string | null; name: string; ancestors: string[] }

export type DropHandlers = {
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

export const ROOT_KEY = 'root'
export const dropKey = (id: string | null) => id ?? ROOT_KEY
