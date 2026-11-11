import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowClockwiseIcon,
  ArrowsOutCardinalIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  HouseIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  fileManagerService,
  type FmBrowseResult,
  type FmFile,
  type FmFolder,
  type FmItem,
  type FmSearchResult,
} from '../../../shared/api/services/fileManager.service'
import { getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import type { SelectFieldOption } from '../../../shared/ui/select-field'
import { HeaderActions } from '../../../widgets/navigation/HeaderActions'
import { FolderPickerDialog, type PickedFolder } from '../components/FolderPickerDialog'
import { ItemMenu, type ItemMenuEntry, type MenuAnchor } from '../components/ItemMenu'
import { FileGrid, FileList, type MenuOrigin } from '../components/ItemViews'
import { NameDialog } from '../components/NameDialog'
import { PreviewDialog } from '../components/PreviewDialog'
import { Breadcrumbs, FilterBar, RefreshButton, SelectionBar, type SearchScope, type ViewMode } from '../components/Toolbar'
import { UploadPanel } from '../components/UploadPanel'
import { COMMON_EXTENSIONS, errorToast, itemKey, saveBlob, sourceLabel, zipName } from '../lib/items'
import { menuAnchorFromPoint, menuAnchorFromRect } from '../lib/menu'
import { createUploadQueue } from '../lib/uploadQueue'
import '../fileManager.css'

const PAGE_SIZE = 60
const SEARCH_LIMIT = 200
const SEARCH_DEBOUNCE_MS = 350
const VIEW_KEY = 'cims.files.view'
const EMPTY = new Set<string>()
const NO_FOLDERS: FmFolder[] = []
const NO_FILES: FmFile[] = []

type Loaded =
  | { key: string; context: string; mode: 'browse'; data: FmBrowseResult }
  | { key: string; context: string; mode: 'search'; data: FmSearchResult }

type DialogState =
  | { type: 'new-folder' }
  | { type: 'rename'; item: FmItem }
  | { type: 'move'; items: FmItem[] }
  /** Uploading at the top level: pick a folder first (files = dropped files, or null → open the file chooser). */
  | { type: 'upload-target'; files: File[] | null }

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function isLocked(item: FmItem) {
  return item.system
}

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
}

/** /files — private file manager (CEO): browse, search, upload, preview, rename, move, delete, ZIP. */
export function FileManagerPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const canView = can('file_manager', 'view')
  const canCreate = canView && can('file_manager', 'create')
  const canEdit = canView && can('file_manager', 'edit')
  const canDelete = canView && can('file_manager', 'delete')
  const canExport = canView && can('file_manager', 'export')
  const canSelect = canExport || canEdit || canDelete

  /* ── URL state: ?folder=<id>&q=&scope=all&ext=&source=&page= ───────────── */
  const [params, setParams] = useSearchParams()
  const folderId = params.get('folder') || null
  const rawQuery = params.get('q') ?? ''
  const query = rawQuery.trim()
  const scope: SearchScope = params.get('scope') === 'all' ? 'all' : 'folder'
  const extension = params.get('ext') ?? ''
  const source = params.get('source') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const globalSearch = scope === 'all' && query.length > 0

  const updateParams = useCallback((change: Record<string, string | null>, replace = false) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      Object.entries(change).forEach(([key, value]) => {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      })
      return next
    }, { replace })
  }, [setParams])

  /* ── Search box: typed text → URL after a pause; back / forward puts the URL text back ─────── */
  const [draft, setDraft] = useState(rawQuery)
  const [draftFor, setDraftFor] = useState(rawQuery)
  if (draftFor !== rawQuery) {
    setDraftFor(rawQuery)
    setDraft(rawQuery)
  }
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  function onSearchChange(value: string) {
    setDraft(value)
    window.clearTimeout(searchTimer.current)
    const commit = () => updateParams({ q: value || null, page: null, ...(value.trim() ? {} : { scope: null }) }, true)
    if (!value) commit()
    else searchTimer.current = window.setTimeout(commit, SEARCH_DEBOUNCE_MS)
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  const [reloadKey, setReloadKey] = useState(0)
  const context = globalSearch ? `search|${query}|${extension}|${source}` : `browse|${folderId ?? ''}`
  const requestKey = globalSearch ? context : `${context}|${query}|${extension}|${source}|${page}`
  const fullKey = `${requestKey}|${reloadKey}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<{ key: string; status: number | null } | null>(null)
  const [knownSources, setKnownSources] = useState<string[]>([])
  const [rootFolders, setRootFolders] = useState<{ key: number; folders: FmFolder[] } | null>(null)
  const atPlainRoot = !globalSearch && folderId === null && !query && !extension && !source && page === 1

  useEffect(() => {
    if (!canView) return
    let alive = true
    const remember = (items: { sourceType: string | null }[]) => {
      const found = items.map((item) => item.sourceType).filter((value): value is string => Boolean(value))
      if (found.length) setKnownSources((previous) => (found.every((value) => previous.includes(value)) ? previous : [...new Set([...previous, ...found])]))
    }
    const request: Promise<Loaded> = globalSearch
      ? fileManagerService.search({ query, extension, sourceType: source, limit: SEARCH_LIMIT })
        .then((data) => ({ key: fullKey, context, mode: 'search' as const, data }))
      : fileManagerService.browse({ folderId, search: query, extension, sourceType: source, page, pageSize: PAGE_SIZE })
        .then((data) => ({ key: fullKey, context, mode: 'browse' as const, data }))
    request
      .then((result) => {
        if (!alive) return
        setLoaded(result)
        setLoadError(null)
        remember([...result.data.folders, ...result.data.files])
        if (result.mode === 'browse' && atPlainRoot) setRootFolders({ key: reloadKey, folders: result.data.folders })
      })
      .catch((error: unknown) => {
        if (alive) setLoadError({ key: fullKey, status: getApiErrorStatus(error) })
      })
    return () => { alive = false }
  }, [atPlainRoot, canView, context, extension, folderId, fullKey, globalSearch, page, query, reloadKey, source])

  // The side list of top-level folders (comes with the main listing when the root is open).
  const sideStale = rootFolders?.key !== reloadKey
  useEffect(() => {
    if (!canView || atPlainRoot || !sideStale) return
    let alive = true
    fileManagerService.browse({ page: 1, pageSize: 1 })
      .then((data) => { if (alive) setRootFolders({ key: reloadKey, folders: data.folders }) })
      .catch(() => { if (alive) setRootFolders((previous) => ({ key: reloadKey, folders: previous?.folders ?? [] })) })
    return () => { alive = false }
  }, [atPlainRoot, canView, reloadKey, sideStale])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])
  const reloadTimer = useRef<number | undefined>(undefined)
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => setReloadKey((value) => value + 1), 500)
  }, [])
  useEffect(() => () => window.clearTimeout(reloadTimer.current), [])

  const error = loadError?.key === fullKey ? loadError : null
  const loading = canView && !error && loaded?.key !== fullKey
  // While a new page / filter loads, the same folder (or search) stays on screen, dimmed.
  const shown = loaded && (loaded.key === fullKey || loaded.context === context) ? loaded : null
  const browse = shown?.mode === 'browse' ? shown.data : null
  const visibleFolders = shown?.data.folders ?? NO_FOLDERS
  const visibleFiles = shown?.data.files ?? NO_FILES
  const visibleItems = useMemo<FmItem[]>(() => [...visibleFolders, ...visibleFiles], [visibleFiles, visibleFolders])
  const crumbs = useMemo(() => (globalSearch ? [] : browse?.breadcrumbs ?? []), [browse, globalSearch])
  const currentFolder: PickedFolder | null = folderId
    ? { id: folderId, name: browse?.folder?.name ?? crumbs[crumbs.length - 1]?.name ?? '…' }
    : null
  const totalFiles = browse?.totalFiles ?? visibleFiles.length
  const pageSize = browse?.pageSize || PAGE_SIZE
  const pageCount = browse ? Math.max(1, Math.ceil(totalFiles / pageSize)) : 1
  const filtersActive = Boolean(query || extension || source)

  /* ── View mode (remembered per browser) ──────────────────────────────── */
  const [view, setView] = useState<ViewMode>(readView)
  function changeView(next: ViewMode) {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* private mode */ }
  }

  /* ── Selection (belongs to one listing; changing folder / filters drops it) ─ */
  const [selection, setSelection] = useState<{ scope: string; keys: Set<string> }>({ scope: '', keys: EMPTY })
  const selectedKeys = selection.scope === requestKey ? selection.keys : EMPTY
  const selectedItems = useMemo(() => visibleItems.filter((item) => selectedKeys.has(itemKey(item))), [selectedKeys, visibleItems])
  const selectedSet = useMemo(() => new Set(selectedItems.map(itemKey)), [selectedItems])
  const lastToggled = useRef<string | null>(null)

  const clearSelection = useCallback(() => setSelection({ scope: requestKey, keys: EMPTY }), [requestKey])
  const selectAll = useCallback(() => setSelection({ scope: requestKey, keys: new Set(visibleItems.map(itemKey)) }), [requestKey, visibleItems])

  function toggle(item: FmItem, range: boolean) {
    const key = itemKey(item)
    const keys = new Set(selectedSet)
    const order = visibleItems.map(itemKey)
    const anchor = lastToggled.current
    if (range && anchor && order.includes(anchor) && anchor !== key) {
      const [from, to] = [order.indexOf(anchor), order.indexOf(key)].sort((a, b) => a - b)
      order.slice(from, to + 1).forEach((value) => keys.add(value))
    } else if (keys.has(key)) {
      keys.delete(key)
    } else {
      keys.add(key)
    }
    lastToggled.current = key
    setSelection({ scope: requestKey, keys })
  }

  /* ── Dialogs, menu, preview, busy items ──────────────────────────────── */
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [menu, setMenu] = useState<{ key: string; item: FmItem; anchor: MenuAnchor } | null>(null)
  // The preview belongs to the listing it was opened from (back / forward to another folder closes it).
  const [previewState, setPreviewState] = useState<{ context: string; file: FmFile } | null>(null)
  const preview = previewState?.context === context ? previewState.file : null
  const setPreview = useCallback((file: FmFile | null) => setPreviewState(file ? { context, file } : null), [context])
  const [busyKeys, setBusyKeys] = useState<Set<string>>(EMPTY)
  const [zipping, setZipping] = useState(false)
  const closeMenu = useCallback(() => setMenu(null), [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const markBusy = useCallback((key: string, on: boolean) => {
    setBusyKeys((previous) => {
      const next = new Set(previous)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const fail = useCallback((caught: unknown, fallback: string) => {
    showToast(errorToast(caught, fallback, t))
  }, [showToast, t])

  /* ── Navigation ──────────────────────────────────────────────────────── */
  const goTo = useCallback((id: string | null) => {
    setMenu(null)
    updateParams({ folder: id, q: null, scope: null, page: null })
  }, [updateParams])

  function openItem(item: FmItem) {
    if (item.kind === 'folder') goTo(item.id)
    else if (canView) setPreview(item)
  }

  /* ── Download one / ZIP ──────────────────────────────────────────────── */
  const download = useCallback(async (file: FmFile) => {
    const key = itemKey(file)
    markBusy(key, true)
    try {
      const result = await fileManagerService.download(file.id)
      saveBlob(result.blob, result.filename || file.name)
    } catch (caught) {
      fail(caught, t('files.download_failed', 'Could not download the file'))
    } finally {
      markBusy(key, false)
    }
  }, [fail, markBusy, t])

  async function downloadZip(items: FmItem[], base: string | null) {
    if (!canExport || !items.length) return
    const key = items.length === 1 ? itemKey(items[0]) : null
    setZipping(true)
    if (key) markBusy(key, true)
    const filename = zipName(base)
    try {
      const result = await fileManagerService.downloadZip({
        folderIds: items.filter((item) => item.kind === 'folder').map((item) => item.id),
        fileIds: items.filter((item) => item.kind === 'file').map((item) => item.id),
        filename,
      })
      saveBlob(result.blob, result.filename || filename)
      showToast({ title: t('files.zip.ready', 'ZIP archive downloaded'), description: result.filename || filename, tone: 'success' })
    } catch (caught) {
      fail(caught, t('files.zip.failed', 'Could not build the ZIP archive'))
    } finally {
      setZipping(false)
      if (key) markBusy(key, false)
    }
  }

  /* ── Create / rename ─────────────────────────────────────────────────── */
  async function createFolder(name: string) {
    try {
      await fileManagerService.createFolder(name, folderId)
    } catch (caught) {
      fail(caught, t('files.folder.create_failed', 'Could not create the folder'))
      throw caught
    }
    setDialog(null)
    showToast({ title: t('files.folder.created', 'Folder created'), description: name, tone: 'success' })
    reload()
  }

  async function rename(item: FmItem, name: string) {
    try {
      if (item.kind === 'folder') await fileManagerService.renameFolder(item.id, name)
      else await fileManagerService.renameFile(item.id, name)
    } catch (caught) {
      fail(caught, t('files.rename_failed', 'Could not rename'))
      throw caught
    }
    setDialog(null)
    if (preview?.id === item.id && item.kind === 'file') setPreview({ ...item, name })
    showToast({ title: t('files.renamed', 'Renamed'), description: name, tone: 'success' })
    reload()
  }

  /* ── Move ────────────────────────────────────────────────────────────── */
  async function moveItems(items: FmItem[], target: PickedFolder) {
    let moved = 0
    let lastError: unknown = null
    for (const item of items) {
      try {
        if (item.kind === 'folder') await fileManagerService.moveFolder(item.id, target.id)
        else await fileManagerService.moveFile(item.id, target.id)
        moved += 1
      } catch (caught) {
        lastError = caught
      }
    }
    setDialog(null)
    clearSelection()
    if (moved) {
      showToast({
        title: items.length === 1 ? t('files.moved_one', 'Moved to “{{folder}}”', { folder: target.name }) : t('files.moved_many', '{{count}} items moved to “{{folder}}”', { count: moved, folder: target.name }),
        tone: 'success',
      })
    }
    if (lastError) fail(lastError, t('files.move_failed', '{{count}} items could not be moved', { count: items.length - moved }))
    reload()
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */
  async function deleteItems(items: FmItem[]) {
    const deletable = items.filter((item) => !isLocked(item))
    if (!canDelete || !deletable.length) return
    const single = deletable.length === 1 ? deletable[0] : null
    const folderCount = deletable.filter((item) => item.kind === 'folder').length
    const ok = await confirm({
      title: single
        ? single.kind === 'folder'
          ? t('files.delete.folder_title', 'Delete the folder “{{name}}”?', { name: single.name })
          : t('files.delete.file_title', 'Delete “{{name}}”?', { name: single.name })
        : t('files.delete.many_title', 'Delete {{count}} items?', { count: deletable.length }),
      description: folderCount
        ? t('files.delete.folder_text', 'Folders are deleted with all their subfolders and files. This cannot be undone.')
        : t('files.delete.file_text', 'The file is deleted permanently. This cannot be undone.'),
      confirmLabel: t('files.delete', 'Delete'),
      cancelLabel: t('files.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!ok) return

    let deleted = 0
    let lastError: unknown = null
    for (const item of deletable) {
      try {
        if (item.kind === 'folder') await fileManagerService.deleteFolder(item.id)
        else await fileManagerService.deleteFile(item.id)
        deleted += 1
      } catch (caught) {
        // Already gone on the server — fine.
        if (getApiErrorStatus(caught) === 404) deleted += 1
        else lastError = caught
      }
    }
    clearSelection()
    if (preview && deletable.some((item) => item.kind === 'file' && item.id === preview.id)) setPreview(null)
    if (deleted) {
      showToast({
        title: single ? t('files.deleted_one', '“{{name}}” deleted', { name: single.name }) : t('files.deleted_many', '{{count}} items deleted', { count: deleted }),
        tone: 'success',
      })
    }
    if (lastError) fail(lastError, t('files.delete_failed', '{{count}} items could not be deleted', { count: deletable.length - deleted }))
    reload()
  }

  /* ── Upload: chooser, drag & drop, queue ─────────────────────────────── */
  const [queue] = useState(() => createUploadQueue((item, onProgress, signal) => fileManagerService.uploadFiles(item.folderId, [item.file], { onProgress, signal })))
  const fileInput = useRef<HTMLInputElement | null>(null)
  const uploadTarget = useRef<PickedFolder | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  useEffect(() => queue.onEvent((event) => {
    if (event.type === 'done' && event.item.folderId === folderId) scheduleReload()
    if (event.type !== 'idle') return
    if (event.failed.length) {
      const reason = errorToast(event.failed[0].error, '', t)
      showToast({
        title: t('files.upload.failed', '{{count}} files could not be uploaded', { count: event.failed.length }),
        description: reason.title || reason.description,
        tone: 'error',
      })
    } else if (event.done) {
      showToast({ title: t('files.upload.success', '{{count}} files uploaded', { count: event.done }), tone: 'success' })
    }
  }), [folderId, queue, scheduleReload, showToast, t])

  function enqueue(files: File[], target: PickedFolder) {
    if (!canCreate || !files.length || !target.id) return
    queue.add(files, { id: target.id, name: target.name })
  }

  function chooseFiles() {
    if (!canCreate) return
    if (!currentFolder) {
      setDialog({ type: 'upload-target', files: null })
      return
    }
    uploadTarget.current = currentFolder
    fileInput.current?.click()
  }

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const target = uploadTarget.current ?? currentFolder
    if (target) enqueue(files, target)
  }

  function pickUploadTarget(target: PickedFolder, files: File[] | null) {
    if (!target.id) return
    if (files) {
      enqueue(files, target)
    } else {
      // Still inside the click on "Upload here", so the browser lets the file chooser open.
      uploadTarget.current = target
      fileInput.current?.click()
    }
    setDialog(null)
    goTo(target.id)
  }

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!canCreate || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!canCreate || !hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!canCreate || !hasFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!canCreate || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const entries = Array.from(event.dataTransfer.items ?? [])
    const skipped = entries.filter((entry) => entry.kind === 'file' && entry.webkitGetAsEntry?.()?.isDirectory).length
    const files = Array.from(event.dataTransfer.files).filter((_, index) => !entries[index]?.webkitGetAsEntry?.()?.isDirectory)
    if (skipped) showToast({ title: t('files.upload.folders_skipped', 'Folders cannot be dropped — open them and drop the files inside'), tone: 'info' })
    if (!files.length) return
    if (currentFolder) enqueue(files, currentFolder)
    else setDialog({ type: 'upload-target', files })
  }

  /* ── Item menu ───────────────────────────────────────────────────────── */
  function menuEntries(item: FmItem): ItemMenuEntry[] {
    const locked = isLocked(item)
    const entries: ItemMenuEntry[] = []
    if (item.kind === 'folder') {
      entries.push({ key: 'open', label: t('files.open', 'Open'), icon: <FolderOpenIcon size={16} />, onSelect: () => goTo(item.id) })
      if (canExport) entries.push({ key: 'zip', label: t('files.zip.folder', 'Download as ZIP'), icon: <FileArchiveIcon size={16} />, onSelect: () => void downloadZip([item], item.name) })
    } else {
      entries.push({ key: 'preview', label: t('files.preview', 'Preview'), icon: <EyeIcon size={16} />, onSelect: () => setPreview(item) })
      entries.push({ key: 'download', label: t('files.download', 'Download'), icon: <DownloadSimpleIcon size={16} />, onSelect: () => void download(item) })
      if (globalSearch && item.folderId) entries.push({ key: 'locate', label: t('files.show_in_folder', 'Show in folder'), icon: <FolderIcon size={16} />, onSelect: () => goTo(item.folderId) })
    }
    if (canEdit && !locked) {
      entries.push({ key: 'rename', label: t('files.rename', 'Rename'), icon: <PencilSimpleIcon size={16} />, onSelect: () => setDialog({ type: 'rename', item }), separated: true })
      entries.push({ key: 'move', label: t('files.move_to', 'Move to…'), icon: <ArrowsOutCardinalIcon size={16} />, onSelect: () => setDialog({ type: 'move', items: [item] }) })
    }
    if (canDelete && !locked) {
      entries.push({ key: 'delete', label: t('files.delete', 'Delete'), icon: <TrashIcon size={16} />, onSelect: () => void deleteItems([item]), tone: 'danger', separated: true })
    }
    return entries
  }

  /** Where the items are now; empty when that is not known for every item (search results). */
  function parentsOf(items: FmItem[]): (string | null)[] {
    const parents = items.map((item) => (item.kind === 'folder' ? item.parentId : item.folderId) ?? (globalSearch ? undefined : folderId))
    return parents.every((parent) => parent !== undefined) ? (parents as (string | null)[]) : []
  }

  function openMenu(item: FmItem, origin: MenuOrigin) {
    const count = menuEntries(item).length
    const anchor = 'rect' in origin ? menuAnchorFromRect(origin.rect, count) : menuAnchorFromPoint(origin.x, origin.y, count)
    setMenu({ key: itemKey(item), item, anchor })
  }

  /* ── Keyboard: Esc clears the selection, Ctrl/⌘ + A selects everything shown ─ */
  const hasOverlay = Boolean(dialog || menu || preview)
  useEffect(() => {
    if (!canSelect || hasOverlay) return
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if (event.key === 'Escape' && selectedSet.size) clearSelection()
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && visibleItems.length) {
        event.preventDefault()
        selectAll()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSelect, clearSelection, hasOverlay, selectAll, selectedSet.size, visibleItems.length])

  /* ── Filter options ──────────────────────────────────────────────────── */
  const extensionOptions = useMemo<SelectFieldOption[]>(() => {
    const seen = new Set<string>([...COMMON_EXTENSIONS, ...visibleFiles.map((file) => file.extension).filter(Boolean)])
    if (extension) seen.add(extension)
    return [{ value: '', label: t('files.filter.all_types', 'All types') }, ...[...seen].sort().map((value) => ({ value, label: `.${value}` }))]
  }, [extension, t, visibleFiles])

  const sourceOptions = useMemo<SelectFieldOption[]>(() => {
    const values = new Set(knownSources)
    if (source) values.add(source)
    return [{ value: '', label: t('files.filter.all_sources', 'All sources') }, ...[...values].sort().map((value) => ({ value, label: sourceLabel(value, t) }))]
  }, [knownSources, source, t])

  /* ── Render ──────────────────────────────────────────────────────────── */
  const lockedSelected = selectedItems.some(isLocked)
  const forbidden = !canView || error?.status === 403
  const showSide = !forbidden
  const missing = error?.status === 404 && !globalSearch
  const showSkeleton = canView && !error && !shown
  const empty = Boolean(shown) && visibleItems.length === 0
  const firstFile = (page - 1) * pageSize + 1
  const lastFile = Math.min(totalFiles, page * pageSize)
  const activeTop = crumbs[0]?.id ?? null

  const headerButtons = canCreate ? (
    <HeaderActions>
      <Button variant="secondary" className="min-h-11 rounded-full border-[var(--border)] px-4 shadow-[var(--pill-shadow)]" leftIcon={<FolderPlusIcon size={17} weight="bold" />} onClick={() => setDialog({ type: 'new-folder' })} disabled={globalSearch}>
        {t('files.new_folder', 'New folder')}
      </Button>
      <Button className="min-h-11 rounded-full px-5" leftIcon={<UploadSimpleIcon size={17} weight="bold" />} onClick={chooseFiles}>
        {t('files.upload', 'Upload')}
      </Button>
    </HeaderActions>
  ) : null

  let body
  if (forbidden) {
    body = (
      <StateCard
        icon={<LockSimpleIcon size={28} weight="duotone" />}
        title={t('files.forbidden.title', 'No access to files')}
        text={t('files.forbidden.text', 'The file manager is available to the CEO only. Ask an administrator if you need access.')}
      />
    )
  } else if (missing) {
    body = (
      <StateCard
        icon={<FolderIcon size={28} weight="duotone" />}
        title={t('files.missing.title', 'This folder does not exist')}
        text={t('files.missing.text', 'It may have been moved or deleted.')}
        action={<Button leftIcon={<HouseIcon size={15} weight="bold" />} onClick={() => goTo(null)}>{t('files.missing.back', 'Back to all files')}</Button>}
      />
    )
  } else if (error) {
    body = (
      <StateCard
        tone="error"
        icon={<WarningCircleIcon size={28} weight="duotone" />}
        title={t('files.load_failed', 'Could not load files')}
        text={t('files.load_failed_text', 'Check the connection and try again.')}
        action={<Button leftIcon={<ArrowClockwiseIcon size={15} weight="bold" />} onClick={reload}>{t('files.retry', 'Try again')}</Button>}
      />
    )
  } else if (showSkeleton) {
    body = <LoadingSkeleton view={view} />
  } else if (empty) {
    body = filtersActive ? (
      <StateCard
        icon={<MagnifyingGlassIcon size={28} weight="duotone" />}
        title={globalSearch ? t('files.empty.search_title', 'Nothing found for “{{query}}”', { query }) : t('files.empty.filtered_title', 'Nothing matches the filters')}
        text={globalSearch ? t('files.empty.search_text', 'Try another word or remove the type filter.') : t('files.empty.filtered_text', 'Try another search, or search everywhere.')}
        action={(
          <div className="flex flex-wrap justify-center gap-2">
            {!globalSearch && query ? (
              <Button variant="secondary" leftIcon={<MagnifyingGlassIcon size={15} weight="bold" />} onClick={() => updateParams({ scope: 'all', page: null }, true)}>
                {t('files.scope.search_everywhere', 'Search everywhere')}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => { setDraft(''); updateParams({ q: null, scope: null, ext: null, source: null, page: null }, true) }}>
              {t('files.filter.clear', 'Clear filters')}
            </Button>
          </div>
        )}
      />
    ) : (
      <StateCard
        icon={<FolderOpenIcon size={28} weight="duotone" />}
        title={folderId ? t('files.empty.folder_title', 'This folder is empty') : t('files.empty.root_title', 'No files yet')}
        text={canCreate
          ? folderId
            ? t('files.empty.folder_text', 'Drag files here or use Upload.')
            : t('files.empty.root_text', 'Create a folder, then upload files into it.')
          : undefined}
        action={canCreate ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" leftIcon={<FolderPlusIcon size={15} weight="bold" />} onClick={() => setDialog({ type: 'new-folder' })}>{t('files.new_folder', 'New folder')}</Button>
            <Button leftIcon={<UploadSimpleIcon size={15} weight="bold" />} onClick={chooseFiles}>{t('files.upload', 'Upload')}</Button>
          </div>
        ) : null}
      />
    )
  } else {
    const viewProps = {
      folders: visibleFolders,
      files: visibleFiles,
      selected: selectedSet,
      selectable: canSelect,
      showPath: globalSearch,
      busyKeys,
      menuKey: menu?.key ?? null,
      onOpen: openItem,
      onToggle: toggle,
      onMenu: openMenu,
    }
    body = (
      <div className={cn('transition-opacity duration-200', loading && 'pointer-events-none opacity-60')} aria-busy={loading}>
        {globalSearch ? (
          <p className="mb-1 text-[12px] text-[var(--muted)]">
            {t('files.search.summary', 'Found — folders: {{folders}}, files: {{files}}', { folders: visibleFolders.length, files: visibleFiles.length })}
            {visibleItems.length >= SEARCH_LIMIT ? ` · ${t('files.search.limited', 'showing the first {{count}}', { count: SEARCH_LIMIT })}` : ''}
          </p>
        ) : null}
        {view === 'grid' ? (
          <FileGrid {...viewProps} />
        ) : (
          <FileList
            {...viewProps}
            allSelected={selectedItems.length > 0 && selectedItems.length === visibleItems.length}
            someSelected={selectedItems.length > 0}
            onToggleAll={() => (selectedItems.length === visibleItems.length ? clearSelection() : selectAll())}
          />
        )}
        {browse && pageCount > 1 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <p className="text-[12.5px] text-[var(--muted)] tabular-nums">
              {t('files.pager.range', 'Files {{from}}–{{to}} of {{total}}', { from: firstFile, to: lastFile, total: totalFiles })}
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : null })}>
                {t('files.pager.previous', 'Previous')}
              </Button>
              <span className="min-w-[64px] text-center text-[12.5px] font-semibold text-[var(--muted-strong)] tabular-nums">{page} / {pageCount}</span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => updateParams({ page: String(page + 1) })}>
                {t('files.pager.next', 'Next')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const summary = shown && !error ? (
    <span className="hidden shrink-0 text-[12px] text-[var(--muted)] tabular-nums sm:inline">
      {t('files.summary', 'Folders: {{folders}} · Files: {{files}}', { folders: visibleFolders.length, files: browse ? totalFiles : visibleFiles.length })}
    </span>
  ) : null

  return (
    // User data (file / folder names, document text) must never go through the app's DOM literal translator.
    <section className="flex flex-col gap-3" data-i18n-skip="true">
      <h1 className="sr-only">{t('files.title', 'Files')}</h1>
      {headerButtons}

      <div className={cn('grid gap-3', showSide && 'lg:grid-cols-[228px_minmax(0,1fr)]')}>
        {/* Side: top-level folders */}
        {showSide ? (
          <aside className="hidden self-start rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-2.5 lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100dvh-var(--header-h)-60px)] lg:flex-col">
            <button
              type="button"
              onClick={() => goTo(null)}
              className={cn(
                'flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors',
                folderId === null && !globalSearch ? 'bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
              )}
            >
              <HouseIcon size={17} weight={folderId === null && !globalSearch ? 'fill' : 'regular'} />
              {t('files.root', 'All files')}
            </button>
            <p className="mt-3 mb-1 px-2.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--caption)] uppercase">{t('files.side.folders', 'Folders')}</p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rootFolders === null ? (
                <div className="flex flex-col gap-1.5 px-1 py-1">
                  {[0, 1, 2].map((index) => <Skeleton key={index} className="h-8 w-full" />)}
                </div>
              ) : rootFolders.folders.length === 0 ? (
                <p className="px-2.5 py-1 text-[12px] text-[var(--muted)]">{t('files.side.none', 'No folders yet')}</p>
              ) : (
                rootFolders.folders.map((folder) => {
                  const active = activeTop === folder.id
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => goTo(folder.id)}
                      title={folder.name}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors',
                        active ? 'bg-[var(--input-surface)] text-[var(--foreground)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
                      )}
                    >
                      {folder.system ? <LockSimpleIcon size={15} className="shrink-0 text-[var(--muted)]" /> : <FolderIcon size={15} weight={active ? 'fill' : 'regular'} className="shrink-0 text-[color-mix(in_oklab,var(--warning-text)_70%,var(--lime))]" />}
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    </button>
                  )
                })
              )}
            </div>
            <p className="mt-3 flex items-start gap-2 border-t border-[var(--border)] px-2.5 pt-3 text-[11.5px] leading-snug text-[var(--muted)]">
              <LockSimpleIcon size={14} className="mt-px shrink-0" />
              {t('files.side.private', 'Private storage — files open only with your sign-in.')}
            </p>
          </aside>
        ) : null}

        {/* Main: filters · path · items */}
        <div
          className={cn('relative min-h-[calc(100dvh-var(--header-h)-80px)] min-w-0 rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4', dragging && 'fm-drop')}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {!forbidden ? (
            <>
              <FilterBar
                search={draft}
                onSearchChange={onSearchChange}
                scope={scope}
                onScopeChange={(next) => updateParams({ scope: next === 'all' ? 'all' : null, page: null }, true)}
                extension={extension}
                extensionOptions={extensionOptions}
                onExtensionChange={(value) => updateParams({ ext: value || null, page: null })}
                source={source}
                sourceOptions={sourceOptions}
                onSourceChange={(value) => updateParams({ source: value || null, page: null })}
                view={view}
                onViewChange={changeView}
              />
              <div className="sticky top-0 z-10 -mx-1 mt-3 mb-1 bg-[var(--card)] px-1 py-1">
                {selectedItems.length ? (
                  <SelectionBar
                    count={selectedItems.length}
                    total={visibleItems.length}
                    canZip={canExport}
                    canMove={canEdit}
                    canDelete={canDelete}
                    zipping={zipping}
                    lockedReason={lockedSelected ? t('files.selection.locked', 'System folders cannot be moved or deleted') : null}
                    onSelectAll={selectAll}
                    onClear={clearSelection}
                    onZip={() => void downloadZip(selectedItems, selectedItems.length === 1 ? selectedItems[0].name : currentFolder?.name ?? null)}
                    onMove={() => setDialog({ type: 'move', items: selectedItems })}
                    onDelete={() => void deleteItems(selectedItems)}
                  />
                ) : (
                  <Breadcrumbs
                    crumbs={crumbs}
                    searchLabel={globalSearch ? t('files.search.results_for', 'Results for “{{query}}”', { query }) : null}
                    onGo={goTo}
                    trailing={(
                      <>
                        {summary}
                        <RefreshButton loading={loading && Boolean(shown)} onClick={reload} />
                      </>
                    )}
                  />
                )}
              </div>
            </>
          ) : null}

          {body}

          {dragging ? (
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[18px] bg-[color-mix(in_srgb,var(--card)_70%,transparent)] p-6">
              <div className="mm-pop flex max-w-sm flex-col items-center gap-2 rounded-[18px] bg-[var(--surface)] px-6 py-5 text-center shadow-[var(--elev-lg)] ring-1 ring-[var(--border)]">
                <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--primary)]">
                  <CloudArrowUpIcon size={26} weight="duotone" />
                </span>
                <p className="text-[14.5px] font-bold text-[var(--foreground)]">
                  {currentFolder ? t('files.drop.title', 'Drop to upload to “{{folder}}”', { folder: currentFolder.name }) : t('files.drop.title_root', 'Drop files to upload')}
                </p>
                <p className="text-[12.5px] text-[var(--muted)]">
                  {currentFolder ? t('files.drop.text', 'Several files at once are fine.') : t('files.drop.text_root', 'You will choose the folder next.')}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <input ref={fileInput} type="file" multiple hidden onChange={onFilesChosen} />

      {menu ? <ItemMenu anchor={menu.anchor} title={menu.item.name} entries={menuEntries(menu.item)} onClose={closeMenu} /> : null}

      {dialog?.type === 'new-folder' ? (
        <NameDialog
          title={t('files.folder.new_title', 'New folder')}
          description={currentFolder ? t('files.folder.new_in', 'Inside “{{folder}}”', { folder: currentFolder.name }) : t('files.folder.new_root', 'At the top level')}
          label={t('files.folder.name', 'Folder name')}
          confirmLabel={t('files.create', 'Create')}
          icon={<FolderPlusIcon size={18} weight="duotone" />}
          onSubmit={createFolder}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'rename' ? (
        <NameDialog
          title={dialog.item.kind === 'folder' ? t('files.rename_folder', 'Rename folder') : t('files.rename_file', 'Rename file')}
          label={t('files.new_name', 'New name')}
          initialValue={dialog.item.name}
          selectBaseName={dialog.item.kind === 'file'}
          confirmLabel={t('files.save', 'Save')}
          icon={<PencilSimpleIcon size={18} weight="duotone" />}
          onSubmit={(name) => rename(dialog.item, name)}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'move' ? (
        <FolderPickerDialog
          title={dialog.items.length === 1 ? t('files.move_one_title', 'Move “{{name}}”', { name: dialog.items[0].name }) : t('files.move_many_title', 'Move {{count}} items', { count: dialog.items.length })}
          description={t('files.move_text', 'Choose the folder to move to.')}
          confirmLabel={t('files.move_here', 'Move here')}
          icon={<ArrowsOutCardinalIcon size={18} weight="duotone" />}
          startFolderId={globalSearch ? null : folderId}
          allowRoot
          blockedIds={dialog.items.filter((item) => item.kind === 'folder').map((item) => item.id)}
          sourceParentIds={parentsOf(dialog.items)}
          onConfirm={(target) => moveItems(dialog.items, target)}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'upload-target' ? (
        <FolderPickerDialog
          title={t('files.upload_target.title', 'Where to upload?')}
          description={dialog.files
            ? t('files.upload_target.text_files', '{{count}} files are ready. Choose a folder for them.', { count: dialog.files.length })
            : t('files.upload_target.text', 'Files are kept inside folders. Choose one, then pick the files.')}
          confirmLabel={t('files.upload_here', 'Upload here')}
          icon={<UploadSimpleIcon size={18} weight="duotone" />}
          startFolderId={null}
          allowRoot={false}
          onConfirm={(target) => pickUploadTarget(target, dialog.files)}
          onClose={closeDialog}
        />
      ) : null}

      {preview ? (
        <PreviewDialog
          file={preview}
          files={visibleFiles}
          canDownload={canView}
          downloading={busyKeys.has(itemKey(preview))}
          onNavigate={setPreview}
          onDownload={(file) => void download(file)}
          onClose={() => setPreview(null)}
        />
      ) : null}

      <UploadPanel queue={queue} />
    </section>
  )
}

function StateCard({ icon, title, text, action, tone = 'default' }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div className="grid min-h-[380px] place-items-center px-4 py-10">
      <div className="mm-pop max-w-md text-center">
        <span className={cn('mx-auto grid h-14 w-14 place-items-center rounded-[16px]', tone === 'error' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
          {icon}
        </span>
        <p className="mt-4 text-[17px] font-bold text-[var(--foreground)]">{title}</p>
        {text ? <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{text}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}

function LoadingSkeleton({ view }: { view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-2 pt-2" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-1.5">
            <Skeleton className="h-8 w-8" rounded="sm" />
            <Skeleton className="h-3.5 flex-1" rounded="full" />
            <Skeleton className="hidden h-3.5 w-20 sm:block" rounded="full" />
            <Skeleton className="hidden h-3.5 w-28 sm:block" rounded="full" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="fm-grid" aria-busy="true">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-2 p-2">
          <Skeleton className="aspect-[3/2] w-full" rounded="lg" />
          <Skeleton className="h-3 w-3/4" rounded="full" />
          <Skeleton className="h-2.5 w-1/2" rounded="full" />
        </div>
      ))}
    </div>
  )
}
