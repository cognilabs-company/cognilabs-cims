import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileArrowUpIcon, ListIcon, PlusIcon, TreeStructureIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { MapList } from '../components/MapList'
import { MindMapEditor } from '../components/MindMapEditor'
import { createLocalStore, summarize } from '../lib/store'
import { createMap, importMap } from '../lib/tree'
import type { MindMap, MindMapSummary } from '../lib/types'

const LIST_HIDDEN_KEY = 'cims.mindmap.list-hidden'

function readListHidden() {
  try { return localStorage.getItem(LIST_HIDDEN_KEY) === '1' } catch { return false }
}

/** Mind maps: list on the left, editor (toolbar · canvas · node panel) on the right. */
export function MindMapPage() {
  const { t } = useLocale()
  const { user, can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const store = useMemo(() => createLocalStore(user?.id ?? 'guest'), [user?.id])
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('map')
  const [maps, setMaps] = useState<MindMapSummary[] | null>(null)
  const [active, setActive] = useState<{ map: MindMap; fresh: boolean } | null>(null)
  const [listHidden, setListHidden] = useState(readListHidden)
  const [mobileListOpen, setMobileListOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void store.list().then((list) => { if (alive) setMaps(list) })
    return () => { alive = false }
  }, [store])

  // Nothing chosen yet → open the most recent map.
  useEffect(() => {
    if (!maps || activeId || maps.length === 0) return
    setSearchParams({ map: maps[0].id }, { replace: true })
  }, [activeId, maps, setSearchParams])

  useEffect(() => {
    if (!activeId) return
    let alive = true
    void store.get(activeId).then((map) => {
      if (!alive) return
      setActive((previous) => (previous?.map.id === activeId ? previous : map ? { map, fresh: false } : null))
    })
    return () => { alive = false }
  }, [activeId, store])

  useEffect(() => {
    try { localStorage.setItem(LIST_HIDDEN_KEY, listHidden ? '1' : '0') } catch { /* private mode */ }
  }, [listHidden])

  const open = useCallback((id: string) => {
    setMobileListOpen(false)
    setSearchParams({ map: id })
  }, [setSearchParams])

  const onSave = useCallback(async (map: MindMap) => {
    const saved = await store.save(map)
    setMaps((list) => [summarize(saved), ...(list ?? []).filter((item) => item.id !== saved.id)])
    return saved
  }, [store])

  async function create() {
    const map = await store.save(createMap(t('mindmap.untitled', 'New mind map')))
    setMaps((list) => [summarize(map), ...(list ?? [])])
    setActive({ map, fresh: true })
    open(map.id)
  }

  async function importFile(file: File) {
    try {
      const parsed = importMap(JSON.parse(await file.text()))
      if (!parsed) throw new Error('format')
      const map = await store.save(parsed)
      setMaps((list) => [summarize(map), ...(list ?? [])])
      setActive({ map, fresh: false })
      open(map.id)
      showToast({ title: t('mindmap.imported', 'Mind map imported'), description: map.title, tone: 'success' })
    } catch {
      showToast({ title: t('mindmap.import_failed', 'This file is not a mind map export'), tone: 'error' })
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
    await store.remove(id)
    const rest = (maps ?? []).filter((item) => item.id !== id)
    setMaps(rest)
    if (id === activeId) {
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
              key={current.map.id}
              initial={current.map}
              autoEditRoot={current.fresh}
              canCreateTask={can('projects', 'create')}
              onSave={onSave}
              onDelete={() => void remove(current.map.id)}
            />
          </div>
        ) : maps !== null && (maps.length === 0 || (activeId && !active)) ? (
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
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => void create()} className="inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white hover:brightness-110">
                  <PlusIcon size={15} weight="bold" />
                  {t('mindmap.list.new', 'New mind map')}
                </button>
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[11px] border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--input-surface)]">
                  <FileArrowUpIcon size={15} />
                  {t('mindmap.list.import', 'Import from JSON')}
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <span className="skeleton block min-h-0 flex-1 rounded-[18px]" />
        )}
      </div>
    </section>
  )
}
