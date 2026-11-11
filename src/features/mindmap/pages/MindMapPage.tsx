import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowClockwiseIcon, CloudArrowUpIcon, CloudCheckIcon, FileArrowUpIcon, ListIcon, PlusIcon, TreeStructureIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { Dialog } from '../../../shared/ui/dialog'
import { MapList } from '../components/MapList'
import { MindMapEditor } from '../components/MindMapEditor'
import { createApiStore, errorStatus, hasLocalMaps, isConflict, migrateLocalMaps, summarize, type StoreError } from '../lib/store'
import { createMap, importMap } from '../lib/tree'
import type { MindMap, MindMapSummary } from '../lib/types'

const LIST_HIDDEN_KEY = 'cims.mindmap.list-hidden'

function readListHidden() {
  try { return localStorage.getItem(LIST_HIDDEN_KEY) === '1' } catch { return false }
}

/** First validation message of a 400 (`detail.errors`) or 422 (`detail[]`), if any. */
function validationMessage(error: unknown) {
  const details = (error as StoreError | null)?.details as { detail?: unknown } | null | undefined
  const detail = details?.detail
  const first = Array.isArray(detail) ? detail[0] : (detail as { errors?: unknown[] } | undefined)?.errors?.[0]
  if (!first) return ''
  if (typeof first === 'string') return first
  const item = first as { msg?: unknown; message?: unknown; loc?: unknown }
  return String(item.msg ?? item.message ?? '')
}

/** Mind maps (stored on the server): list on the left, editor (toolbar · canvas · node panel) on the right. */
export function MindMapPage() {
  const { t } = useLocale()
  const { user, can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [store] = useState(createApiStore)
  const canCreate = can('mind_map', 'create')
  const canEdit = can('mind_map', 'edit')
  const canDelete = can('mind_map', 'delete')
  const canExport = can('mind_map', 'export')
  const userId = user?.id ?? null
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('map')
  // setSearchParams changes identity with every URL change; the list must not reload because of that.
  const setParamsRef = useRef(setSearchParams)
  useEffect(() => { setParamsRef.current = setSearchParams }, [setSearchParams])
  const [maps, setMaps] = useState<MindMapSummary[] | null>(null)
  const [listError, setListError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [active, setActive] = useState<{ map: MindMap; fresh: boolean; epoch: number } | null>(null)
  const activeRef = useRef<string | null>(null)
  const [missingId, setMissingId] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ id: string; title: string } | null>(null)
  const [resolving, setResolving] = useState(false)
  const lastAttempt = useRef(new Map<string, MindMap>())
  const lastToast = useRef({ key: '', at: 0 })
  const [listHidden, setListHidden] = useState(readListHidden)
  const [mobileListOpen, setMobileListOpen] = useState(false)

  /** The same error toast at most once per 15 s (autosave would repeat it on every edit). */
  const notify = useCallback((key: string, title: string, description?: string) => {
    const now = Date.now()
    if (lastToast.current.key === key && now - lastToast.current.at < 15000) return
    lastToast.current = { key, at: now }
    showToast({ title, description, tone: 'error' })
  }, [showToast])

  const failure = useCallback((error: unknown, fallback: string) => {
    const status = errorStatus(error)
    if (status === 413) return { key: 'too_large', title: t('mindmap.error.too_large', 'The mind map is too big (over 1 MB)') }
    if (status === 400 || status === 422) return { key: 'invalid', title: t('mindmap.error.invalid', 'The mind map has invalid data'), description: validationMessage(error) || undefined }
    if (status === 403) return { key: 'forbidden', title: t('mindmap.error.forbidden', 'You do not have permission for this') }
    if (status === 404) return { key: 'missing', title: t('mindmap.empty.missing', 'This mind map was not found') }
    return { key: fallback, title: fallback }
  }, [t])

  // Old maps from this browser go to the server first (once), then the list loads.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (userId !== null && canCreate && hasLocalMaps(userId)) {
          const { moved, failed } = await migrateLocalMaps(userId, store)
          if (!alive) return
          if (moved.size) {
            showToast({ title: t('mindmap.migrated', '{{count}} mind maps moved to the server', { count: moved.size }), description: t('mindmap.migrated_text', 'They are now available on every device.'), tone: 'success' })
            // A link to an old local map opens its server copy.
            setParamsRef.current((previous) => {
              const next = moved.get(previous.get('map') ?? '')
              return next ? { map: next } : previous
            }, { replace: true })
          }
          if (failed) showToast({ title: t('mindmap.migrate_failed', '{{count}} mind maps could not be moved — they stay in this browser', { count: failed }), tone: 'error' })
        }
        const list = await store.list()
        if (!alive) return
        setMaps(list)
        setListError(false)
      } catch {
        if (alive) setListError(true)
      }
    })()
    return () => { alive = false }
  }, [canCreate, reloadKey, showToast, store, t, userId])

  // Nothing chosen yet → open the most recent map.
  useEffect(() => {
    if (!maps || activeId || maps.length === 0) return
    setSearchParams({ map: maps[0].id }, { replace: true })
  }, [activeId, maps, setSearchParams])

  useEffect(() => {
    if (!activeId || activeRef.current === activeId) return
    let alive = true
    store.get(activeId).then((map) => {
      if (!alive) return
      if (!map) { setMissingId(activeId); return }
      activeRef.current = map.id
      setActive({ map, fresh: false, epoch: 0 })
      setMissingId(null)
    }).catch((error: unknown) => {
      if (!alive) return
      setMissingId(activeId)
      const problem = failure(error, t('mindmap.load_failed', 'Could not load the mind map'))
      notify(problem.key, problem.title, problem.description)
    })
    return () => { alive = false }
  }, [activeId, failure, notify, store, t])

  useEffect(() => {
    try { localStorage.setItem(LIST_HIDDEN_KEY, listHidden ? '1' : '0') } catch { /* private mode */ }
  }, [listHidden])

  const open = useCallback((id: string) => {
    setMobileListOpen(false)
    setSearchParams({ map: id })
  }, [setSearchParams])

  function show(map: MindMap, fresh = false) {
    activeRef.current = map.id
    setActive((previous) => ({ map, fresh, epoch: (previous?.epoch ?? 0) + 1 }))
    setMissingId(null)
  }

  const upsertSummary = useCallback((map: MindMap) => {
    setMaps((list) => [summarize(map), ...(list ?? []).filter((item) => item.id !== map.id)])
  }, [])

  const onSave = useCallback(async (map: MindMap) => {
    lastAttempt.current.set(map.id, map)
    try {
      const saved = await store.save(map)
      upsertSummary(saved)
      return saved
    } catch (error) {
      if (isConflict(error)) setConflict({ id: map.id, title: map.title })
      else {
        const problem = failure(error, t('mindmap.save_failed', 'Could not save the mind map'))
        notify(problem.key, problem.title, problem.description)
      }
      // The editor shows "Not saved"; the message is already on screen.
      throw Object.assign(new Error('not saved'), { handled: true })
    }
  }, [failure, notify, store, t, upsertSummary])

  /** Conflict → take the server copy (this tab's unsaved edits are dropped). */
  function loadServerCopy() {
    if (!conflict) return
    const resolved = store.resolveConflict(conflict.id)
    setConflict(null)
    if (!resolved) return
    show(resolved.current)
    upsertSummary(resolved.current)
  }

  /** Conflict → save this tab's version over the server copy (on purpose, with the server's version). */
  async function keepMine() {
    if (!conflict) return
    const id = conflict.id
    store.resolveConflict(id)
    const latest = lastAttempt.current.get(id)
    setResolving(true)
    try {
      if (!latest) return
      const saved = await store.save(latest)
      show(saved)
      upsertSummary(saved)
      setConflict(null)
      showToast({ title: t('mindmap.saved', 'Saved'), tone: 'success' })
    } catch (error) {
      if (!isConflict(error)) {
        setConflict(null)
        const problem = failure(error, t('mindmap.save_failed', 'Could not save the mind map'))
        notify(problem.key, problem.title, problem.description)
      }
    } finally {
      setResolving(false)
    }
  }

  async function create() {
    if (!canCreate) return
    try {
      const map = await store.create(createMap(t('mindmap.untitled', 'New mind map')))
      upsertSummary(map)
      show(map, true)
      open(map.id)
    } catch (error) {
      const problem = failure(error, t('mindmap.create_failed', 'Could not create the mind map'))
      notify(problem.key, problem.title, problem.description)
    }
  }

  async function importFile(file: File) {
    if (!canCreate) return
    let parsed: MindMap | null = null
    try { parsed = importMap(JSON.parse(await file.text())) } catch { parsed = null }
    if (!parsed) {
      showToast({ title: t('mindmap.import_failed', 'This file is not a mind map export'), tone: 'error' })
      return
    }
    try {
      const map = await store.create(parsed)
      upsertSummary(map)
      show(map)
      open(map.id)
      showToast({ title: t('mindmap.imported', 'Mind map imported'), description: map.title, tone: 'success' })
    } catch (error) {
      const problem = failure(error, t('mindmap.create_failed', 'Could not create the mind map'))
      notify(problem.key, problem.title, problem.description)
    }
  }

  async function confirmRemove(id: string) {
    const title = (maps ?? []).find((item) => item.id === id)?.title ?? ''
    const ok = await confirm({
      title: t('mindmap.delete_title', 'Delete “{{title}}”?', { title }),
      description: t('mindmap.delete_text', 'The mind map and all its nodes are deleted. This cannot be undone.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok) await remove(id)
  }

  async function remove(id: string) {
    try {
      await store.remove(id)
    } catch (error) {
      // Already gone on the server — drop it here too.
      if (errorStatus(error) !== 404) {
        const problem = failure(error, t('mindmap.delete_failed', 'Could not delete the mind map'))
        notify(problem.key, problem.title, problem.description)
        return
      }
    }
    const rest = (maps ?? []).filter((item) => item.id !== id)
    setMaps(rest)
    if (id === activeId) {
      activeRef.current = null
      setActive(null)
      setSearchParams(rest[0] ? { map: rest[0].id } : {}, { replace: true })
    }
    showToast({ title: t('mindmap.deleted', 'Mind map deleted'), tone: 'success' })
  }

  const list = (
    <MapList
      maps={maps}
      activeId={activeId}
      onOpen={open}
      canCreate={canCreate}
      canDelete={canDelete}
      onCreate={() => void create()}
      onDelete={(id) => void confirmRemove(id)}
      onImport={(file) => void importFile(file)}
      onCollapse={() => { setListHidden(true); setMobileListOpen(false) }}
    />
  )
  const current = active && active.map.id === activeId ? active : null

  return (
    <section className="relative flex h-[calc(100dvh-var(--header-h)-44px)] min-h-[560px] gap-3">
      {!listHidden ? (
        <aside className="hidden w-[220px] shrink-0 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] lg:block">{list}</aside>
      ) : null}
      {mobileListOpen ? (
        <>
          <button type="button" aria-label={t('common.close', 'Close')} onClick={() => setMobileListOpen(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />
          <aside className="absolute inset-y-0 left-0 z-40 w-[260px] overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] shadow-2xl lg:hidden">{list}</aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <button
          type="button"
          onClick={() => { setListHidden(false); setMobileListOpen(true) }}
          className={cn(
            'inline-flex h-[34px] w-fit items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[12.5px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]',
            listHidden ? 'flex' : 'lg:hidden',
          )}
        >
          <ListIcon size={15} />
          {t('mindmap.list.show', 'Mind maps')}
          {maps ? <span className="rounded-full bg-[var(--muted-surface)] px-1.5 text-[11px] tabular-nums">{maps.length}</span> : null}
        </button>

        {current ? (
          <div className="min-h-0 flex-1">
            <MindMapEditor
              key={`${current.map.id}:${current.epoch}`}
              initial={current.map}
              autoEditRoot={current.fresh && canEdit}
              canCreateTask={canEdit && can('projects', 'create')}
              readOnly={!canEdit}
              canExport={canExport}
              canDelete={canDelete}
              onSave={onSave}
              onDelete={() => void remove(current.map.id)}
            />
          </div>
        ) : listError ? (
          <div className="grid min-h-0 flex-1 place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] p-6">
            <div className="mm-pop max-w-sm text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--danger-dim)] text-[var(--danger-text)]">
                <WarningCircleIcon size={28} weight="duotone" />
              </span>
              <p className="mt-4 text-[17px] font-bold text-[var(--foreground)]">{t('mindmap.list_failed', 'Could not load mind maps')}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{t('mindmap.list_failed_text', 'Check the connection and try again.')}</p>
              <button type="button" onClick={() => { setListError(false); setMaps(null); setReloadKey((key) => key + 1) }} className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:brightness-110">
                <ArrowClockwiseIcon size={15} weight="bold" />
                {t('mindmap.retry', 'Try again')}
              </button>
            </div>
          </div>
        ) : maps !== null && (maps.length === 0 || (activeId && missingId === activeId)) ? (
          <div className="grid min-h-0 flex-1 place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] p-6">
            <div className="mm-pop max-w-sm text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--blue-dim)] text-[var(--primary)]">
                <TreeStructureIcon size={28} weight="duotone" />
              </span>
              <p className="mt-4 text-[17px] font-bold text-[var(--foreground)]">
                {maps.length === 0 ? t('mindmap.empty.title', 'Your first mind map') : t('mindmap.empty.missing', 'This mind map was not found')}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
                {t('mindmap.empty.text', 'Put the main topic in the centre and branch out ideas, tasks and links. Any node can become a project task.')}
              </p>
              {canCreate ? <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => void create()} className="inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:brightness-110">
                  <PlusIcon size={15} weight="bold" />
                  {t('mindmap.list.new', 'New mind map')}
                </button>
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[11px] border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]">
                  <FileArrowUpIcon size={15} />
                  {t('mindmap.list.import', 'Import from JSON')}
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} />
                </label>
              </div> : null}
            </div>
          </div>
        ) : (
          <span className="skeleton block min-h-0 flex-1 rounded-[18px]" />
        )}
      </div>

      <Dialog
        open={conflict !== null}
        onClose={() => { if (!resolving) loadServerCopy() }}
        title={t('mindmap.conflict.title', 'This mind map was changed elsewhere')}
        description={t('mindmap.conflict.text', '“{{title}}” was saved in another tab or on another device. Which version do you keep?', { title: conflict?.title ?? '' })}
        headerIcon={<WarningCircleIcon size={20} weight="duotone" />}
      >
        <div className="grid gap-2">
          <button
            type="button"
            disabled={resolving}
            onClick={loadServerCopy}
            className="flex items-start gap-3 rounded-[12px] border border-[var(--border)] px-3.5 py-3 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--blue-dim)] disabled:opacity-50"
          >
            <CloudCheckIcon size={20} weight="duotone" className="mt-0.5 shrink-0 text-[var(--primary)]" />
            <span>
              <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{t('mindmap.conflict.server', 'Load the saved version')}</span>
              <span className="block text-[12px] text-[var(--muted)]">{t('mindmap.conflict.server_hint', 'Changes made here that were not saved are dropped.')}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void keepMine()}
            className="flex items-start gap-3 rounded-[12px] border border-[var(--border)] px-3.5 py-3 text-left transition-colors hover:border-[var(--warning-text)] hover:bg-[var(--warning-dim)] disabled:opacity-50"
          >
            <CloudArrowUpIcon size={20} weight="duotone" className="mt-0.5 shrink-0 text-[var(--warning-text)]" />
            <span>
              <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{t('mindmap.conflict.mine', 'Keep my version')}</span>
              <span className="block text-[12px] text-[var(--muted)]">{t('mindmap.conflict.mine_hint', 'The saved version is replaced with what you see here.')}</span>
            </span>
          </button>
        </div>
      </Dialog>
    </section>
  )
}
