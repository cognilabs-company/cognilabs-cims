import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowClockwiseIcon,
  ArrowsDownUpIcon,
  ArrowsOutCardinalIcon,
  CheckSquareIcon,
  ClipboardTextIcon,
  CloudArrowUpIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileArchiveIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FunnelIcon,
  FunnelXIcon,
  GlobeIcon,
  FolderSimpleIcon,
  HouseIcon,
  InfoIcon,
  ListIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  ScissorsIcon,
  SelectionAllIcon,
  SidebarSimpleIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SquaresFourIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  extensionOf,
  fileManagerService,
  type FmBrowseResult,
  type FmCrumb,
  type FmFile,
  type FmFolder,
  type FmItem,
  type FmSearchResult,
} from '../../../shared/api/services/fileManager.service'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { AddressBar } from '../components/AddressBar'
import { CommandBar, type Command } from '../components/CommandBar'
import { ContextMenu, type MenuAnchor, type MenuEntry } from '../components/ContextMenu'
import { DetailsPane, type PaneAction, type PaneSubject } from '../components/DetailsPane'
import { FolderPickerDialog, type PickedFolder } from '../components/FolderPickerDialog'
import { FolderTree } from '../components/FolderTree'
import { ItemGlyph } from '../components/ItemGlyph'
import { ItemsPane, type SelectionChange } from '../components/ItemsPane'
import { NameDialog } from '../components/NameDialog'
import { PreviewDialog } from '../components/PreviewDialog'
import { PropertiesDialog } from '../components/PropertiesDialog'
import { StatusBar, type Pager } from '../components/StatusBar'
import { UploadPanel } from '../components/UploadPanel'
import {
  DRAG_TYPE,
  ROOT_KEY,
  clampTreeWidth,
  dragHasFiles,
  dragIsInternal,
  dropKey,
  isLocked,
  readPrefs,
  sortItems,
  totalSize,
  typeLabel,
  writePrefs,
  type DropHandlers,
  type DropTarget,
  type ExplorerPrefs,
  type SearchScope,
  type SortKey,
  type ViewMode,
} from '../lib/explorer'
import { COMMON_EXTENSIONS, errorToast, formatBytes, itemKey, kindOf, saveBlob, sourceLabel, zipName } from '../lib/items'
import { uniqueName } from '../lib/names'
import { folderRows, itemRows, type PropertyRow } from '../lib/properties'
import { createUploadQueue } from '../lib/uploadQueue'
import { useExplorerHistory } from '../lib/useExplorerHistory'
import { useFolderTree } from '../lib/useFolderTree'
import '../fileManager.css'

const PAGE_SIZE = 100
const SEARCH_LIMIT = 200
const SEARCH_DEBOUNCE_MS = 350
const EMPTY = new Set<string>()
const NO_FOLDERS: FmFolder[] = []
const NO_FILES: FmFile[] = []

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const KEYS = {
  mod: (key: string) => (MAC ? `⌘${key}` : `Ctrl+${key}`),
  alt: (key: string) => (MAC ? `⌥${key}` : `Alt+${key}`),
  del: MAC ? '⌘⌫' : 'Del',
}

type Listing = { folders: FmFolder[]; files: FmFile[] }

type Loaded =
  | { key: string; context: string; requestKey: string; mode: 'browse'; data: FmBrowseResult }
  | { key: string; context: string; requestKey: string; mode: 'search'; data: FmSearchResult }

type Selection = { scope: string; keys: ReadonlySet<string>; anchor: string | null; focus: string | null }

type DialogState =
  | { type: 'new-folder' }
  | { type: 'rename'; item: FmItem }
  | { type: 'move'; items: FmItem[] }
  /** Uploading at the top level: pick a folder first (files = dropped files, or null → open the file chooser). */
  | { type: 'upload-target'; files: File[] | null }
  | { type: 'properties'; subject: PaneSubject; rows: PropertyRow[] }

type MenuKind =
  | { type: 'empty' }
  | { type: 'items'; items: FmItem[] }
  | { type: 'tree'; folder: FmFolder | null; ancestors: string[] }
  | { type: 'crumb'; id: string | null }
  | { type: 'overflow'; crumbs: FmCrumb[] }
  | { type: 'command'; id: 'new' | 'sort' | 'view' | 'filter' | 'more' }
/** `context`: the listing it was opened on — Back / Forward to another folder closes it. */
type MenuState = MenuKind & { anchor: MenuAnchor; trigger: HTMLElement | null; focusFirst: boolean; openKey: string; context: string }

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
}

const browseContext = (folder: string | null) => `browse|${folder ?? ''}`
const requestKeyOf = (context: string, query: string, extension: string, source: string, page: number) => `${context}|${query}|${extension}|${source}|${page}`

/** /files — the private file manager (CEO), laid out like a desktop file explorer. */
export function FileManagerPage() {
  const { t, locale } = useLocale()
  const { can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const canView = can('file_manager', 'view')
  const canCreate = canView && can('file_manager', 'create')
  const canEdit = canView && can('file_manager', 'edit')
  const canDelete = canView && can('file_manager', 'delete')
  const canExport = canView && can('file_manager', 'export')
  const rootLabel = t('files.root', 'All files')
  const noPermission = t('files.error.forbidden', 'You do not have permission for this action')
  const lockedHint = t('files.locked_hint', 'System folders cannot be renamed, moved or deleted')

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
  const searchRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  function onSearchChange(value: string) {
    setDraft(value)
    window.clearTimeout(searchTimer.current)
    const commit = () => updateParams({ q: value || null, page: null, ...(value.trim() ? {} : { scope: null }) }, true)
    if (!value) commit()
    else searchTimer.current = window.setTimeout(commit, SEARCH_DEBOUNCE_MS)
  }

  /* ── Preferences (view, sort, panes) — remembered per browser ───────────── */
  const [prefs, setPrefs] = useState<ExplorerPrefs>(readPrefs)
  const updatePrefs = useCallback((change: Partial<ExplorerPrefs>) => {
    setPrefs((previous) => {
      const next = { ...previous, ...change }
      writePrefs(next)
      return next
    })
  }, [])
  const view = prefs.view
  const sort = prefs.sort
  const setView = (next: ViewMode) => updatePrefs({ view: next })
  const setSort = (key: SortKey, dir?: 'asc' | 'desc') => updatePrefs({ sort: { key, dir: dir ?? (sort.key === key ? (sort.dir === 'asc' ? 'desc' : 'asc') : key === 'modified' || key === 'size' ? 'desc' : 'asc') } })

  /* ── Loading ─────────────────────────────────────────────────────────── */
  const [reloadKey, setReloadKey] = useState(0)
  const context = globalSearch ? `search|${query}|${extension}|${source}` : browseContext(folderId)
  const requestKey = globalSearch ? context : requestKeyOf(context, query, extension, source, page)
  const fullKey = `${requestKey}|${reloadKey}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<{ key: string; status: number | null } | null>(null)
  const [knownSources, setKnownSources] = useState<string[]>([])
  const filtersActive = Boolean(query || extension || source)

  const error = loadError?.key === fullKey ? loadError : null
  const loading = canView && !error && loaded?.key !== fullKey
  // While a new page / filter (or a refresh) loads, the same folder (or search) stays on screen.
  const shown = loaded && (loaded.key === fullKey || loaded.context === context) ? loaded : null
  const dimmed = loading && Boolean(shown) && shown?.requestKey !== requestKey
  const browse = shown?.mode === 'browse' ? shown.data : null
  const visibleFolders = shown?.data.folders ?? NO_FOLDERS
  const visibleFiles = shown?.data.files ?? NO_FILES

  /* ── Folder tree (navigation pane) ───────────────────────────────────── */
  const loadedCrumbs = browse?.breadcrumbs
  const pathIds = useMemo(() => [ROOT_KEY, ...(loadedCrumbs ?? []).slice(0, -1).map((crumb) => crumb.id)], [loadedCrumbs])
  const tree = useFolderTree({ enabled: canView, generation: reloadKey, pathIds })
  const { seed, pathTo } = tree

  useEffect(() => {
    if (!canView) return
    let alive = true
    const remember = (items: { sourceType: string | null }[]) => {
      const found = items.map((item) => item.sourceType).filter((value): value is string => Boolean(value))
      if (found.length) setKnownSources((previous) => (found.every((value) => previous.includes(value)) ? previous : [...new Set([...previous, ...found])]))
    }
    const request: Promise<Loaded> = globalSearch
      ? fileManagerService.search({ query, extension, sourceType: source, limit: SEARCH_LIMIT })
        .then((data) => ({ key: fullKey, context, requestKey, mode: 'search' as const, data }))
      : fileManagerService.browse({ folderId, search: query, extension, sourceType: source, page, pageSize: PAGE_SIZE })
        .then((data) => ({ key: fullKey, context, requestKey, mode: 'browse' as const, data }))
    request
      .then((result) => {
        if (!alive) return
        setLoaded(result)
        setLoadError(null)
        remember([...result.data.folders, ...result.data.files])
        // The listing already holds this folder's sub-folders: the tree does not ask again.
        if (result.mode === 'browse' && !query && !extension && !source) seed(folderId ?? ROOT_KEY, result.data.folders, reloadKey)
      })
      .catch((caught: unknown) => {
        if (alive) setLoadError({ key: fullKey, status: getApiErrorStatus(caught) })
      })
    return () => { alive = false }
  }, [canView, context, extension, folderId, fullKey, globalSearch, page, query, reloadKey, requestKey, seed, source])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])
  const reloadTimer = useRef<number | undefined>(undefined)
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => setReloadKey((value) => value + 1), 500)
  }, [])
  useEffect(() => () => window.clearTimeout(reloadTimer.current), [])

  /**
   * Optimistic change of what is on screen (the reload that follows confirms it). `forContext` is the
   * listing the action started on — if another folder opened meanwhile, nothing is patched.
   */
  const patchListing = useCallback((forContext: string, change: (listing: Listing) => Listing) => {
    setLoaded((previous) => {
      if (!previous || previous.context !== forContext) return previous
      const next = change({ folders: previous.data.folders, files: previous.data.files })
      return previous.mode === 'browse'
        ? { ...previous, data: { ...previous.data, ...next } }
        : { ...previous, data: { ...previous.data, ...next } }
    })
  }, [])

  /* ── Path, sorting ───────────────────────────────────────────────────── */
  const crumbs = useMemo<FmCrumb[]>(() => {
    if (globalSearch || !folderId) return []
    return loadedCrumbs ?? pathTo(folderId) ?? []
  }, [folderId, globalSearch, loadedCrumbs, pathTo])
  const currentFolder: PickedFolder | null = folderId
    ? { id: folderId, name: browse?.folder?.name ?? crumbs[crumbs.length - 1]?.name ?? '…' }
    : null
  const currentSystem = Boolean(browse?.folder?.system ?? crumbs[crumbs.length - 1]?.system)
  const locationText = globalSearch ? null : [rootLabel, ...crumbs.map((crumb) => crumb.name)].join(' / ')
  const ancestors = useMemo(() => crumbs.map((crumb) => crumb.id), [crumbs])

  const items = useMemo(() => sortItems(visibleFolders, visibleFiles, sort, locale, t), [locale, sort, t, visibleFiles, visibleFolders])
  const previewFiles = useMemo(() => items.filter((item): item is FmFile => item.kind === 'file'), [items])
  const totalFiles = browse?.totalFiles ?? visibleFiles.length
  const pageSize = browse?.pageSize || PAGE_SIZE
  const pageCount = browse ? Math.max(1, Math.ceil(totalFiles / pageSize)) : 1

  /* ── History (Back / Forward / Up) ───────────────────────────────────── */
  const nav = useExplorerHistory(folderId)

  /* ── Selection (belongs to one listing; changing folder / filters drops it) ─ */
  const [selectionState, setSelectionState] = useState<Selection>({ scope: '', keys: EMPTY, anchor: null, focus: null })
  const selection: Selection = selectionState.scope === requestKey ? selectionState : { scope: requestKey, keys: EMPTY, anchor: null, focus: null }
  const selectedItems = useMemo(() => items.filter((item) => selection.keys.has(itemKey(item))), [items, selection.keys])
  const selectedKeys = useMemo(() => new Set(selectedItems.map(itemKey)), [selectedItems])
  const single = selectedItems.length === 1 ? selectedItems[0] : null

  const select = useCallback((change: SelectionChange) => setSelectionState({ scope: requestKey, keys: change.keys, anchor: change.anchor, focus: change.focus }), [requestKey])
  const clearSelection = useCallback(() => setSelectionState((previous) => ({ scope: requestKey, keys: EMPTY, anchor: null, focus: previous.scope === requestKey ? previous.focus : null })), [requestKey])
  const selectAll = useCallback(() => {
    const keys = new Set(items.map(itemKey))
    setSelectionState((previous) => ({ scope: requestKey, keys, anchor: items[0] ? itemKey(items[0]) : null, focus: previous.scope === requestKey ? previous.focus : null }))
  }, [items, requestKey])
  const selectOnly = useCallback((item: FmItem) => {
    const key = itemKey(item)
    setSelectionState({ scope: requestKey, keys: new Set([key]), anchor: key, focus: key })
  }, [requestKey])

  /* ── Dialogs, menus, preview, rename, busy items ─────────────────────── */
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [menuState, setMenu] = useState<MenuState | null>(null)
  const menu = menuState?.context === context ? menuState : null
  const closeMenu = useCallback(() => setMenu(null), [])
  const closeDialog = useCallback(() => setDialog(null), [])
  // The preview belongs to the listing it was opened from (back / forward to another folder closes it).
  const [previewState, setPreviewState] = useState<{ context: string; file: FmFile } | null>(null)
  const preview = previewState?.context === context ? previewState.file : null
  const setPreview = useCallback((file: FmFile | null) => setPreviewState(file ? { context, file } : null), [context])
  const [renaming, setRenaming] = useState<{ scope: string; key: string } | null>(null)
  const renamingKey = renaming?.scope === requestKey ? renaming.key : null
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(EMPTY)
  const [zipping, setZipping] = useState(false)
  const [clipboard, setClipboard] = useState<{ items: FmItem[]; keys: ReadonlySet<string>; from: string | null } | null>(null)

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

  /* ── Layout: navigation drawer (narrow), details pane, tree width ────── */
  const desktop = useMediaQuery('(min-width: 1024px)')
  const wide = useMediaQuery('(min-width: 1280px)')
  const [treeDrawer, setTreeDrawer] = useState(false)
  const [detailsOverlay, setDetailsOverlay] = useState(false)
  const detailsOpen = wide ? prefs.details : detailsOverlay
  const toggleDetails = () => {
    if (wide) updatePrefs({ details: !prefs.details })
    else setDetailsOverlay((value) => !value)
  }
  const rootRef = useRef<HTMLElement | null>(null)

  /* ── Navigation ──────────────────────────────────────────────────────── */
  const goTo = useCallback((id: string | null) => {
    setMenu(null)
    setRenaming(null)
    setTreeDrawer(false)
    updateParams({ folder: id, q: null, scope: null, page: null })
  }, [updateParams])

  const parentId = crumbs.length >= 2 ? crumbs[crumbs.length - 2].id : null
  const canUp = globalSearch || Boolean(query) || folderId !== null
  function goUp() {
    if (globalSearch || query) {
      setDraft('')
      updateParams({ q: null, scope: null, page: null })
      return
    }
    if (!folderId) return
    // Like Explorer: the folder you came out of is selected in its parent.
    const key = itemKey({ kind: 'folder', id: folderId })
    setSelectionState({ scope: requestKeyOf(browseContext(parentId), '', extension, source, 1), keys: new Set([key]), anchor: key, focus: key })
    goTo(parentId)
  }

  function openItem(item: FmItem) {
    if (item.kind === 'folder') goTo(item.id)
    else if (canView) setPreview(item)
  }

  function focusPane() {
    rootRef.current?.querySelector<HTMLElement>('.fx-pane-scroll [data-key][tabindex="0"], .fx-pane-scroll')?.focus({ preventScroll: true })
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

  async function downloadZip(targets: FmItem[], base: string | null) {
    if (!canExport || !targets.length || zipping) return
    const key = targets.length === 1 ? itemKey(targets[0]) : null
    setZipping(true)
    if (key) markBusy(key, true)
    const filename = zipName(base)
    try {
      const result = await fileManagerService.downloadZip({
        folderIds: targets.filter((item) => item.kind === 'folder').map((item) => item.id),
        fileIds: targets.filter((item) => item.kind === 'file').map((item) => item.id),
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

  const zipBase = (targets: FmItem[]) => (targets.length === 1 ? targets[0].name : currentFolder?.name ?? null)

  /* ── Create ──────────────────────────────────────────────────────────── */
  async function createFolderNamed(name: string) {
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

  /** Like Explorer: "New folder" appears right away with its name ready to type over. */
  async function newFolder() {
    if (!canCreate || globalSearch) return
    if (filtersActive) {
      setDialog({ type: 'new-folder' })
      return
    }
    const base = t('files.folder.default_name', 'New folder')
    const taken = visibleFolders.map((folder) => folder.name)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const name = uniqueName(base, taken)
      try {
        const created = await fileManagerService.createFolder(name, folderId)
        if (created) {
          const folder: FmFolder = { ...created, name: created.name === '—' ? name : created.name, parentId: created.parentId ?? folderId }
          const key = itemKey(folder)
          patchListing(context, (listing) => ({ ...listing, folders: [...listing.folders.filter((item) => item.id !== folder.id), folder] }))
          setSelectionState({ scope: requestKey, keys: new Set([key]), anchor: key, focus: key })
          setRenaming({ scope: requestKey, key })
        } else {
          showToast({ title: t('files.folder.created', 'Folder created'), description: name, tone: 'success' })
        }
        reload()
        return
      } catch (caught) {
        if (getApiErrorStatus(caught) === 409) {
          taken.push(name)
          continue
        }
        fail(caught, t('files.folder.create_failed', 'Could not create the folder'))
        return
      }
    }
  }

  /* ── Rename ──────────────────────────────────────────────────────────── */
  async function renameItem(item: FmItem, name: string) {
    if (item.kind === 'folder') await fileManagerService.renameFolder(item.id, name)
    else await fileManagerService.renameFile(item.id, name)
    patchListing(context, (listing) => ({
      folders: listing.folders.map((folder) => (item.kind === 'folder' && folder.id === item.id ? { ...folder, name } : folder)),
      files: listing.files.map((file) => (item.kind === 'file' && file.id === item.id ? { ...file, name, extension: extensionOf(name) || file.extension } : file)),
    }))
    if (preview?.id === item.id && item.kind === 'file') setPreview({ ...item, name })
    reload()
  }

  /** Inline rename (F2): true when saved; false keeps the box open. */
  async function commitInlineRename(item: FmItem, name: string) {
    try {
      await renameItem(item, name)
      setRenaming(null)
      return true
    } catch (caught) {
      fail(caught, t('files.rename_failed', 'Could not rename'))
      return false
    }
  }

  async function renameFromDialog(item: FmItem, name: string) {
    try {
      await renameItem(item, name)
    } catch (caught) {
      fail(caught, t('files.rename_failed', 'Could not rename'))
      throw caught
    }
    setDialog(null)
    showToast({ title: t('files.renamed', 'Renamed'), description: name, tone: 'success' })
  }

  function startRename(item: FmItem) {
    if (!canEdit || isLocked(item)) return
    const key = itemKey(item)
    if (items.some((entry) => itemKey(entry) === key)) {
      selectOnly(item)
      setRenaming({ scope: requestKey, key })
    } else {
      setDialog({ type: 'rename', item })
    }
  }

  /* ── Move (dialog, drag & drop, cut / paste) ─────────────────────────── */
  /** Where the items are now; empty when that is not known for every item (search results). */
  function parentsOf(targets: FmItem[]): (string | null)[] {
    const parents = targets.map((item) => (item.kind === 'folder' ? item.parentId : item.folderId) ?? (globalSearch ? undefined : folderId))
    return parents.every((parent) => parent !== undefined) ? (parents as (string | null)[]) : []
  }

  async function moveItems(targets: FmItem[], target: PickedFolder) {
    let moved = 0
    let lastError: unknown = null
    const movedKeys = new Set<string>()
    for (const item of targets) {
      try {
        if (item.kind === 'folder') await fileManagerService.moveFolder(item.id, target.id)
        else await fileManagerService.moveFile(item.id, target.id)
        moved += 1
        movedKeys.add(itemKey(item))
      } catch (caught) {
        lastError = caught
      }
    }
    setDialog(null)
    clearSelection()
    if (!globalSearch && target.id !== folderId && movedKeys.size) {
      patchListing(context, (listing) => ({
        folders: listing.folders.filter((item) => !movedKeys.has(itemKey(item))),
        files: listing.files.filter((item) => !movedKeys.has(itemKey(item))),
      }))
    }
    if (moved) {
      showToast({
        title: targets.length === 1 ? t('files.moved_one', 'Moved to “{{folder}}”', { folder: target.name }) : t('files.moved_many', '{{count}} items moved to “{{folder}}”', { count: moved, folder: target.name }),
        tone: 'success',
      })
    }
    if (lastError) fail(lastError, t('files.move_failed', '{{count}} items could not be moved', { count: targets.length - moved }))
    reload()
  }

  function openMove(targets: FmItem[]) {
    const movable = targets.filter((item) => !isLocked(item))
    if (!canEdit || !movable.length) return
    setDialog({ type: 'move', items: movable })
  }

  function cut(targets: FmItem[]) {
    const movable = targets.filter((item) => !isLocked(item))
    if (!canEdit || !movable.length || globalSearch) return
    setClipboard({ items: movable, keys: new Set(movable.map(itemKey)), from: folderId })
    showToast({ title: t('files.cut.done', '{{count}} items ready to move', { count: movable.length }), description: t('files.cut.hint', 'Open the destination folder and paste ({{keys}}).', { keys: KEYS.mod('V') }), tone: 'info' })
  }

  const pasteBlocked = !clipboard || !canEdit || globalSearch || clipboard.from === folderId
    || clipboard.items.some((item) => item.kind === 'folder' && (item.id === folderId || ancestors.includes(item.id)))
  function paste() {
    if (!clipboard || pasteBlocked) return
    const targets = clipboard.items
    setClipboard(null)
    void moveItems(targets, { id: folderId, name: currentFolder?.name ?? rootLabel })
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */
  async function deleteItems(targets: FmItem[]) {
    const deletable = targets.filter((item) => !isLocked(item))
    if (!canDelete || !deletable.length) return
    const one = deletable.length === 1 ? deletable[0] : null
    const folderCount = deletable.filter((item) => item.kind === 'folder').length
    const ok = await confirm({
      title: one
        ? one.kind === 'folder'
          ? t('files.delete.folder_title', 'Delete the folder “{{name}}”?', { name: one.name })
          : t('files.delete.file_title', 'Delete “{{name}}”?', { name: one.name })
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
    const gone = new Set<string>()
    for (const item of deletable) {
      try {
        if (item.kind === 'folder') await fileManagerService.deleteFolder(item.id)
        else await fileManagerService.deleteFile(item.id)
        deleted += 1
        gone.add(itemKey(item))
      } catch (caught) {
        // Already gone on the server — fine.
        if (getApiErrorStatus(caught) === 404) {
          deleted += 1
          gone.add(itemKey(item))
        } else {
          lastError = caught
        }
      }
    }
    clearSelection()
    if (gone.size) {
      patchListing(context, (listing) => ({
        folders: listing.folders.filter((item) => !gone.has(itemKey(item))),
        files: listing.files.filter((item) => !gone.has(itemKey(item))),
      }))
    }
    if (preview && deletable.some((item) => item.kind === 'file' && item.id === preview.id)) setPreview(null)
    if (deleted) {
      showToast({
        title: one ? t('files.deleted_one', '“{{name}}” deleted', { name: one.name }) : t('files.deleted_many', '{{count}} items deleted', { count: deleted }),
        tone: 'success',
      })
    }
    if (lastError) fail(lastError, t('files.delete_failed', '{{count}} items could not be deleted', { count: deletable.length - deleted }))
    // Deleted the open folder or one above it (from the tree): go to the closest folder that still exists.
    const goneIndex = crumbs.findIndex((crumb) => gone.has(itemKey({ kind: 'folder', id: crumb.id })))
    if (goneIndex >= 0) goTo(goneIndex > 0 ? crumbs[goneIndex - 1].id : null)
    reload()
  }

  /* ── Upload: chooser, drag & drop, queue ─────────────────────────────── */
  const [queue] = useState(() => createUploadQueue((item, onProgress, signal) => fileManagerService.uploadFiles(item.folderId, [item.file], { onProgress, signal })))
  const fileInput = useRef<HTMLInputElement | null>(null)
  const uploadTarget = useRef<PickedFolder | null>(null)

  useEffect(() => queue.onEvent((event) => {
    // Counts of folders change too, so any finished upload refreshes the listing (debounced).
    if (event.type === 'done') scheduleReload()
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
  }), [queue, scheduleReload, showToast, t])

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

  function droppedFiles(dataTransfer: DataTransfer) {
    const entries = Array.from(dataTransfer.items ?? [])
    const skipped = entries.filter((entry) => entry.kind === 'file' && entry.webkitGetAsEntry?.()?.isDirectory).length
    const files = Array.from(dataTransfer.files).filter((_, index) => !entries[index]?.webkitGetAsEntry?.()?.isDirectory)
    if (skipped) showToast({ title: t('files.upload.folders_skipped', 'Folders cannot be dropped — open them and drop the files inside'), tone: 'info' })
    return files
  }

  /* ── Drag & drop: items onto folders (move), files from the computer (upload) ─ */
  const [dragging, setDragging] = useState<{ items: FmItem[]; keys: ReadonlySet<string> } | null>(null)
  const [dropHover, setDropHover] = useState<string | null>(null)
  const [osDrag, setOsDrag] = useState(false)
  const osDepth = useRef(0)

  useEffect(() => {
    const reset = () => {
      osDepth.current = 0
      setOsDrag(false)
      setDropHover(null)
    }
    window.addEventListener('drop', reset)
    window.addEventListener('dragend', reset)
    return () => {
      window.removeEventListener('drop', reset)
      window.removeEventListener('dragend', reset)
    }
  }, [])

  function dropMode(dataTransfer: DataTransfer, target: DropTarget): 'move' | 'upload' | null {
    if (dragIsInternal(dataTransfer)) {
      if (!canEdit || !dragging) return null
      const folderIds = dragging.items.filter((item) => item.kind === 'folder').map((item) => item.id)
      if (target.id !== null && (folderIds.includes(target.id) || target.ancestors.some((id) => folderIds.includes(id)))) return null
      const parents = parentsOf(dragging.items)
      if (parents.length && parents.every((parent) => parent === target.id)) return null
      return 'move'
    }
    if (dragHasFiles(dataTransfer)) return canCreate && target.id !== null ? 'upload' : null
    return null
  }

  function getDropProps(target: DropTarget): DropHandlers | null {
    if (!canEdit && !canCreate) return null
    const key = dropKey(target.id)
    return {
      onDragOver: (event) => {
        const mode = dropMode(event.dataTransfer, target)
        if (!mode) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = mode === 'move' ? 'move' : 'copy'
        if (dropHover !== key) setDropHover(key)
      },
      onDragLeave: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropHover((current) => (current === key ? null : current))
      },
      onDrop: (event) => {
        const mode = dropMode(event.dataTransfer, target)
        if (!mode) return
        event.preventDefault()
        event.stopPropagation()
        setDropHover(null)
        osDepth.current = 0
        setOsDrag(false)
        if (mode === 'move' && dragging) void moveItems(dragging.items, { id: target.id, name: target.name })
        else if (mode === 'upload') enqueue(droppedFiles(event.dataTransfer), { id: target.id, name: target.name })
        setDragging(null)
      },
    }
  }

  function onDragItems(event: DragEvent<HTMLElement>, item: FmItem) {
    const key = itemKey(item)
    const group = (selectedKeys.has(key) ? selectedItems : [item]).filter((entry) => !isLocked(entry))
    if (!canEdit || !group.length) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_TYPE, group.map(itemKey).join(','))
    // A small "3 items" label follows the pointer instead of a picture of the whole tile.
    const ghost = document.createElement('div')
    ghost.className = 'fx-ghost'
    ghost.setAttribute('data-i18n-skip', 'true')
    ghost.textContent = group.length === 1 ? group[0].name : t('files.items_count', '{{count}} items', { count: group.length })
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(ghost, 16, 16)
    window.setTimeout(() => ghost.remove(), 0)
    if (!selectedKeys.has(key)) selectOnly(item)
    setDragging({ items: group, keys: new Set(group.map(itemKey)) })
  }

  const onDragEnd = useCallback(() => {
    setDragging(null)
    setDropHover(null)
  }, [])

  const paneDrop = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      if (!canCreate || !dragHasFiles(event.dataTransfer) || dragIsInternal(event.dataTransfer)) return
      event.preventDefault()
      osDepth.current += 1
      setOsDrag(true)
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!canCreate || !dragHasFiles(event.dataTransfer) || dragIsInternal(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      if (dropHover) setDropHover(null)
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!canCreate || !dragHasFiles(event.dataTransfer)) return
      osDepth.current = Math.max(0, osDepth.current - 1)
      if (osDepth.current === 0) setOsDrag(false)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!canCreate || !dragHasFiles(event.dataTransfer) || dragIsInternal(event.dataTransfer)) return
      event.preventDefault()
      osDepth.current = 0
      setOsDrag(false)
      const files = droppedFiles(event.dataTransfer)
      if (!files.length) return
      if (currentFolder) enqueue(files, currentFolder)
      else setDialog({ type: 'upload-target', files })
    },
  }

  /* ── Properties / details pane ───────────────────────────────────────── */
  const listingSummary = { folders: visibleFolders.length, files: browse ? totalFiles : visibleFiles.length, filesSize: totalSize(visibleFiles) }

  function subjectOf(targets: FmItem[]): PaneSubject {
    if (targets.length === 1) {
      const item = targets[0]
      return {
        glyphs: [{ kind: kindOf(item), extension: item.kind === 'file' ? item.extension : '', system: item.system, filled: item.kind === 'folder' && ((item.fileCount ?? 0) + (item.folderCount ?? 0) > 0) }],
        name: item.name,
        subtitle: [typeLabel(item, t), item.kind === 'file' ? formatBytes(item.size) : ''].filter(Boolean).join(' · '),
      }
    }
    if (targets.length > 1) {
      const files = targets.filter((item) => item.kind === 'file').length
      const size = totalSize(targets)
      return {
        glyphs: targets.slice(0, 3).map((item) => ({ kind: kindOf(item), extension: item.kind === 'file' ? item.extension : '', system: false, filled: item.kind === 'folder' })),
        name: t('files.selected_count', '{{count}} selected', { count: targets.length }),
        subtitle: [t('files.props.counts', 'Files: {{files}}, folders: {{folders}}', { files, folders: targets.length - files }), size !== null ? formatBytes(size) : ''].filter(Boolean).join(' · '),
      }
    }
    return {
      glyphs: [{ kind: 'folder', extension: '', system: currentSystem, filled: items.length > 0 }],
      name: currentFolder?.name ?? rootLabel,
      subtitle: t('files.items_count', '{{count}} items', { count: listingSummary.folders + listingSummary.files }),
    }
  }

  function rowsOf(targets: FmItem[], detailed: boolean): PropertyRow[] {
    const ctx = { t, locale, location: locationText, detailed }
    if (targets.length) return itemRows(targets, ctx)
    const parentLocation = globalSearch ? null : [rootLabel, ...crumbs.slice(0, -1).map((crumb) => crumb.name)].join(' / ')
    return folderRows(browse?.folder ?? null, listingSummary, { ...ctx, location: folderId ? parentLocation : null })
  }

  function openProperties(targets: FmItem[]) {
    setDialog({ type: 'properties', subject: subjectOf(targets), rows: rowsOf(targets, true) })
  }

  function openTreeProperties(folder: FmFolder | null) {
    if (!folder) {
      openProperties([])
      return
    }
    setDialog({ type: 'properties', subject: subjectOf([folder]), rows: itemRows([folder], { t, locale, location: null, detailed: true }) })
  }

  /* ── Menus ───────────────────────────────────────────────────────────── */
  function openMenu(kind: MenuKind, anchor: MenuAnchor, options: { trigger?: HTMLElement | null; focusFirst?: boolean; openKey?: string } = {}) {
    setMenu({ ...kind, anchor, trigger: options.trigger ?? null, focusFirst: options.focusFirst ?? false, openKey: options.openKey ?? kind.type, context })
  }

  function toggleCommandMenu(id: 'new' | 'sort' | 'view' | 'filter' | 'more', element: HTMLElement) {
    if (menu?.type === 'command' && menu.id === id) {
      setMenu(null)
      return
    }
    openMenu({ type: 'command', id }, { rect: element.getBoundingClientRect(), align: id === 'more' ? 'end' : 'start' }, { trigger: element, openKey: id })
  }

  const viewEntries = (): MenuEntry[] => [
    { id: 'view-large', label: t('files.view.large', 'Large icons'), check: 'radio', checked: view === 'large', icon: (<SquaresFourIcon size={16} />), onSelect: () => setView('large') },
    { id: 'view-medium', label: t('files.view.medium', 'Medium icons'), check: 'radio', checked: view === 'medium', icon: (<SquaresFourIcon size={16} />), onSelect: () => setView('medium') },
    { id: 'view-details', label: t('files.view.details', 'Details'), check: 'radio', checked: view === 'details', icon: (<ListIcon size={16} />), onSelect: () => setView('details') },
    { kind: 'separator', id: 'view-sep' },
    { id: 'view-checks', label: t('files.view.checkboxes', 'Item check boxes'), check: 'check', checked: prefs.checkboxes, icon: (<CheckSquareIcon size={16} />), onSelect: () => updatePrefs({ checkboxes: !prefs.checkboxes }) },
    { id: 'view-pane', label: t('files.details.pane', 'Details pane'), check: 'check', checked: detailsOpen, icon: (<SidebarSimpleIcon size={16} mirrored />), onSelect: toggleDetails },
  ]

  const sortEntries = (): MenuEntry[] => [
    ...([
      ['name', t('files.column.name', 'Name')],
      ['modified', t('files.column.modified_long', 'Date modified')],
      ['type', t('files.column.type', 'Type')],
      ['size', t('files.column.size', 'Size')],
    ] as const).map(([key, label]): MenuEntry => ({ id: `sort-${key}`, label, check: 'radio', checked: sort.key === key, onSelect: () => setSort(key, sort.key === key ? sort.dir : undefined) })),
    { kind: 'separator', id: 'sort-sep' },
    { id: 'sort-asc', label: t('files.sort.asc', 'Ascending'), check: 'radio', checked: sort.dir === 'asc', icon: (<SortAscendingIcon size={16} />), onSelect: () => setSort(sort.key, 'asc') },
    { id: 'sort-desc', label: t('files.sort.desc', 'Descending'), check: 'radio', checked: sort.dir === 'desc', icon: (<SortDescendingIcon size={16} />), onSelect: () => setSort(sort.key, 'desc') },
  ]

  const newDisabledHint = !canCreate ? noPermission : globalSearch ? t('files.new.search_hint', 'Close the search to create a folder') : undefined
  const newEntries = (): MenuEntry[] => [
    { id: 'new-folder', label: t('files.new.folder', 'Folder'), icon: (<FolderPlusIcon size={16} />), disabled: !canCreate || globalSearch, hint: newDisabledHint, onSelect: () => void newFolder() },
    { id: 'new-upload', label: t('files.upload.files', 'Upload files…'), icon: (<UploadSimpleIcon size={16} />), disabled: !canCreate, hint: canCreate ? undefined : noPermission, onSelect: chooseFiles },
  ]

  const extensionOptions = useMemo(() => {
    const seen = new Set<string>([...COMMON_EXTENSIONS, ...visibleFiles.map((file) => file.extension).filter(Boolean)])
    if (extension) seen.add(extension)
    return [...seen].sort()
  }, [extension, visibleFiles])
  const sourceOptions = useMemo(() => {
    const values = new Set(knownSources)
    if (source) values.add(source)
    return [...values].sort()
  }, [knownSources, source])

  const filterEntries = (): MenuEntry[] => [
    {
      kind: 'submenu',
      id: 'filter-type',
      label: t('files.filter.type', 'File type'),
      icon: (<FolderSimpleIcon size={16} />),
      entries: [
        { id: 'type-all', label: t('files.filter.all_types', 'All types'), check: 'radio', checked: !extension, onSelect: () => updateParams({ ext: null, page: null }) },
        { kind: 'separator', id: 'type-sep' },
        ...extensionOptions.map((value): MenuEntry => ({ id: `type-${value}`, label: `.${value}`, check: 'radio', checked: extension === value, onSelect: () => updateParams({ ext: value, page: null }) })),
      ],
    },
    {
      kind: 'submenu',
      id: 'filter-source',
      label: t('files.filter.source', 'Source'),
      icon: (<FunnelIcon size={16} />),
      disabled: sourceOptions.length === 0,
      entries: [
        { id: 'source-all', label: t('files.filter.all_sources', 'All sources'), check: 'radio', checked: !source, onSelect: () => updateParams({ source: null, page: null }) },
        { kind: 'separator', id: 'source-sep' },
        ...sourceOptions.map((value): MenuEntry => ({ id: `source-${value}`, label: sourceLabel(value, t), check: 'radio', checked: source === value, onSelect: () => updateParams({ source: value, page: null }) })),
      ],
    },
    { kind: 'separator', id: 'filter-sep' },
    { id: 'filter-clear', label: t('files.filter.clear', 'Clear filters'), icon: (<FunnelXIcon size={16} />), disabled: !extension && !source, onSelect: () => updateParams({ ext: null, source: null, page: null }) },
  ]

  function itemEntries(targets: FmItem[], origin: 'pane' | 'tree'): MenuEntry[] {
    const one = targets.length === 1 ? targets[0] : null
    const locked = targets.some(isLocked)
    const editHint = !canEdit ? noPermission : locked ? lockedHint : undefined
    const deleteHint = !canDelete ? noPermission : locked ? lockedHint : undefined
    const entries: MenuEntry[] = []
    if (one?.kind === 'folder') {
      entries.push({ id: 'open', label: t('files.open', 'Open'), strong: true, shortcut: origin === 'pane' ? 'Enter' : undefined, icon: (<FolderOpenIcon size={16} />), onSelect: () => goTo(one.id) })
    } else if (one?.kind === 'file') {
      entries.push({ id: 'preview', label: t('files.preview', 'Preview'), strong: true, shortcut: 'Enter', icon: (<EyeIcon size={16} />), onSelect: () => setPreview(one) })
      entries.push({ id: 'download', label: t('files.download', 'Download'), icon: (<DownloadSimpleIcon size={16} />), onSelect: () => void download(one) })
    }
    if (one && globalSearch) {
      const parent = one.kind === 'folder' ? one.parentId : one.folderId
      entries.push({ id: 'locate', label: t('files.show_in_folder', 'Show in folder'), icon: (<FolderSimpleIcon size={16} />), onSelect: () => goTo(parent) })
    }
    entries.push({ kind: 'separator', id: 'sep-zip' })
    entries.push({
      id: 'zip',
      label: t('files.zip.folder', 'Download as ZIP'),
      icon: (<FileArchiveIcon size={16} />),
      disabled: !canExport,
      hint: canExport ? undefined : noPermission,
      onSelect: () => void downloadZip(targets, zipBase(targets)),
    })
    entries.push({ kind: 'separator', id: 'sep-edit' })
    if (origin === 'pane') {
      entries.push({ id: 'cut', label: t('files.cut', 'Cut'), shortcut: KEYS.mod('X'), icon: (<ScissorsIcon size={16} />), disabled: !canEdit || locked || globalSearch, hint: editHint, onSelect: () => cut(targets) })
    }
    entries.push({
      id: 'rename',
      label: t('files.rename', 'Rename'),
      shortcut: origin === 'pane' ? 'F2' : undefined,
      icon: (<PencilSimpleIcon size={16} />),
      disabled: !canEdit || locked || !one,
      hint: editHint,
      onSelect: () => {
        if (!one) return
        if (origin === 'tree') setDialog({ type: 'rename', item: one })
        else startRename(one)
      },
    })
    entries.push({ id: 'move', label: t('files.move_to', 'Move to…'), icon: (<ArrowsOutCardinalIcon size={16} />), disabled: !canEdit || locked, hint: editHint, onSelect: () => openMove(targets) })
    entries.push({ id: 'delete', label: t('files.delete', 'Delete'), shortcut: origin === 'pane' ? KEYS.del : undefined, danger: true, icon: (<TrashIcon size={16} />), disabled: !canDelete || locked, hint: deleteHint, onSelect: () => void deleteItems(targets) })
    entries.push({ kind: 'separator', id: 'sep-props' })
    entries.push({ id: 'props', label: t('files.props.title', 'Properties'), shortcut: KEYS.alt('Enter'), icon: (<InfoIcon size={16} />), onSelect: () => (origin === 'tree' && one?.kind === 'folder' ? openTreeProperties(one) : openProperties(targets)) })
    return entries
  }

  function emptyEntries(): MenuEntry[] {
    return [
      { kind: 'submenu', id: 'view', label: t('files.view.label', 'View'), icon: (<SquaresFourIcon size={16} />), entries: viewEntries() },
      { kind: 'submenu', id: 'sort', label: t('files.sort.by', 'Sort by'), icon: (<ArrowsDownUpIcon size={16} />), entries: sortEntries() },
      { id: 'refresh', label: t('files.refresh', 'Refresh'), shortcut: 'F5', icon: (<ArrowClockwiseIcon size={16} />), onSelect: reload },
      { kind: 'separator', id: 'sep-paste' },
      { id: 'paste', label: clipboard ? t('files.paste_count', 'Paste {{count}} items', { count: clipboard.items.length }) : t('files.paste', 'Paste'), shortcut: KEYS.mod('V'), icon: (<ClipboardTextIcon size={16} />), disabled: pasteBlocked, onSelect: paste },
      { kind: 'separator', id: 'sep-new' },
      { kind: 'submenu', id: 'new', label: t('files.new', 'New'), icon: (<PlusIcon size={16} />), disabled: !canCreate, entries: newEntries() },
      { id: 'upload', label: t('files.upload.files', 'Upload files…'), icon: (<UploadSimpleIcon size={16} />), disabled: !canCreate, hint: canCreate ? undefined : noPermission, onSelect: chooseFiles },
      { kind: 'separator', id: 'sep-select' },
      { id: 'select-all', label: t('files.select_all', 'Select all'), shortcut: KEYS.mod('A'), icon: (<SelectionAllIcon size={16} />), disabled: !items.length, onSelect: selectAll },
      { kind: 'separator', id: 'sep-props' },
      { id: 'props', label: t('files.props.title', 'Properties'), shortcut: KEYS.alt('Enter'), icon: (<InfoIcon size={16} />), onSelect: () => openProperties([]) },
    ]
  }

  function treeEntries(folder: FmFolder | null): MenuEntry[] {
    if (folder) return itemEntries([folder], 'tree')
    return [
      { id: 'open', label: t('files.open', 'Open'), strong: true, icon: (<HouseIcon size={16} />), onSelect: () => goTo(null) },
      { id: 'refresh', label: t('files.refresh', 'Refresh'), icon: (<ArrowClockwiseIcon size={16} />), onSelect: reload },
      { kind: 'separator', id: 'sep' },
      { id: 'props', label: t('files.props.title', 'Properties'), icon: (<InfoIcon size={16} />), onSelect: () => openTreeProperties(null) },
    ]
  }

  function crumbEntries(id: string | null): MenuEntry[] {
    const key = id ?? ROOT_KEY
    const children = tree.childrenOf(key)
    if (!children) {
      return [{ id: 'loading', label: tree.hasFailed(key) ? t('files.picker.failed', 'Could not load folders') : t('files.loading', 'Loading…'), disabled: true, onSelect: () => undefined }]
    }
    if (!children.length) return [{ id: 'none', label: t('files.picker.no_subfolders', 'No folders inside'), disabled: true, onSelect: () => undefined }]
    return children.map((folder): MenuEntry => ({
      id: folder.id,
      label: folder.name,
      strong: folder.id === folderId || ancestors.includes(folder.id),
      icon: (<ItemGlyph kind="folder" size={18} filled={(folder.fileCount ?? 0) > 0} />),
      onSelect: () => goTo(folder.id),
    }))
  }

  function moreEntries(): MenuEntry[] {
    const targets = selectedItems
    const entries: MenuEntry[] = [
      { kind: 'submenu', id: 'new', label: t('files.new', 'New'), icon: (<PlusIcon size={16} />), disabled: !canCreate, entries: newEntries() },
    ]
    if (targets.length) {
      entries.push({ kind: 'separator', id: 'sep-sel' }, { kind: 'label', id: 'sel-label', label: t('files.selected_count', '{{count}} selected', { count: targets.length }) })
      entries.push(...itemEntries(targets, 'pane').filter((entry) => entry.kind !== 'separator'))
    }
    entries.push(
      { kind: 'separator', id: 'sep-view' },
      { kind: 'submenu', id: 'view', label: t('files.view.label', 'View'), icon: (<SquaresFourIcon size={16} />), entries: viewEntries() },
      { kind: 'submenu', id: 'sort', label: t('files.sort.by', 'Sort by'), icon: (<ArrowsDownUpIcon size={16} />), entries: sortEntries() },
      { kind: 'submenu', id: 'filter', label: t('files.filter.label', 'Filter'), icon: (<FunnelIcon size={16} />), entries: filterEntries() },
      { kind: 'separator', id: 'sep-more' },
      { id: 'more-paste', label: t('files.paste', 'Paste'), icon: (<ClipboardTextIcon size={16} />), disabled: pasteBlocked, onSelect: paste },
      { id: 'more-select-all', label: t('files.select_all', 'Select all'), icon: (<SelectionAllIcon size={16} />), disabled: !items.length, onSelect: selectAll },
      { id: 'more-refresh', label: t('files.refresh', 'Refresh'), icon: (<ArrowClockwiseIcon size={16} />), onSelect: reload },
    )
    // With a selection its own "Properties" is already in the list above.
    if (!targets.length) entries.push({ id: 'more-props', label: t('files.props.title', 'Properties'), icon: (<InfoIcon size={16} />), onSelect: () => openProperties([]) })
    return entries
  }

  function menuContent(state: MenuState): { entries: MenuEntry[]; label: string; title?: string } {
    switch (state.type) {
      case 'empty': return { entries: emptyEntries(), label: currentFolder?.name ?? rootLabel }
      case 'items': return {
        entries: itemEntries(state.items, 'pane'),
        label: state.items.length === 1 ? state.items[0].name : t('files.selected_count', '{{count}} selected', { count: state.items.length }),
      }
      case 'tree': return { entries: treeEntries(state.folder), label: state.folder?.name ?? rootLabel }
      case 'crumb': return { entries: crumbEntries(state.id), label: t('files.address.subfolders_short', 'Folders inside') }
      case 'overflow': return {
        entries: [...state.crumbs].reverse().map((crumb): MenuEntry => ({ id: crumb.id, label: crumb.name, icon: (<ItemGlyph kind="folder" size={18} />), onSelect: () => goTo(crumb.id) })),
        label: t('files.breadcrumbs', 'Folder path'),
      }
      case 'command':
        if (state.id === 'new') return { entries: newEntries(), label: t('files.new', 'New') }
        if (state.id === 'sort') return { entries: sortEntries(), label: t('files.sort.by', 'Sort by') }
        if (state.id === 'view') return { entries: viewEntries(), label: t('files.view.label', 'View') }
        if (state.id === 'filter') return { entries: filterEntries(), label: t('files.filter.label', 'Filter') }
        return { entries: moreEntries(), label: t('files.more', 'More') }
    }
  }

  function onItemMenu(item: FmItem, anchor: MenuAnchor, fromKeyboard: boolean) {
    const key = itemKey(item)
    const targets = selectedKeys.has(key) ? selectedItems : [item]
    openMenu({ type: 'items', items: targets }, anchor, { focusFirst: fromKeyboard, openKey: `item:${key}` })
  }

  function onEmptyMenu(anchor: MenuAnchor) {
    openMenu({ type: 'empty' }, anchor)
  }

  function onTreeMenu(folder: FmFolder | null, _ancestors: string[], anchor: MenuAnchor, fromKeyboard: boolean) {
    openMenu({ type: 'tree', folder, ancestors: _ancestors }, anchor, { focusFirst: fromKeyboard })
  }

  function onCrumbMenu(id: string | null, element: HTMLElement) {
    const openKey = `crumb:${dropKey(id)}`
    if (menu?.openKey === openKey) {
      setMenu(null)
      return
    }
    tree.request(id ?? ROOT_KEY)
    openMenu({ type: 'crumb', id }, { rect: element.getBoundingClientRect(), align: 'start' }, { trigger: element, openKey })
  }

  /* ── Keyboard shortcuts (while the explorer has the focus) ───────────── */
  const hasOverlay = Boolean(dialog || menu || preview)
  function handleKey(event: KeyboardEvent) {
    if (!canView || hasOverlay || event.defaultPrevented) return
    const root = rootRef.current
    const active = document.activeElement
    if (active && active !== document.body && !(root?.contains(active) ?? false)) return
    const mod = event.ctrlKey || event.metaKey
    const key = event.key
    const lower = key.toLowerCase()
    if (mod && !event.altKey && lower === 'f') {
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }
    if (isTyping(event.target)) return
    const run = (action: () => void) => {
      event.preventDefault()
      action()
    }
    if (event.altKey && key === 'ArrowLeft') return nav.canBack ? run(nav.back) : undefined
    if (event.altKey && key === 'ArrowRight') return nav.canForward ? run(nav.forward) : undefined
    if ((event.altKey && key === 'ArrowUp') || (key === 'Backspace' && !mod)) return canUp ? run(goUp) : undefined
    if (key === 'F5' && !mod) return run(reload)
    if (event.altKey && key === 'Enter') return run(() => openProperties(selectedItems))
    if (key === 'F2' && single) return run(() => startRename(single))
    if ((key === 'Delete' || (MAC && event.metaKey && key === 'Backspace')) && selectedItems.length) return run(() => void deleteItems(selectedItems))
    if (mod && lower === 'a') return run(selectAll)
    if (mod && lower === 'x' && selectedItems.length) return run(() => cut(selectedItems))
    if (mod && lower === 'v' && clipboard) return run(paste)
    if (key === 'Escape') {
      if (selectedItems.length) return run(clearSelection)
      if (clipboard) return run(() => setClipboard(null))
      return
    }
    if (key === 'Enter' && single && !(event.target instanceof HTMLElement && event.target.closest('[data-key]'))) return run(() => openItem(single))
    if ((key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) && !(event.target instanceof HTMLElement && event.target.closest('[data-key], [role="tree"]'))) {
      const rect = root?.querySelector('.fx-pane-scroll')?.getBoundingClientRect()
      if (rect) run(() => openMenu({ type: 'empty' }, { x: rect.left + 24, y: rect.top + 24 }, { focusFirst: true }))
    }
  }
  const keyHandler = useRef(handleKey)
  useEffect(() => {
    keyHandler.current = handleKey
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyHandler.current(event)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── Tree width (drag the splitter) ──────────────────────────────────── */
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const root = rootRef.current
    if (!root || event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startWidth = prefs.treeWidth
    let width = startWidth
    root.dataset.resizing = 'true'
    const onMove = (move: PointerEvent) => {
      width = clampTreeWidth(startWidth + move.clientX - startX)
      root.style.setProperty('--fx-tree-w', `${width}px`)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      delete root.dataset.resizing
      updatePrefs({ treeWidth: width })
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  const forbidden = !canView || error?.status === 403
  if (forbidden) {
    return (
      <section className="fx-root fx-root--state" data-i18n-skip="true">
        <h1 className="sr-only">{t('files.title', 'Files')}</h1>
        <StateCard
          icon={<LockSimpleIcon size={28} weight="duotone" />}
          title={t('files.forbidden.title', 'No access to files')}
          text={t('files.forbidden.text', 'The file manager is available to the CEO only. Ask an administrator if you need access.')}
        />
      </section>
    )
  }

  const missing = error?.status === 404 && !globalSearch
  const showSkeleton = !error && !shown
  const lockedSelected = selectedItems.some(isLocked)
  const anySelected = selectedItems.length > 0
  const cutKeys = clipboard && clipboard.from === folderId && !globalSearch ? clipboard.keys : EMPTY

  const commandGroups: Command[][] = [
    [
      {
        id: 'new',
        label: t('files.new', 'New'),
        icon: <PlusIcon size={16} weight="bold" />,
        dropdown: true,
        tone: 'primary',
        text: 'always',
        disabled: !canCreate,
        title: canCreate ? t('files.new', 'New') : noPermission,
        onRun: (element) => toggleCommandMenu('new', element),
      },
    ],
    [
      { id: 'cut', label: t('files.cut', 'Cut'), title: `${t('files.cut', 'Cut')} (${KEYS.mod('X')})`, icon: <ScissorsIcon size={17} />, text: 'never', collapse: true, disabled: !canEdit || !anySelected || lockedSelected || globalSearch, onRun: () => cut(selectedItems) },
      { id: 'paste', label: t('files.paste', 'Paste'), title: `${t('files.paste', 'Paste')} (${KEYS.mod('V')})`, icon: <ClipboardTextIcon size={17} />, text: 'never', collapse: true, disabled: pasteBlocked, onRun: paste },
      { id: 'rename', label: t('files.rename', 'Rename'), title: `${t('files.rename', 'Rename')} (F2)`, icon: <PencilSimpleIcon size={17} />, text: 'never', collapse: true, disabled: !canEdit || !single || lockedSelected, onRun: () => single && startRename(single) },
      { id: 'move', label: t('files.move_to', 'Move to…'), icon: <ArrowsOutCardinalIcon size={17} />, text: 'never', collapse: true, disabled: !canEdit || !anySelected || lockedSelected, onRun: () => openMove(selectedItems) },
      { id: 'delete', label: t('files.delete', 'Delete'), title: `${t('files.delete', 'Delete')} (${KEYS.del})`, icon: <TrashIcon size={17} />, text: 'never', collapse: true, tone: 'danger', disabled: !canDelete || !anySelected || lockedSelected, onRun: () => void deleteItems(selectedItems) },
    ],
    [
      { id: 'download', label: t('files.download', 'Download'), icon: <DownloadSimpleIcon size={17} />, collapse: true, disabled: single?.kind !== 'file', onRun: () => single?.kind === 'file' && void download(single) },
      { id: 'zip', label: t('files.zip.short', 'ZIP'), title: t('files.zip.download', 'Download ZIP'), icon: <FileArchiveIcon size={17} />, collapse: true, disabled: !canExport || !anySelected || zipping, onRun: () => void downloadZip(selectedItems, zipBase(selectedItems)) },
    ],
    [
      { id: 'sort', label: t('files.sort.label', 'Sort'), icon: <ArrowsDownUpIcon size={17} />, dropdown: true, collapse: true, onRun: (element) => toggleCommandMenu('sort', element) },
      { id: 'view', label: t('files.view.label', 'View'), icon: view === 'details' ? <ListIcon size={17} /> : <SquaresFourIcon size={17} />, dropdown: true, collapse: true, onRun: (element) => toggleCommandMenu('view', element) },
      { id: 'filter', label: t('files.filter.label', 'Filter'), icon: <FunnelIcon size={17} weight={extension || source ? 'fill' : 'regular'} />, dropdown: true, collapse: true, pressed: Boolean(extension || source), badge: (extension ? 1 : 0) + (source ? 1 : 0), onRun: (element) => toggleCommandMenu('filter', element) },
    ],
  ]
  const trailing: Command[] = [
    { id: 'more', label: t('files.more', 'More'), icon: <DotsThreeIcon size={18} weight="bold" />, text: 'never', dropdown: false, onRun: (element) => toggleCommandMenu('more', element) },
    { id: 'details', label: t('files.details.title', 'Details'), title: t('files.details.pane', 'Details pane'), icon: <SidebarSimpleIcon size={17} mirrored />, pressed: detailsOpen, onRun: toggleDetails },
  ]
  const openCommand = menu?.type === 'command' ? menu.id : null

  const paneTargets = selectedItems
  const paneActions: PaneAction[] = []
  if (single?.kind === 'file') {
    paneActions.push({ id: 'preview', label: t('files.preview', 'Preview'), icon: <EyeIcon size={16} />, onRun: () => setPreview(single) })
    paneActions.push({ id: 'download', label: t('files.download', 'Download'), icon: <DownloadSimpleIcon size={16} />, busy: busyKeys.has(itemKey(single)), onRun: () => void download(single) })
  } else if (single?.kind === 'folder') {
    paneActions.push({ id: 'open', label: t('files.open', 'Open'), icon: <FolderOpenIcon size={16} />, onRun: () => goTo(single.id) })
  }
  if (paneTargets.length) {
    if (canExport && (paneTargets.length > 1 || single?.kind === 'folder')) paneActions.push({ id: 'zip', label: t('files.zip.short', 'ZIP'), icon: <FileArchiveIcon size={16} />, busy: zipping, onRun: () => void downloadZip(paneTargets, zipBase(paneTargets)) })
    if (canEdit && single && !lockedSelected) paneActions.push({ id: 'rename', label: t('files.rename', 'Rename'), icon: <PencilSimpleIcon size={16} />, onRun: () => startRename(single) })
    if (canEdit && !lockedSelected) paneActions.push({ id: 'move', label: t('files.move', 'Move'), icon: <ArrowsOutCardinalIcon size={16} />, onRun: () => openMove(paneTargets) })
    if (canDelete && !lockedSelected) paneActions.push({ id: 'delete', label: t('files.delete', 'Delete'), icon: <TrashIcon size={16} />, danger: true, onRun: () => void deleteItems(paneTargets) })
  } else if (!globalSearch) {
    if (canCreate) paneActions.push({ id: 'new-folder', label: t('files.new.folder', 'Folder'), icon: <FolderPlusIcon size={16} />, onRun: () => void newFolder() })
    if (canCreate) paneActions.push({ id: 'upload', label: t('files.upload', 'Upload'), icon: <UploadSimpleIcon size={16} />, onRun: chooseFiles })
  }

  const searchPlaceholder = globalSearch || scope === 'all'
    ? t('files.search.placeholder_all', 'Search all files and folders')
    : currentFolder && currentFolder.name === '…'
      ? t('files.search.placeholder', 'Search in this folder')
      : t('files.search.placeholder_in', 'Search in “{{folder}}”', { folder: currentFolder?.name ?? rootLabel })

  /* Banner over the items: search scope, active filters, system folder note. */
  const filterChips = [
    extension ? { id: 'ext', label: t('files.filter.chip_type', 'Type: .{{ext}}', { ext: extension }), clear: () => updateParams({ ext: null, page: null }) } : null,
    source ? { id: 'source', label: t('files.filter.chip_source', 'Source: {{source}}', { source: sourceLabel(source, t) }), clear: () => updateParams({ source: null, page: null }) } : null,
  ].filter((chip): chip is { id: string; label: string; clear: () => void } => chip !== null)
  const banner = (query || filterChips.length || (currentSystem && !globalSearch)) && !error ? (
    <div className="fx-banner" data-no-marquee="">
      {query ? (
        <>
          <MagnifyingGlassIcon size={15} weight="bold" className="shrink-0 text-[var(--primary)]" />
          <span className="fx-banner__text">
            {t('files.search.results_for', 'Results for “{{query}}”', { query })}
            {shown ? <span className="fx-banner__muted"> · {t('files.items_count', '{{count}} items', { count: items.length })}</span> : null}
          </span>
          <div role="radiogroup" aria-label={t('files.scope.label', 'Where to search')} className="fx-seg">
            {([
              ['folder', currentFolder ? t('files.scope.here', 'This folder') : rootLabel, <FolderSimpleIcon key="i" size={13} weight="bold" />],
              ['all', t('files.scope.everywhere', 'Everywhere'), <GlobeIcon key="i" size={13} weight="bold" />],
            ] as const).map(([value, label, glyph]) => (
              <button key={value} type="button" role="radio" aria-checked={scope === value} className="fx-seg__btn" onClick={() => updateParams({ scope: value === 'all' ? 'all' : null, page: null }, true)}>
                {glyph}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {filterChips.map((chip) => (
        <button key={chip.id} type="button" className="fx-chip" onClick={chip.clear} title={t('files.filter.remove', 'Remove this filter')}>
          <span>{chip.label}</span>
          <XIcon size={11} weight="bold" />
        </button>
      ))}
      {currentSystem && !globalSearch && !query && !filterChips.length ? (
        <>
          <LockSimpleIcon size={14} weight="bold" className="shrink-0 text-[var(--muted-strong)]" />
          <span className="fx-banner__text fx-banner__muted">{t('files.system_note', 'System folder — it is filled automatically and cannot be renamed, moved or deleted.')}</span>
        </>
      ) : null}
      {query || filterChips.length ? (
        <button type="button" className="fx-banner__clear" onClick={() => { setDraft(''); updateParams({ q: null, scope: null, ext: null, source: null, page: null }, true) }}>
          {t('files.filter.clear_all', 'Clear')}
        </button>
      ) : null}
    </div>
  ) : null

  let emptyState: ReactNode = null
  if (missing) {
    emptyState = (
      <StateCard
        icon={<FolderSimpleIcon size={28} weight="duotone" />}
        title={t('files.missing.title', 'This folder does not exist')}
        text={t('files.missing.text', 'It may have been moved or deleted.')}
        action={<Button leftIcon={<HouseIcon size={15} weight="bold" />} onClick={() => goTo(null)}>{t('files.missing.back', 'Back to all files')}</Button>}
      />
    )
  } else if (error) {
    emptyState = (
      <StateCard
        tone="error"
        icon={<WarningCircleIcon size={28} weight="duotone" />}
        title={t('files.load_failed', 'Could not load files')}
        text={t('files.load_failed_text', 'Check the connection and try again.')}
        action={<Button leftIcon={<ArrowClockwiseIcon size={15} weight="bold" />} onClick={reload}>{t('files.retry', 'Try again')}</Button>}
      />
    )
  } else if (showSkeleton) {
    emptyState = <LoadingSkeleton view={view} />
  } else if (filtersActive) {
    emptyState = (
      <StateCard
        icon={<MagnifyingGlassIcon size={28} weight="duotone" />}
        title={globalSearch ? t('files.empty.search_title', 'Nothing found for “{{query}}”', { query }) : t('files.empty.filtered_title', 'Nothing matches the filters')}
        text={globalSearch ? t('files.empty.search_text', 'Try another word or remove the type filter.') : t('files.empty.filtered_text', 'Try another search, or search everywhere.')}
        action={(
          <div className="flex flex-wrap justify-center gap-2">
            {!globalSearch && query ? (
              <Button variant="secondary" leftIcon={<GlobeIcon size={15} weight="bold" />} onClick={() => updateParams({ scope: 'all', page: null }, true)}>
                {t('files.scope.search_everywhere', 'Search everywhere')}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => { setDraft(''); updateParams({ q: null, scope: null, ext: null, source: null, page: null }, true) }}>
              {t('files.filter.clear', 'Clear filters')}
            </Button>
          </div>
        )}
      />
    )
  } else {
    emptyState = (
      <StateCard
        illustration
        title={folderId ? t('files.empty.folder_title', 'This folder is empty') : t('files.empty.root_title', 'No files yet')}
        text={canCreate
          ? folderId
            ? t('files.empty.folder_hint', 'Drop files here, or right-click for New folder and Upload.')
            : t('files.empty.root_text', 'Create a folder, then upload files into it.')
          : undefined}
        action={canCreate ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" leftIcon={<FolderPlusIcon size={15} weight="bold" />} onClick={() => void newFolder()}>{t('files.new_folder', 'New folder')}</Button>
            <Button leftIcon={<UploadSimpleIcon size={15} weight="bold" />} onClick={chooseFiles}>{t('files.upload', 'Upload')}</Button>
          </div>
        ) : null}
      />
    )
  }

  const pager: Pager | null = browse && pageCount > 1 && !error
    ? {
        page,
        pageCount,
        from: (page - 1) * pageSize + 1,
        to: Math.min(totalFiles, page * pageSize),
        total: totalFiles,
        onPrevious: () => updateParams({ page: page - 1 > 1 ? String(page - 1) : null }),
        onNext: () => updateParams({ page: String(page + 1) }),
      }
    : null

  const dropLabel = dropHover && dropHover !== dropKey(folderId)
    ? items.find((item) => item.kind === 'folder' && dropKey(item.id) === dropHover)?.name ?? null
    : null
  const menuData = menu ? menuContent(menu) : null
  const rootStyle = { '--fx-tree-w': `${prefs.treeWidth}px` } as CSSProperties

  return (
    // User data (file / folder names, document text) must never go through the app's DOM literal translator.
    <section
      ref={rootRef}
      className="fx-root"
      data-i18n-skip="true"
      data-details={detailsOpen || undefined}
      data-tree-drawer={treeDrawer || undefined}
      data-dragging={dragging ? 'true' : undefined}
      style={rootStyle}
    >
      <h1 className="sr-only">{t('files.title', 'Files')}</h1>

      <AddressBar
        canBack={nav.canBack}
        canForward={nav.canForward}
        canUp={canUp}
        onBack={nav.back}
        onForward={nav.forward}
        onUp={goUp}
        onRefresh={reload}
        refreshing={loading && Boolean(shown)}
        crumbs={crumbs}
        rootLabel={rootLabel}
        searchLabel={globalSearch ? t('files.search.results_for', 'Results for “{{query}}”', { query }) : null}
        onGo={goTo}
        onCrumbMenu={onCrumbMenu}
        onOverflowMenu={(hidden, element) => openMenu({ type: 'overflow', crumbs: hidden }, { rect: element.getBoundingClientRect(), align: 'start' }, { trigger: element, openKey: 'overflow' })}
        openMenuKey={menu?.type === 'crumb' ? `${dropKey(menu.id)}` : null}
        getDropProps={getDropProps}
        dropHover={dropHover}
        search={draft}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchRef={searchRef}
        onSearchExit={focusPane}
        onToggleTree={() => setTreeDrawer((value) => !value)}
      />

      <CommandBar groups={commandGroups} trailing={trailing} openMenuId={openCommand} label={t('files.commands', 'Commands')} />

      <div className="fx-body">
        {/* Navigation pane: inline on desktop, a drawer on narrow screens. */}
        {!desktop && treeDrawer ? <div className="fx-scrim" onClick={() => setTreeDrawer(false)} aria-hidden="true" /> : null}
        <div className="fx-side" aria-hidden={!desktop && !treeDrawer ? true : undefined} inert={!desktop && !treeDrawer ? true : undefined}>
          <FolderTree
            tree={tree}
            currentId={globalSearch ? undefined : folderId}
            rootLabel={rootLabel}
            dropHover={dropHover}
            getDropProps={getDropProps}
            onGo={goTo}
            onMenu={onTreeMenu}
          />
        </div>
        {desktop ? (
          <div
            className="fx-splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label={t('files.tree.resize', 'Resize the navigation pane')}
            onPointerDown={startResize}
            onDoubleClick={() => updatePrefs({ treeWidth: 236 })}
          />
        ) : null}

        <div className={cn('fx-main', osDrag && 'fx-main--drop')} {...paneDrop}>
          {loading && shown ? <div className="fx-progress" aria-hidden="true" /> : null}
          <ItemsPane
            items={showSkeleton || error ? [] : items}
            view={view}
            sort={sort}
            onSort={(key) => setSort(key)}
            showLocation={globalSearch}
            selected={selectedKeys}
            anchorKey={selection.anchor}
            focusKey={selection.focus}
            onSelect={select}
            checkboxes={prefs.checkboxes}
            cutKeys={cutKeys}
            busyKeys={busyKeys}
            draggingKeys={dragging?.keys ?? EMPTY}
            dropHover={dropHover}
            renamingKey={renamingKey}
            onRenameCommit={commitInlineRename}
            onRenameCancel={() => setRenaming(null)}
            onOpen={openItem}
            onItemMenu={onItemMenu}
            onEmptyMenu={onEmptyMenu}
            getDropProps={getDropProps}
            folderAncestors={ancestors}
            canDrag={(item) => canEdit && !isLocked(item) && !globalSearch}
            onDragItems={onDragItems}
            onDragEnd={onDragEnd}
            animateKey={context}
            ready={Boolean(shown) && !error}
            dimmed={dimmed}
            banner={banner}
            empty={emptyState}
            label={currentFolder?.name ?? rootLabel}
          />
          {osDrag ? (
            <div className="fx-dropzone" aria-hidden="true">
              <div className="fx-dropzone__card">
                <span className="fx-dropzone__icon"><CloudArrowUpIcon size={26} weight="duotone" /></span>
                <p className="fx-dropzone__title">
                  {dropLabel
                    ? t('files.drop.into', 'Upload into “{{folder}}”', { folder: dropLabel })
                    : currentFolder ? t('files.drop.title', 'Drop to upload to “{{folder}}”', { folder: currentFolder.name }) : t('files.drop.title_root', 'Drop files to upload')}
                </p>
                <p className="fx-dropzone__text">
                  {currentFolder || dropLabel ? t('files.drop.text', 'Several files at once are fine.') : t('files.drop.text_root', 'You will choose the folder next.')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {detailsOpen ? (
          <>
            {!wide ? <div className="fx-scrim fx-scrim--right" onClick={() => setDetailsOverlay(false)} aria-hidden="true" /> : null}
            <div className="fx-details-wrap">
              <DetailsPane
                subject={subjectOf(paneTargets)}
                subjectKey={paneTargets.length ? paneTargets.map(itemKey).join(',') : `folder:${folderId ?? ''}`}
                rows={rowsOf(paneTargets, false)}
                actions={paneActions}
                onClose={toggleDetails}
              />
            </div>
          </>
        ) : null}
      </div>

      <StatusBar
        itemCount={shown && !error ? visibleFolders.length + (browse ? totalFiles : visibleFiles.length) : null}
        selectedCount={selectedItems.length}
        selectedSize={totalSize(selectedItems) || null}
        loading={loading}
        pager={pager}
        note={globalSearch && items.length >= SEARCH_LIMIT ? t('files.search.limited', 'showing the first {{count}}', { count: SEARCH_LIMIT }) : clipboard ? t('files.cut.status', '{{count}} items cut', { count: clipboard.items.length }) : null}
        view={view}
        onView={setView}
      />

      <input ref={fileInput} type="file" multiple hidden onChange={onFilesChosen} />

      {menu && menuData ? (
        <ContextMenu
          anchor={menu.anchor}
          entries={menuData.entries}
          label={menuData.label}
          title={menuData.title}
          trigger={menu.trigger}
          focusFirst={menu.focusFirst}
          onClose={closeMenu}
        />
      ) : null}

      {dialog?.type === 'new-folder' ? (
        <NameDialog
          title={t('files.folder.new_title', 'New folder')}
          description={currentFolder ? t('files.folder.new_in', 'Inside “{{folder}}”', { folder: currentFolder.name }) : t('files.folder.new_root', 'At the top level')}
          label={t('files.folder.name', 'Folder name')}
          confirmLabel={t('files.create', 'Create')}
          icon={<FolderPlusIcon size={18} weight="duotone" />}
          onSubmit={createFolderNamed}
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
          onSubmit={(name) => renameFromDialog(dialog.item, name)}
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

      {dialog?.type === 'properties' ? <PropertiesDialog subject={dialog.subject} rows={dialog.rows} onClose={closeDialog} /> : null}

      {preview ? (
        <PreviewDialog
          file={preview}
          files={previewFiles}
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

function StateCard({ icon, illustration = false, title, text, action, tone = 'default' }: { icon?: ReactNode; illustration?: boolean; title: string; text?: string; action?: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div className="fx-state">
      <div className="fx-state__card">
        {illustration ? (
          <span className="fx-state__art" aria-hidden="true">
            <ItemGlyph kind="folder" size={96} />
          </span>
        ) : (
          <span className={cn('mx-auto grid h-14 w-14 place-items-center rounded-[16px]', tone === 'error' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
            {icon}
          </span>
        )}
        <p className="mt-4 text-[16px] font-bold text-[var(--foreground)]">{title}</p>
        {text ? <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{text}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}

function LoadingSkeleton({ view }: { view: ViewMode }) {
  if (view === 'details') {
    return (
      <div className="fx-skeleton flex flex-col gap-1 px-2 pt-2" aria-busy="true">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-1.5">
            <Skeleton className="h-5 w-5" rounded="sm" />
            <Skeleton className="h-3 flex-1" rounded="full" />
            <Skeleton className="hidden h-3 w-28 sm:block" rounded="full" />
            <Skeleton className="hidden h-3 w-20 sm:block" rounded="full" />
            <Skeleton className="hidden h-3 w-14 sm:block" rounded="full" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={cn('fx-skeleton fx-items', `fx-items--${view}`)} aria-busy="true">
      {Array.from({ length: 14 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-2 p-2">
          <Skeleton className={view === 'large' ? 'h-[64px] w-[64px]' : 'h-[38px] w-[38px]'} rounded="lg" />
          <Skeleton className="h-2.5 w-3/4" rounded="full" />
        </div>
      ))}
    </div>
  )
}
